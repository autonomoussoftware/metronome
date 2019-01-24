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
const BlockTime = require('../test/shared/time')

contract('TokenLocker', accounts => {
  const DECMULT = 10 ** 18
  const MINIMUM_PRICE = 33 * 10 ** 11// minimum wei per token
  const STARTING_PRICE = 2 // 2ETH per MET
  const TIME_SCALE = 1
  const INITIAL_AUCTION_END_TIME = 7 * 24 * 60 * 60 // 7 days in seconds
  const SECS_IN_A_DAY = 86400
  const SECS_IN_A_MIN = 60

  const OWNER = accounts[0]
  const FOUNDER = accounts[1]

  function parseAddress (founder) {
    return founder.slice(0, 42)
  }

  function parseToken (founder) {
    return parseInt(founder.slice(42), 16)
  }

  it('Should verify that TokenLocker contract is initialized correctly', () => {
    return new Promise(async (resolve, reject) => {
      const { auctions, metToken, founders } = await Metronome.initContracts(accounts, BlockTime.getCurrentBlockTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

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
      for (let i = 0; i < founders.length; i++) {
        const founderAddress = parseAddress(founders[i])
        const founderTokens = parseToken(founders[i])
        const tokenLockerAddress = await auctions.tokenLockers(founderAddress)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)
        assert.equal(await tokenLocker.auctions(), auctions.address, "Auctions address isn't setup correctly")
        assert.equal(await tokenLocker.token(), metToken.address, "METToken address isn't setup correctly")

        const lockedBalance = await metToken.balanceOf(tokenLocker.address)
        assert.equal(lockedBalance.toNumber(), founderTokens, 'Minted amount is wrong for ' + i)

        const balance = await tokenLocker.deposited()
        assert.equal(balance.toNumber(), founderTokens, 'Deposited amount is not correct.')
        const locked = await tokenLocker.locked()
        assert.isTrue(locked, 'Token Locker is not locked')

        grandTotalDeposited += balance.toNumber()
        totalMinted += lockedBalance.toNumber() / DECMULT
        foundersTotal += founderTokens
      }
      totalMinted *= DECMULT
      assert.equal(grandTotalDeposited, foundersTotal, 'Total deposit is not correct')

      const reserveAmount = 2000000
      assert.equal(totalMinted, (reserveAmount - 1) * DECMULT, 'Total minted for all founders is not correct')

      resolve()
    })
  })

  it('Only the owner can withdraw', () => {
    return new Promise(async (resolve, reject) => {
      const startTime = BlockTime.getCurrentBlockTime() - (10 * SECS_IN_A_MIN)
      const { auctions, founders } = await Metronome.initContracts(accounts, startTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      const buyer = accounts[2]
      await auctions.sendTransaction({
        from: buyer,
        value: 1e18
      })

      let advanceSeconds = INITIAL_AUCTION_END_TIME + (2 * SECS_IN_A_MIN)
      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()

      for (let i = 0; i < founders.length; i++) {
        const founderAddress = parseAddress(founders[i])
        const tokenLockerAddress = await auctions.tokenLockers(founderAddress)
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
      const startTime = BlockTime.getCurrentBlockTime() - (10 * SECS_IN_A_MIN)
      const { auctions, founders } = await Metronome.initContracts(accounts, startTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      let advanceSeconds = INITIAL_AUCTION_END_TIME + (2 * SECS_IN_A_MIN)
      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()

      for (let i = 0; i < founders.length; i++) {
        const founderAddress = parseAddress(founders[i])
        const tokenLockerAddress = await auctions.tokenLockers(founderAddress)
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
      const startTime = BlockTime.getCurrentBlockTime() - (10 * SECS_IN_A_MIN)
      const { metToken, auctions, founders } = await Metronome.initContracts(accounts, startTime, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

      await auctions.sendTransaction({
        from: accounts[2],
        value: 1e18
      })
      assert.isFalse(await auctions.isInitialAuctionEnded(), 'Initial Auction should not have already ended')

      for (let i = 0; i < founders.length; i++) {
        const founderAddress = parseAddress(founders[i])
        const tokenLockerAddress = await auctions.tokenLockers(founderAddress)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        let thrown = false
        try {
          await tokenLocker.withdraw({from: founderAddress})
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'Founder should not be allowed to withdraw fund before initial auction ended')
      }

      let advanceSeconds = INITIAL_AUCTION_END_TIME + (2 * 60)
      await BlockTime.timeTravel(advanceSeconds)
      await BlockTime.mineBlock()
      await metToken.enableMETTransfers()
      for (let i = 0; i < founders.length; i++) {
        const founderAddress = parseAddress(founders[i])
        const founderTokens = parseToken(founders[i])
        const tokenLockerAddress = await auctions.tokenLockers(founderAddress)
        const tokenLocker = await TokenLocker.at(tokenLockerAddress)

        await tokenLocker.withdraw({from: founderAddress})
        let metBalanceAfter = await metToken.balanceOf(founderAddress)
        assert.equal(metBalanceAfter.toNumber(), founderTokens * 0.25, 'initial fund withdaw  amount is not correct for founder 1')

        advanceSeconds = SECS_IN_A_DAY
        await BlockTime.timeTravel(advanceSeconds)
        await BlockTime.mineBlock()
      }

      resolve()
    })
  })
})
