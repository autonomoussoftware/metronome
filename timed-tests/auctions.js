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
const ERCClaimableTests = require('../test/shared/erc-claimable')
const TestRPCTime = require('../test/shared/time')
const MTNToken = artifacts.require('MTNToken')
const SmartToken = artifacts.require('SmartToken')
const Proceeds = artifacts.require('Proceeds')
const AutonomousConverter = artifacts.require('AutonomousConverter')
const Auctions = artifacts.require('Auctions')
const TokenLocker = artifacts.require('TokenLocker')

contract('Auctions', accounts => {
  const BUYER1 = accounts[6]
  const BUYER2 = accounts[8]

  const OWNER = accounts[0]
  const OWNER_TOKENS_HEX = '0000d3c20dee1639f99c0000'
  const FOUNDER = accounts[1]
  const FOUNDER_TOKENS_HEX = '000069e10de76676d0000000'

  const EXT_FOUNDER = accounts[7]
  const EXT_FOUNDER_TOKENS = 5e23

  const MTN_INITIAL_SUPPLY = 0
  const SMART_INITIAL_SUPPLY = 0
  const DECMULT = 10 ** 18
  const MINIMUM_PRICE = 33 * 10 ** 11 // minimum wei per token
  const STARTING_PRICE = 2 // 2 ETH per MTN
  const TIME_SCALE = 1
  const MILLISECS_IN_A_SEC = 1000
  const SECS_IN_DAY = 86400
  const SECS_IN_MINUTE = 60
  const SECS_IN_HOUR = 3600
  let currentTimeOffset = 0

  let mtnToken, smartToken, proceeds, autonomousConverter, auctions

  function getCurrentTime (offsetDays) {
    let date = new Date()
    date.setDate(date.getDate() + offsetDays)
    const timeInSeconds = (date.getTime() / MILLISECS_IN_A_SEC)
    return Math.floor(timeInSeconds / 60) * 60 // time in seconds round to nearest minute
  }

  function getCurrentBlockTime () {
    var defaultBlock = web3.eth.defaultBlock
    return web3.eth.getBlock(defaultBlock).timestamp
  }

  function roundToNextMidnight (t) {
    // round to prev midnight, then add a day
    const nextMidnight = (t - (t % SECS_IN_DAY)) + SECS_IN_DAY
    assert(new Date(nextMidnight * MILLISECS_IN_A_SEC).toUTCString().indexOf('00:00:00') >= 0, 'timestamp is not midnight')
    return nextMidnight
  }

  async function initContracts (startTime, minimumPrice, startingPrice, timeScale) {
    const founders = []
    // Since we are appending it with hexadecimal address so amount should also be
    // in hexa decimal. Hence 999999e18 = 0000d3c21bcecceda1000000 in 24 character ( 96 bits)
    // 1000000e18 =  0000d3c20dee1639f99c0000
    founders.push(OWNER + OWNER_TOKENS_HEX)
    founders.push(FOUNDER + FOUNDER_TOKENS_HEX)
    mtnToken = await MTNToken.new(autonomousConverter.address, auctions.address, MTN_INITIAL_SUPPLY, DECMULT, {from: OWNER})
    smartToken = await SmartToken.new(autonomousConverter.address, autonomousConverter.address, SMART_INITIAL_SUPPLY, {from: OWNER})
    await autonomousConverter.init(mtnToken.address, smartToken.address, auctions.address,
      {
        from: OWNER,
        value: web3.toWei(1, 'ether')
      })
    await proceeds.initProceeds(autonomousConverter.address, auctions.address, {from: OWNER})
    await auctions.mintInitialSupply(founders, EXT_FOUNDER, mtnToken.address, proceeds.address, {from: OWNER})
    await auctions.initAuctions(startTime, MINIMUM_PRICE, STARTING_PRICE, timeScale, {from: OWNER})
  }

  before(async () => {
    await web3.eth.sendTransaction({
      from: accounts[8],
      to: OWNER,
      value: 30e18
    })
  })

  // Create contracts and initilize them for each test case
  beforeEach(async () => {
    proceeds = await Proceeds.new()
    autonomousConverter = await AutonomousConverter.new()
    auctions = await Auctions.new()
  })

  it('Should verify that Auctions contract is initialized correctly ', () => {
    return new Promise(async (resolve, reject) => {
      const reserveAmount = 2000000 // 20% of total supply aka 2 million
      // auction start time will be provided time + 60
      const genesisTime = getCurrentTime(currentTimeOffset) + 60

      await initContracts(getCurrentTime(currentTimeOffset), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      assert.equal(await auctions.proceeds(), proceeds.address, 'Proceeds address isn`t setup correctly')
      assert.equal(await auctions.token(), mtnToken.address, 'MTNToken address isn\'t setup correctly')
      assert.equal(await auctions.genesisTime(), genesisTime, 'genesisTime isn\'t setup correctly')
      assert.equal(await auctions.minimumPrice(), MINIMUM_PRICE, 'minimumPrice isn\'t setup correctly')
      assert.equal(await auctions.lastPurchasePrice(), web3.toWei(STARTING_PRICE), 'startingPrice isn\'t setup correctly')
      assert.equal(await auctions.timeScale(), TIME_SCALE, 'time scale isn\'t setup correctly')

      const extFounder = await auctions.extFounder()
      assert.equal(extFounder, EXT_FOUNDER, 'External founder was not set')
      const extBalance = await mtnToken.balanceOf(extFounder)
      assert.equal(extBalance.toNumber(), EXT_FOUNDER_TOKENS, 'External founder minted balance was not correct')

      const founders = [
        { address: await auctions.founders(0), targetTokens: parseInt(OWNER_TOKENS_HEX, 16) },
        { address: await auctions.founders(1), targetTokens: parseInt(FOUNDER_TOKENS_HEX, 16) }]

      let totalFounderMints = extBalance.toNumber() / DECMULT
      for (let i = 0; i < founders.length; i++) {
        const founder = founders[i]
        const tokenLockerAddress = await auctions.tokenLockers(founder.address)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)
        totalFounderMints += (await mtnToken.balanceOf(tokenLocker.address)).toNumber() / DECMULT
      }
      totalFounderMints *= DECMULT
      assert.equal(totalFounderMints, (reserveAmount - 1) * DECMULT, 'Reserve for founders isn\'t setup correctly')

      // Auctions will mint 1 token for autonomous converter
      assert.equal(await mtnToken.balanceOf(autonomousConverter.address), (MTN_INITIAL_SUPPLY + 1) * DECMULT, 'Reserve for founders isn\'t setup correctly')

      resolve()
    })
  })

  it('Should verify that Auctions contract is initialized correctly with defaults', () => {
    return new Promise(async (resolve, reject) => {
      // When 0 is provided for auction start time, it will be calculated
      // using block timestamp, block.timestamp + 60
      const defaultAuctionTime = getCurrentTime(currentTimeOffset) + 60
      const defaultStartingPrice = 2 // 2 ETH per MTN
      const defaultMinimumPrice = 33 * 10 ** 11

      await initContracts(0, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      assert.equal(await auctions.genesisTime(), defaultAuctionTime, 'default genesisTime isn\'t setup correctly or test took longer in execution')
      assert.equal(await auctions.minimumPrice(), defaultMinimumPrice, 'default minimumPrice isn\'t setup correctly')
      assert.equal(await auctions.lastPurchasePrice(), web3.toWei(defaultStartingPrice), 'default startingPrice isn\'t setup correctly')

      resolve()
    })
  })

  it('Should return true indicating auction is running', () => {
    return new Promise(async (resolve, reject) => {
      await initContracts(1, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      assert.ok(await auctions.isRunning(), 'Auctions should be running')
      resolve()
    })
  })

  it('Should buy MTN every hour during initial auction until 3 days ', () => {
    return new Promise(async (resolve, reject) => {
      // initialize auction
      await initContracts(getCurrentBlockTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      // advance a minute so action can start
      let advanceSeconds = SECS_IN_MINUTE
      await TestRPCTime.timeTravel(advanceSeconds)
      await TestRPCTime.mineBlock()
      currentTimeOffset += advanceSeconds / SECS_IN_DAY

      // validate we are at the begining of initial auction
      const nowTime = getCurrentBlockTime()
      const genesisTime = (await auctions.genesisTime()).toNumber()
      assert(nowTime > genesisTime, 'Current time is not after genesisTime')
      const initialAuctionEndTime = (await auctions.initialAuctionEndTime()).toNumber()
      assert(nowTime < initialAuctionEndTime, 'Current time is after the inital auction end time')
      const dailyAuctionStartTime = (await auctions.dailyAuctionStartTime()).toNumber()
      assert(nowTime < dailyAuctionStartTime, 'Current time is not before the next daily auction start time')

      // simulate hourly buys for three days
      const fromAccount = BUYER2
      const amount = web3.toWei(0.1, 'ether')

      const totalHours = 24 * 3
      let expectedToken = 0
      let expectedPrice = 2e18
      let lastPurchasePrice
      let mtnBalanceBefore = await mtnToken.balanceOf(fromAccount)
      let mtnBalanceAfter = mtnBalanceBefore
      const MULTIPLIER = 1984320568 * 10 ** 5
      let currentAuction = 0
      for (let i = 0; i < totalHours; i++) {
        // peform buy
        await auctions.sendTransaction({
          from: fromAccount,
          value: amount
        })

        // calculate expected price based on current hour
        if (i < 167) {
          if (i > 0) {
            expectedPrice = expectedPrice - (MULTIPLIER * 60)
          }
        } else {
          if ((i % 24) === 0) {
            expectedPrice = 2 * expectedPrice
          } else {
            expectedPrice = expectedPrice * (0.99 ** 60)
          }
        }

        if (expectedPrice < (33 * (10 ** 11))) {
          expectedPrice = 33 * (10 ** 11)
        }
        expectedToken = expectedToken + ((amount * 1e18) / expectedPrice)

        // check balances and validate pprice
        mtnBalanceBefore = mtnBalanceAfter
        mtnBalanceAfter = await mtnToken.balanceOf(fromAccount)
        currentAuction = await auctions.currentAuction()
        // console.log(i, mtnBalanceAfter.toNumber(), mtnBalanceBefore.toNumber())
        assert(mtnBalanceAfter.toNumber() > mtnBalanceBefore.toNumber(), 'MTN not recieved at ' + i + 'th hours after auction started')

        // check price
        lastPurchasePrice = await auctions.lastPurchasePrice()
        assert.equal(expectedPrice, lastPurchasePrice.toNumber(), 'Last purchase price is not correct at ' + i + 'th hours after auction started')
        assert.equal(0, currentAuction.toNumber(), 'Current auction is not correct at ' + i + 'th hours after auction started')

        // advance an hour
        advanceSeconds = SECS_IN_HOUR
        await TestRPCTime.timeTravel(advanceSeconds)
        await TestRPCTime.mineBlock()
        currentTimeOffset += advanceSeconds / SECS_IN_DAY
      }

      resolve()
    })
  })

  it('Should verify the auction behaviour at 10th tick of 3rd auction', () => {
    return new Promise(async (resolve, reject) => {
      const fromAccount = accounts[6]
      const amountUsedForPurchase = 1e18

      await initContracts(getCurrentTime(currentTimeOffset), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      // const startTime = currentTime() - (9 * 24 * 60 * 60) - 11 * 60
      // offset + 9 days + 10th tick
      const currentBlockTime = getCurrentBlockTime()
      const currentBlockTimeRounded = roundToNextMidnight(currentBlockTime)
      const SECS_TO_NEXT_MIDNIGHT = currentBlockTimeRounded - currentBlockTime

      // console.log('before', new Date(currentBlockTime * MILLISECS_IN_A_SEC).toUTCString())
      const advanceSeconds = SECS_TO_NEXT_MIDNIGHT + (SECS_IN_DAY * 9) + (10 * SECS_IN_MINUTE)
      await TestRPCTime.timeTravel(advanceSeconds)
      await TestRPCTime.mineBlock()
      currentTimeOffset += advanceSeconds / SECS_IN_DAY
      // console.log('after', new Date(getCurrentBlockTime() * MILLISECS_IN_A_SEC).toUTCString())

      const currentAuction = (await auctions.currentAuction()).toNumber()
      assert.equal(currentAuction, 3, 'Not at the 3rd auction')

      // expected token at 10th tick during 3rd auction for 1 ETH
      const expectedTokenPurchase = 55286367766094027433
      const expectedWeiPerToken = 18087641500176090
      const tokensInNextAuction = 8e24 + 3 * 2880e18

      // get estimate from auction
      const purchaseDetail = await auctions.whatWouldPurchaseDo(amountUsedForPurchase, getCurrentBlockTime())
      assert.equal(purchaseDetail[0].valueOf(), expectedWeiPerToken, ' weiPerToken is not correct')
      assert.equal(purchaseDetail[1].valueOf(), expectedTokenPurchase, 'Total calcualted tokens are not correct')
      assert.equal(purchaseDetail[2].valueOf(), 0, 'refund is not correct')

      // perform actual transaction
      const mtTokenBalanceBefore = await mtnToken.balanceOf(fromAccount)
      await auctions.sendTransaction({ from: fromAccount, value: amountUsedForPurchase })
      const mintable = await auctions.mintable()
      assert.equal(mintable.toNumber() + expectedTokenPurchase, tokensInNextAuction, 'Carried over tokens are not correct')

      const mtTokenBalanceAfter = await mtnToken.balanceOf(fromAccount)
      assert.equal(mtTokenBalanceAfter.sub(mtTokenBalanceBefore).valueOf(), expectedTokenPurchase, 'Total purchased/minted tokens are not correct')
      resolve()
    })
  })

  it('Should test heart beat function during operational auction skip 1 day', () => {
    return new Promise(async (resolve, reject) => {
      // operational auction started and no purchase yet. 10th tick
      const amount = 1e18
      await TestRPCTime.mineBlock()
      const currentBlockTime = getCurrentBlockTime()
      await initContracts(currentBlockTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      // fast forward time to opertional auction skipping first day
      const currentBlockTimeRounded = roundToNextMidnight(currentBlockTime)
      const SECS_TO_NEXT_MIDNIGHT = currentBlockTimeRounded - currentBlockTime
      // console.log('before', new Date(currentBlockTime * MILLISECS_IN_A_SEC).toUTCString())
      const advanceSeconds = SECS_TO_NEXT_MIDNIGHT + (SECS_IN_DAY * 8) + (10 * SECS_IN_MINUTE)
      await TestRPCTime.timeTravel(advanceSeconds)
      await TestRPCTime.mineBlock()
      currentTimeOffset += advanceSeconds / SECS_IN_DAY
      // console.log('after', new Date(getCurrentBlockTime() * MILLISECS_IN_A_SEC).toUTCString())

      // validate ticks and auctions
      const currentAuction = (await auctions.currentAuction()).toNumber()
      assert.equal(currentAuction, 2, 'Not at the 2nd auction')

      // TODO: should we have an assertion here?
      // const currentTick = (await auctions.currentTick()).toNumber()
      // assert.equal(currentTick, 10, 'Not at the 10th tick')

      // validate we are in the operation auction time period (skip day 1)
      const nowTime = getCurrentBlockTime()
      const genesisTime = (await auctions.genesisTime()).toNumber()
      assert(genesisTime < nowTime, 'Current time is not after genesisTime')
      const initialAuctionEndTime = (await auctions.initialAuctionEndTime()).toNumber()
      assert(initialAuctionEndTime < nowTime, 'Current time is not after the inital auction end time')
      const dailyAuctionStartTime = (await auctions.dailyAuctionStartTime()).toNumber()
      assert(nowTime > dailyAuctionStartTime, 'Current time is not after the next daily auction start time')

      // execute transaction by the buyer
      await auctions.sendTransaction({
        from: BUYER1,
        value: amount
      })

      // calculate expected price
      const expectedCurrentPrice = 18087641500176090

      // validate heartbeat
      const heartbeat = await auctions.heartbeat()

      var globalMtnSupply = await auctions.globalMtnSupply()
      var totalSupplyHere = await mtnToken.totalSupply()
      assert.equal(heartbeat[5].toNumber(), totalSupplyHere.toNumber(), 'total minted MTN is not correct')
      assert.equal(heartbeat[4].toNumber(), globalMtnSupply.sub(totalSupplyHere).toNumber(), 'Mintable is not correct')
      assert.equal(heartbeat[6].toNumber(), web3.eth.getBalance(proceeds.address).toNumber(), 'Proceed balance is not correct')
      const nextAuction = await auctions.nextAuction()
      assert(new Date(nextAuction[0] * MILLISECS_IN_A_SEC).toUTCString().indexOf('00:00:00') >= 0, 'nextAuction timestamp is not midnight')
      assert.equal(heartbeat[9].toNumber(), nextAuction[0].toNumber(), 'Next auction start time is not correct')
      assert.equal(heartbeat[11].toNumber(), expectedCurrentPrice, 'Current price is not correct')

      resolve()
    })
  })

  it('Should test heart beat function during operational auction', () => {
    return new Promise(async (resolve, reject) => {
      // operational auction started and no purchase yet. 10th tick
      const amount = 1e18
      await initContracts(getCurrentBlockTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      // fast forward time to opertional auction skipping first day
      const currentBlockTime = getCurrentBlockTime()
      const currentBlockTimeRounded = roundToNextMidnight(currentBlockTime)
      const SECS_TO_NEXT_MIDNIGHT = currentBlockTimeRounded - currentBlockTime
      // console.log('before', new Date(currentBlockTime * MILLISECS_IN_A_SEC).toUTCString())
      const advanceSeconds = SECS_TO_NEXT_MIDNIGHT + (SECS_IN_DAY * 7) + (10 * SECS_IN_MINUTE)
      await TestRPCTime.timeTravel(advanceSeconds)
      await TestRPCTime.mineBlock()
      currentTimeOffset += advanceSeconds / SECS_IN_DAY
      // console.log('after', new Date(getCurrentBlockTime() * MILLISECS_IN_A_SEC).toUTCString())

      // validate ticks and auctions
      const currentAuction = (await auctions.currentAuction()).toNumber()
      assert.equal(currentAuction, 1, 'Not at the 1st auction')

      // validate we are in the operation auction time period (skip day 1)
      const nowTime = getCurrentBlockTime()
      const genesisTime = (await auctions.genesisTime()).toNumber()
      assert(genesisTime < nowTime, 'Current time is not after genesisTime')
      const initialAuctionEndTime = (await auctions.initialAuctionEndTime()).toNumber()
      assert(initialAuctionEndTime < nowTime, 'Current time is not after the inital auction end time')
      const dailyAuctionStartTime = (await auctions.dailyAuctionStartTime()).toNumber()
      assert(nowTime > dailyAuctionStartTime, 'Current time is not after the next daily auction start time')

      // execute transaction by buyer
      await auctions.sendTransaction({
        from: BUYER1,
        value: amount
      })

      // calculate expected price
      const expectedCurrentPrice = 3617528300035217960

      // validate heatbeat
      const heartbeat = await auctions.heartbeat()

      var globalMtnSupply = await auctions.globalMtnSupply()
      var totalSupplyHere = await mtnToken.totalSupply()
      assert.equal(heartbeat[5].toNumber(), totalSupplyHere.toNumber(), 'total minted MTN is not correct')
      assert.equal(heartbeat[4].toNumber(), globalMtnSupply.sub(totalSupplyHere).toNumber(), 'Mintable is not correct')
      assert.equal(heartbeat[6].toNumber(), web3.eth.getBalance(proceeds.address).toNumber(), 'Proceed balance is not correct')
      const nextAuction = await auctions.nextAuction()
      assert(new Date(nextAuction[0] * MILLISECS_IN_A_SEC).toUTCString().indexOf('00:00:00') >= 0, 'nextAuction timestamp is not midnight')
      assert.equal(heartbeat[9].toNumber(), nextAuction[0].toNumber(), 'Next auction start time is not correct')
      assert.equal(heartbeat[11].toNumber(), expectedCurrentPrice, 'Current price is not correct')

      resolve()
    })
  })

  it('Should verify annual rate ​equal ​to ​2.0% ​of ​the ​then-outstanding ​supply ​per ​year ', () => {
    return new Promise(async (resolve, reject) => {
      await initContracts(getCurrentTime(currentTimeOffset), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      const amount = 1e17
      let currentBlockTime = getCurrentBlockTime()
      const currentBlockTimeRounded = roundToNextMidnight(currentBlockTime)
      const SECS_TO_NEXT_MIDNIGHT = currentBlockTimeRounded - currentBlockTime
      let advanceSeconds = SECS_TO_NEXT_MIDNIGHT + (10 * SECS_IN_MINUTE)

      await TestRPCTime.timeTravel(advanceSeconds)
      await TestRPCTime.mineBlock()
      let globalDailySupply = await auctions.globalDailySupply()
      advanceSeconds = SECS_TO_NEXT_MIDNIGHT + (SECS_IN_DAY * 14798) + (10 * SECS_IN_MINUTE)
      await TestRPCTime.timeTravel(advanceSeconds)
      await TestRPCTime.mineBlock()

      await auctions.sendTransaction({
        from: BUYER1,
        value: amount
      })

      let expectedDailySupply = 2880.27160103461e18
      var nextAuctionTokenBefore = await auctions.nextAuction()
      console.log('nextAuctionTokenBefore=', nextAuctionTokenBefore[2].valueOf())
      globalDailySupply = await auctions.globalDailySupply()
      assert.closeTo(expectedDailySupply, globalDailySupply.toNumber(), 2e8)

      await TestRPCTime.timeTravel(SECS_IN_DAY)
      await TestRPCTime.mineBlock()

      await auctions.sendTransaction({
        from: BUYER1,
        value: amount
      })

      expectedDailySupply = 2880.42931611201e18
      var nextAuctionTokenAfter = await auctions.nextAuction()
      console.log('nextAuctionTokenAfter=', nextAuctionTokenAfter[2].valueOf())
      console.log('difference=', nextAuctionTokenAfter[2].valueOf() - nextAuctionTokenBefore[2].valueOf())
      globalDailySupply = await auctions.globalDailySupply()
      assert.closeTo(expectedDailySupply, globalDailySupply.toNumber(), 2e8)

      await TestRPCTime.timeTravel(SECS_IN_DAY)
      await TestRPCTime.mineBlock()

      await auctions.sendTransaction({
        from: BUYER1,
        value: amount
      })

      expectedDailySupply = 2880.58703982542e18
      globalDailySupply = await auctions.globalDailySupply()

      assert.closeTo(expectedDailySupply, globalDailySupply.toNumber(), 2e8)

      await TestRPCTime.timeTravel(SECS_IN_DAY)
      await TestRPCTime.mineBlock()

      await auctions.sendTransaction({
        from: BUYER1,
        value: amount
      })

      expectedDailySupply = 2880.74477217531e18
      globalDailySupply = await auctions.globalDailySupply()

      assert.closeTo(expectedDailySupply, globalDailySupply.toNumber(), 2e8)
      await TestRPCTime.timeTravel(SECS_IN_DAY)
      await TestRPCTime.mineBlock()

      await auctions.sendTransaction({
        from: BUYER1,
        value: amount
      })

      expectedDailySupply = 2880.90251316215e18
      globalDailySupply = await auctions.globalDailySupply()

      assert.closeTo(expectedDailySupply, globalDailySupply.toNumber(), 2e8)

      resolve()
    })
  })

  describe('claim airdropped erc tokens', () => {
    ERCClaimableTests.tests(accounts, 'auctions')
  })
})
