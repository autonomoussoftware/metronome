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

contract('Deploy Contracts', accounts => {
  let mtnToken, autonomousConverter, auctions, proceeds, smartToken
  const OWNER = accounts[0]
  const BLOQ = accounts[3]
  const FOUNDER = accounts[1]
  const EXT_FOUNDER = accounts[6]
  const BUYER = accounts[2]
  const MILLISECS_IN_A_SEC = 1000
  const SECS_IN_A_DAY = 86400
  const DAYS_IN_WEEK = 7

  function roundToNextMidnight (t) {
    // round to prev midnight, then add a day
    const nextMidnight = (t - (t % SECS_IN_A_DAY)) + SECS_IN_A_DAY
    assert(new Date(nextMidnight * MILLISECS_IN_A_SEC).toUTCString().indexOf('00:00:00') >= 0, 'timestamp is not midnight')
    return nextMidnight
  }

  const initContractsWithoutAuction = function () {
    return new Promise(async (resolve, reject) => {
      //
      // Deployment Step 1
      //
      autonomousConverter = await AutonomousConverter.new({from: OWNER})
      auctions = await Auctions.new({from: OWNER})
      proceeds = await Proceeds.new({from: OWNER})

      const MTN_INITIAL_SUPPLY = 0
      const DECMULT = 10 ** 18
      mtnToken = await MTNToken.new(autonomousConverter.address, auctions.address, MTN_INITIAL_SUPPLY, DECMULT, {from: OWNER})
      smartToken = await SmartToken.new(autonomousConverter.address, autonomousConverter.address, MTN_INITIAL_SUPPLY, {from: OWNER})

      const founders = []
      founders.push(OWNER + '000069E10DE76676D0800000')
      founders.push(FOUNDER + '000069E10DE76676D0800000')
      assert.isTrue(await auctions.mintInitialSupply.call(founders, EXT_FOUNDER, mtnToken.address, proceeds.address), 'mintInitialSupply did not return true')
      await auctions.mintInitialSupply(founders, EXT_FOUNDER, mtnToken.address, proceeds.address, {from: OWNER})

      //
      // change ownership to bloq for step 2
      //
      await mtnToken.changeOwnership(BLOQ, {from: OWNER})
      await autonomousConverter.changeOwnership(BLOQ, {from: OWNER})
      await auctions.changeOwnership(BLOQ, {from: OWNER})
      await proceeds.changeOwnership(BLOQ, {from: OWNER})
      await smartToken.changeOwnership(BLOQ, {from: OWNER})
      resolve()
    })
  }

  function getCurrentTime (offsetDays) {
    let date = new Date()
    date.setDate(date.getDate() + offsetDays)
    return Math.floor(date.getTime() / MILLISECS_IN_A_SEC)
  }

  beforeEach(async () => {
    await initContractsWithoutAuction()
  })

  describe('AutonomousConverter is uninitialized', () => {
    it('No one should be able to convert eth to mtn', () => {
      return new Promise(async (resolve, reject) => {
        const amount = 1e18

        let thrown = false
        try {
          await autonomousConverter.convertEthToMtn(1, {
            from: BUYER,
            value: amount
          })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'convertEthToMtn fallback did not throw')
        resolve()
      })
    })

    it('No one should be able to convert mtn to eth', () => {
      return new Promise(async (resolve, reject) => {
        const amount = 1e18

        await mtnToken.approve(autonomousConverter.address, amount, { from: BUYER })

        let thrown = false
        try {
          await autonomousConverter.convertMtnToEth(amount, 1, {
            from: BUYER,
            value: amount
          })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'convertEthToMtn fallback did not throw')
        resolve()
      })
    })
  })

  describe('Proceeds is uninitialized', () => {
    it('No one should be able to closeAuction', () => {
      return new Promise(async (resolve, reject) => {
        let thrown = false
        try {
          await proceeds.closeAuction({
            from: BUYER
          })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'closeAuction fallback did not throw')
        resolve()
      })
    })
  })

  describe('Auction is uninitialized', () => {
    it('Should return false indicating auction is running', () => {
      return new Promise(async (resolve, reject) => {
        assert.isFalse(await auctions.isRunning(), 'Auctions should not be running')
        resolve()
      })
    })

    it('No one should be able to send funds to auction', () => {
      return new Promise(async (resolve, reject) => {
        const amount = 1e18

        let thrown = false
        try {
          await auctions.sendTransaction({
            from: BUYER,
            value: amount
          })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'Auction fallback did not throw')
        resolve()
      })
    })

    it('stopEverything function should throw', () => {
      return new Promise(async (resolve, reject) => {
        let thrown = false
        try {
          await auctions.stopEverything()
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'stopEverything did not throw')
        resolve()
      })
    })
  })

  describe('Auction is initialized (Step 2)', () => {
    it('Owner is able to mint and start auction in two steps', () => {
      return new Promise(async (resolve, reject) => {
        //
        // Deployment Step 2
        //
        await autonomousConverter.init(mtnToken.address, smartToken.address, auctions.address, { from: BLOQ, value: web3.toWei(1, 'ether') })
        await proceeds.initProceeds(autonomousConverter.address, auctions.address, {from: BLOQ})

        const MINIMUM_PRICE = 1000
        const STARTING_PRICE = 1
        const TIME_SCALE = 1
        const START_TIME = getCurrentTime(0)
        assert.isTrue(await auctions.initAuctions.call(START_TIME, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE, {from: BLOQ}), 'initAuctions did not return true')
        await auctions.initAuctions(START_TIME, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE, {from: BLOQ})

        const genesisTime = await auctions.genesisTime()
        const initialAuctionEndTime = await auctions.initialAuctionEndTime()
        const intialAuctionDuration = (initialAuctionEndTime.toNumber() - genesisTime.toNumber()) / SECS_IN_A_DAY
        const dailyAuctionStartTime = await auctions.dailyAuctionStartTime()
        const expectedDailyAuctionStartTime = roundToNextMidnight(initialAuctionEndTime)
        assert.equal(dailyAuctionStartTime.toNumber(), expectedDailyAuctionStartTime, 'Inital Auction End and Daily Start are not the same')
        assert.equal(intialAuctionDuration, DAYS_IN_WEEK, 'Auction duration is not correct')
        assert.equal(await auctions.isInitialAuctionEnded(), false, 'Inital auction should not have ended')

        resolve()
      })
    })
  })
})
