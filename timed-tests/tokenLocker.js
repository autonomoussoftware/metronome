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
const MTNToken = artifacts.require('MTNToken')
const SmartToken = artifacts.require('SmartToken')
const Proceeds = artifacts.require('Proceeds')
const AutonomousConverter = artifacts.require('AutonomousConverter')
const Auctions = artifacts.require('Auctions')
const TokenLocker = artifacts.require('TokenLocker')

contract('TokenLocker', accounts => {
  const MTN_INITIAL_SUPPLY = 0
  const SMART_INITIAL_SUPPLY = 0
  const DECMULT = 10 ** 18
  const MINIMUM_PRICE = 33 * 10 ** 11// minimum wei per token
  const STARTING_PRICE = 2 // 2ETH per MTN
  const TIME_SCALE = 1
  const INITIAL_AUCTION_END_TIME = 7 * 24 * 60 * 60 // 7 days in seconds
  const SECS_IN_A_DAY = 86400
  const SECS_IN_A_MIN = 60

  const OWNER = accounts[0]
  const OWNER_TOKENS_HEX = '0000d3c20dee1639f99c0000'
  const FOUNDER = accounts[1]
  const FOUNDER_TOKENS_HEX = '000069e10de76676d0000000'

  const EXT_FOUNDER = accounts[6]
  const EXT_FOUNDER_TOKENS = 5e23

  let mtnToken, smartToken, proceeds, autonomousConverter, auctions
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

  async function initContracts (startTime, timeScale) {
    mtnToken = await MTNToken.new(autonomousConverter.address, auctions.address, MTN_INITIAL_SUPPLY, DECMULT, {from: OWNER})
    smartToken = await SmartToken.new(autonomousConverter.address, autonomousConverter.address, SMART_INITIAL_SUPPLY, {from: OWNER})
    await autonomousConverter.init(mtnToken.address, smartToken.address, auctions.address,
      { from: OWNER,
        value: web3.toWei(1, 'ether')
      })
    await proceeds.initProceeds(autonomousConverter.address, auctions.address, {from: OWNER})

    const founders = []
    // Since we are appending it with hexadecimal address so amount should also be
    // in hexa decimal. Hence 999999e18 = 0000d3c20dee1639f99c0000 in 24 character ( 96 bits)
    // 1000000e18 =  0000d3c20dee1639f99c0000
    founders.push(OWNER + OWNER_TOKENS_HEX)
    founders.push(FOUNDER + FOUNDER_TOKENS_HEX)

    assert.equal((await mtnToken.balanceOf(EXT_FOUNDER)).toNumber(), 0, 'External founder should not already have tokens')
    await auctions.mintInitialSupply(founders, EXT_FOUNDER, mtnToken.address, proceeds.address, autonomousConverter.address, {from: OWNER})
    await auctions.initAuctions(startTime, MINIMUM_PRICE, STARTING_PRICE, timeScale, {from: OWNER})
  }

  // Create contracts and initilize them for each test case
  beforeEach(async () => {
    proceeds = await Proceeds.new()
    autonomousConverter = await AutonomousConverter.new()
    auctions = await Auctions.new()
  })

  it('Should verify that TokenLocker contract is initialized correctly', () => {
    return new Promise(async (resolve, reject) => {
      await initContracts(getCurrentBlockTime(), TIME_SCALE)

      const extFounder = await auctions.extFounder()
      assert.equal(extFounder, EXT_FOUNDER, 'External founder was not set')
      const extBalance = await mtnToken.balanceOf(extFounder)
      assert.equal(extBalance.toNumber(), EXT_FOUNDER_TOKENS, 'External founder minted balance was not correct')

      const firstFounder = await auctions.founders(0)
      assert.equal(firstFounder, OWNER, 'First founder is wrong')
      const secondFounder = await auctions.founders(1)
      assert.equal(secondFounder, FOUNDER, 'Second founder is wrong')
      const founders = [
        { address: firstFounder, targetTokens: parseInt(OWNER_TOKENS_HEX, 16) },
        { address: secondFounder, targetTokens: parseInt(FOUNDER_TOKENS_HEX, 16) }]

      let thrown = false
      try {
        await auctions.founders(2)
      } catch (error) {
        thrown = true
      }
      assert.isTrue(thrown, 'There are more than two founders')

      let grandTotalDeposited = 0
      let totalMinted = extBalance.toNumber() / DECMULT
      for (let i = 0; i < founders.length; i++) {
        const founder = founders[i]
        const tokenLockerAddress = await auctions.tokenLockers(founder.address)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)
        assert.equal(await tokenLocker.auctions(), auctions.address, "Auctions address isn't setup correctly")
        assert.equal(await tokenLocker.token(), mtnToken.address, "MTNToken address isn't setup correctly")

        const lockedBalance = await mtnToken.balanceOf(tokenLocker.address)
        assert.equal(lockedBalance.toNumber(), founder.targetTokens, 'Minted amount is wrong for ' + i)

        const balance = await tokenLocker.deposited()
        assert.equal(balance.toNumber(), founder.targetTokens, 'Deposited amount is not correct.')
        const locked = await tokenLocker.locked()
        assert.isTrue(locked, 'Token Locker is not locked')

        grandTotalDeposited += balance.toNumber()
        totalMinted += lockedBalance.toNumber() / DECMULT
      }
      totalMinted *= DECMULT
      assert.equal(grandTotalDeposited, founders[0].targetTokens + founders[1].targetTokens, 'Total deposit is not correct')

      const reserveAmount = 2000000
      assert.equal(totalMinted, (reserveAmount - 1) * DECMULT, 'Total minted for all founders is not correct')

      resolve()
    })
  })

  it('Only the owner can withdraw', () => {
    return new Promise(async (resolve, reject) => {
      const startTime = getCurrentBlockTime() - (10 * SECS_IN_A_MIN)
      await initContracts(startTime, TIME_SCALE)

      const buyer = accounts[2]
      await auctions.sendTransaction({
        from: buyer,
        value: 1e18
      })

      let advanceSeconds = INITIAL_AUCTION_END_TIME + (2 * SECS_IN_A_MIN)
      await timeTravel(advanceSeconds)
      await mineBlock()

      const founders = [
        { address: await auctions.founders(0), targetTokens: parseInt(OWNER_TOKENS_HEX, 16) },
        { address: await auctions.founders(1), targetTokens: parseInt(FOUNDER_TOKENS_HEX, 16) }]

      for (let i = 0; i < founders.length; i++) {
        const founder = founders[i]
        const tokenLockerAddress = await auctions.tokenLockers(founder.address)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        let thrown = false
        try {
          await tokenLocker.withdraw({from: buyer})
        } catch (error) {
          thrown = true
        }

        assert.isTrue(thrown, 'withdraw did not throw')
      }

      resolve()
    })
  })

  it('Only the owner can enquiry balances', () => {
    return new Promise(async (resolve, reject) => {
      const startTime = getCurrentBlockTime() - (10 * SECS_IN_A_MIN)
      await initContracts(startTime, TIME_SCALE)

      let advanceSeconds = INITIAL_AUCTION_END_TIME + (2 * SECS_IN_A_MIN)
      await timeTravel(advanceSeconds)
      await mineBlock()

      const founders = [
        { address: await auctions.founders(0), targetTokens: parseInt(OWNER_TOKENS_HEX, 16) },
        { address: await auctions.founders(1), targetTokens: parseInt(FOUNDER_TOKENS_HEX, 16) }]

      for (let i = 0; i < founders.length; i++) {
        const founder = founders[i]
        const tokenLockerAddress = await auctions.tokenLockers(founder.address)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        const buyer = accounts[2]
        let thrown = false
        try {
          await tokenLocker.balanceEnquiry(FOUNDER, {from: buyer})
        } catch (error) {
          thrown = true
        }

        assert.isTrue(thrown, 'balanceEnquiry did not throw')
      }

      resolve()
    })
  })

  it('Should verify that initial fund unlocked and can be transferred by owner', () => {
    return new Promise(async (resolve, reject) => {
      const startTime = getCurrentBlockTime() - (10 * SECS_IN_A_MIN)
      await initContracts(startTime, TIME_SCALE)
      await auctions.sendTransaction({
        from: accounts[2],
        value: 1e18
      })
      assert.isFalse(await auctions.isInitialAuctionEnded(), 'Initial Auction should not have already ended')
      const founders = [
        { address: await auctions.founders(0), targetTokens: parseInt(OWNER_TOKENS_HEX, 16) },
        { address: await auctions.founders(1), targetTokens: parseInt(FOUNDER_TOKENS_HEX, 16) }]

      for (let i = 0; i < founders.length; i++) {
        const founder = founders[i]
        const tokenLockerAddress = await auctions.tokenLockers(founder.address)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        let thrown = false
        try {
          await tokenLocker.withdraw({from: founder.address})
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'Founder should not be allowed to withdraw fund before initial auction ended')
      }

      let advanceSeconds = INITIAL_AUCTION_END_TIME + (2 * 60)
      await timeTravel(advanceSeconds)
      await mineBlock()
      await mtnToken.enableMTNTransfers()
      for (let i = 0; i < founders.length; i++) {
        const founder = founders[i]
        const tokenLockerAddress = await auctions.tokenLockers(founder.address)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        await tokenLocker.withdraw({from: founder.address})
        let mtnBalanceAfter = await mtnToken.balanceOf(founder.address)
        assert.equal(mtnBalanceAfter.toNumber(), founder.targetTokens * 0.25, 'initial fund withdaw  amount is not correct for founder 1')

        advanceSeconds = SECS_IN_A_DAY
        await timeTravel(advanceSeconds)
        await mineBlock()
      }

      resolve()
    })
  })
})
