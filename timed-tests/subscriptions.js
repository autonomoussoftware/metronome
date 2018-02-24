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

contract('Subscriptions', accounts => {
  let mtnToken, autonomousConverter, auctions, proceeds, smartToken
  const OWNER = accounts[0]
  const FOUNDER = accounts[1]
  const subscribers = [accounts[2], accounts[4], accounts[6]]
  const spenders = [accounts[3], accounts[5], accounts[7]]
  const payPerWeek = 1e18

  const DAYS_IN_WEEK = 7
  const SECS_IN_DAY = 86400

  const timeTravel = function (time) {
    return new Promise((resolve, reject) => {
      web3.currentProvider.sendAsync({
        jsonrpc: '2.0',
        method: 'evm_increaseTime',
        params: [time],
        id: new Date().getTime()
      }, (err, result) => {
        if (err) { return reject(err) }
        return resolve(result)
      })
    })
  }

  const mineBlock = function () {
    return new Promise((resolve, reject) => {
      web3.currentProvider.sendAsync({
        jsonrpc: '2.0',
        method: 'evm_mine'
      }, (err, result) => {
        if (err) { return reject(err) }
        return resolve(result)
      })
    })
  }

  function getCurrentBlockTime () {
    var defaultBlock = web3.eth.defaultBlock
    return web3.eth.getBlock(defaultBlock).timestamp
  }

  beforeEach(async () => {
    autonomousConverter = await AutonomousConverter.new({from: OWNER})
    auctions = await Auctions.new({from: OWNER})
    proceeds = await Proceeds.new({from: OWNER})

    const founders = []
    founders.push(OWNER + '0000d3c20dee1639f99c0000')
    founders.push(FOUNDER + '000069e10de76676d0000000')

    const EXT_FOUNDER = accounts[8]

    const MTN_INITIAL_SUPPLY = 10e6
    const DECMULT = 10 ** 18
    const MINIMUM_PRICE = 1000
    const STARTING_PRICE = 1
    const TIME_SCALE = 1
    let timeInSeconds = new Date().getTime() / 1000
    var START_TIME = (Math.floor(timeInSeconds / 60) * 60)

    mtnToken = await MTNToken.new(autonomousConverter.address, auctions.address, MTN_INITIAL_SUPPLY, DECMULT, {from: OWNER})
    smartToken = await SmartToken.new(autonomousConverter.address, autonomousConverter.address, MTN_INITIAL_SUPPLY, {from: OWNER})
    await autonomousConverter.init(mtnToken.address, smartToken.address, proceeds.address, auctions.address, { from: OWNER, value: web3.toWei(1, 'ether') })
    await proceeds.initProceeds(autonomousConverter.address, auctions.address, {from: OWNER})
    await auctions.mintInitialSupply(founders, EXT_FOUNDER, mtnToken.address, proceeds.address, {from: OWNER})
    await auctions.initAuctions(START_TIME, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE, {from: OWNER})
  })

  describe('Time travel', () => {
    it('Consistent Weekly Payments for a year', () => {
      return new Promise(async (resolve, reject) => {
        // subscribe users
        const startTime = getCurrentBlockTime()
        for (let i = 0; i < subscribers.length; i++) {
          await autonomousConverter.convertEthToMtn(1, { from: subscribers[i], value: 2e18 })
          const tx = await mtnToken.subscribe(startTime, payPerWeek, spenders[i], {from: subscribers[i]})
          assert.equal(tx.logs.length, 1, 'incorrect number of logs')
          const log = tx.logs[0]
          assert.equal(log.event, 'LogSubscription', 'LogSubscription was not found')
          assert.equal(log.args.subscriber, subscribers[i], 'Subscriber is wrong')
          assert.equal(log.args.subscribesTo, spenders[i], 'SubscribesTo is wrong')
        }

        for (let w = 0; w < 52; w++) {
          // advance a week
          await timeTravel(SECS_IN_DAY * DAYS_IN_WEEK)
          await mineBlock()

          let n = await mtnToken.multiSubWithdrawFor.call(subscribers, spenders, {from: OWNER})
          assert.equal(n, spenders.length, 'Return value was incorrect')
          let tx = await mtnToken.multiSubWithdrawFor(subscribers, spenders, {from: OWNER})
          assert.equal(tx.logs.length, spenders.length, 'Not all payments were processed')

          for (let i = 0; i < tx.logs.length; i++) {
            const log = tx.logs[i]
            assert.equal(log.event, 'Transfer', 'Transfer event was not found')
            assert.equal(log.args._from, subscribers[i], 'From is wrong')
            assert.equal(log.args._to, spenders[i], 'To is wrong')
            assert.equal(log.args._value.toNumber(), payPerWeek, 'Transfer amount is wrong')
          }
        }

        resolve()
      })
    })

    it('Consistent Weekly Payments for a year with a future start date', () => {
      return new Promise(async (resolve, reject) => {
        // subscribe users
        const startTime = getCurrentBlockTime()
        var balance
        for (let i = 0; i < (subscribers.length); i++) {
          await autonomousConverter.convertEthToMtn(1, { from: subscribers[i], value: 2e18 })
          await mtnToken.subscribe(startTime + (i * SECS_IN_DAY * DAYS_IN_WEEK), payPerWeek, spenders[i], {from: subscribers[i]})
        }

        for (let w = 0; w < 52; w++) {
          // advance a week
          await timeTravel(SECS_IN_DAY * DAYS_IN_WEEK)
          await mineBlock()

          let tx = await mtnToken.multiSubWithdrawFor(subscribers, spenders, {from: OWNER})
          if (w === 0) {
            assert.equal(tx.logs.length, 1, 'Not all payments were processed')
          } else if (w === 1) {
            assert.equal(tx.logs.length, 2, 'Not all payments were processed')
          } else {
            assert.equal(tx.logs.length, spenders.length, 'Not all payments were processed')
          }
          let expectedBalance
          for (let i = 0; i < spenders.length; i++) {
            balance = await mtnToken.balanceOf(spenders[i])
            expectedBalance = payPerWeek * (w - i + 1)
            if (expectedBalance < 0) {
              expectedBalance = 0
            }
            assert.equal(expectedBalance, balance.valueOf(), 'payment not transferred to ' + spenders[i] + ' for week ' + w)
          }
        }
        resolve()
      })
    })

    it('Consistent Payments every other week for two years', () => {
      return new Promise(async (resolve, reject) => {
        // subscribe users, time offset starts one year ahead
        const startTime = getCurrentBlockTime()
        for (let i = 0; i < subscribers.length; i++) {
          await autonomousConverter.convertEthToMtn(1, { from: subscribers[i], value: 2e18 })
          await mtnToken.subscribe(startTime, payPerWeek, spenders[i], {from: subscribers[i]})
        }

        for (let w = 0; w < 104; w++) {
          // advance a week
          await timeTravel(SECS_IN_DAY * DAYS_IN_WEEK)
          await mineBlock()

          if (w % 2 !== 0) {
            let tx = await mtnToken.multiSubWithdrawFor(subscribers, spenders, {from: OWNER})
            assert.equal(tx.logs.length, spenders.length, 'Not all payments were processed')

            for (let i = 0; i < tx.logs.length; i++) {
              const log = tx.logs[i]
              assert.equal(log.event, 'Transfer', 'Transfer event was not found')
              assert.equal(log.args._from, subscribers[i], 'From is wrong')
              assert.equal(log.args._to, spenders[i], 'To is wrong')
              assert.equal(log.args._value.toNumber(), payPerWeek * 2, 'Transfer amount is wrong')
            }
          }
        }

        resolve()
      })
    })

    it('One spender will withdraw on their own for a year', () => {
      return new Promise(async (resolve, reject) => {
        // subscribe users, time offset is 3 years ahead
        const startTime = getCurrentBlockTime()
        for (let i = 0; i < subscribers.length; i++) {
          await autonomousConverter.convertEthToMtn(1, { from: subscribers[i], value: 2e18 })
          await mtnToken.subscribe(startTime, payPerWeek, spenders[i], {from: subscribers[i]})
        }

        for (let w = 0; w < 52; w++) {
          // advance a week
          await timeTravel(SECS_IN_DAY * DAYS_IN_WEEK)
          await mineBlock()

          // one spender withdraws on their own
          const diligentSpender = spenders[0]
          const luckySub = subscribers[0]
          const txSpender = await mtnToken.subWithdraw(luckySub, {from: diligentSpender})
          assert.equal(txSpender.logs.length, 1, 'Tansfer was not triggered')
          const firstLog = txSpender.logs[0]
          assert.equal(firstLog.event, 'Transfer', 'Transfer event was not found')
          assert.equal(firstLog.args._from, luckySub, 'From is wrong')
          assert.equal(firstLog.args._to, diligentSpender, 'To is wrong')
          assert.equal(firstLog.args._value.toNumber(), payPerWeek, 'Transfer amount is wrong')

          let tx = await mtnToken.multiSubWithdrawFor(subscribers, spenders, {from: OWNER})
          assert.equal(tx.logs.length, spenders.length - 1, 'Not all payments were processed')

          for (let i = 0; i < tx.logs.length; i++) {
            const log = tx.logs[i]
            const subOff = i + 1 // offset for first spender
            assert.equal(log.event, 'Transfer', 'Transfer event was not found')
            assert.equal(log.args._from, subscribers[subOff], 'From is wrong')
            assert.equal(log.args._to, spenders[subOff], 'To is wrong')
            assert.equal(log.args._value.toNumber(), payPerWeek, 'Transfer amount is wrong')
          }
        }
        resolve()
      })
    })
  })
})
