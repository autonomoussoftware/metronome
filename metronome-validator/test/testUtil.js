const ethjsABI = require('ethjs-abi')
const MerkleTreeJs = require('merkletreejs')
const crypto = require('crypto')
const reader = require('../lib/file-reader')
const parser = require('../lib/parser')
const Chain = require('../lib/chain')

// create contract object from abi
function initContracts () {
  return new Promise(async (resolve, reject) => {
    let ethChain, etcChain, ethBuyer, etcBuyer

    let configuration = reader.readFileAsJson('./config.json')
    configuration.eth.password = ''
    configuration.etc.password = ''

    let metronome = reader.readMetronome()
    let metronomeContracts = parser.parseMetronome(metronome)

    // create chain object to get contracts
    ethChain = new Chain(configuration.eth, metronomeContracts.eth)
    etcChain = new Chain(configuration.etc, metronomeContracts.etc)

    // ETH setup and init
    ethBuyer = setupAccount(ethChain.web3)
    configureChain(ethChain, etcChain)

    // ETC setup and init
    etcBuyer = setupAccount(etcChain.web3)
    configureChain(etcChain, ethChain)

    resolve({
      ethChain: ethChain,
      ethBuyer: ethBuyer,
      etcChain: etcChain,
      etcBuyer: etcBuyer
    })
  })
}

// Create account and send some ether in it
function setupAccount (web3) {
  let user = web3.personal.newAccount('password')
  web3.personal.unlockAccount(web3.eth.accounts[0], '')
  web3.eth.sendTransaction({to: user, from: web3.eth.accounts[0], value: 2e18})
  return user
}

// Configure chain: Add destination chain and add validators
function configureChain (chain, destChain) {
  let destinationChain = chain.contracts.tokenPorter.destinationChains(destChain.name)
  console.log('destinationChain=', destinationChain)
  if (destinationChain === '0x0000000000000000000000000000000000000000') {
    let owner = chain.contracts.tokenPorter.owner()
    var destTokanAddress = destChain.contracts.metToken.address
    chain.contracts.tokenPorter.addDestinationChain(destChain.name, destTokanAddress, {from: owner})
  }
  
}

// Prepare import data using export receipt
async function prepareImportData (chain, receipt) {
  let burnHashes = []
  let i = 0
  let decoder = ethjsABI.logDecoder(chain.contracts.tokenPorter.abi)
  let logExportReceipt = decoder(receipt.logs)[0]

  if (logExportReceipt.burnSequence > 15) {
    i = logExportReceipt.burnSequence - 15
  }

  while (i <= logExportReceipt.burnSequence) {
    burnHashes.push(await chain.contracts.tokenPorter.exportedBurns(i))
    i++
  }

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
      logExportReceipt.genesisTime,
      logExportReceipt.dailyMintable,
      logExportReceipt.burnSequence,
      logExportReceipt.dailyAuctionStartTime
    ],
    root: getMerkleRoot(burnHashes),
    extraData: logExportReceipt.extraData,
    supplyOnAllChains: logExportReceipt.supplyOnAllChains,
    destinationChain: logExportReceipt.destinationChain
  }
}

// Calculate merkle root for given hashes
function getMerkleRoot (hashes) {
  const leaves = hashes.map(x => Buffer.from(x.slice(2), 'hex'))
  const tree = new MerkleTreeJs(leaves, (data) => {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest()
  })
  return '0x' + tree.getRoot().toString('hex')
}

module.exports = {initContracts, prepareImportData}
