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
const MTNToken = artifacts.require('MTNToken')
const SmartToken = artifacts.require('SmartToken')
const Proceeds = artifacts.require('Proceeds')
const AutonomousConverter = artifacts.require('AutonomousConverter')
const Auctions = artifacts.require('Auctions')
const TokenLocker = artifacts.require('TokenLocker')

contract('Proceeds - timed test', accounts => {
  const MTN_INITIAL_SUPPLY = 0
  const SMART_INITIAL_SUPPLY = 0
  const DECMULT = 10 ** 18
  const MINIMUM_PRICE = 33 * 10 ** 11 // minimum wei per token
  const STARTING_PRICE = 2 // 2 ETH per MTN
  const TIME_SCALE = 1
  // const INITIAL_AUCTION_DURATION = 7 * 24 * 60// 7 days in minutes

  const OWNER = accounts[0]
  const OWNER_TOKENS_HEX = '0000d3c20dee1639f99c0000'
  const FOUNDER = accounts[1]
  const FOUNDER_TOKENS_HEX = '000069e10de76676d0000000'

  const EXT_FOUNDER = accounts[6]
  const EXT_FOUNDER_TOKENS = 5e23

  let mtnToken, smartToken, proceeds, autonomousConverter, auctions

  function currentTime () {
    const timeInSeconds = new Date().getTime() / 1000
    return Math.floor(timeInSeconds / 60) * 60 // time in seconds, rounded to a minute
  }

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
  // function getCurrentTime (offsetDays) {
  //   let date = new Date()
  //   date.setDate(date.getDate() + offsetDays)
  //   const timeInSeconds = date.getTime() / 1000
  //   return Math.floor(timeInSeconds / 60) * 60
  // }

  async function initContracts (startTime, minimumPrice, startingPrice, timeScale) {
    mtnToken = await MTNToken.new(autonomousConverter.address, auctions.address, MTN_INITIAL_SUPPLY, DECMULT, {from: OWNER})
    smartToken = await SmartToken.new(autonomousConverter.address, autonomousConverter.address, SMART_INITIAL_SUPPLY, {from: OWNER})
    const founders = []
    // Since we are appending it with hexadecimal address so amount should also be
    // in hexa decimal. Hence 999999e18 = 0000d3c21bcecceda1000000 in 24 character ( 96 bits)
    // 1000000e18 =  0000d3c20dee1639f99c0000
    founders.push(OWNER + OWNER_TOKENS_HEX)
    founders.push(FOUNDER + FOUNDER_TOKENS_HEX)
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
      const genesisTime = currentTime() + 60

      await initContracts(currentTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

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
      const defaultAuctionTime = currentTime() + 60
      const defaultStartingPrice = 2 // 2 ETH per MTN
      const defaultMinimumPrice = 33 * 10 ** 11

      await initContracts(0, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

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

  it('Public should be able to trigger the forward fund to AC', () => {
    return new Promise(async (resolve, reject) => {
      const fromAccount = accounts[7]
      const amount = web3.toWei(10, 'ether')
      let auctionStartTime = currentTime()
      let expectedFundTranferInAC = (amount * 0.25) / 100
      await initContracts(auctionStartTime - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      await timeTravel(60 * 60)
      await mineBlock()
      var balanceACBefore = await web3.eth.getBalance(autonomousConverter.address).valueOf()
      await auctions.sendTransaction({
        from: fromAccount,
        value: amount
      })
      await timeTravel(8 * 24 * 60 * 60)
      await mineBlock()
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
      balanceACBefore = await web3.eth.getBalance(autonomousConverter.address).valueOf()
      await timeTravel(2 * 24 * 60 * 60)
      await mineBlock()
      let balanceOfProceed = await web3.eth.getBalance(proceeds.address).valueOf()
      const tx = await proceeds.closeAuction({from: fromAccount})
      expectedFundTranferInAC = (balanceOfProceed * 25) / 10000
      assert.equal(tx.receipt.logs.length, 2, 'Incorrect number of logs emitted')
      const decoder = ethjsABI.logDecoder(autonomousConverter.abi)
      const decodedEvents = decoder(tx.receipt.logs)
      const logFundsIn = decodedEvents[0]
      assert.equal(logFundsIn._eventName, 'LogFundsIn', 'AC LogFundsIn not emitted')
      assert.equal(logFundsIn.from, proceeds.address, 'From is wrong')
      assert.equal(logFundsIn.value.toString(), expectedFundTranferInAC.toString(), 'Value is wrong')

      assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted')
      const log = tx.logs[0]
      assert.equal(log.event, 'LogClosedAuction', 'Log name is wrong')
      assert.equal(log.args.from, fromAccount, 'From is wrong')
      assert.equal(log.args.value.toNumber(), expectedFundTranferInAC, 'Value is wrong')

      balanceACAfter = await web3.eth.getBalance(autonomousConverter.address).valueOf()
      assert.equal(balanceACAfter - balanceACBefore, expectedFundTranferInAC, 'Incorrect fund transffered to AC')
      balanceACBefore = balanceACAfter
      await proceeds.closeAuction({from: fromAccount})
      balanceACAfter = await web3.eth.getBalance(autonomousConverter.address).valueOf()
      assert.equal(balanceACAfter - balanceACBefore, 0, 'Incorrect fund transffered to AC')
      resolve()
    })
  })
})
