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
const TokenLocker = artifacts.require('TokenLocker')

contract('Auctions', accounts => {
  const BUYER1 = accounts[6]
  const BUYER2 = accounts[8]
  const BUYER3 = accounts[7]

  const MET_INITIAL_SUPPLY = 0
  const DECMULT = 10 ** 18
  const MINIMUM_PRICE = 33 * 10 ** 11 // minimum wei per token
  const STARTING_PRICE = 2 // 2 ETH per MET
  const TIME_SCALE = 1
  const SECS_IN_DAY = 86400
  const SECS_IN_MINUTE = 60
  const SECS_IN_HOUR = 3600
  const MINUTES_IN_DAY = 24 * 60

  // before(async () => {
  //   await web3.eth.sendTransaction({
  //     from: accounts[8],
  //     to: OWNER,
  //     value: 30e18
  //   })
  // })

  it('Should verify that Auctions contract is initialized correctly ', () => {
    return new Promise(async (resolve, reject) => {
      const reserveAmount = 2000000 // 20% of total supply aka 2 million
      // auction start time will be provided time + 60
      const currentTime = BlockTime.getCurrentBlockTime()
      const genesisTime = (Math.floor(currentTime / 60) * 60) + 60

      const { auctions, proceeds, metToken, autonomousConverter, founders } = await Metronome.initContracts(accounts, currentTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      assert.equal(await auctions.proceeds(), proceeds.address, 'Proceeds address isn`t setup correctly')
      assert.equal(await auctions.token(), metToken.address, 'METToken address isn\'t setup correctly')
      assert.equal(await auctions.genesisTime(), genesisTime, 'genesisTime isn\'t setup correctly')
      assert.equal(await auctions.minimumPrice(), MINIMUM_PRICE, 'minimumPrice isn\'t setup correctly')
      assert.equal(await auctions.lastPurchasePrice(), web3.toWei(STARTING_PRICE), 'startingPrice isn\'t setup correctly')
      assert.equal(await auctions.timeScale(), TIME_SCALE, 'time scale isn\'t setup correctly')

      let totalFounderMints = 0
      for (let i = 0; i < founders.length; i++) {
        const founderAddress = founders[i].slice(0, 42)
        const tokenLockerAddress = await auctions.tokenLockers(founderAddress)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)
        totalFounderMints += (await metToken.balanceOf(tokenLocker.address)).toNumber() / DECMULT
      }
      totalFounderMints *= DECMULT
      assert.equal(totalFounderMints, (reserveAmount - 1) * DECMULT, 'Reserve for founders isn\'t setup correctly')

      // Auctions will mint 1 token for autonomous converter
      assert.equal(await metToken.balanceOf(autonomousConverter.address), (MET_INITIAL_SUPPLY + 1) * DECMULT, 'Reserve for founders isn\'t setup correctly')

      resolve()
    })
  })

  it('Should verify that Auctions contract is initialized correctly with defaults', () => {
    return new Promise(async (resolve, reject) => {
      // When 0 is provided for auction start time, it will be calculated
      // using block timestamp, block.timestamp + 60
      const currentTime = BlockTime.getCurrentBlockTime()
      const genesisTime = (Math.floor(currentTime / 60) * 60) + 60
      const defaultStartingPrice = 2 // 2 ETH per MET
      const defaultMinimumPrice = 33 * 10 ** 11

      const { auctions } = await Metronome.initContracts(accounts, 0, 0, 0, TIME_SCALE)

      assert.equal(await auctions.genesisTime(), genesisTime, 'default genesisTime isn\'t setup correctly or test took longer in execution')
      assert.equal(await auctions.minimumPrice(), defaultMinimumPrice, 'default minimumPrice isn\'t setup correctly')
      assert.equal(await auctions.lastPurchasePrice(), web3.toWei(defaultStartingPrice), 'default startingPrice isn\'t setup correctly')

      resolve()
    })
  })

  it('Should return true indicating auction is running', () => {
    return new Promise(async (resolve, reject) => {
      const { auctions } = await Metronome.initContracts(accounts, 1, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      assert.ok(await auctions.isRunning(), 'Auctions should be running')
      resolve()
    })
  })

  it('Should buy MET every hour during initial auction until 3 days ', () => {
    return new Promise(async (resolve, reject) => {
      // initialize auction
      await BlockTime.mineBlock()
      const currentTime = await BlockTime.getCurrentBlockTime()
      const { auctions, metToken } = await Metronome.initContracts(accounts, currentTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      // advance a minute so action can start
      let advanceSeconds = SECS_IN_MINUTE
      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()

      // validate we are at the begining of initial auction
      const nowTime = BlockTime.getCurrentBlockTime()
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
      let metBalanceBefore = await metToken.balanceOf(fromAccount)
      let metBalanceAfter = metBalanceBefore
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
        metBalanceBefore = metBalanceAfter
        metBalanceAfter = await metToken.balanceOf(fromAccount)
        currentAuction = await auctions.currentAuction()
        assert(metBalanceAfter.toNumber() > metBalanceBefore.toNumber(), 'MET not recieved at ' + i + 'th hours after auction started')

        // check price
        lastPurchasePrice = await auctions.lastPurchasePrice()
        assert.equal(expectedPrice, lastPurchasePrice.toNumber(), 'Last purchase price is not correct at ' + i + 'th hours after auction started')
        assert.equal(0, currentAuction.toNumber(), 'Current auction is not correct at ' + i + 'th hours after auction started')

        // advance an hour
        advanceSeconds = SECS_IN_HOUR
        await BlockTime.timeTravel(advanceSeconds)
        await BlockTime.mineBlock()
      }

      resolve()
    })
  })

  it('Should buy MET every day and observe mintable tokens', () => {
    return new Promise(async (resolve, reject) => {
      // initialize auction
      await BlockTime.mineBlock()
      const { auctions, metToken } = await Metronome.initContracts(accounts, BlockTime.getCurrentBlockTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      // advance a minute so action can start
      let advanceSeconds = SECS_IN_MINUTE
      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()

      // validate we are at the begining of initial auction
      const nowTime = BlockTime.getCurrentBlockTime()
      const genesisTime = (await auctions.genesisTime()).toNumber()
      assert(nowTime > genesisTime, 'Current time is not after genesisTime')
      const initialAuctionEndTime = (await auctions.initialAuctionEndTime()).toNumber()
      assert(nowTime < initialAuctionEndTime, 'Current time is after the inital auction end time')
      const dailyAuctionStartTime = (await auctions.dailyAuctionStartTime()).toNumber()
      assert(nowTime < dailyAuctionStartTime, 'Current time is not before the next daily auction start time')

      // simulate hourly buys for three days
      const fromAccount = BUYER1
      const amount = web3.toWei(0.001, 'ether')
      const totalDays = 14
      let expectedToken = 0
      let expectedPrice = 2e18
      let metBalanceBefore = await metToken.balanceOf(fromAccount)
      let metBalanceAfter = metBalanceBefore
      const MULTIPLIER = 1984320568 * 10 ** 5
      let currentAuction = 0
      let tx, log
      let mintabeBefore, mintableAfter
      mintableAfter = await auctions.mintable()

      for (let i = 0; i < totalDays; i++) {
        // peform buy
        tx = await auctions.sendTransaction({
          from: fromAccount,
          value: amount
        })
        if (i > 0) {
          if (i <= 7) {
            expectedPrice = expectedPrice - (MULTIPLIER * (Math.floor(advanceSeconds / 60)))
            if (expectedPrice < MINIMUM_PRICE) {
              expectedPrice = MINIMUM_PRICE * 2
            }
          } else {
            expectedPrice = expectedPrice * (0.99 ** MINUTES_IN_DAY)
            if (expectedPrice < MINIMUM_PRICE) {
              expectedPrice = MINIMUM_PRICE
            }
            expectedPrice = expectedPrice * 2
          }
        }

        log = tx.logs[0]
        mintabeBefore = mintableAfter
        mintableAfter = await auctions.mintable()

        expectedToken = expectedToken + ((amount * 1e18) / expectedPrice)
        // check balances and validate pprice
        metBalanceBefore = metBalanceAfter
        metBalanceAfter = await metToken.balanceOf(fromAccount)
        currentAuction = await auctions.currentAuction()

        let errorDetla = 1e7
        assert.closeTo(metBalanceAfter.sub(metBalanceBefore).toNumber(), log.args.tokens.toNumber(), errorDetla, 'MET token issued is wrong at ' + i + 'th day')
        if (currentAuction.toNumber() > 0) {
          assert.closeTo(mintableAfter.toNumber() - mintabeBefore.toNumber() + log.args.tokens.toNumber(), 2880e18, 50e8, 'Minted token is wrong at ' + i + 'th day')
        }
        // advance a day
        if (i === 6) {
          let SECS_TO_NEXT_MIDNIGHT = await BlockTime.getSecondsToNextMidnight()
          advanceSeconds = SECS_TO_NEXT_MIDNIGHT + 10
        } else {
          advanceSeconds = SECS_IN_DAY
        }

        await BlockTime.timeTravel(advanceSeconds)
        await BlockTime.mineBlock()
      }
      resolve()
    })
  })

  it('Should verify the auction behaviour at 10th tick of 3rd auction', () => {
    return new Promise(async (resolve, reject) => {
      const fromAccount = accounts[6]
      const amountUsedForPurchase = 1e18
      let currentBlockTime = BlockTime.getCurrentBlockTime()

      const { auctions, metToken } = await Metronome.initContracts(accounts, currentBlockTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      // const startTime = currentTime() - (9 * 24 * 60 * 60) - 11 * 60
      // offset + 9 days + 10th tick
      let SECS_TO_NEXT_MIDNIGHT = await BlockTime.getSecondsToNextMidnight()
      let advanceSeconds = SECS_TO_NEXT_MIDNIGHT + (SECS_IN_DAY * 9) + (10 * SECS_IN_MINUTE)
      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()

      const currentAuction = (await auctions.currentAuction()).toNumber()
      assert.equal(currentAuction, 3, 'Not at the 3rd auction')

      // expected token at 10th tick during 3rd auction for 1 ETH
      const expectedTokenPurchase = 55286367766094027433
      const expectedWeiPerToken = 18087641500176090
      const tokensInNextAuction = 8e24 + 3 * 2880e18

      // get estimate from auction
      const purchaseDetail = await auctions.whatWouldPurchaseDo(amountUsedForPurchase, BlockTime.getCurrentBlockTime())
      assert.equal(purchaseDetail[0].valueOf(), expectedWeiPerToken, ' weiPerToken is not correct')
      assert.equal(purchaseDetail[1].valueOf(), expectedTokenPurchase, 'Total calcualted tokens are not correct')
      assert.equal(purchaseDetail[2].valueOf(), 0, 'refund is not correct')
      // perform actual transaction
      const mtTokenBalanceBefore = await metToken.balanceOf(fromAccount)
      await auctions.sendTransaction({ from: fromAccount, value: amountUsedForPurchase })
      let mintable = await auctions.mintable()
      assert.equal(mintable.toNumber() + expectedTokenPurchase, tokensInNextAuction, 'Carried over tokens are not correct')

      const mtTokenBalanceAfter = await metToken.balanceOf(fromAccount)
      assert.equal(mtTokenBalanceAfter.sub(mtTokenBalanceBefore).valueOf(), expectedTokenPurchase, 'Total purchased/minted tokens are not correct')

      SECS_TO_NEXT_MIDNIGHT = await BlockTime.getSecondsToNextMidnight()
      advanceSeconds = SECS_TO_NEXT_MIDNIGHT + 10
      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()

      const expectedNextAuctionPrice = 20736727076

      await auctions.sendTransaction({
        from: BUYER1,
        value: amountUsedForPurchase
      })
      let lastPurchasePrice = await auctions.lastPurchasePrice()
      assert.closeTo(expectedNextAuctionPrice, lastPurchasePrice.toNumber(), 20)
      resolve()
    })
  })

  it('Should test heart beat function during operational auction skip 1 day', () => {
    return new Promise(async (resolve, reject) => {
      // operational auction started and no purchase yet. 10th tick
      const amount = 1e18
      await BlockTime.mineBlock()
      const currentBlockTime = BlockTime.getCurrentBlockTime()
      const { auctions, metToken, proceeds } = await Metronome.initContracts(accounts, currentBlockTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      // fast forward time to opertional auction skipping first day
      const SECS_TO_NEXT_MIDNIGHT = await BlockTime.getSecondsToNextMidnight()
      const advanceSeconds = SECS_TO_NEXT_MIDNIGHT + (SECS_IN_DAY * 8) + (10 * SECS_IN_MINUTE)
      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()

      // validate ticks and auctions
      const currentAuction = (await auctions.currentAuction()).toNumber()
      assert.equal(currentAuction, 2, 'Not at the 2nd auction')

      // validate we are in the operation auction time period (skip day 1)
      const nowTime = BlockTime.getCurrentBlockTime()
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

      var globalMetSupply = await auctions.globalMetSupply()
      var totalSupplyHere = await metToken.totalSupply()
      assert.equal(heartbeat[5].toNumber(), totalSupplyHere.toNumber(), 'total minted MET is not correct')
      assert.equal(heartbeat[4].toNumber(), globalMetSupply.sub(totalSupplyHere).toNumber(), 'Mintable is not correct')
      assert.equal(heartbeat[6].toNumber(), web3.eth.getBalance(proceeds.address).toNumber(), 'Proceed balance is not correct')
      let nextAuctionStartTime = dailyAuctionStartTime + (heartbeat[8].toNumber() * SECS_IN_DAY)
      assert.equal(heartbeat[9].toNumber(), nextAuctionStartTime, 'Next auction start time is not correct')
      assert.equal(heartbeat[11].toNumber(), expectedCurrentPrice, 'Current price is not correct')

      resolve()
    })
  })

  it('Should test start price of daily auctions', () => {
    return new Promise(async (resolve, reject) => {
      // operational auction started and no purchase yet. 10th tick
      const amount = 1e18
      await BlockTime.mineBlock()
      const currentBlockTime = BlockTime.getCurrentBlockTime()
      const { auctions } = await Metronome.initContracts(accounts, currentBlockTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      // fast forward time to opertional auction skipping first day
      let SECS_TO_NEXT_MIDNIGHT = await BlockTime.getSecondsToNextMidnight()

      let advanceSeconds = SECS_TO_NEXT_MIDNIGHT + (SECS_IN_DAY * 7) + 10
      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()

      // execute transaction by the buyer
      await auctions.sendTransaction({
        from: BUYER1,
        value: amount
      })
      let lastPurchasePrice = await auctions.lastPurchasePrice()
      const expectedPrice = 6600000000000
      assert.equal(lastPurchasePrice.valueOf(), expectedPrice, 'Purchase price is not correct')
      resolve()
    })
  })

  it('Should test heart beat function during operational auction', () => {
    return new Promise(async (resolve, reject) => {
      // operational auction started and no purchase yet. 10th tick
      const amount = 1e18
      const { auctions, metToken, proceeds } = await Metronome.initContracts(accounts, BlockTime.getCurrentBlockTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      // fast forward time to opertional auction skipping first day
      const SECS_TO_NEXT_MIDNIGHT = await BlockTime.getSecondsToNextMidnight()
      const advanceSeconds = SECS_TO_NEXT_MIDNIGHT + (SECS_IN_DAY * 7) + (10 * SECS_IN_MINUTE)
      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()

      // validate ticks and auctions
      const currentAuction = (await auctions.currentAuction()).toNumber()
      assert.equal(currentAuction, 1, 'Not at the 1st auction')

      // validate we are in the operation auction time period (skip day 1)
      const nowTime = BlockTime.getCurrentBlockTime()
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
      const expectedCurrentPrice = 5968921695058

      // validate heatbeat
      const heartbeat = await auctions.heartbeat()
      var globalMetSupply = await auctions.globalMetSupply()
      var totalSupplyHere = await metToken.totalSupply()
      assert.equal(heartbeat[5].toNumber(), totalSupplyHere.toNumber(), 'total minted MET is not correct')
      assert.equal(heartbeat[4].toNumber(), globalMetSupply.sub(totalSupplyHere).toNumber(), 'Mintable is not correct')
      assert.equal(heartbeat[6].toNumber(), web3.eth.getBalance(proceeds.address).toNumber(), 'Proceed balance is not correct')
      let nextAuctionStartTime = dailyAuctionStartTime + (heartbeat[8].toNumber() * SECS_IN_DAY)
      assert.equal(heartbeat[9].toNumber(), nextAuctionStartTime, 'Next auction start time is not correct')
      assert.equal(heartbeat[11].toNumber(), expectedCurrentPrice, 'Current price is not correct')

      resolve()
    })
  })

  it('Should verify annual rate ​equal ​to ​2.0% ​of ​the ​then-outstanding ​supply ​per ​year ', () => {
    return new Promise(async (resolve, reject) => {
      await BlockTime.mineBlock()
      const { auctions } = await Metronome.initContracts(accounts, BlockTime.getCurrentBlockTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      const amount = 1e17

      const SECS_TO_NEXT_MIDNIGHT = await BlockTime.getSecondsToNextMidnight()
      let advanceSeconds = SECS_TO_NEXT_MIDNIGHT + (10 * SECS_IN_MINUTE)

      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()
      let globalDailySupply = await auctions.globalDailySupply()

      advanceSeconds = SECS_TO_NEXT_MIDNIGHT + (SECS_IN_DAY * 14798) + (10 * SECS_IN_MINUTE)
      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()

      await auctions.sendTransaction({
        from: BUYER1,
        value: amount
      })

      let expectedDailySupply = 2880.27160103461e18

      globalDailySupply = await auctions.globalDailySupply()
      assert.closeTo(expectedDailySupply, globalDailySupply.toNumber(), 2e8)

      await BlockTime.timeTravel(SECS_IN_DAY)
      await BlockTime.mineBlock()

      await auctions.sendTransaction({
        from: BUYER1,
        value: amount
      })

      expectedDailySupply = 2880.42931611201e18

      globalDailySupply = await auctions.globalDailySupply()
      assert.closeTo(expectedDailySupply, globalDailySupply.toNumber(), 2e8)

      await BlockTime.timeTravel(SECS_IN_DAY)
      await BlockTime.mineBlock()

      await auctions.sendTransaction({
        from: BUYER1,
        value: amount
      })

      expectedDailySupply = 2880.58703982542e18
      globalDailySupply = await auctions.globalDailySupply()

      assert.closeTo(expectedDailySupply, globalDailySupply.toNumber(), 2e8)

      await BlockTime.timeTravel(SECS_IN_DAY)
      await BlockTime.mineBlock()

      await auctions.sendTransaction({
        from: BUYER1,
        value: amount
      })

      expectedDailySupply = 2880.74477217531e18

      globalDailySupply = await auctions.globalDailySupply()

      assert.closeTo(expectedDailySupply, globalDailySupply.toNumber(), 2e8)
      await BlockTime.timeTravel(SECS_IN_DAY)
      await BlockTime.mineBlock()

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

  it('Should test current price at the start of 1st daily auction, initial auction not sold out', () => {
    return new Promise(async (resolve, reject) => {
      const amount = 1e18
      const minimumPrice = 33e11
      await BlockTime.mineBlock()
      var currentBlockTime = BlockTime.getCurrentBlockTime()
      const { auctions } = await Metronome.initContracts(accounts, currentBlockTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      let advanceSeconds = SECS_IN_DAY
      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()
      // execute transaction by the buyer
      await auctions.sendTransaction({
        from: BUYER3,
        value: amount
      })

      // fast forward to the start of 1st daily auction
      await BlockTime.mineBlock()

      let SECS_TO_NEXT_MIDNIGHT = await BlockTime.getSecondsToNextMidnight()
      advanceSeconds = SECS_TO_NEXT_MIDNIGHT + (6 * SECS_IN_DAY) + 20
      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()

      const currentAuction = await auctions.currentAuction()
      assert.equal(currentAuction.valueOf(), 1, 'Current auction is not correct')
      const currentPrice = await auctions.currentPrice()
      assert.equal(currentPrice.valueOf(), minimumPrice * 2, 'Current price is not correct')

      resolve()
    })
  })

  it('Should test current price at the start of 2nd daily auction, when prev auctions sold out', () => {
    return new Promise(async (resolve, reject) => {
      const amount = 1e18
      await BlockTime.mineBlock()
      var currentBlockTime = BlockTime.getCurrentBlockTime()
      const { auctions } = await Metronome.initContracts(accounts, currentBlockTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      // fast forward towards the end of 1st daily auction
      let SECS_TO_NEXT_MIDNIGHT = await BlockTime.getSecondsToNextMidnight()
      let advanceSeconds = SECS_TO_NEXT_MIDNIGHT + (8 * SECS_IN_DAY) - (2 * SECS_IN_HOUR)

      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()
      // execute transaction by the buyer, auction will be sold out
      await auctions.sendTransaction({
        from: BUYER3,
        value: amount
      })

      const currentPriceAfterPurchase = await auctions.currentPrice()
      // fast forward to the start of 2nd daily auction
      advanceSeconds = (2 * SECS_IN_HOUR) + 20
      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()

      const currentAuction = await auctions.currentAuction()
      assert.equal(currentAuction.valueOf(), 2, 'Current auction is not correct')
      const currentPrice = await auctions.currentPrice()
      assert.equal(currentPrice.valueOf(), currentPriceAfterPurchase * 2, 'Current price is not correct')

      resolve()
    })
  })
})
