const ethjsABI = require('ethjs-abi')
const MerkleTreeJs = require('merkletreejs')
const assert = require('chai').assert
const BN = require('bn.js')
const crypto = require('crypto')
const TestRPCTime = require('./time')

const MILLISECS_IN_A_SEC = 1000
const SECS_IN_DAY = 86400

function sha256 (data) {
  // returns Buffer
  return crypto
    .createHash('sha256')
    .update(data)
    .digest()
}

async function prepareImportData (sourceContracts, tx) {
  let tokenPorter = sourceContracts.tokenPorter
  const decoder = ethjsABI.logDecoder(tokenPorter.abi)
  const logExportReceipt = decoder(tx.receipt.logs)[0]
  var burnHashes = []
  var i = 0
  if (logExportReceipt.burnSequence > 16) {
    i = logExportReceipt.burnSequence - 15
  }
  while (i <= logExportReceipt.burnSequence) {
    burnHashes.push(await tokenPorter.exportedBurns(i))
    i++
  }
  const leaves = burnHashes.map(x => Buffer.from(x.slice(2), 'hex'))

  const tree = new MerkleTreeJs(leaves, sha256)
  var buffer = tree.getProof(leaves[leaves.length - 1])
  let merkleProof = []
  for (let i = 0; i < buffer.length; i++) {
    merkleProof.push('0x' + buffer[i].data.toString('hex'))
  }
  let genesisTime = new BN((await sourceContracts.auctions.genesisTime()).valueOf(), 10)
  let dailyAuctionStartTime = new BN((await sourceContracts.auctions.dailyAuctionStartTime()).valueOf(), 10)
  return {
    addresses: [
      logExportReceipt.destinationMetronomeAddr,
      logExportReceipt.destinationRecipientAddr
    ],
    burnHashes: [
      logExportReceipt.prevBurnHash,
      logExportReceipt.currentBurnHash
    ],
    importData: [
      logExportReceipt.blockTimestamp,
      logExportReceipt.amountToBurn,
      logExportReceipt.fee,
      logExportReceipt.currentTick,
      genesisTime,
      logExportReceipt.dailyMintable,
      logExportReceipt.burnSequence,
      dailyAuctionStartTime
    ],
    merkelProof: merkleProof,
    root: '0x' + tree.getRoot().toString('hex'),
    extraData: logExportReceipt.extraData,
    supplyOnAllChains: logExportReceipt.supplyOnAllChains,
    destinationChain: logExportReceipt.destinationChain
  }
}

function roundToNextMidnight (t) {
  // round to prev midnight, then add a day
  const nextMidnight = t - (t % SECS_IN_DAY) + SECS_IN_DAY
  assert(
    new Date(nextMidnight * MILLISECS_IN_A_SEC)
      .toUTCString()
      .indexOf('00:00:00') >= 0,
    'timestamp is not midnight'
  )
  return nextMidnight
}

async function secondsToNextMidnight () {
  const currentTime = await TestRPCTime.getCurrentBlockTime()
  const nextMidnight = roundToNextMidnight(currentTime)
  return nextMidnight - currentTime
}

async function importExport (
  sourceChain,
  sourceContracts,
  destContracts,
  amountToExport,
  fee,
  exporter,
  beneficiary,
  validator1,
  validator2
) {
  const expectedExtraData = 'extra data'
  var destChain = 'ETC'
  if (sourceChain === 'ETC') {
    destChain = 'ETH'
  }
  let tx = await sourceContracts.metToken.export(
    web3.fromAscii(destChain),
    destContracts.metToken.address,
    beneficiary,
    amountToExport,
    fee,
    web3.fromAscii(expectedExtraData),
    { from: exporter }
  )
  let importDataObj = await prepareImportData(sourceContracts, tx)
  let balanceBeforeImport = await destContracts.metToken.balanceOf(
    importDataObj.addresses[1]
  )
  await destContracts.metToken.importMET(
    web3.fromAscii(sourceChain),
    importDataObj.destinationChain,
    importDataObj.addresses,
    importDataObj.extraData,
    importDataObj.burnHashes,
    importDataObj.supplyOnAllChains,
    importDataObj.importData,
    importDataObj.root
  )

  // Before Minting
  var totalSupplyBefore = await destContracts.metToken.totalSupply()

  // let signature = web3.eth.sign(validator1, importDataObj.burnHashes[1])
  let totalSupplyInSourceChain = (await sourceContracts.metToken.totalSupply()).toNumber()
  await destContracts.validator.attestHash(
    importDataObj.burnHashes[1],
    web3.fromAscii(sourceChain),
    importDataObj.addresses[1],
    parseInt(importDataObj.importData[1]),
    parseInt(importDataObj.importData[2]),
    importDataObj.merkelProof,
    importDataObj.extraData,
    totalSupplyInSourceChain,
    { from: validator1 }
  )
  // signature = web3.eth.sign(validator2, importDataObj.burnHashes[1])
  await destContracts.validator.attestHash(
    importDataObj.burnHashes[1],
    web3.fromAscii(sourceChain),
    importDataObj.addresses[1],
    parseInt(importDataObj.importData[1]),
    parseInt(importDataObj.importData[2]),
    importDataObj.merkelProof,
    importDataObj.extraData,
    totalSupplyInSourceChain,
    { from: validator2 }
  )
  // After minting
  let globalSupplyETH = await sourceContracts.auctions.globalMetSupply()
  let globalSupplyETC = await destContracts.auctions.globalMetSupply()
  assert.equal(
    globalSupplyETC.toNumber(),
    globalSupplyETH.toNumber(),
    'Global supply in two chain is not correct'
  )
  let balanceAfterImport = await destContracts.metToken.balanceOf(
    importDataObj.addresses[1]
  )
  assert.equal(
    balanceAfterImport.sub(balanceBeforeImport).valueOf(),
    amountToExport
  )

  let totalSupplyAfter = await destContracts.metToken.totalSupply()
  assert.equal(
    totalSupplyAfter.sub(totalSupplyBefore).valueOf(),
    amountToExport + fee,
    'Total supply after import is not correct'
  )
  globalSupplyETH = await sourceContracts.auctions.globalMetSupply()
  globalSupplyETC = await destContracts.auctions.globalMetSupply()
  assert.equal(
    globalSupplyETC.valueOf(),
    globalSupplyETH.valueOf(),
    'Global supply in two chain is not correct'
  )
  return true
}

module.exports = { secondsToNextMidnight, prepareImportData, importExport }
