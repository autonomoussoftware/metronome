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
const METToken = artifacts.require('METToken')
const SmartToken = artifacts.require('SmartToken')
const Proceeds = artifacts.require('Proceeds')
const AutonomousConverter = artifacts.require('AutonomousConverter')
const Auctions = artifacts.require('Auctions')
const TokenLocker = artifacts.require('TokenLocker')

contract('Auctions', accounts => {
  const BAD_BUYER = accounts[6]
  const MET_INITIAL_SUPPLY = 0
  const SMART_INITIAL_SUPPLY = 0
  const DECMULT = 10 ** 18
  const MINIMUM_PRICE = 33 * 10 ** 11 // minimum wei per token
  const STARTING_PRICE = 2 // 2 ETH per MET
  const TIME_SCALE = 1
  const INITIAL_AUCTION_DURATION = 7 * 24 * 60// 7 days in minutes
  const MILLISECS_IN_A_SEC = 1000
  const SECS_IN_A_DAY = 86400

  const OWNER = accounts[0]
  const OWNER_TOKENS_HEX = '0000D3C214DE7193CD4E0000'
  const FOUNDER = accounts[1]
  const FOUNDER_TOKENS_HEX = '0000D3C214DE7193CD4E0000'

  let metToken, smartToken, proceeds, autonomousConverter, auctions

  function currentTime () {
    const timeInSeconds = new Date().getTime() / 1000
    return Math.floor(timeInSeconds / 60) * 60 // time in seconds, rounded to a minute
  }

  async function initContracts (startTime, minimumPrice, startingPrice, timeScale) {
    metToken = await METToken.new(autonomousConverter.address, auctions.address, MET_INITIAL_SUPPLY, DECMULT, {from: OWNER})
    smartToken = await SmartToken.new(autonomousConverter.address, autonomousConverter.address, SMART_INITIAL_SUPPLY, {from: OWNER})

    const founders = []
    // Since we are appending it with hexadecimal address so amount should also be
    // in hexa decimal. Hence 999999e18 = 0000d3c21bcecceda1000000 in 24 character ( 96 bits)
    // 1000000e18 =  0000d3c20dee1639f99c0000
    founders.push(OWNER + OWNER_TOKENS_HEX)
    founders.push(FOUNDER + FOUNDER_TOKENS_HEX)
    await autonomousConverter.init(metToken.address, smartToken.address, auctions.address,
      {
        from: OWNER,
        value: web3.toWei(1, 'ether')
      })
    await proceeds.initProceeds(autonomousConverter.address, auctions.address, {from: OWNER})
    await auctions.mintInitialSupply(founders, metToken.address, proceeds.address, autonomousConverter.address, {from: OWNER})
    await auctions.initAuctions(startTime, minimumPrice, startingPrice, timeScale, {from: OWNER})
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
      const genesisTime = currentTime() + 60

      await initContracts(currentTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      assert.equal(await auctions.proceeds(), proceeds.address, 'Proceeds address isn`t setup correctly')
      assert.equal(await auctions.token(), metToken.address, 'METToken address isn\'t setup correctly')
      assert.equal(await auctions.genesisTime(), genesisTime, 'genesisTime isn\'t setup correctly')
      assert.equal(await auctions.minimumPrice(), MINIMUM_PRICE, 'minimumPrice isn\'t setup correctly')
      assert.equal(await auctions.lastPurchasePrice(), web3.toWei(STARTING_PRICE), 'startingPrice isn\'t setup correctly')
      assert.equal(await auctions.timeScale(), TIME_SCALE, 'time scale isn\'t setup correctly')

      const founders = [
        { address: await auctions.founders(0), targetTokens: parseInt(OWNER_TOKENS_HEX, 16) },
        { address: await auctions.founders(1), targetTokens: parseInt(FOUNDER_TOKENS_HEX, 16) }]

      let totalFounderMints = 0
      for (let i = 0; i < founders.length; i++) {
        const founder = founders[i]
        const tokenLockerAddress = await auctions.tokenLockers(founder.address)
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
      const defaultAuctionTime = currentTime() + 60
      const defaultStartingPrice = 2 // 2 ETH per MET
      const defaultMinimumPrice = 33 * 10 ** 11

      await initContracts(0, 0, 0, TIME_SCALE)

      assert.equal((await auctions.genesisTime()).toNumber(), defaultAuctionTime, 'default genesisTime isn\'t setup correctly or test took longer in execution')
      assert.equal((await auctions.minimumPrice()).toNumber(), defaultMinimumPrice, 'default minimumPrice isn\'t setup correctly')
      assert.equal((await auctions.lastPurchasePrice()).toNumber(), web3.toWei(defaultStartingPrice), 'default startingPrice isn\'t setup correctly')

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

  it('Should verify that current tick in metronome clock is equal to 1', () => {
    return new Promise(async (resolve, reject) => {
      // if you do change time scale, return will be based on block time
      // and time taken by test to run, which is unpredicted for assert.

      // genesisTime is equal to provided time + 60
      // To set genesisTime one minute in past, we need currentTime -120
      const time = currentTime() - 120
      await initContracts(time, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      const currentTick = await auctions.currentTick()
      assert.equal(currentTick.valueOf(), 1, 'Current tick should be equal to 1')

      resolve()
    })
  })

  it('Should verify that metronome clock tick is 5, for given time and timeScale', () => {
    return new Promise(async (resolve, reject) => {
      // genesisTime is equal to provided time + 60
      // To set genesisTime one minute in past, we need currentTime -120
      const time = currentTime() - 120
      await initContracts(time, MINIMUM_PRICE, STARTING_PRICE, 5)

      const whichTick = await auctions.whichTick(currentTime())
      assert.equal(whichTick.valueOf(), 5, 'whichTick should be equal to 5')

      resolve()
    })
  })

  it('Should verify that auction is equal to 1 for given metronome tick', () => {
    return new Promise(async (resolve, reject) => {
      await initContracts(0, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      const dailyAuctionStartTime = await auctions.dailyAuctionStartTime()
      const genesisTime = await auctions.genesisTime()
      const metronomeTick = Math.floor((dailyAuctionStartTime - genesisTime) / 60)
      const whichAuction = await auctions.whichAuction(metronomeTick + 1)
      assert.equal(whichAuction.valueOf(), 1, 'whichAuction should be equal to 1')

      resolve()
    })
  })

  it('Should stop auction and change auction start time to 1000 years from now', () => {
    return new Promise(async (resolve, reject) => {
      await initContracts(currentTime() + (10 * 60), 0, 0, TIME_SCALE)
      await auctions.stopEverything()

      const updatedDailyAuctionTime = await auctions.dailyAuctionStartTime()
      const updatedGenesisTime = await auctions.genesisTime()
      const updatedInitialAuctionEndTime = await auctions.initialAuctionEndTime()
      let updatedDate = new Date(updatedDailyAuctionTime.valueOf() * 1000)

      // Some bug in solidity while adding 1000 years. its adding 1000 minus few months.
      assert.isAbove(updatedDate.getFullYear(), (new Date().getFullYear()) + 900, 'Daily auction start time is not updated correctly')

      updatedDate = new Date(updatedGenesisTime.valueOf() * 1000)
      assert.isAbove(updatedDate.getFullYear(), (new Date().getFullYear()) + 900, 'Auction genesis time is not updated correctly')
      updatedDate = new Date(updatedInitialAuctionEndTime.valueOf() * 1000)
      assert.isAbove(updatedDate.getFullYear(), (new Date().getFullYear()) + 900, 'Auction InitialAuctionEndTime is not updated correctly')
      resolve()
    })
  })

  it('Should return global supply after 1 auction', () => {
    return new Promise(async (resolve, reject) => {
      // Initial supply defined in autions + (daily supply * auctions)
      const expectedSupply = (10000000 + (2880 * 1)) * DECMULT
      // set genesisTime to 7 days and 1 day earlier (auction off period and few hours)
      const startTime = currentTime() - ((INITIAL_AUCTION_DURATION * 60) + SECS_IN_A_DAY)
      await initContracts(startTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      const globalMETSupply = await auctions.globalMetSupply()
      assert.equal(globalMETSupply.valueOf(), expectedSupply, 'global supply is not correct')

      resolve()
    })
  })

  it('Should return auction supply aka amount needed to mint for next auction', () => {
    return new Promise(async (resolve, reject) => {
      // Daily supply according to white paper
      const dailySupply = 2880 * DECMULT
      // time of previous day in seconds, 24*60*60 aka a day in seconds
      // set genesisTime to one day and a minute earlier (provided + 60)
      const previousDay = currentTime() - SECS_IN_A_DAY - 120
      await initContracts(previousDay, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      const heartbeat = await auctions.heartbeat()
      assert.equal(heartbeat[12].toNumber(), dailySupply, 'auction supply is not correct')

      resolve()
    })
  })

  it('Should return current price in weiPerToken at 0th tick', () => {
    return new Promise(async (resolve, reject) => {
      // at 0th tick
      const expectedWeiPerToken = STARTING_PRICE * DECMULT
      await initContracts(currentTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      const currentAuction = (await auctions.currentAuction()).toNumber()
      assert.equal(currentAuction, 0, 'Not at the 0th auction')

      const currentTick = (await auctions.currentTick()).toNumber()
      assert.equal(currentTick, 0, 'Not at the 0th tick')

      const weiPerToken = await auctions.currentPrice()
      assert.equal(weiPerToken.valueOf(), expectedWeiPerToken, 'WeiPerToken is not correct at 0th tick')

      resolve()
    })
  })

  it('Should return current price in weiPerToken at 10th tick', () => {
    return new Promise(async (resolve, reject) => {
      // at 0th tick
      const expectedWeiPerToken = 1998015679432000000
      // 10 tick, 10 * 60
      const startTime = currentTime() - 10 * 60 - 60
      await initContracts(startTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      const currentAuction = (await auctions.currentAuction()).toNumber()
      assert.equal(currentAuction, 0, 'Not at the 0th auction')

      const currentTick = (await auctions.currentTick()).toNumber()
      assert.equal(currentTick, 10, 'Not at the 10th tick')

      const weiPerToken = await auctions.currentPrice()
      assert.equal(weiPerToken.valueOf(), expectedWeiPerToken, 'WeiPerToken is not correct at 10th tick')

      resolve()
    })
  })

  it('Should mint correct purchased token for 10 ETH, in first auction, at 0th tick', () => {
    return new Promise(async (resolve, reject) => {
      const fromAccount = accounts[9]
      const expectedToken = 5 * DECMULT
      const amount = web3.toWei(10, 'ether')
      // currentTime()-30 will leads to genesisTime = currentTime
      await initContracts(currentTime() - 30, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      const currentAuction = (await auctions.currentAuction()).toNumber()
      assert.equal(currentAuction, 0, 'Not at the 0th auction')

      const currentTick = (await auctions.currentTick()).toNumber()
      assert.equal(currentTick, 0, 'Not at the 0th tick')

      await auctions.sendTransaction({
        from: fromAccount,
        value: amount
      })

      assert.equal(await auctions.lastPurchasePrice(), STARTING_PRICE * DECMULT, 'Purchase price is not correct')
      assert.equal(await metToken.balanceOf(fromAccount), expectedToken, 'Tokens are not minted correctly')
      assert.equal(await web3.eth.getBalance(proceeds.address), amount, 'Amount forwarded to proceeds in not correct')
      resolve()
    })
  })

  it('Should refund excess amount when initial auction is soldout', () => {
    return new Promise(async (resolve, reject) => {
      const startTime = currentTime() - (INITIAL_AUCTION_DURATION * 60)
      const fromAccount = accounts[3]
      const balanceBefore = web3.eth.getBalance(fromAccount).valueOf()
      const amountUsedForPurchase = 27e18 // 27 ETH can purchase all met after 7 days
      const totalTokenForPurchase = 8e24 // aka 8 million
      await initContracts(startTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      const tx = await auctions.sendTransaction({
        from: fromAccount,
        value: amountUsedForPurchase
      })

      const balanceAfter = web3.eth.getBalance(fromAccount).valueOf()
      let metTokenBalance = await metToken.balanceOf(fromAccount)
      // This assert will make sure that when user send more money than required to purchase available tokens
      // refund will be issued and difference will be less than amount used to purchase tokens due to refund.
      assert.isBelow(balanceBefore - balanceAfter, amountUsedForPurchase, 'Difference is higher than expected')
      assert.equal(metTokenBalance.valueOf(), totalTokenForPurchase, 'Total purchased/minted tokens are not correct')

      assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted')
      const log = tx.logs[0]
      assert.equal(log.event, 'LogAuctionFundsIn', 'LogAuctionFundsIn log was not emitted')
      let amount = log.args.amount
      let lastPurchasePrice = await auctions.lastPurchasePrice()
      assert.isBelow(amount.toNumber(), amountUsedForPurchase, 'Amount logged in event is not correct')
      assert.equal(log.args.tokens, totalTokenForPurchase, 'Token logged in event is not correct')
      assert.equal(log.args.purchasePrice, lastPurchasePrice.valueOf(), 'Purchase price logged in event is not correct')
      resolve()
    })
  })

  it('Should test currentPrice is equal to minimumPrice during initial auction', () => {
    return new Promise(async (resolve, reject) => {
      const startTime = currentTime() - (5 * 24 * 60 * 60)

      await initContracts(startTime, MINIMUM_PRICE, 1, TIME_SCALE)

      const currentPrice = await auctions.currentPrice()
      assert.equal(currentPrice.valueOf(), MINIMUM_PRICE, 'Current price is not equal to minimum price')
      resolve()
    })
  })

  it('Should verify that current auction is equal to 1, for given time and timeScale', () => {
    return new Promise(async (resolve, reject) => {
      // set genesisTime to 7 days and 1 day earlier (auction off period and few hours)
      const startTime = currentTime() - ((INITIAL_AUCTION_DURATION * 60) + SECS_IN_A_DAY)
      await initContracts(startTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      let currentAuction = await auctions.currentAuction()
      assert.equal(currentAuction.valueOf(), 1, 'Current auction should be equal to 1')

      resolve()
    })
  })

  it('Should verify that current auction is equal to 2, for given time and timeScale', () => {
    return new Promise(async (resolve, reject) => {
      // set genesisTime to 8 days and 1 day earlier (auction off period and few hours)
      const eightDaysAgo = currentTime() - (INITIAL_AUCTION_DURATION) * 60 - 2 * SECS_IN_A_DAY
      await initContracts(eightDaysAgo, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      const currentAuction = await auctions.currentAuction()
      assert.equal(currentAuction.valueOf(), 2, 'Current auction should be equal to 2')

      resolve()
    })
  })

  it('Should test Global daily met supply', () => {
    return new Promise(async (resolve, reject) => {
      // 10th tick
      const startTime = ((currentTime() - 11 * 60))

      await initContracts(startTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      const globaldailySupply = await auctions.globalDailySupply()

      assert.equal(globaldailySupply.valueOf(), 2880e18, ' Global daily met supply is not correct')

      resolve()
    })
  })

  it('Should test heart beat function during initial auction', () => {
    return new Promise(async (resolve, reject) => {
      const startTime = ((currentTime() - (4 * SECS_IN_A_DAY) - 60))
      const expectedCurrentPrice = 857031352832000000
      await initContracts(startTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      const heartbeat = await auctions.heartbeat()
      var globalMetSupply = await auctions.globalMetSupply()
      var totalSupplyHere = await metToken.totalSupply()
      assert.equal(heartbeat[1].valueOf(), auctions.address, 'Auctions address is not correct')
      assert.equal(heartbeat[2].valueOf(), autonomousConverter.address, 'autonomousConverter address is not correct')
      assert.equal(heartbeat[3].valueOf(), metToken.address, 'METToken address is not correct')
      assert.equal(heartbeat[5].valueOf(), totalSupplyHere, 'total minted MET is not correct')
      assert.equal(heartbeat[4].valueOf(), globalMetSupply.sub(totalSupplyHere), 'Mintable is not correct')
      assert.equal(heartbeat[6].valueOf(), web3.eth.getBalance(proceeds.address), 'Proceed balance is not correct')
      assert.equal(heartbeat[7].valueOf(), await auctions.currentTick(), 'Current tick is not correct')
      assert.equal(heartbeat[8].valueOf(), await auctions.currentAuction(), 'Current auction is not correct')
      const dailyAuctionStartTime = (await auctions.dailyAuctionStartTime()).toNumber()
      let nextAuctionStartTime = dailyAuctionStartTime + (heartbeat[8].toNumber() * SECS_IN_A_DAY)
      assert.equal(heartbeat[9].valueOf(), nextAuctionStartTime, 'Next auction start time is not correct')
      assert.equal(heartbeat[11].valueOf(), expectedCurrentPrice, 'Current price is not correct')
      resolve()
    })
  })

  it('Auction should not accept funds after end of initial auction and before the start of next daily auction', () => {
    return new Promise(async (resolve, reject) => {
      // 1st tick which is between initial auction end and daily auction start
      const startTime = ((currentTime() - (INITIAL_AUCTION_DURATION * 60) - 120))
      await initContracts(startTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      // assert that time period is during down time (after initial but before next auction)
      const nowTime = new Date().getTime() / MILLISECS_IN_A_SEC
      const genesisTime = (await auctions.genesisTime()).toNumber()
      assert(genesisTime < nowTime, 'Current time is not after genesisTime')

      const initialAuctionEndTime = (await auctions.initialAuctionEndTime()).toNumber()
      assert(initialAuctionEndTime < nowTime, 'Current time is not after the inital auction end time')

      const dailyAuctionStartTime = (await auctions.dailyAuctionStartTime()).toNumber()
      assert(nowTime < dailyAuctionStartTime, 'Current time is not before the next daily auction start time')

      let thrown = false
      try {
        const amount = 1e18
        await auctions.sendTransaction({ from: BAD_BUYER, value: amount })
      } catch (error) {
        thrown = true
      }
      assert(thrown, 'Auction fallback did not throw')

      resolve()
    })
  })

  it('Should get all amount refund if all token sold', () => {
    return new Promise(async (resolve, reject) => {
      // purchase at the last minute of initial auction
      const startTime = currentTime() - (INITIAL_AUCTION_DURATION * 60)
      const fromAccount = accounts[5]
      const amountUsedForPurchase = 40e18
      await initContracts(startTime, 0, STARTING_PRICE, TIME_SCALE)
      await auctions.sendTransaction({
        from: fromAccount,
        value: amountUsedForPurchase
      })

      const mtTokenBalanceBefore = await metToken.balanceOf(fromAccount)
      let heartbeat = await auctions.heartbeat()
      assert.equal(heartbeat[4].valueOf(), 0, 'Mintable should be 0 after all token sold')

      const ethBalanceBefore = web3.eth.getBalance(fromAccount).valueOf()

      let thrown = false
      try {
        await auctions.sendTransaction({
          from: fromAccount,
          value: 3e18
        })
      } catch (error) {
        thrown = true
      }
      assert(thrown, 'Auction fallback did not throw')

      const ethBalanceAfter = web3.eth.getBalance(fromAccount).valueOf()
      const mtTokenBalanceAfter = await metToken.balanceOf(fromAccount)
      assert.equal(mtTokenBalanceAfter.valueOf(), mtTokenBalanceBefore.valueOf(), 'User should not able to get any MET tokena after  token all sold')
      assert.isBelow(ethBalanceAfter.valueOf() - ethBalanceBefore.valueOf(), 1e18, 'Amount is not refunded if user trying to buy after all token sold')
      resolve()
    })
  })

  // This test can be tested by setting PURCHASE_LIMIT_PER_AUCTION to 1 ether and see 3rd purchase fail.
  // it('Should verify that user should not be able to buy more than each auction limit', () => {
  //   return new Promise(async (resolve, reject) => {
  //     const startTime = currentTime() - (INITIAL_AUCTION_DURATION * 60) - 3 * 60 * 60
  //     const fromAccount = accounts[3]
  //     const amountUsedForPurchase = 0.4e18 // 27 ETH can purchase all met afer 23 hrs passed
  //     await initContracts(startTime, 0, STARTING_PRICE, TIME_SCALE)
  //     let ethBalance = await web3.eth.getBalance(fromAccount)
  //     console.log('balance=', ethBalance.valueOf())
  //     await auctions.sendTransaction({
  //       from: fromAccount,
  //       value: amountUsedForPurchase
  //     })
  //     let metTokenBalance = await metToken.balanceOf(fromAccount)

  //     console.log('metTokenBalance=', metTokenBalance.valueOf())
  //     ethBalance = await web3.eth.getBalance(fromAccount)
  //     console.log('balance=', ethBalance.valueOf())
  //     await auctions.sendTransaction({
  //       from: fromAccount,
  //       value: amountUsedForPurchase
  //     })

  //     metTokenBalance = await metToken.balanceOf(fromAccount)
  //     console.log('metTokenBalance=', metTokenBalance.valueOf())
  //     ethBalance = await web3.eth.getBalance(fromAccount)
  //     console.log('balance=', ethBalance.valueOf())
  //     await auctions.sendTransaction({
  //       from: fromAccount,
  //       value: amountUsedForPurchase
  //     })

  //     metTokenBalance = await metToken.balanceOf(fromAccount)
  //     console.log('metTokenBalance=', metTokenBalance.valueOf())
  //     ethBalance = await web3.eth.getBalance(fromAccount)
  //     console.log('balance=', ethBalance.valueOf())

  //     await auctions.sendTransaction({
  //       from: fromAccount,
  //       value: amountUsedForPurchase
  //     })

  //     metTokenBalance = await metToken.balanceOf(fromAccount)
  //     console.log('metTokenBalance=', metTokenBalance.valueOf())
  //     ethBalance = await web3.eth.getBalance(fromAccount)
  //     console.log('balance=', ethBalance.valueOf())
  //     resolve()
  //   })
  // })
})
