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
const util = require('./testUtil')
var ethBuyer1
var etcBuyer1
var eth
var etc

function validateMinting (
  chain,
  recipient,
  expectedTotalSupply,
  expectedBalanceOfRecepient,
  fee,
  balanceOfValidatorBefore
) {
  let validator = chain.configuration.address

  let currentTotalSupply = chain.contracts.metToken.totalSupply()
  assert.closeTo(currentTotalSupply.sub(expectedTotalSupply).toNumber(), 0, 3, 'Total supply is wrong after import')

  assert.equal(chain.contracts.metToken.balanceOf(recipient).valueOf(),
    expectedBalanceOfRecepient.valueOf(), 'Balance of recepient wrong after import')

  let balanceOfValidatorAfter = chain.contracts.metToken.balanceOf(validator)
  let expectedFee = fee / chain.contracts.validator.getValidatorsCount()
  assert(balanceOfValidatorAfter - balanceOfValidatorBefore, expectedFee, 'Validator did not get correct export fee')
}

const getDataForImport = _.memoize(function () {
  return fs.readFileSync('import-data.json').toString()
})

before(async () => {
  const response = await util.initContracts()
  eth = response.ethChain
  ethBuyer1 = response.ethBuyer
  etc = response.etcChain
  etcBuyer1 = response.etcBuyer
})

describe('cross chain testing', () => {
  beforeEach(async () => {
    eth.web3.personal.unlockAccount(ethBuyer1, 'password')
    etc.web3.personal.unlockAccount(etcBuyer1, 'password')
  })

  it('Export test 1. ETH to ETC', () => {
    return new Promise(async (resolve, reject) => {
      let flatFee = 10e12
      let feePerTenThousand = 1

      // Buy some MET
      await eth.web3.eth.sendTransaction({
        to: eth.contracts.auctions.address,
        from: ethBuyer1,
        value: 2e16
      })
      let metBalance = eth.contracts.metToken.balanceOf(ethBuyer1)
      assert(metBalance > 0, 'Exporter has no MET token balance')

      let fee = Math.floor(metBalance.div(2))
      let amount = metBalance.sub(fee)
      assert(metBalance, amount.add(fee), 'Total of amount and fee should be equal to metBalance')
      assert.isAbove(fee, flatFee, 'Fee should be greater than defined flatFee')
      // const calculatedFee = amount.mul(feePerTenThousand).div(10000)
      assert.isAbove(fee, amount.mul(feePerTenThousand).div(10000).toNumber(), 'Fee should be greater than defined fee')

      let extraData = 'D'
      let totalSupplybefore = await eth.contracts.metToken.totalSupply()
      let tx = await eth.contracts.metToken.export(
        eth.web3.fromAscii('ETC'),
        etc.contracts.metToken.address,
        etcBuyer1,
        amount.valueOf(),
        fee.valueOf(),
        eth.web3.fromAscii(extraData),
        { from: ethBuyer1 }
      )
      let receipt = eth.web3.eth.getTransactionReceipt(tx)
      if (receipt.status === '0x0') {
        reject(new Error('Export function reverted'))
      }
      let totalSupplyAfter = eth.contracts.metToken.totalSupply()
      assert(totalSupplybefore.sub(totalSupplyAfter), amount.add(fee), 'Export from ETH failed')

      let importDataObj = await util.prepareImportData(eth, receipt)
      let expectedTotalSupply = etc.contracts.metToken.totalSupply().add(amount).add(fee)

      let expectedBalanceOfRecepient = etc.contracts.metToken.balanceOf(etcBuyer1).add(amount)
      let balanceOfValidatorBefore = etc.contracts.metToken.balanceOf(etc.configuration.address)
      tx = await etc.contracts.metToken.importMET(
        etc.web3.fromAscii('ETH'),
        importDataObj.destinationChain,
        importDataObj.addresses,
        importDataObj.extraData,
        importDataObj.burnHashes,
        importDataObj.supplyOnAllChains,
        importDataObj.importData,
        importDataObj.root,
        { from: etcBuyer1 }
      )
      receipt = etc.web3.eth.getTransactionReceipt(tx)
      if (receipt.status === '0x0') {
        reject(new Error('importMET function reverted'))
      }
      // wait for minting to happen
      let filter = etc.contracts.tokenPorter.LogImport().watch((err, response) => {
        if (err) {
          console.log('export error', err)
        } else {
          if (importDataObj.burnHashes[1] === response.args.currentHash) {
            filter.stopWatching()
            validateMinting(etc, etcBuyer1, expectedTotalSupply, expectedBalanceOfRecepient,
              fee, balanceOfValidatorBefore)
            resolve()
          }
        }
      })
    })
  })

  it('Export test 2. ETC to ETH', () => {
    return new Promise(async (resolve, reject) => {
      let amount = etc.contracts.metToken.balanceOf(etcBuyer1)
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
        { from: etcBuyer1 }
      )
      let receipt = etc.web3.eth.getTransactionReceipt(tx)
      if (receipt.status === '0x0') {
        reject(new Error('Export function reverted'))
      }
      let totalSupplyAfter = etc.contracts.metToken.totalSupply()

      assert(
        totalSupplybefore.sub(totalSupplyAfter),
        amount + fee,
        'Export from ETH failed'
      )
      let importDataObj = await util.prepareImportData(etc, receipt)
      let expectedTotalSupply = eth.contracts.metToken
        .totalSupply()
        .add(amount)
        .add(fee)
      let expectedBalanceOfRecepient = eth.contracts.metToken
        .balanceOf(importDataObj.addresses[1])
        .add(amount)
      let balanceOfValidatorBefore = eth.contracts.metToken.balanceOf(
        eth.configuration.address
      )
      tx = await eth.contracts.metToken.importMET(
        eth.web3.fromAscii('ETC'),
        importDataObj.destinationChain,
        importDataObj.addresses,
        importDataObj.extraData,
        importDataObj.burnHashes,
        importDataObj.supplyOnAllChains,
        importDataObj.importData,
        importDataObj.root,
        { from: ethBuyer1 }
      )
      receipt = eth.web3.eth.getTransactionReceipt(tx)
      if (receipt.status === '0x0') {
        reject(new Error('importMET function reverted'))
      }
      let filter = eth.contracts.tokenPorter
        .LogImport()
        .watch((err, response) => {
          if (err) {
            console.log('export error', err)
          } else {
            if (importDataObj.burnHashes[1] === response.args.currentHash) {
              filter.stopWatching()
              validateMinting(
                eth,
                ethBuyer1,
                expectedTotalSupply,
                expectedBalanceOfRecepient,
                fee,
                balanceOfValidatorBefore
              )
              resolve()
            }
          }
        })
    })
  })

  it('ETH to ETC: Fake export receipt, should pass on-chain validation and fail on off-chain validation', () => {
    return new Promise(async (resolve, reject) => {
      // Buy some MET
      await eth.web3.eth.sendTransaction({to: eth.contracts.auctions.address, from: ethBuyer1, value: 2e16})
      let metBalance = eth.contracts.metToken.balanceOf(ethBuyer1)
      assert(metBalance > 0, 'Exporter has no MET token balance')
      let fee = Math.floor(metBalance.div(2))
      let amount = metBalance.sub(fee)
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
      let receipt = eth.web3.eth.getTransactionReceipt(tx)
      if (receipt.status === '0x0') {
        reject(new Error('export function reverted'))
      }
      let totalSupplyAfter = eth.contracts.metToken.totalSupply()
      let decoder = ethjsABI.logDecoder(eth.contracts.tokenPorter.abi)
      let logExportReceipt = decoder(receipt.logs)[0]
      assert(totalSupplybefore.sub(totalSupplyAfter), amount.add(fee), 'Export from ETH failed')
      const importDataJson = JSON.parse(getDataForImport())

      const data = importDataJson.intData
      const burnHashes = importDataJson.burnHashes
      const addresses = importDataJson.addresses

      let outcome = etc.contracts.metToken.importMET.call(
        importDataJson.eth,
        importDataJson.etc,
        addresses,
        importDataJson.extraData,
        burnHashes,
        logExportReceipt.supplyOnAllChains,
        data,
        importDataJson.root,
        { from: etcBuyer1 }
      )
      assert(outcome, 'call to importMET should return true')
      tx = await etc.contracts.metToken.importMET(
        importDataJson.eth,
        importDataJson.etc,
        addresses,
        importDataJson.extraData,
        burnHashes,
        logExportReceipt.supplyOnAllChains,
        data,
        importDataJson.root,
        { from: etcBuyer1 }
      )
      receipt = etc.web3.eth.getTransactionReceipt(tx)
      decoder = ethjsABI.logDecoder(etc.contracts.tokenPorter.abi)
      let logData = decoder(receipt.logs)[0]
      if (receipt.status === '0x0') {
        reject(new Error('importMET function reverted'))
      }
      let filter = etc.contracts.validator
        .LogAttestation()
        .watch((err, response) => {
          if (err) {
            console.log('Attestation error', err)
          } else {
            if (logData.currentBurnHash === response.args.hash) {
              assert.isFalse(response.args.isValid)
              filter.stopWatching()
              resolve()
            }
          }
        })
    })
  })

  it('ETH to ETC: import should fail as provided fee is less than defined fee', () => {
    return new Promise(async (resolve, reject) => {
      // Buy some MET
      await eth.web3.eth.sendTransaction({to: eth.contracts.auctions.address, from: ethBuyer1, value: 2e16})
      let metBalance = eth.contracts.metToken.balanceOf(ethBuyer1)
      let fee = 10 // 10 wei MET
      let amount = metBalance.sub(fee)
      let extraData = 'D'
      let outcome = await eth.contracts.metToken.export.call(
        eth.web3.fromAscii('ETC'),
        etc.contracts.metToken.address,
        etcBuyer1,
        amount.valueOf(),
        fee.valueOf(),
        eth.web3.fromAscii(extraData),
        { from: ethBuyer1 })

      assert.isFalse(outcome, 'call to importMET should return false, as provided fee is less than defined fee')
      resolve()
    })
  })

  // it('ETH to ETC: import should fail as provided fee is less than defined fee', () => {
  //   return new Promise(async (resolve, reject) => {

  //     // Buy some MET
  //     await eth.web3.eth.sendTransaction({to: eth.contracts.auctions.address, from: ethBuyer1, value: 2e16})
  //     let metBalance = eth.contracts.metToken.balanceOf(ethBuyer1)
  //     let fee = Math.floor(metBalance.div(2))
  //     let amount = metBalance.sub(fee)
  //     assert(metBalance, amount.add(fee), 'Total of amount and fee should be equal to metBalance')

  //     let extraData = 'D'
  //     let totalSupplybefore = await eth.contracts.metToken.totalSupply()
  //     let tx = await eth.contracts.metToken.export(
  //       eth.web3.fromAscii('ETC'),
  //       etc.contracts.metToken.address,
  //       etcBuyer1,
  //       amount.valueOf(),
  //       fee.valueOf(),
  //       eth.web3.fromAscii(extraData),
  //       { from: ethBuyer1 }
  //     )
  //     let receipt = eth.web3.eth.getTransactionReceipt(tx)
  //     let importDataObj = await util.prepareImportData(eth, receipt)
  //     let expectedTotalSupply = etc.contracts.metToken.totalSupply().add(amount).add(fee)

  //     let expectedBalanceOfRecepient = etc.contracts.metToken.balanceOf(etcBuyer1).add(amount)
  //     let balanceOfValidatorBefore = etc.contracts.metToken.balanceOf(etc.configuration.address)
  //     tx = await etc.contracts.metToken.importMET(
  //       etc.web3.fromAscii('ETH'),
  //       importDataObj.destinationChain,
  //       importDataObj.addresses,
  //       importDataObj.extraData,
  //       importDataObj.burnHashes,
  //       importDataObj.supplyOnAllChains,
  //       importDataObj.importData,
  //       importDataObj.root,
  //       { from: etcBuyer1 }
  //     )
  //     receipt = etc.web3.eth.getTransactionReceipt(tx)
  //     if (receipt.status === '0x0') {
  //       reject(new Error('importMET function reverted'))
  //     }
  //     // wait for minting to happen
  //     let filter = etc.contracts.tokenPorter.LogImport().watch((err, response) => {
  //       if (err) {
  //         console.log('export error', err)
  //       } else {
  //         if (importDataObj.burnHashes[1] === response.args.currentHash) {
  //           filter.stopWatching()
  //           validateMinting(etc, etcBuyer1, expectedTotalSupply, expectedBalanceOfRecepient,
  //             fee, balanceOfValidatorBefore)
  //           resolve()
  //         }
  //       }
  //     })
  //   })
  // })
})
