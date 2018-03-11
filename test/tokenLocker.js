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

contract('TokenLocker', accounts => {
  const MET_INITIAL_SUPPLY = 0
  const SMART_INITIAL_SUPPLY = 0
  const DECMULT = 10 ** 18
  const MINIMUM_PRICE = 33 * 10 ** 11// minimum wei per token
  const STARTING_PRICE = 2 // 2ETH per MET
  const TIME_SCALE = 1

  const OWNER = accounts[0]
  const OWNER_TOKENS_HEX = '0000d3c20dee1639f99c0000'
  const FOUNDER = accounts[1]
  const FOUNDER_TOKENS_HEX = '0000D3C21BCECCEDA1000000'

  const SECS_IN_A_DAY = 86400
  const SECS_IN_A_MIN = 60
  const INITIAL_AUCTION_END_TIME = 7 * SECS_IN_A_DAY // 7 days in seconds
  const ONE_QUARTER = (91 * SECS_IN_A_DAY) + (450 * SECS_IN_A_MIN)// 91 days + 450 minutes in seconds
  const MILLISECS_IN_A_SEC = 1000

  let metToken, smartToken, proceeds, autonomousConverter, auctions

  function currentTime () {
    const timeInSeconds = new Date().getTime() / MILLISECS_IN_A_SEC
    return Math.floor(timeInSeconds / SECS_IN_A_MIN) * SECS_IN_A_MIN // time in seconds, rounded to a minute
  }

  function roundToPrevMidnight (t) {
    // round to prev midnight
    const prevMidnight = t - (t % SECS_IN_A_DAY)
    assert(new Date(prevMidnight * MILLISECS_IN_A_SEC).toUTCString().indexOf('00:00:00') >= 0, 'timestamp is not midnight')
    return prevMidnight
  }

  async function initContracts (startTime, timeScale) {
    metToken = await METToken.new(autonomousConverter.address, auctions.address, MET_INITIAL_SUPPLY, DECMULT, {from: OWNER})
    smartToken = await SmartToken.new(autonomousConverter.address, autonomousConverter.address, SMART_INITIAL_SUPPLY, {from: OWNER})
    await autonomousConverter.init(metToken.address, smartToken.address, auctions.address,
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
    await auctions.mintInitialSupply(founders, metToken.address, proceeds.address, autonomousConverter.address, {from: OWNER})
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
      await initContracts(currentTime(), TIME_SCALE)

      // console.log('totalSupply=', (await metToken.totalSupply()).valueOf())
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
      let totalMinted = 0
      totalMinted = totalMinted / DECMULT
      for (let i = 0; i < founders.length; i++) {
        const founder = founders[i]
        const tokenLockerAddress = await auctions.tokenLockers(founder.address)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)
        assert.equal(await tokenLocker.auctions(), auctions.address, "Auctions address isn't setup correctly")
        assert.equal(await tokenLocker.token(), metToken.address, "METToken address isn't setup correctly")

        let lockedBalance = await metToken.balanceOf(tokenLocker.address)
        assert.equal(lockedBalance.toNumber(), founder.targetTokens, 'Minted amount is wrong for ' + i)

        const balance = await tokenLocker.deposited()
        assert.equal(balance.toNumber(), founder.targetTokens, 'Deposited amount is not correct.')

        const locked = await tokenLocker.locked()
        assert.isTrue(locked, 'Token Locker is not locked')
        grandTotalDeposited += balance.toNumber()
        lockedBalance = lockedBalance / DECMULT
        totalMinted += lockedBalance
      }
      totalMinted = totalMinted * DECMULT
      assert.equal(grandTotalDeposited, founders[0].targetTokens + founders[1].targetTokens, 'Total deposit is not correct')
      assert.equal(totalMinted, founders[0].targetTokens + founders[1].targetTokens, 'Total minted is not correct')

      const reserveAmount = 2000000
      assert.equal(totalMinted, (reserveAmount - 1) * DECMULT, 'Total minted for all founders is not correct')

      resolve()
    })
  })

  it('Should verify that initial fund unlocked and can be transferred by owner', () => {
    return new Promise(async (resolve, reject) => {
      // seven days in past, round to prev midnight plus a few minutes
      const sevenDaysAgo = roundToPrevMidnight(currentTime() - INITIAL_AUCTION_END_TIME) - 120
      await initContracts(sevenDaysAgo, TIME_SCALE)
      await metToken.enableMETTransfers()

      // Transaction in auction will enable withdraw
      await auctions.sendTransaction({
        from: accounts[2],
        value: 1e18
      })

      const founders = [
        { address: await auctions.founders(0), targetTokens: parseInt(OWNER_TOKENS_HEX, 16) },
        { address: await auctions.founders(1), targetTokens: parseInt(FOUNDER_TOKENS_HEX, 16) }]

      for (let i = 0; i < founders.length; i++) {
        const founder = founders[i]
        const tokenLockerAddress = await auctions.tokenLockers(founder.address)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        const balanceBefore = await metToken.balanceOf(founder.address)

        const tx = await tokenLocker.withdraw({from: founder.address})
        assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted for withdraw on founder ' + i)

        const log = tx.logs[0]
        const expectedWithdrawn = founder.targetTokens * 0.25
        assert.equal(log.event, 'Withdrawn', 'Withdrawn log was not emitted')
        assert.equal(log.args.who, founder.address, 'Who is wrong')
        assert.equal(log.args.amount.toNumber(), expectedWithdrawn, 'Amount is wrong')

        const balanceAfter = await metToken.balanceOf(founder.address)
        assert.equal(balanceAfter.toNumber() - balanceBefore.toNumber(), expectedWithdrawn, 'Initial fund withdraw was not correct')
      }

      resolve()
    })
  })

  it('Should verify that double withdraw of initial fund is not posisble', () => {
    return new Promise(async (resolve, reject) => {
      // seven days in past, round to prev midnight plus a few minutes
      const sevenDaysAgo = roundToPrevMidnight(currentTime() - INITIAL_AUCTION_END_TIME) - 120
      await initContracts(sevenDaysAgo, TIME_SCALE)
      await metToken.enableMETTransfers()

      // Transaction in auction will enable withdraw
      await auctions.sendTransaction({
        from: accounts[2],
        value: 1e18
      })

      const founders = [
        { address: await auctions.founders(0), targetTokens: parseInt(OWNER_TOKENS_HEX, 16) },
        { address: await auctions.founders(1), targetTokens: parseInt(FOUNDER_TOKENS_HEX, 16) }]

      for (let i = 0; i < founders.length; i++) {
        const founder = founders[i]
        const tokenLockerAddress = await auctions.tokenLockers(founder.address)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        let balanceBefore = await metToken.balanceOf(founder.address)
        let tx = await tokenLocker.withdraw({from: founder.address})
        assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted for withdraw on founder ' + i)
        const log = tx.logs[0]
        const expectedWithdrawn = founder.targetTokens * 0.25
        assert.equal(log.event, 'Withdrawn', 'Withdrawn log was not emitted')
        assert.equal(log.args.who, founder.address, 'Who is wrong')
        assert.equal(log.args.amount.toNumber(), expectedWithdrawn, 'Amount is wrong')
        let balanceAfter = await metToken.balanceOf(founder.address)
        assert.equal(balanceAfter.toNumber() - balanceBefore.toNumber(), expectedWithdrawn, 'Initial fund withdraw was not correct')

        balanceBefore = await metToken.balanceOf(founder.address)
        tx = await tokenLocker.withdraw({from: founder.address})
        assert.equal(tx.logs.length, 0, 'Incorrect number of logs emitted for 2nd withdraw on founder ' + i)
        balanceAfter = await metToken.balanceOf(founder.address)
        assert.equal(balanceAfter.toNumber() - balanceBefore.toNumber(), 0, 'Balance should not have changed after 2nd withdraw')
      }

      resolve()
    })
  })

  it('Should verify that first quarterly fund can be withdraw', () => {
    return new Promise(async (resolve, reject) => {
      // seven days and one quarter in the past, plus a few minutes
      const genesisTime = roundToPrevMidnight(currentTime() - ONE_QUARTER - INITIAL_AUCTION_END_TIME) - 120
      await initContracts(genesisTime, TIME_SCALE)
      await metToken.enableMETTransfers()

      // Transaction in auction will enable withdraw
      await auctions.sendTransaction({
        from: accounts[3],
        value: 1e18
      })

      const founders = [
        { address: await auctions.founders(0), targetTokens: parseInt(OWNER_TOKENS_HEX, 16) },
        { address: await auctions.founders(1), targetTokens: parseInt(FOUNDER_TOKENS_HEX, 16) }]

      for (let i = 0; i < founders.length; i++) {
        const founder = founders[i]
        const tokenLockerAddress = await auctions.tokenLockers(founder.address)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        const balanceBefore = await metToken.balanceOf(founder.address)
        const tx = await tokenLocker.withdraw({from: founder.address})
        assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted for withdraw on founder ' + i)
        const log = tx.logs[0]

        var expectedWithdrawn = (founder.targetTokens * 0.25) + ((founder.targetTokens * 0.75) / 12)
        expectedWithdrawn = (expectedWithdrawn / DECMULT) * DECMULT

        assert.equal(log.event, 'Withdrawn', 'Withdrawn log was not emitted')
        assert.equal(log.args.who, founder.address, 'Who is wrong')
        let errorMargin = 67108864
        assert.closeTo(log.args.amount.toNumber(), expectedWithdrawn, errorMargin, 'Amount is wrong')
        let balanceAfter = await metToken.balanceOf(founder.address)
        assert.closeTo(balanceAfter.toNumber() - balanceBefore.toNumber(), expectedWithdrawn, errorMargin, 'Quarterly withdraw was not correct')

        const remainingBalance = await tokenLocker.deposited()
        const QrtlyWithdrawable = await tokenLocker.quarterlyWithdrable()
        const expectedRemaingBalance = (founder.targetTokens - expectedWithdrawn)
        errorMargin = 134217728
        assert.closeTo(remainingBalance.toNumber(), expectedRemaingBalance, errorMargin, 'Remaining fund after withdraw is not correct')

        const expectedQtrlyWithdrawable = ((founder.targetTokens * 0.75) / 12)
        assert.equal(QrtlyWithdrawable.toNumber(), expectedQtrlyWithdrawable, 'Quarterly withdrawable is not correct')
      }

      resolve()
    })
  })

  it('Should verify that two quarterly fund can be withdraw', () => {
    return new Promise(async (resolve, reject) => {
      // seven days and two quarters in the past, plus a few minutes
      const genesisTime = roundToPrevMidnight(currentTime() - (2 * ONE_QUARTER) - INITIAL_AUCTION_END_TIME) - 120
      await initContracts(genesisTime, TIME_SCALE)
      await metToken.enableMETTransfers()

      // Transaction in auction will enable withdraw
      await auctions.sendTransaction({
        from: accounts[4],
        value: 1e18
      })

      const founders = [
        { address: await auctions.founders(0), targetTokens: parseInt(OWNER_TOKENS_HEX, 16) },
        { address: await auctions.founders(1), targetTokens: parseInt(FOUNDER_TOKENS_HEX, 16) }]

      for (let i = 0; i < founders.length; i++) {
        const founder = founders[i]
        const tokenLockerAddress = await auctions.tokenLockers(founder.address)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        const balanceBefore = await metToken.balanceOf(founder.address)
        const tx = await tokenLocker.withdraw({from: founder.address})
        assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted for withdraw on founder ' + i)
        const log = tx.logs[0]
        const expectedWithdrawn = (founder.targetTokens * 0.25) + (2 * ((founder.targetTokens * 0.75) / 12))
        assert.equal(log.event, 'Withdrawn', 'Withdrawn log was not emitted')
        assert.equal(log.args.who, founder.address, 'Who is wrong')
        assert.equal(log.args.amount.toNumber(), expectedWithdrawn, 'Amount is wrong')
        const balanceAfter = await metToken.balanceOf(founder.address)
        assert.equal(balanceAfter.toNumber() - balanceBefore.toNumber(), expectedWithdrawn, 'Quarterly withdraw was not correct')

        const remainingBalance = await tokenLocker.deposited()
        const QrtlyWithdrawable = await tokenLocker.quarterlyWithdrable()
        let expectedRemaingBalance = (founder.targetTokens / DECMULT) - (expectedWithdrawn / DECMULT)
        expectedRemaingBalance = expectedRemaingBalance * DECMULT
        assert.equal(remainingBalance.toNumber(), expectedRemaingBalance, 'Remaining fund after withdraw is not correct')

        // TODO: check expectedQtrlyWithdrawable math
        const expectedQtrlyWithdrawable = ((founder.targetTokens * 0.75) / 12)
        assert.equal(QrtlyWithdrawable.toNumber(), expectedQtrlyWithdrawable, 'Quarterly withdrawable is not correct')
      }

      resolve()
    })
  })

  it('Should verify that total fund can be withdrawn after 12 quarters', () => {
    return new Promise(async (resolve, reject) => {
      // seven days and 12 quarters in the past, plus a few minutes
      const genesisTime = roundToPrevMidnight(currentTime() - 12 * ONE_QUARTER - INITIAL_AUCTION_END_TIME) - 120
      await initContracts(genesisTime, TIME_SCALE)
      await metToken.enableMETTransfers()

      // Transaction in auction will enable withdraw
      await auctions.sendTransaction({
        from: accounts[5],
        value: 1e18
      })

      const founders = [
        { address: await auctions.founders(0), targetTokens: parseInt(OWNER_TOKENS_HEX, 16) },
        { address: await auctions.founders(1), targetTokens: parseInt(FOUNDER_TOKENS_HEX, 16) }]

      for (let i = 0; i < founders.length; i++) {
        const founder = founders[i]
        const tokenLockerAddress = await auctions.tokenLockers(founder.address)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        const balanceBefore = await metToken.balanceOf(founder.address)
        const tx = await tokenLocker.withdraw({from: founder.address})
        assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted for withdraw on founder ' + i)
        const log = tx.logs[0]
        assert.equal(log.event, 'Withdrawn', 'Withdrawn log was not emitted')
        assert.equal(log.args.who, founder.address, 'Who is wrong')
        assert.equal(log.args.amount.toNumber(), founder.targetTokens, 'Amount is wrong')
        const balanceAfter = await metToken.balanceOf(founder.address)
        assert.equal(balanceAfter.toNumber() - balanceBefore.toNumber(), founder.targetTokens, 'Quarterly withdraw was not correct')

        const remainingBalance = await tokenLocker.deposited()
        const QrtlyWithdrawable = await tokenLocker.quarterlyWithdrable()
        assert.equal(remainingBalance.toNumber(), 0, 'Remaining fund after withdraw is not correct')

        const expectedQtrlyWithdrawable = ((founder.targetTokens * 0.75) / 12)
        assert.equal(QrtlyWithdrawable.toNumber(), expectedQtrlyWithdrawable, 'Quarterly withdrawable is not correct')
      }

      resolve()
    })
  })

  it('Should fail when deposit is called during postLock phase', () => {
    return new Promise(async (resolve, reject) => {
      const reserverFund = 1999999 * DECMULT
      await initContracts(currentTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      const founders = [
        { address: await auctions.founders(0), targetTokens: parseInt(OWNER_TOKENS_HEX, 16) },
        { address: await auctions.founders(1), targetTokens: parseInt(FOUNDER_TOKENS_HEX, 16) }]

      for (let i = 0; i < founders.length; i++) {
        const founder = founders[i]
        const tokenLockerAddress = await auctions.tokenLockers(founder.address)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        let thrown = false
        try {
          // Deposit is allowed during initialization only
          await tokenLocker.deposit(OWNER, reserverFund)
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'deposit did not throw')
      }

      resolve()
    })
  })
})
