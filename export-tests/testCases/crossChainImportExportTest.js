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
const chain = require('../common/crossChainContracts')

const ETHChain = chain.eth
const ETCChain = chain.etc
const ETH = ETHChain.web3.fromAscii('ETH')
const ETC = ETCChain.web3.fromAscii('ETC')

var ethBuyer1

var etcBuyer1

const prepareForExport = function () {
  return new Promise(async (resolve, reject) => {
    ethBuyer1 = await ETHChain.web3.personal.newAccount('password')
    etcBuyer1 = await ETCChain.web3.personal.newAccount('password')
    await ETHChain.web3.eth.sendTransaction({to: ethBuyer1, from: ETHChain.web3.eth.accounts[0], value: ETHChain.web3.toWei(2, 'ether')})
    // send some ether for gas cost
    await ETCChain.web3.eth.sendTransaction({to: etcBuyer1, from: ETCChain.web3.eth.accounts[0], value: ETHChain.web3.toWei(2, 'ether')})

    await ETHChain.web3.personal.unlockAccount(ethBuyer1, 'password')
    let balance = await ETHChain.web3.eth.getBalance(ethBuyer1)
    console.log('Balance of ethBuyer1 ', balance)
    ETHChain.web3.personal.unlockAccount(ethBuyer1, 'password')
    await ETHChain.web3.eth.sendTransaction({to: ETHChain.auctions.address, from: ethBuyer1, value: ETHChain.web3.toWei(0.01, 'ether')})
    var metTokenBalance = await ETHChain.metToken.balanceOf(ethBuyer1)
    assert(metTokenBalance.toNumber() > 0, 'Exporter has no MET token balance')
    let owner = await ETHChain.tokenPorter.owner()
    await ETHChain.web3.personal.unlockAccount(owner, 'newOwner')

    var tokenAddress = ETCChain.tokenPorter.token()
    await ETHChain.tokenPorter.addDestinationChain(ETC, tokenAddress, {from: owner})
    owner = await ETCChain.tokenPorter.owner()
    await ETCChain.web3.personal.unlockAccount(owner, 'newOwner')
    tokenAddress = await ETHChain.tokenPorter.token()
    await ETCChain.tokenPorter.addDestinationChain(ETH, tokenAddress, {from: owner})
    console.log('timeout??')

    resolve()
  })
}

before(async () => {
  await prepareForExport()
})

describe('cross chain testing', () => {
  it('Export test 1. Buy token and export to ETC', () => {
    return new Promise(async (resolve, reject) => {
      let destChain = await ETCChain.tokenPorter.destinationChains(ETCChain.web3.fromAscii('ETH'))
      console.log('destChain', destChain)
      ETHChain.web3.personal.unlockAccount(ethBuyer1, 'password')
      var amount = ETHChain.metToken.balanceOf(ethBuyer1)
      var extraData = 'extra data'
      destChain = await ETHChain.tokenPorter.destinationChains(ETHChain.web3.fromAscii('ETC'))
      var totalSupplybefore = await ETHChain.metToken.totalSupply()
      var tx = ETHChain.metToken.export(
        ETHChain.web3.fromAscii('ETC'),
        ETCChain.metToken.address,
        etcBuyer1,
        amount.valueOf(),
        0,
        ETHChain.web3.fromAscii(extraData),
        { from: ethBuyer1 })

      var totalSupplyAfter = ETHChain.metToken.totalSupply()
      let receipt = ETHChain.web3.eth.getTransactionReceipt(tx)
      const decoder = ethjsABI.logDecoder(ETHChain.tokenPorter.abi)
      // console.log('logs=', receipt.logs)
      const exportReceipt = decoder(receipt.logs)[0]
      assert(totalSupplybefore.sub(totalSupplyAfter), amount, 'Export from ETH failed')
      // let validatorAddress = ETCChain.web3.eth.accounts[0]
      // chain.validateHash(exportReceipt, ETCChain.web3, ETCChain.validator, validatorAddress)
      // validatorAddress = await ETCChain.metToken.owner()
      // await ETCChain.web3.personal.unlockAccount(validatorAddress, 'newOwner')
      // chain.validateHash(exportReceipt, ETCChain.web3, ETCChain.validator, validatorAddress)
      // totalSupplybefore = ETCChain.metToken.totalSupply()
      // let metBalanceBefore = ETCChain.metToken.balanceOf(etcBuyer1)

      chain.importHash(exportReceipt, ETCChain.web3, ETCChain.validator, ETCChain.tokenPorter, ETCChain.metToken, ETH)
      totalSupplyAfter = ETCChain.metToken.totalSupply()
      console.log('totalSupplyAfter', totalSupplyAfter)
      // let diff = totalSupplyAfter.sub(totalSupplybefore)
      // assert.equal(diff.valueOf(), amount.valueOf(), 'Total supply in ETC after import is wrong')
      // let metBalanceAfter = ETCChain.metToken.balanceOf(etcBuyer1)
      // diff = metBalanceAfter.sub(metBalanceBefore)
      // assert.equal(diff.valueOf(), amount.valueOf(), 'Balance of importer is wrong after import')
      resolve()
    })
  })

  // it('Export from ETC and import to ETH', () => {
  //   return new Promise(async (resolve, reject) => {
  //     ETCChain.web3.personal.unlockAccount(etcBuyer1, 'password')
  //     var amount = await ETCChain.metToken.balanceOf(etcBuyer1)

  //     console.log('balance of exporter in etc=', amount.valueOf())
  //     var extraData = 'extra data'
  //     let destChain = await ETCChain.tokenPorter.destinationChains(ETCChain.web3.fromAscii('ETH'))
  //     console.log('dest chain =', destChain)
  //     var totalSupplybefore = await ETCChain.metToken.totalSupply()
  //     console.log('totalSupply in etc before export=', totalSupplybefore.valueOf())
  //     var tx = ETCChain.metToken.export(
  //       ETHChain.web3.fromAscii('ETH'),
  //       ETHChain.metToken.address,
  //       ethBuyer1,
  //       amount.valueOf(),
  //       0,
  //       ETCChain.web3.fromAscii(extraData),
  //       { from: etcBuyer1 })
  //     var totalSupplyAfter = await ETCChain.metToken.totalSupply()
  //     console.log('totalSupply in etc after export=', totalSupplyAfter.valueOf())
  //     let receipt = ETCChain.web3.eth.getTransactionReceipt(tx)
  //     const decoder = ethjsABI.logDecoder(ETCChain.tokenPorter.abi)
  //     const exportReceipt = decoder(receipt.logs)[0]
  //     console.log('totalSupplybefore', totalSupplybefore)
  //     assert(totalSupplybefore.sub(totalSupplyAfter), amount, 'Export from ETH failed')
  //     let validatorAddress = ETHChain.web3.eth.accounts[0]
  //     chain.validateHash(exportReceipt, ETHChain.web3, ETHChain.validator, validatorAddress)
  //     validatorAddress = await ETHChain.metToken.owner()
  //     await ETHChain.web3.personal.unlockAccount(validatorAddress, 'newOwner')
  //     chain.validateHash(exportReceipt, ETHChain.web3, ETHChain.validator, validatorAddress)

  //     totalSupplybefore = await ETHChain.metToken.totalSupply()
  //     console.log('totalSupply in eth before  import=', totalSupplybefore.valueOf())
  //     let metBalanceBefore = ETHChain.metToken.balanceOf(etcBuyer1)

  //     chain.importHash(exportReceipt, ETHChain.web3, ETHChain.validator, ETHChain.tokenPorter, ETHChain.metToken, ETC)
  //     totalSupplyAfter = await ETHChain.metToken.totalSupply()
  //     console.log('totalSupply in eth after  import=', totalSupplyAfter.valueOf())
  //     let diff = totalSupplyAfter.sub(totalSupplybefore)
  //     assert.equal(diff.valueOf(), amount.valueOf(), 'Total supply in ETC after import is wrong')
  //     let metBalanceAfter = ETHChain.metToken.balanceOf(ethBuyer1)
  //     diff = metBalanceAfter.sub(metBalanceBefore)
  //     assert.equal(diff.valueOf(), amount.valueOf(), 'Balance of importer is wrong after import')
  //     resolve()
  //   })
  // })

  // it('Import some MET in ETC and leave the balance there', () => {
  //   return new Promise(async (resolve, reject) => {
  //     let destChain = await ETCChain.tokenPorter.destinationChains(ETCChain.web3.fromAscii('ETH'))
  //     console.log('destChain', destChain)
  //     ETHChain.web3.personal.unlockAccount(ethBuyer1, 'password')
  //     var amount = ETHChain.metToken.balanceOf(ethBuyer1)
  //     var extraData = 'extra data'
  //     destChain = await ETHChain.tokenPorter.destinationChains(ETHChain.web3.fromAscii('ETC'))
  //     var totalSupplybefore = await ETHChain.metToken.totalSupply()
  //     var tx = ETHChain.metToken.export(
  //       ETHChain.web3.fromAscii('ETC'),
  //       ETCChain.metToken.address,
  //       etcBuyer1,
  //       amount.valueOf(),
  //       0,
  //       ETHChain.web3.fromAscii(extraData),
  //       { from: ethBuyer1 })
  //     var totalSupplyAfter = await ETHChain.metToken.totalSupply()
  //     let receipt = ETHChain.web3.eth.getTransactionReceipt(tx)
  //     const decoder = ethjsABI.logDecoder(ETHChain.tokenPorter.abi)

  //     const exportReceipt = decoder(receipt.logs)[0]
  //     let validatorAddress = ETCChain.web3.eth.accounts[0]
  //     chain.validateHash(exportReceipt, ETCChain.web3, ETCChain.validator, validatorAddress)
  //     validatorAddress = await ETCChain.metToken.owner()
  //     await ETCChain.web3.personal.unlockAccount(validatorAddress, 'newOwner')
  //     chain.validateHash(exportReceipt, ETCChain.web3, ETCChain.validator, validatorAddress)

  //     totalSupplybefore = await ETCChain.metToken.totalSupply()
  //     let metBalanceBefore = ETCChain.metToken.balanceOf(etcBuyer1)

  //     chain.importHash(exportReceipt, ETCChain.web3, ETCChain.validator, ETCChain.tokenPorter, ETCChain.metToken, ETH)
  //     totalSupplyAfter = await ETCChain.metToken.totalSupply()
  //     let diff = totalSupplyAfter.sub(totalSupplybefore)
  //     assert.equal(diff.valueOf(), amount.valueOf(), 'Total supply in ETC after import is wrong')
  //     let metBalanceAfter = ETCChain.metToken.balanceOf(etcBuyer1)
  //     diff = metBalanceAfter.sub(metBalanceBefore)
  //     assert.equal(diff.valueOf(), amount.valueOf(), 'Balance of importer is wrong after import')
  //     resolve()
  //   })
  // })
})
