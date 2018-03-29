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
const METToken = artifacts.require('METToken')
const Proceeds = artifacts.require('Proceeds')
const SmartToken = artifacts.require('SmartToken')
const TestRPCTime = require('../test/shared/time')

contract('Subscriptions', accounts => {
  let metToken, autonomousConverter, auctions, proceeds, smartToken
  const OWNER = accounts[0]
  const FOUNDER = accounts[1]
  const SUBSCRIBERS = [accounts[2], accounts[4], accounts[6]]
  const SPENDERS = [accounts[3], accounts[5], accounts[7]]
  const PAY_PER_WEEK = 1e10
  const MET_INITIAL_SUPPLY = 0
  const ST_INITIAL_SUPPLY = 10e6
  const DECMULT = 10 ** 18
  const MINIMUM_PRICE = 1000
  const STARTING_PRICE = 1
  const TIME_SCALE = 1
  const DAYS_IN_WEEK = 7
  const INITIAL_AUCTION_END_TIME = 7 * 24 * 60 * 60 // 7 days in seconds
  const SECS_IN_DAY = 86400
  const SECS_IN_MIN = 60
  const SECS_IN_WEEK = SECS_IN_DAY * DAYS_IN_WEEK

  async function initContracts (startTime) {
    autonomousConverter = await AutonomousConverter.new({from: OWNER})
    auctions = await Auctions.new({from: OWNER})
    proceeds = await Proceeds.new({from: OWNER})

    const founders = []
    founders.push(OWNER + '0000D3C214DE7193CD4E0000')
    founders.push(FOUNDER + '0000D3C214DE7193CD4E0000')
    metToken = await METToken.new(autonomousConverter.address, auctions.address, MET_INITIAL_SUPPLY, DECMULT, {from: OWNER})
    smartToken = await SmartToken.new(autonomousConverter.address, autonomousConverter.address, ST_INITIAL_SUPPLY, {from: OWNER})
    await autonomousConverter.init(metToken.address, smartToken.address, auctions.address, { from: OWNER, value: web3.toWei(1, 'ether') })
    await proceeds.initProceeds(autonomousConverter.address, auctions.address, {from: OWNER})
    await auctions.mintInitialSupply(founders, metToken.address, proceeds.address, autonomousConverter.address, {from: OWNER})
    await auctions.initAuctions(startTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE, {from: OWNER})
  }

  describe('Subscribe when transfer not enabled', () => {
    beforeEach(async () => {
      await initContracts(TestRPCTime.getCurrentBlockTime())
      await TestRPCTime.timeTravel(INITIAL_AUCTION_END_TIME + (2 * SECS_IN_DAY))
      await TestRPCTime.mineBlock()
    })

    it('Subwithdraw test when transfer not allowed', () => {
      return new Promise(async (resolve, reject) => {
        const spender = accounts[9]
        const startTime = TestRPCTime.getCurrentBlockTime() + SECS_IN_MIN
        await auctions.sendTransaction({ from: OWNER, value: 1e18 })
        await metToken.subscribe(startTime, PAY_PER_WEEK, spender, {from: OWNER})
        await TestRPCTime.timeTravel(SECS_IN_WEEK)
        await TestRPCTime.mineBlock()
        let thrown = false
        try {
          await metToken.subWithdraw(OWNER, {from: spender})
        } catch (error) {
          thrown = true
        }
        assert(thrown, 'Subwithdraw did not throw')
        resolve()
      })
    })
  })

  describe('Time travel', () => {
    beforeEach(async () => {
      await initContracts(TestRPCTime.getCurrentBlockTime())
      await TestRPCTime.timeTravel(INITIAL_AUCTION_END_TIME + 120)
      await TestRPCTime.mineBlock()
      await metToken.enableMETTransfers()
    })

    it('Consistent Weekly Payments for a year', () => {
      return new Promise(async (resolve, reject) => {
        // subscribe users
        const startTime = TestRPCTime.getCurrentBlockTime() + SECS_IN_MIN
        for (let i = 0; i < SUBSCRIBERS.length; i++) {
          await autonomousConverter.convertEthToMet(1, { from: SUBSCRIBERS[i], value: 2e18 })
          const tx = await metToken.subscribe(startTime, PAY_PER_WEEK, SPENDERS[i], {from: SUBSCRIBERS[i]})
          assert.equal(tx.logs.length, 1, 'incorrect number of logs')
          const log = tx.logs[0]
          assert.equal(log.event, 'LogSubscription', 'LogSubscription was not found')
          assert.equal(log.args.subscriber, SUBSCRIBERS[i], 'Subscriber is wrong')
          assert.equal(log.args.subscribesTo, SPENDERS[i], 'SubscribesTo is wrong')
        }
        // forward a minute to catch up with subscribe time
        await TestRPCTime.timeTravel(SECS_IN_MIN)
        await TestRPCTime.mineBlock()

        for (let w = 0; w < 52; w++) {
          // advance a week
          await TestRPCTime.timeTravel(SECS_IN_WEEK)
          await TestRPCTime.mineBlock()

          let n = await metToken.multiSubWithdrawFor.call(SUBSCRIBERS, SPENDERS, {from: OWNER})
          assert.equal(n.valueOf(), SPENDERS.length, 'Return value was incorrect')
          let tx = await metToken.multiSubWithdrawFor(SUBSCRIBERS, SPENDERS, {from: OWNER})
          assert.equal(tx.logs.length, SPENDERS.length, 'Not all payments were processed')

          for (let i = 0; i < tx.logs.length; i++) {
            const log = tx.logs[i]
            assert.equal(log.event, 'Transfer', 'Transfer event was not found')
            assert.equal(log.args._from, SUBSCRIBERS[i], 'From is wrong')
            assert.equal(log.args._to, SPENDERS[i], 'To is wrong')
            assert.equal(log.args._value.toNumber(), PAY_PER_WEEK, 'Transfer amount is wrong')
          }
        }

        resolve()
      })
    })

    it('Consistent Weekly Payments for a year with a future start date', () => {
      return new Promise(async (resolve, reject) => {
        // subscribe users
        const startTime = TestRPCTime.getCurrentBlockTime() + SECS_IN_MIN
        var balance
        for (let i = 0; i < (SUBSCRIBERS.length); i++) {
          await autonomousConverter.convertEthToMet(1, { from: SUBSCRIBERS[i], value: 2e18 })
          await metToken.subscribe(startTime + (i * SECS_IN_WEEK), PAY_PER_WEEK, SPENDERS[i], {from: SUBSCRIBERS[i]})
        }

        // forward a minute to catch up with subscribe time
        await TestRPCTime.timeTravel(SECS_IN_MIN)
        await TestRPCTime.mineBlock()

        for (let w = 0; w < 52; w++) {
          // advance a week
          await TestRPCTime.timeTravel(SECS_IN_WEEK)
          await TestRPCTime.mineBlock()

          let tx = await metToken.multiSubWithdrawFor(SUBSCRIBERS, SPENDERS, {from: OWNER})
          if (w === 0) {
            assert.equal(tx.logs.length, 1, 'Not all payments were processed')
          } else if (w === 1) {
            assert.equal(tx.logs.length, 2, 'Not all payments were processed')
          } else {
            assert.equal(tx.logs.length, SPENDERS.length, 'Not all payments were processed')
          }
          let expectedBalance
          for (let i = 0; i < SPENDERS.length; i++) {
            balance = await metToken.balanceOf(SPENDERS[i])
            expectedBalance = PAY_PER_WEEK * (w - i + 1)
            if (expectedBalance < 0) {
              expectedBalance = 0
            }
            assert.equal(expectedBalance, balance.valueOf(), 'payment not transferred to ' + SPENDERS[i] + ' for week ' + w)
          }
        }
        resolve()
      })
    })

    it('Consistent Payments every other week for two years', () => {
      return new Promise(async (resolve, reject) => {
        // subscribe users, time offset starts one year ahead
        const startTime = TestRPCTime.getCurrentBlockTime() + SECS_IN_MIN
        for (let i = 0; i < SUBSCRIBERS.length; i++) {
          await autonomousConverter.convertEthToMet(1, { from: SUBSCRIBERS[i], value: 2e18 })
          await metToken.subscribe(startTime, PAY_PER_WEEK, SPENDERS[i], {from: SUBSCRIBERS[i]})
        }

        // forward a minute to catch up with subscribe time
        await TestRPCTime.timeTravel(SECS_IN_MIN)
        await TestRPCTime.mineBlock()

        for (let w = 0; w < 104; w++) {
          // advance a week
          await TestRPCTime.timeTravel(SECS_IN_WEEK)
          await TestRPCTime.mineBlock()

          if (w % 2 !== 0) {
            let tx = await metToken.multiSubWithdrawFor(SUBSCRIBERS, SPENDERS, {from: OWNER})
            assert.equal(tx.logs.length, SPENDERS.length, 'Not all payments were processed')

            for (let i = 0; i < tx.logs.length; i++) {
              const log = tx.logs[i]
              assert.equal(log.event, 'Transfer', 'Transfer event was not found')
              assert.equal(log.args._from, SUBSCRIBERS[i], 'From is wrong')
              assert.equal(log.args._to, SPENDERS[i], 'To is wrong')
              assert.equal(log.args._value.toNumber(), PAY_PER_WEEK * 2, 'Transfer amount is wrong')
            }
          }
        }

        resolve()
      })
    })

    it('One spender will withdraw on their own for a year', () => {
      return new Promise(async (resolve, reject) => {
        // subscribe users, time offset is 3 years ahead
        const startTime = TestRPCTime.getCurrentBlockTime() + SECS_IN_MIN
        for (let i = 0; i < SUBSCRIBERS.length; i++) {
          await autonomousConverter.convertEthToMet(1, { from: SUBSCRIBERS[i], value: 2e18 })
          await metToken.subscribe(startTime, PAY_PER_WEEK, SPENDERS[i], {from: SUBSCRIBERS[i]})
        }

        // forward a minute to catch up with subscribe time
        await TestRPCTime.timeTravel(SECS_IN_MIN)
        await TestRPCTime.mineBlock()

        for (let w = 0; w < 52; w++) {
          // advance a week
          await TestRPCTime.timeTravel(SECS_IN_WEEK)
          await TestRPCTime.mineBlock()

          // one spender withdraws on their own
          const diligentSpender = SPENDERS[0]
          const luckySub = SUBSCRIBERS[0]
          const txSpender = await metToken.subWithdraw(luckySub, {from: diligentSpender})
          assert.equal(txSpender.logs.length, 1, 'Tansfer was not triggered')
          const firstLog = txSpender.logs[0]
          assert.equal(firstLog.event, 'Transfer', 'Transfer event was not found')
          assert.equal(firstLog.args._from, luckySub, 'From is wrong')
          assert.equal(firstLog.args._to, diligentSpender, 'To is wrong')
          assert.equal(firstLog.args._value.toNumber(), PAY_PER_WEEK, 'Transfer amount is wrong')

          let tx = await metToken.multiSubWithdrawFor(SUBSCRIBERS, SPENDERS, {from: OWNER})
          assert.equal(tx.logs.length, SPENDERS.length - 1, 'Not all payments were processed')

          for (let i = 0; i < tx.logs.length; i++) {
            const log = tx.logs[i]
            const subOff = i + 1 // offset for first spender
            assert.equal(log.event, 'Transfer', 'Transfer event was not found')
            assert.equal(log.args._from, SUBSCRIBERS[subOff], 'From is wrong')
            assert.equal(log.args._to, SPENDERS[subOff], 'To is wrong')
            assert.equal(log.args._value.toNumber(), PAY_PER_WEEK, 'Transfer amount is wrong')
          }
        }
        resolve()
      })
    })

    it('Should verify subWithdraw function when subscription started', () => {
      return new Promise(async (resolve, reject) => {
        const spender = accounts[9]
        const startTime = TestRPCTime.getCurrentBlockTime() + SECS_IN_MIN

        await autonomousConverter.convertEthToMet(1, { from: OWNER, value: 2e18 })
        await metToken.subscribe(startTime, PAY_PER_WEEK, spender, {from: OWNER})

        await TestRPCTime.timeTravel(SECS_IN_WEEK + SECS_IN_MIN)
        await TestRPCTime.mineBlock()

        const balanceBefore = await metToken.balanceOf(spender)
        await metToken.subWithdraw(OWNER, {from: spender})
        const balanceAfter = await metToken.balanceOf(spender)
        assert.equal(balanceAfter.sub(balanceBefore), PAY_PER_WEEK, 'Subscription withdraw failed')

        resolve()
      })
    })

    it('Should verify subWithdraw function when subscription started 12 months ago', () => {
      return new Promise(async (resolve, reject) => {
        const spender = accounts[9]
        const allowance = PAY_PER_WEEK * 52 // 52 weeks in 12 months

        const startTime = TestRPCTime.getCurrentBlockTime() + SECS_IN_MIN

        await autonomousConverter.convertEthToMet(1, { from: OWNER, value: 2e18 })
        await metToken.subscribe(startTime, PAY_PER_WEEK, spender, {from: OWNER})

        await TestRPCTime.timeTravel((SECS_IN_WEEK * 52) + SECS_IN_MIN)
        await TestRPCTime.mineBlock()

        const balanceBefore = await metToken.balanceOf(spender)
        assert.equal(balanceBefore, 0, 'balance of spender is not zero')

        await metToken.subWithdraw(OWNER, {from: spender})
        const balanceAfter = await metToken.balanceOf(spender)
        assert.equal(balanceAfter, allowance, 'Subscription withdraw failed')

        resolve()
      })
    })

    it('Should verify multiSubWithdraw function', () => {
      return new Promise(async (resolve, reject) => {
        const spender = accounts[9]

        const allowance = PAY_PER_WEEK * SUBSCRIBERS.length

        const startTime = TestRPCTime.getCurrentBlockTime() + SECS_IN_MIN

        for (let i = 0; i < SUBSCRIBERS.length; i++) {
          await autonomousConverter.convertEthToMet(1, { from: SUBSCRIBERS[i], value: 2e18 })
          await metToken.subscribe(startTime, PAY_PER_WEEK, spender, {from: SUBSCRIBERS[i]})
        }

        // await autonomousConverter.convertEthToMet(1, { from: subscriber, value: 2e18 })
        // await metToken.transfer(otherSubscriber, 1e16, {from: subscriber})
        //
        // await metToken.subscribe(startTime, PAY_PER_WEEK, spender, {from: subscriber})
        // await metToken.subscribe(startTime, PAY_PER_WEEK, spender, {from: otherSubscriber})

        await TestRPCTime.timeTravel(SECS_IN_WEEK + SECS_IN_MIN)
        await TestRPCTime.mineBlock()

        const balanceBefore = await metToken.balanceOf(spender)
        assert.equal(balanceBefore, 0, 'balance of spender is not zero')

        const result = await metToken.multiSubWithdraw(SUBSCRIBERS, {from: spender})
        assert.equal(result.logs.length, SUBSCRIBERS.length, 'Not all payments were processed')
        const balanceAfter = await metToken.balanceOf(spender)
        assert.equal(balanceAfter.valueOf(), allowance, 'Subscription multiSubWithdraw failed from OWNER and other_subscriber')

        resolve()
      })
    })

    it('Should verify that no underflow in multiSubWithdrawFor function', () => {
      return new Promise(async (resolve, reject) => {
        const spenders = [accounts[3], accounts[5]]
        const subscribers = [accounts[4], accounts[6]]
        const payPerWeek = 1e17

        const startTime = TestRPCTime.getCurrentBlockTime() + SECS_IN_MIN

        await autonomousConverter.convertEthToMet(1, { from: subscribers[1], value: 2e18 })
        await metToken.transfer(subscribers[0], 1e16, {from: subscribers[1]})

        for (let i = 0; i < subscribers.length; i++) {
          await metToken.subscribe(startTime, payPerWeek, spenders[i], {from: subscribers[i]})
          assert.equal(await metToken.balanceOf(spenders[i]), 0, 'balance is not zero for spender at ' + i)
        }

        await TestRPCTime.timeTravel(SECS_IN_WEEK + SECS_IN_MIN)
        await TestRPCTime.mineBlock()

        const nTransfers = await metToken.multiSubWithdrawFor.call(subscribers, spenders)
        assert.equal(nTransfers, subscribers.length - 1, 'Too many transfers accepted, possible underflow')

        const result = await metToken.multiSubWithdrawFor(subscribers, spenders)
        assert.equal(result.logs.length, subscribers.length - 1, 'Underflow happened in multiSubWithdrawFor')

        assert.equal(await metToken.balanceOf(spenders[0]), 0, 'Allowance is more than available balance, subscription payment should be 0')
        assert.equal(await metToken.balanceOf(spenders[1]), payPerWeek, 'Subscription payment is failed from accounts[6]')

        resolve()
      })
    })
  })
})
