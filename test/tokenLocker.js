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
const TokenLocker = artifacts.require('TokenLocker')
const Metronome = require('../test/shared/inits')

contract('TokenLocker', accounts => {
  const DECMULT = 10 ** 18
  const MINIMUM_PRICE = 33 * 10 ** 11// minimum wei per token
  const STARTING_PRICE = 2 // 2ETH per MET
  const TIME_SCALE = 1

  const OWNER = accounts[0]
  const FOUNDER = accounts[1]

  const SECS_IN_A_DAY = 86400
  const SECS_IN_A_MIN = 60
  const INITIAL_AUCTION_END_TIME = 7 * SECS_IN_A_DAY // 7 days in seconds
  const ONE_QUARTER = (91 * SECS_IN_A_DAY) + (450 * SECS_IN_A_MIN)// 91 days + 450 minutes in seconds
  const MILLISECS_IN_A_SEC = 1000

  function currentTime () {
    const timeInSeconds = new Date().getTime() / MILLISECS_IN_A_SEC
    return Math.floor(timeInSeconds / SECS_IN_A_MIN) * SECS_IN_A_MIN // time in seconds, rounded to a minute
  }

  function roundToPrevMidnight (t) {
    // round to prev midnight
    const prevMidnight = t - (t % SECS_IN_A_DAY)
    return prevMidnight
  }

  function parseAddress (founder) {
    return founder.slice(0, 42)
  }

  function parseToken (founder) {
    return parseInt(founder.slice(42), 16)
  }

  it('Should verify that TokenLocker contract is initialized correctly', () => {
    return new Promise(async (resolve, reject) => {
      const {metToken, auctions, founders} = await Metronome.initContracts(accounts, currentTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      const firstFounder = await auctions.founders(0)
      assert.equal(firstFounder, OWNER, 'First founder is wrong')
      const secondFounder = await auctions.founders(1)
      assert.equal(secondFounder, FOUNDER, 'Second founder is wrong')

      let thrown = false
      try {
        await auctions.founders(2)
      } catch (error) {
        thrown = true
      }
      assert.isTrue(thrown, 'There are more than two founders')

      let grandTotalDeposited = 0
      let foundersTotal = 0
      let totalMinted = 0
      totalMinted = totalMinted / DECMULT
      for (let i = 0; i < founders.length; i++) {
        const foundersAddress = parseAddress(founders[i])
        const foundersToken = parseToken(founders[i])
        const tokenLockerAddress = await auctions.tokenLockers(foundersAddress)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)
        let owner = await tokenLocker.owner()
        assert.equal(owner, foundersAddress, 'Owner of token locker is wrong')
        assert.equal(await tokenLocker.auctions(), auctions.address, "Auctions address isn't setup correctly")
        assert.equal(await tokenLocker.token(), metToken.address, "METToken address isn't setup correctly")

        let lockedBalance = await metToken.balanceOf(tokenLocker.address)
        assert.equal(lockedBalance.toNumber(), foundersToken, 'Minted amount is wrong for ' + i)

        const balance = await tokenLocker.deposited()
        assert.equal(balance.toNumber(), foundersToken, 'Deposited amount is not correct.')

        const locked = await tokenLocker.locked()
        assert.isTrue(locked, 'Token Locker is not locked')
        grandTotalDeposited += balance.toNumber()
        lockedBalance = lockedBalance / DECMULT
        totalMinted += lockedBalance
        foundersTotal += foundersToken
      }
      totalMinted = totalMinted * DECMULT
      assert.equal(grandTotalDeposited, foundersTotal, 'Total deposit is not correct')
      assert.equal(totalMinted, foundersTotal, 'Total minted is not correct')

      const reserveAmount = 2000000
      assert.equal(totalMinted, (reserveAmount - 1) * DECMULT, 'Total minted for all founders is not correct')

      resolve()
    })
  })

  it('Should verify that initial fund unlocked and can be transferred by owner', () => {
    return new Promise(async (resolve, reject) => {
      // seven days in past, round to prev midnight plus a few minutes
      const sevenDaysAgo = roundToPrevMidnight(currentTime() - INITIAL_AUCTION_END_TIME) - 120
      const {metToken, auctions, founders} = await Metronome.initContracts(accounts, sevenDaysAgo, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      await metToken.enableMETTransfers()

      // Transaction in auction will enable withdraw
      await auctions.sendTransaction({
        from: accounts[2],
        value: 1e18
      })

      for (let i = 0; i < founders.length; i++) {
        const foundersAddress = parseAddress(founders[i])
        const foundersToken = parseToken(founders[i])
        const tokenLockerAddress = await auctions.tokenLockers(foundersAddress)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        const balanceBefore = await metToken.balanceOf(foundersAddress)

        const tx = await tokenLocker.withdraw({from: foundersAddress})
        assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted for withdraw on founder ' + i)

        const log = tx.logs[0]
        const expectedWithdrawn = foundersToken * 0.25
        assert.equal(log.event, 'Withdrawn', 'Withdrawn log was not emitted')
        assert.equal(log.args.who, foundersAddress, 'Who is wrong')
        assert.equal(log.args.amount.toNumber(), expectedWithdrawn, 'Amount is wrong')

        const balanceAfter = await metToken.balanceOf(foundersAddress)
        assert.equal(balanceAfter.toNumber() - balanceBefore.toNumber(), expectedWithdrawn, 'Initial fund withdraw was not correct')
      }

      resolve()
    })
  })

  it('Should verify that double withdraw of initial fund is not posisble', () => {
    return new Promise(async (resolve, reject) => {
      // seven days in past, round to prev midnight plus a few minutes
      const sevenDaysAgo = roundToPrevMidnight(currentTime() - INITIAL_AUCTION_END_TIME) - 120
      const {metToken, auctions, founders} = await Metronome.initContracts(accounts, sevenDaysAgo, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      await metToken.enableMETTransfers()

      // Transaction in auction will enable withdraw
      await auctions.sendTransaction({
        from: accounts[2],
        value: 1e18
      })

      for (let i = 0; i < founders.length; i++) {
        const foundersAddress = parseAddress(founders[i])
        const foundersToken = parseToken(founders[i])
        const tokenLockerAddress = await auctions.tokenLockers(foundersAddress)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        let balanceBefore = await metToken.balanceOf(foundersAddress)
        let tx = await tokenLocker.withdraw({from: foundersAddress})
        assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted for withdraw on founder ' + i)
        const log = tx.logs[0]
        const expectedWithdrawn = foundersToken * 0.25
        assert.equal(log.event, 'Withdrawn', 'Withdrawn log was not emitted')
        assert.equal(log.args.who, foundersAddress, 'Who is wrong')
        assert.equal(log.args.amount.toNumber(), expectedWithdrawn, 'Amount is wrong')
        let balanceAfter = await metToken.balanceOf(foundersAddress)
        assert.equal(balanceAfter.toNumber() - balanceBefore.toNumber(), expectedWithdrawn, 'Initial fund withdraw was not correct')

        balanceBefore = await metToken.balanceOf(foundersAddress)
        tx = await tokenLocker.withdraw({from: foundersAddress})
        assert.equal(tx.logs.length, 0, 'Incorrect number of logs emitted for 2nd withdraw on founder ' + i)
        balanceAfter = await metToken.balanceOf(foundersAddress)
        assert.equal(balanceAfter.toNumber() - balanceBefore.toNumber(), 0, 'Balance should not have changed after 2nd withdraw')
      }

      resolve()
    })
  })

  it('Should verify that first quarterly fund can be withdraw', () => {
    return new Promise(async (resolve, reject) => {
      // seven days and one quarter in the past, plus a few minutes
      const genesisTime = roundToPrevMidnight(currentTime() - ONE_QUARTER - INITIAL_AUCTION_END_TIME) - 120
      const {metToken, auctions, founders} = await Metronome.initContracts(accounts, genesisTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      await metToken.enableMETTransfers()

      // Transaction in auction will enable withdraw
      await auctions.sendTransaction({
        from: accounts[3],
        value: 1e18
      })

      for (let i = 0; i < founders.length; i++) {
        const foundersAddress = parseAddress(founders[i])
        const foundersToken = parseToken(founders[i])
        const tokenLockerAddress = await auctions.tokenLockers(foundersAddress)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        const balanceBefore = await metToken.balanceOf(foundersAddress)
        const tx = await tokenLocker.withdraw({from: foundersAddress})
        assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted for withdraw on founder ' + i)
        const log = tx.logs[0]

        var expectedWithdrawn = (foundersToken * 0.25) + ((foundersToken * 0.75) / 12)
        expectedWithdrawn = (expectedWithdrawn / DECMULT) * DECMULT

        assert.equal(log.event, 'Withdrawn', 'Withdrawn log was not emitted')
        assert.equal(log.args.who, foundersAddress, 'Who is wrong')
        let errorMargin = 67108864
        assert.closeTo(log.args.amount.toNumber(), expectedWithdrawn, errorMargin, 'Amount is wrong')
        let balanceAfter = await metToken.balanceOf(foundersAddress)
        assert.closeTo(balanceAfter.toNumber() - balanceBefore.toNumber(), expectedWithdrawn, errorMargin, 'Quarterly withdraw was not correct')

        const remainingBalance = await tokenLocker.deposited()
        const QrtlyWithdrawable = await tokenLocker.quarterlyWithdrawable()
        const expectedRemaingBalance = (foundersToken - expectedWithdrawn)
        errorMargin = 134217728
        assert.closeTo(remainingBalance.toNumber(), expectedRemaingBalance, errorMargin, 'Remaining fund after withdraw is not correct')

        const expectedQtrlyWithdrawable = ((foundersToken * 0.75) / 12)
        assert.equal(QrtlyWithdrawable.toNumber(), expectedQtrlyWithdrawable, 'Quarterly withdrawable is not correct')
      }

      resolve()
    })
  })

  it('Should verify that two quarterly fund can be withdraw', () => {
    return new Promise(async (resolve, reject) => {
      // seven days and two quarters in the past, plus a few minutes
      const genesisTime = roundToPrevMidnight(currentTime() - (2 * ONE_QUARTER) - INITIAL_AUCTION_END_TIME) - 120
      const {metToken, auctions, founders} = await Metronome.initContracts(accounts, genesisTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      await metToken.enableMETTransfers()

      // Transaction in auction will enable withdraw
      await auctions.sendTransaction({
        from: accounts[4],
        value: 1e18
      })

      for (let i = 0; i < founders.length; i++) {
        const foundersAddress = parseAddress(founders[i])
        const foundersToken = parseToken(founders[i])
        const tokenLockerAddress = await auctions.tokenLockers(foundersAddress)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        const balanceBefore = await metToken.balanceOf(foundersAddress)
        const tx = await tokenLocker.withdraw({from: foundersAddress})
        assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted for withdraw on founder ' + i)
        const log = tx.logs[0]
        const expectedWithdrawn = (foundersToken * 0.25) + (2 * ((foundersToken * 0.75) / 12))
        assert.equal(log.event, 'Withdrawn', 'Withdrawn log was not emitted')
        assert.equal(log.args.who, foundersAddress, 'Who is wrong')
        assert.equal(log.args.amount.toNumber(), expectedWithdrawn, 'Amount is wrong')
        const balanceAfter = await metToken.balanceOf(foundersAddress)
        assert.equal(balanceAfter.toNumber() - balanceBefore.toNumber(), expectedWithdrawn, 'Quarterly withdraw was not correct')

        const remainingBalance = await tokenLocker.deposited()
        const QrtlyWithdrawable = await tokenLocker.quarterlyWithdrawable()
        let expectedRemaingBalance = (foundersToken / DECMULT) - (expectedWithdrawn / DECMULT)
        expectedRemaingBalance = expectedRemaingBalance * DECMULT
        assert.equal(remainingBalance.toNumber(), expectedRemaingBalance, 'Remaining fund after withdraw is not correct')

        // TODO: check expectedQtrlyWithdrawable math
        const expectedQtrlyWithdrawable = ((foundersToken * 0.75) / 12)
        assert.equal(QrtlyWithdrawable.toNumber(), expectedQtrlyWithdrawable, 'Quarterly withdrawable is not correct')
      }

      resolve()
    })
  })

  it('Should verify that total fund can be withdrawn after 12 quarters', () => {
    return new Promise(async (resolve, reject) => {
      // seven days and 12 quarters in the past, plus a few minutes
      const genesisTime = roundToPrevMidnight(currentTime() - 12 * ONE_QUARTER - INITIAL_AUCTION_END_TIME) - 120
      const {metToken, auctions, founders} = await Metronome.initContracts(accounts, genesisTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      await metToken.enableMETTransfers()

      // Transaction in auction will enable withdraw
      await auctions.sendTransaction({
        from: accounts[5],
        value: 1e18
      })

      for (let i = 0; i < founders.length; i++) {
        const foundersAddress = parseAddress(founders[i])
        const foundersToken = parseToken(founders[i])
        const tokenLockerAddress = await auctions.tokenLockers(foundersAddress)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        const balanceBefore = await metToken.balanceOf(foundersAddress)
        const tx = await tokenLocker.withdraw({from: foundersAddress})
        assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted for withdraw on founder ' + i)
        const log = tx.logs[0]
        assert.equal(log.event, 'Withdrawn', 'Withdrawn log was not emitted')
        assert.equal(log.args.who, foundersAddress, 'Who is wrong')
        assert.equal(log.args.amount.toNumber(), foundersToken, 'Amount is wrong')
        const balanceAfter = await metToken.balanceOf(foundersAddress)
        assert.equal(balanceAfter.toNumber() - balanceBefore.toNumber(), foundersToken, 'Quarterly withdraw was not correct')

        const remainingBalance = await tokenLocker.deposited()
        const QrtlyWithdrawable = await tokenLocker.quarterlyWithdrawable()
        assert.equal(remainingBalance.toNumber(), 0, 'Remaining fund after withdraw is not correct')

        const expectedQtrlyWithdrawable = ((foundersToken * 0.75) / 12)
        assert.equal(QrtlyWithdrawable.toNumber(), expectedQtrlyWithdrawable, 'Quarterly withdrawable is not correct')
      }

      resolve()
    })
  })

  it('Should fail when deposit is called during postLock phase', () => {
    return new Promise(async (resolve, reject) => {
      const reserverFund = 1999999 * DECMULT
      const {auctions, founders} = await Metronome.initContracts(accounts, currentTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      for (let i = 0; i < founders.length; i++) {
        const foundersAddress = parseAddress(founders[i])
        const tokenLockerAddress = await auctions.tokenLockers(foundersAddress)
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
