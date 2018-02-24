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

const AutonomousConverter = artifacts.require('AutonomousConverter')
const Auctions = artifacts.require('Auctions')
const MTNToken = artifacts.require('MTNToken')
const Proceeds = artifacts.require('Proceeds')
const SmartToken = artifacts.require('SmartToken')

contract('MTNToken', accounts => {
  let mtnToken, autonomousConverter, auctions, proceeds, smartToken
  const OWNER = accounts[0]
  const MTN_TOTAL_SUPPLY = 10e6
  const MTN_INITIAL_SUPPLY = 10e6
  const DECMULT = 10 ** 18
  const MINIMUM_PRICE = 1000 // minimum wei per token
  const STARTING_PRICE = 1 // 1ETH per MTN
  const TIME_SCALE = 1
  let timeInSeconds = new Date().getTime() / 1000
  var START_TIME = (Math.floor(timeInSeconds / 60) * 60)

  describe('Constructor and Owner only functions', () => {
    beforeEach(async () => {
      autonomousConverter = await AutonomousConverter.new()
      auctions = await Auctions.new()
      proceeds = await Proceeds.new()

      mtnToken = await MTNToken.new(autonomousConverter.address, auctions.address, MTN_INITIAL_SUPPLY, DECMULT, {from: OWNER})
      smartToken = await SmartToken.new(autonomousConverter.address, autonomousConverter.address, MTN_INITIAL_SUPPLY, {from: OWNER})
      await autonomousConverter.init(mtnToken.address, smartToken.address, proceeds.address, auctions.address,
        {
          from: OWNER,
          value: web3.toWei(1, 'ether')
        })
      await proceeds.initProceeds(autonomousConverter.address, auctions.address, {from: OWNER})
    })

    it('Should verify initialization of the MTN token and its paramters', () => {
      return new Promise(async (resolve, reject) => {
        var output = await mtnToken.totalSupply()
        assert.equal(output, MTN_TOTAL_SUPPLY * DECMULT, 'Expected total supply is not correct')

        output = await mtnToken.autonomousConverter()
        assert.equal(output, autonomousConverter.address, 'autonomousConverter.address is not correct')

        output = await mtnToken.minter()
        assert.equal(output, auctions.address, 'Minter address is not correct')

        output = await mtnToken.balanceOf(autonomousConverter.address)
        assert.equal(output, MTN_TOTAL_SUPPLY * DECMULT, 'Initial MTN balance of autonomousConverter is not correct')

        resolve()
      })
    })
  })

  describe('Transfer functions', () => {
    beforeEach(async () => {
      autonomousConverter = await AutonomousConverter.new()
      auctions = await Auctions.new()
      proceeds = await Proceeds.new()
      START_TIME = START_TIME - (7 * 24 * 60 * 60) - 120

      mtnToken = await MTNToken.new(autonomousConverter.address, auctions.address, MTN_INITIAL_SUPPLY, DECMULT, {from: OWNER})
      smartToken = await SmartToken.new(autonomousConverter.address, autonomousConverter.address, MTN_INITIAL_SUPPLY, {from: OWNER})
      await autonomousConverter.init(mtnToken.address, smartToken.address, proceeds.address, auctions.address,
        {
          from: OWNER,
          value: web3.toWei(1, 'ether')
        })
      await proceeds.initProceeds(autonomousConverter.address, auctions.address, {from: OWNER})
      const founders = []
      founders.push(OWNER + '0000d3c20dee1639f99c0000')
      founders.push(accounts[1] + '000069e10de76676d0000000')
      const EXT_FOUNDER = accounts[10]
      await auctions.mintInitialSupply(founders, EXT_FOUNDER, mtnToken.address, proceeds.address, {from: OWNER})
      await auctions.initAuctions(START_TIME, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE, {from: OWNER})
      // mtnBalance = await mtnToken.balanceOf(OWNER)
      await autonomousConverter.convertEthToMtn(1,
        {
          from: OWNER,
          value: 2e18
        })
    })

    it('Should verify transfer function without data', () => {
      return new Promise(async (resolve, reject) => {
        const mtnTransferAmount = 1e18
        const prevMTNBalance = await mtnToken.balanceOf(accounts[1])
        const flag = await mtnToken.transfer(accounts[1], mtnTransferAmount, {from: OWNER})
        assert(flag, 'Transfer was not mined')
        const currentMTNBalance = await mtnToken.balanceOf(accounts[1])
        assert.equal(mtnTransferAmount, currentMTNBalance - prevMTNBalance, 'MTN transfer is not correct')
        resolve()
      })
    })

    /*
    it('Should verify transfer function with data', () => {
        return new Promise(async (resolve, reject) => {
        const mtnTransferAmount = 1e18;
        const prevMTNBalance = await mtnToken.balanceOf(accounts[1])
        console.log('prevMTNBalance=', prevMTNBalance)
        const flag = await mtnToken.transfer(accounts[1], mtnTransferAmount, '0x42', {from:OWNER})
        const currentMTNBalance = await mtnToken.balanceOf(accounts[1])
        console.log('currentMTNBalance=', currentMTNBalance)
        assert.equal(mtnTransferAmount, currentMTNBalance-prevMTNBalance, 'MTN transfer is not correct')
        resolve()
        })
    })
    */

    it('Should verify approve , approveMore and approveLess function', () => {
      return new Promise(async (resolve, reject) => {
        const SPENDER = accounts[1]
        const BENEFICIARY = accounts[3]
        const approveAmount = 2e18
        const previousAllowance = await mtnToken.allowance.call(OWNER, SPENDER)
        assert.equal(previousAllowance, 0, 'allowance is not initially zero')

        await mtnToken.approve(SPENDER, approveAmount, {from: OWNER})
        const currentAllowance = await mtnToken.allowance.call(OWNER, SPENDER)
        assert.equal(currentAllowance, approveAmount, 'allowance approved is not correct')

        await mtnToken.approveMore(SPENDER, approveAmount, {from: OWNER})
        const currentAllowanceMore = await mtnToken.allowance.call(OWNER, SPENDER)
        assert.equal(currentAllowanceMore, approveAmount * 2, 'allowance approved more is not correct')

        await mtnToken.approveLess(SPENDER, approveAmount, {from: OWNER})
        const currentAllowanceLess = await mtnToken.allowance.call(OWNER, SPENDER)
        assert.equal(currentAllowanceLess, approveAmount, 'allowance approved less is not correct')

        const balanceBefore = await mtnToken.balanceOf(BENEFICIARY)
        const withdrawAmount = 1e18
        assert.equal(balanceBefore, 0, 'spender account balance is not zero')
        await mtnToken.transferFrom(OWNER, BENEFICIARY, withdrawAmount, {from: SPENDER})
        const balanceAfter = await mtnToken.balanceOf(BENEFICIARY)
        assert.equal(balanceAfter, withdrawAmount, 'Trasnfer from is not correct')

        const BAD_SPENDER = accounts[2]
        const balanceBeforeBad = await mtnToken.balanceOf(BAD_SPENDER)
        assert.equal(balanceBeforeBad, 0, 'bad spender account balance is not zero')
        let errorMsg
        try {
          await mtnToken.transferFrom(OWNER, BENEFICIARY, withdrawAmount, {from: BAD_SPENDER})
        } catch (error) {
          errorMsg = error
        }
        assert.include(errorMsg + '', 'Error: VM Exception while processing transaction:', 'Unauthorized transfer from')

        resolve()
      })
    })

    it('Should verify Subcribe function', () => {
      return new Promise(async (resolve, reject) => {
        const payPerMonth = 1e17
        // const subsBefore = await mtnToken.getSubscription(OWNER, accounts[2])
        // const balanceBefore = await mtnToken.balanceOf(OWNER)

        await mtnToken.subscribe(START_TIME, payPerMonth, accounts[2])
        const subsAfter = await mtnToken.getSubscription(OWNER, accounts[2])
        assert.equal(subsAfter[0].valueOf(), START_TIME, 'Start time of subscription is not correct')
        assert.equal(subsAfter[1].valueOf(), payPerMonth, 'Pay per month amount in subscription is not correct')
        assert.equal(subsAfter[2].toNumber(), START_TIME, 'Last Withdraw is wrong')

        resolve()
      })
    })

    it('Should not be able to cancel subscription, with no subscriptions', () => {
      return new Promise(async (resolve, reject) => {
        const LENDER = accounts[3]
        const BAD_SUBSCRIBER = accounts[2]

        // confirm user has no subscription
        const subscription = await mtnToken.getSubscription(LENDER, BAD_SUBSCRIBER)
        assert(
          subscription[0].toNumber() === 0 &&
          subscription[1].toNumber() === 0 &&
          subscription[2].toNumber() === 0, 'BAD_SUBSCRIBER has a subscription')

        // validate throw
        let errorMsg
        try {
          await mtnToken.cancelSubscription(BAD_SUBSCRIBER, {from: LENDER})
        } catch (error) {
          errorMsg = error
        }
        assert.include(errorMsg + '', 'Error: VM Exception while processing transaction:', 'cancelSubscription did not throw')

        resolve()
      })
    })

    it('Should verify Cancel Subscription function', () => {
      return new Promise(async (resolve, reject) => {
        const LENDER = accounts[3]
        const SUBSCRIBER = accounts[2]
        const PAY_PER_MONTH = 1e17

        const successSub = await mtnToken.subscribe.call(START_TIME, PAY_PER_MONTH, SUBSCRIBER, {from: LENDER})
        assert(successSub, 'Subscribe failed')
        const txSub = await mtnToken.subscribe(START_TIME, PAY_PER_MONTH, SUBSCRIBER, {from: LENDER})
        assert(txSub, 'Subscribe was not mined')

        const successCancel = await mtnToken.cancelSubscription.call(SUBSCRIBER, {from: LENDER})
        assert(successCancel, 'Cancellation failed')
        const txCancel = await mtnToken.cancelSubscription(SUBSCRIBER, {from: LENDER})
        assert.equal(txCancel.logs.length, 1, 'incorrect number of logs')
        const log = txCancel.logs[0]
        assert.equal(log.event, 'LogCancelSubscription', 'LogCancelSubscription was not found')
        assert.equal(log.args.subscriber, LENDER, 'Subscriber is wrong')
        assert.equal(log.args.subscribesTo, SUBSCRIBER, 'SubscribesTo is wrong')

        const subscription = await mtnToken.getSubscription(LENDER, SUBSCRIBER)
        assert(
          subscription[0].toNumber() === 0 &&
          subscription[1].toNumber() === 0 &&
          subscription[2].toNumber() === 0, 'SUBSCRIBER still has a subscription')

        resolve()
      })
    })

    it('Should verify subWithdraw function when subscription started', () => {
      return new Promise(async (resolve, reject) => {
        const SPENDER = accounts[2]
        const payPerWeek = 1e17

        let date = new Date()
        date.setDate(date.getDate() - 7)
        START_TIME = Math.floor(date.getTime() / 1000)

        await mtnToken.subscribe(START_TIME, payPerWeek, SPENDER, {from: OWNER})
        const balanceBefore = await mtnToken.balanceOf(SPENDER)
        assert.equal(balanceBefore, 0, 'balance of spender is not zero')

        await mtnToken.subWithdraw(OWNER, {from: SPENDER})
        const balanceAfter = await mtnToken.balanceOf(SPENDER)
        assert.equal(balanceAfter, payPerWeek, 'Subscription withdraw failed')

        resolve()
      })
    })

    it('Should verify subWithdraw function when subscription started 12 months ago', () => {
      return new Promise(async (resolve, reject) => {
        const SPENDER = accounts[3]
        const payPerWeek = 1e17
        const allowance = payPerWeek * 52 // 52 weeks in 12 months

        let date = new Date()
        date.setFullYear(date.getFullYear() - 1)
        START_TIME = Math.floor(date.getTime() / 1000)

        await mtnToken.subscribe(START_TIME, payPerWeek, SPENDER, {from: OWNER})
        const balanceBefore = await mtnToken.balanceOf(SPENDER)
        assert.equal(balanceBefore, 0, 'balance of spender is not zero')

        await mtnToken.subWithdraw(OWNER, {from: SPENDER})
        const balanceAfter = await mtnToken.balanceOf(SPENDER)
        assert.equal(balanceAfter, allowance, 'Subscription withdraw failed')

        resolve()
      })
    })

    it('Should verify multiSubWithdraw function', () => {
      return new Promise(async (resolve, reject) => {
        const SPENDER = accounts[4]
        const OTHER_SUBSCRIBER = accounts[5]

        const payPerWeek = 1e17
        const allowance = payPerWeek * 2

        await mtnToken.transfer(OTHER_SUBSCRIBER, 1e18, {from: OWNER})

        let date = new Date()
        date.setDate(date.getDate() - 7)
        START_TIME = Math.floor(date.getTime() / 1000)

        await mtnToken.subscribe(START_TIME, payPerWeek, SPENDER, {from: OWNER})
        await mtnToken.subscribe(START_TIME, payPerWeek, SPENDER, {from: OTHER_SUBSCRIBER})

        const balanceBefore = await mtnToken.balanceOf(SPENDER)
        assert.equal(balanceBefore, 0, 'balance of spender is not zero')

        await mtnToken.multiSubWithdraw([OWNER, OTHER_SUBSCRIBER], {from: SPENDER})
        const balanceAfter = await mtnToken.balanceOf(SPENDER)
        assert.equal(balanceAfter, allowance, 'Subscription multi-withdraw failed')
        assert.equal(balanceAfter - balanceBefore, allowance, 'Subscription payment from OWNER and account[1] failed')

        resolve()
      })
    })

    it('Should verify multi transfer function', () => {
      return new Promise(async (resolve, reject) => {
        const tokenAmount = '000000000000000000000001'
        const allowance = parseInt(tokenAmount, 16)
        const RECIPIENTS = [
          accounts[4],
          accounts[5],
          accounts[6],
          accounts[7],
          accounts[8],
          accounts[9]
        ]

        const bitParam = []
        for (let idx = 0; idx < RECIPIENTS.length; idx++) {
          const recipient = RECIPIENTS[idx]
          bitParam.push(recipient + tokenAmount)

          const mtnBalanceBefore = await mtnToken.balanceOf(recipient)
          assert.equal(mtnBalanceBefore, 0, 'recipient balance is not zero for ' + idx)
        }

        await mtnToken.multiTransfer(bitParam, {from: OWNER})

        for (let idx = 0; idx < RECIPIENTS.length; idx++) {
          const recipient = RECIPIENTS[idx]
          const mtnBalanceAfter = await mtnToken.balanceOf(recipient)
          assert.equal(mtnBalanceAfter, allowance, 'multi-transfer failed for ' + idx)
        }

        resolve()
      })
    })

    it('Should verify Subcribe for future time', () => {
      return new Promise(async (resolve, reject) => {
        const payPerWeek = 1e17
        START_TIME = Math.floor((new Date(2018, 10, 8)).getTime() / 1000)
        await mtnToken.subscribe(START_TIME, payPerWeek, accounts[2], {from: OWNER})
        let errorMsg
        try {
          await mtnToken.subWithdraw(OWNER, {from: accounts[2]})
        } catch (error) {
          errorMsg = error
        }
        assert.include(errorMsg + '', 'Error: VM Exception while processing transaction:', 'Should not be able to withdraw fund if sub start time is future')
        resolve()
      })
    })
  })
})
