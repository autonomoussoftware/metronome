/*
    The MIT License (MIT)

    Copyright 2017 - 2018, Alchemy Limited, LLC.

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be included
    in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
    IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
    CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
    TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
    SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const assert = require('chai').assert
const ethjsABI = require('ethjs-abi')
const _ = require('lodash')
const fs = require('fs')
const Parser = require('../lib/parser')
const Chain = require('../lib/chain')
const MerkleTreeJs = require('merkletreejs')
const crypto = require('crypto')
var ethBuyer1
var etcBuyer1
var eth
var etc

const initContracts = function () {
  return new Promise(async (resolve, reject) => {
    let config = fs.readFileSync('./config.json').toString()
    let chainPath = './abi/'
    let fileName = '/metronome.js'
    let metronome = {}
    let supportedChains = fs.readdirSync(chainPath)
    for (let i = 0; i < supportedChains.length; i++) {
      metronome[supportedChains[i]] = fs.readFileSync(chainPath + supportedChains[i] + fileName).toString()
    }
    let configuration = Parser.parseConfig(config)
    let metronomeContracts = Parser.parseMetronome(metronome)
    // create validator object
    eth = new Chain(configuration.eth, metronomeContracts.eth)
    etc = new Chain(configuration.etc, metronomeContracts.etc)
    ethBuyer1 = eth.web3.personal.newAccount('password')
    etcBuyer1 = etc.web3.personal.newAccount('password')
    // Send some ether for gas cost and MET
    await eth.web3.personal.unlockAccount(eth.web3.eth.accounts[0], '')
    await etc.web3.personal.unlockAccount(etc.web3.eth.accounts[0], '')

    await eth.web3.eth.sendTransaction({to: ethBuyer1, from: eth.web3.eth.accounts[0], value: 2e18})
    await etc.web3.eth.sendTransaction({to: etcBuyer1, from: etc.web3.eth.accounts[0], value: 2e18})

    let owner = await eth.contracts.tokenPorter.owner()
    await eth.web3.personal.unlockAccount(owner, 'newOwner')
    var tokenAddress = etc.contracts.metToken.address
    await eth.contracts.tokenPorter.addDestinationChain('ETC', tokenAddress, {from: owner})
    await eth.contracts.validator.addValidator(eth.web3.eth.accounts[0], {from: owner})

    owner = await etc.contracts.tokenPorter.owner()
    await etc.web3.personal.unlockAccount(owner, 'newOwner')
    tokenAddress = await eth.contracts.metToken.address
    await etc.contracts.tokenPorter.addDestinationChain('ETH', tokenAddress, {from: owner})
    await etc.contracts.validator.addValidator(etc.web3.eth.accounts[0], {from: owner})
    resolve()
  })
}

function sha256 (data) {
  // returns Buffer
  return crypto.createHash('sha256').update(data).digest()
}

const getDataForImport = _.memoize(function () {
  return fs.readFileSync('import-data.json').toString()
})

async function prepareImportData (sourceChain, logExportReceipt) {
  let burnHashes = []
  let i = 0
  if (logExportReceipt.burnSequence > 15) {
    i = logExportReceipt.burnSequence - 15
  }
  while (i <= logExportReceipt.burnSequence) {
    burnHashes.push(await sourceChain.contracts.tokenPorter.exportedBurns(i))
    i++
  }
  const leaves = burnHashes.map(x => Buffer.from(x.slice(2), 'hex'))

  const tree = new MerkleTreeJs(leaves, sha256)
  let buffer = tree.getProof(leaves[leaves.length - 1])
  let merkleProof = []
  for (let i = 0; i < buffer.length; i++) {
    merkleProof.push('0x' + ((buffer[i].data).toString('hex')))
  }
  return {
    addresses: [logExportReceipt.destinationMetronomeAddr, logExportReceipt.destinationRecipientAddr],
    burnHashes: [logExportReceipt.prevBurnHash, logExportReceipt.currentBurnHash],
    importData: [logExportReceipt.blockTimestamp, logExportReceipt.amountToBurn, logExportReceipt.fee,
      logExportReceipt.currentTick, logExportReceipt.genesisTime, logExportReceipt.dailyMintable,
      logExportReceipt.burnSequence, logExportReceipt.dailyAuctionStartTime],
    merkelProof: merkleProof,
    root: '0x' + (tree.getRoot()).toString('hex'),
    extraData: logExportReceipt.extraData
  }
}

before(async () => {
  await initContracts()
})

describe('cross chain testing', () => {
  it('Export test 1. ETH to ETC', () => {
    return new Promise(async (resolve, reject) => {
      eth.web3.personal.unlockAccount(ethBuyer1, 'password')
      etc.web3.personal.unlockAccount(etcBuyer1, 'password')
      // Buy some MET
      await eth.web3.eth.sendTransaction({to: eth.contracts.auctions.address, from: ethBuyer1, value: 2e16})
      let metBalance = (eth.contracts.metToken.balanceOf(ethBuyer1))
      assert(metBalance > 0, 'Exporter has no MET token balance')
      let fee = Math.floor(metBalance.div(2))
      let amount = metBalance.sub(fee)
      assert(metBalance, amount.add(fee), 'Total of amount and fee should be equal to metBalance')
      let extraData = 'D'
      let totalSupplybefore = await eth.contracts.metToken.totalSupply()
      let tx = await eth.contracts.metToken.export(
        eth.web3.fromAscii('ETC'),
        etc.contracts.metToken.address,
        etcBuyer1,
        amount.valueOf(),
        fee.valueOf(),
        eth.web3.fromAscii(extraData),
        { from: ethBuyer1 })
      let totalSupplyAfter = eth.contracts.metToken.totalSupply()
      let receipt = eth.web3.eth.getTransactionReceipt(tx)
      let decoder = ethjsABI.logDecoder(eth.contracts.tokenPorter.abi)
      let logExportReceipt = decoder(receipt.logs)[0]
      assert(totalSupplybefore.sub(totalSupplyAfter), amount.add(fee), 'Export from ETH failed')
      let importDataObj = await prepareImportData(eth, logExportReceipt)
      let expectedTotalSupply = etc.contracts.metToken.totalSupply().add(amount).add(fee)
      let expectedBalanceOfRecepient = etc.contracts.metToken.balanceOf(etcBuyer1).add(amount)
      let balanceOfValidatorBefore = etc.contracts.metToken.balanceOf(etc.configuration.address)
      tx = await etc.contracts.metToken.importMET(etc.web3.fromAscii('ETH'), logExportReceipt.destinationChain, importDataObj.addresses, logExportReceipt.extraData,
        importDataObj.burnHashes, logExportReceipt.supplyOnAllChains, importDataObj.importData, importDataObj.root, {from: etcBuyer1})
      let filter = etc.contracts.tokenPorter.LogImport().watch((err, response) => {
        if (err) {
          console.log('export error', err)
        } else {
          if (logExportReceipt.currentBurnHash === response.args.currentHash) {
            filter.stopWatching()
            assert.equal((etc.contracts.metToken.totalSupply()).valueOf(), expectedTotalSupply.valueOf(), 'Total supply is wrong after import')
            assert.equal(etc.contracts.metToken.balanceOf(etcBuyer1).valueOf(), expectedBalanceOfRecepient, 'Balance of recepient wrong after import')
            let balanceOfValidatorAfter = etc.contracts.metToken.balanceOf(etc.configuration.address)
            let expectedFee = fee / (etc.contracts.validator.getValidatorsCount())
            assert(balanceOfValidatorAfter - balanceOfValidatorBefore, expectedFee, 'Validator did not get correct export fee')
            resolve()
          }
        }
      })
    })
  })

  it('Export test 2. ETC to ETH', () => {
    return new Promise(async (resolve, reject) => {
      eth.web3.personal.unlockAccount(ethBuyer1, 'password')
      etc.web3.personal.unlockAccount(etcBuyer1, 'password')
      let amount = (etc.contracts.metToken.balanceOf(etcBuyer1))
      assert(amount > 0, 'Exporter has no MET token balance')
      let fee = 3e14
      amount = amount - fee
      let extraData = 'D'
      let totalSupplybefore = await etc.contracts.metToken.totalSupply()
      let tx = await etc.contracts.metToken.export(
        etc.web3.fromAscii('ETH'),
        eth.contracts.metToken.address,
        ethBuyer1,
        amount.valueOf(),
        fee,
        etc.web3.fromAscii(extraData),
        { from: etcBuyer1 })
      let totalSupplyAfter = etc.contracts.metToken.totalSupply()
      let receipt = etc.web3.eth.getTransactionReceipt(tx)
      let decoder = ethjsABI.logDecoder(etc.contracts.tokenPorter.abi)
      let logExportReceipt = decoder(receipt.logs)[0]
      assert(totalSupplybefore.sub(totalSupplyAfter), amount + fee, 'Export from ETH failed')
      let importDataObj = await prepareImportData(etc, logExportReceipt)
      let expectedTotalSupply = eth.contracts.metToken.totalSupply().add(amount).add(fee)
      let expectedBalanceOfRecepient = eth.contracts.metToken.balanceOf(logExportReceipt.destinationRecipientAddr).add(amount)
      let balanceOfValidatorBefore = eth.contracts.metToken.balanceOf(eth.configuration.address)
      tx = await eth.contracts.metToken.importMET(eth.web3.fromAscii('ETC'), logExportReceipt.destinationChain, importDataObj.addresses, logExportReceipt.extraData,
        importDataObj.burnHashes, logExportReceipt.supplyOnAllChains, importDataObj.importData, importDataObj.root, {from: ethBuyer1})
      let filter = eth.contracts.tokenPorter.LogImport().watch((err, response) => {
        if (err) {
          console.log('export error', err)
        } else {
          if (logExportReceipt.currentBurnHash === response.args.currentHash) {
            filter.stopWatching()
            assert.equal(eth.contracts.metToken.totalSupply().valueOf(), expectedTotalSupply, 'Total supply is wrong after import')
            assert.equal(eth.contracts.metToken.balanceOf(logExportReceipt.destinationRecipientAddr).valueOf(), expectedBalanceOfRecepient, 'Balance of recepient wrong after import')
            let balanceOfValidatorAfter = eth.contracts.metToken.balanceOf(eth.configuration.address)
            let expectedFee = fee / (eth.contracts.validator.getValidatorsCount())
            assert(balanceOfValidatorAfter - balanceOfValidatorBefore, expectedFee, 'Validator did not get correct export fee')
            resolve()
          }
        }
      })
    })
  })

  it('ETH to ETC: Fake export receipt, should pass on-chain validation and fail on off-chain validation', () => {
    return new Promise(async (resolve, reject) => {
      eth.web3.personal.unlockAccount(ethBuyer1, 'password')
      etc.web3.personal.unlockAccount(etcBuyer1, 'password')
      // Buy some MET
      await eth.web3.eth.sendTransaction({to: eth.contracts.auctions.address, from: ethBuyer1, value: 2e16})
      let amount = (eth.contracts.metToken.balanceOf(ethBuyer1)).toNumber()
      assert(amount > 0, 'Exporter has no MET token balance')
      let fee = amount / 2
      amount = amount - fee
      let extraData = 'D'
      let totalSupplybefore = await eth.contracts.metToken.totalSupply()
      let tx = await eth.contracts.metToken.export(
        eth.web3.fromAscii('ETC'),
        etc.contracts.metToken.address,
        etcBuyer1,
        amount,
        fee,
        eth.web3.fromAscii(extraData),
        { from: ethBuyer1 })
      let totalSupplyAfter = eth.contracts.metToken.totalSupply()
      let receipt = eth.web3.eth.getTransactionReceipt(tx)
      let decoder = ethjsABI.logDecoder(eth.contracts.tokenPorter.abi)
      let logExportReceipt = decoder(receipt.logs)[0]
      assert(totalSupplybefore.sub(totalSupplyAfter), amount + fee, 'Export from ETH failed')
      // /let importDataObj = await prepareImportData(eth, logExportReceipt)

      const importDataJson = JSON.parse(getDataForImport())

      const data = importDataJson.intData
      const burnHashes = importDataJson.burnHashes
      const addresses = importDataJson.addresses

      let outcome = etc.contracts.metToken.importMET.call(importDataJson.eth, importDataJson.etc, addresses, importDataJson.extraData,
        burnHashes, logExportReceipt.supplyOnAllChains, data, importDataJson.root, {from: etcBuyer1})
      assert(outcome, 'call to importMET should return true')
      tx = await etc.contracts.metToken.importMET(importDataJson.eth, importDataJson.etc, addresses, importDataJson.extraData,
        burnHashes, logExportReceipt.supplyOnAllChains, data, importDataJson.root, {from: etcBuyer1})

      // TODO: uncomment below code once we add refute logic in off-chain validator
      // let filter = etc.contracts.validator.LogAttestation().watch((err, response) => {
      //   if (err) {
      //     console.log('Attestation error', err)
      //   } else {
      //     if (logExportReceipt.currentBurnHash === response.args.hash) {
      //       console.log('Is this import valid? ', response.args.isValid)
      //       assert.isFalse(response.args.isValid)
      //       filter.stopWatching()
      //       resolve()
      //     }
      //   }
      // })
      resolve()
    })
  })
})
