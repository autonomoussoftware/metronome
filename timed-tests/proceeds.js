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
const Metronome = require('../test/shared/inits')
const BlockTime = require('../test/shared/time')

contract('Proceeds - timed test', accounts => {
  const MINIMUM_PRICE = 33 * 10 ** 11 // minimum wei per token
  const STARTING_PRICE = 2 // 2 ETH per MET
  const TIME_SCALE = 1

  it('Public should be able to trigger the forward fund to AC', () => {
    return new Promise(async (resolve, reject) => {
      const fromAccount = accounts[7]
      const amount = web3.toWei(10, 'ether')
      let expectedFundTranferInAC = (amount * 0.25) / 100
      await BlockTime.mineBlock()
      const { auctions, proceeds, autonomousConverter } = await Metronome.initContracts(accounts, BlockTime.getCurrentBlockTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      // await initContracts(auctionStartTime - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      // advance a minute so action can start and one hour for purchase, ie 61 mins
      await BlockTime.timeTravel(61 * 60)
      await BlockTime.mineBlock()
      var balanceACBefore = await web3.eth.getBalance(autonomousConverter.address).valueOf()
      await auctions.sendTransaction({
        from: fromAccount,
        value: amount
      })
      await BlockTime.timeTravel(8 * 24 * 60 * 60)
      await BlockTime.mineBlock()
      await auctions.sendTransaction({
        from: fromAccount,
        value: amount
      })
      var balanceACAfter = await web3.eth.getBalance(autonomousConverter.address).valueOf()
      assert.equal(balanceACAfter - balanceACBefore, expectedFundTranferInAC, 'Incorrect fund transffered to AC')
      balanceACBefore = balanceACAfter
      await proceeds.closeAuction({from: fromAccount})

      balanceACAfter = await web3.eth.getBalance(autonomousConverter.address).valueOf()
      assert.equal(balanceACAfter - balanceACBefore, 0, 'Incorrect fund transffered to AC')
      balanceACBefore = await web3.eth.getBalance(autonomousConverter.address)
      await BlockTime.timeTravel(2 * 24 * 60 * 60)
      await BlockTime.mineBlock()
      let balanceOfProceed = await web3.eth.getBalance(proceeds.address)
      const tx = await proceeds.closeAuction({from: fromAccount})
      expectedFundTranferInAC = (balanceOfProceed.mul(25)).div(10000).toNumber()
      assert.equal(tx.receipt.logs.length, 2, 'Incorrect number of logs emitted')

      assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted')
      const log = tx.logs[0]
      assert.equal(log.event, 'LogClosedAuction', 'Log name is wrong')
      assert.equal(log.args.from, fromAccount, 'From is wrong')
      assert.equal(log.args.value.valueOf(), expectedFundTranferInAC, 'Value is wrong')

      balanceACAfter = await web3.eth.getBalance(autonomousConverter.address)
      assert.equal(balanceACAfter.sub(balanceACBefore).valueOf(), expectedFundTranferInAC, 'Incorrect fund transffered to AC')
      balanceACBefore = balanceACAfter
      await proceeds.closeAuction({from: fromAccount})
      balanceACAfter = await web3.eth.getBalance(autonomousConverter.address).valueOf()
      assert.equal(balanceACAfter - balanceACBefore, 0, 'Incorrect fund transffered to AC')
      resolve()
    })
  })
})
