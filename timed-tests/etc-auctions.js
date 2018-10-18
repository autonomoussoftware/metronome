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
const BlockTime = require('../test/shared/time')
const Metronome = require('../test/shared/inits')
const Utils = require('../test/shared/utils')

contract('ETC - Auction', accounts => {
  const OWNER = accounts[0]
  const MINIMUM_PRICE = 33 * 10 ** 11 // minimum wei per token
  var STARTING_PRICE = 2 // 2ETH per MET
  const TIME_SCALE = 1
  const SECS_IN_DAY = 86400
  const SECS_IN_MINUTE = 60
  var ethContracts, etcContracts

  // Create contracts and initilize them for each test case
  beforeEach(async () => {
    let genesisTime = BlockTime.getCurrentBlockTime()
    ethContracts = await Metronome.initContracts(
      accounts,
      genesisTime,
      MINIMUM_PRICE,
      STARTING_PRICE,
      TIME_SCALE
    )
    genesisTime = await ethContracts.auctions.genesisTime()

    let initialAuctionEndTime = await ethContracts.auctions.initialAuctionEndTime()
    // await initNonOGContracts(accounts, TestRPCTime.getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE, initialAuctionEndTime.valueOf())
    etcContracts = await Metronome.initNonOGContracts(
      accounts,
      genesisTime.valueOf(),
      MINIMUM_PRICE,
      STARTING_PRICE / 2,
      TIME_SCALE,
      initialAuctionEndTime.valueOf()
    )

    await Metronome.configureImportExport(accounts, ethContracts, etcContracts)
  })

  it('Init ETC - Move half MET to other chain and verify mintable', () => {
    return new Promise(async (resolve, reject) => {
      let fee = 3e24
      const amountToExport = 2.00144e24
      // get some balance for export
      const exporter = accounts[7]
      const amount = 80e18
      // Time travel to just a minute before auction end and buy all MET
      await BlockTime.timeTravel(8 * SECS_IN_DAY - SECS_IN_MINUTE)
      await BlockTime.mineBlock()
      await ethContracts.auctions.sendTransaction({
        from: exporter,
        value: amount
      })

      var balanceOfBuyer = await ethContracts.metToken.balanceOf(exporter)
      assert.isAbove(
        balanceOfBuyer.toNumber(),
        amountToExport,
        'Balance of buyer after purchase is not correct'
      )
      await Utils.importExport(
        'ETH',
        ethContracts,
        etcContracts,
        amountToExport,
        fee,
        exporter,
        accounts[8],
        OWNER,
        accounts[1]
      )
      let dailyMintableETH = await ethContracts.auctions.dailyMintable()
      let dailyMintableETC = await etcContracts.auctions.dailyMintable()
      assert.equal(
        dailyMintableETH.valueOf(),
        dailyMintableETC.valueOf(),
        'Daily mintable is wrong in two chains'
      )
      resolve()
    })
  })

  it('Verify that current  genesis time is same in two chains', () => {
    return new Promise(async (resolve, reject) => {
      await BlockTime.timeTravel(8 * SECS_IN_DAY - SECS_IN_MINUTE)
      await BlockTime.mineBlock()
      let etcGenesisTime = await etcContracts.auctions.genesisTime()
      let ethGenesisTime = await ethContracts.auctions.genesisTime()
      assert.equal(
        etcGenesisTime.valueOf(),
        ethGenesisTime.valueOf(),
        'Genesis time is wrong in two chains'
      )
      let etcCurrentTick = await etcContracts.auctions.currentTick()
      let ethCurrentTick = await ethContracts.auctions.currentTick()
      assert.equal(
        ethCurrentTick.valueOf(),
        etcCurrentTick.valueOf(),
        'Current tick is wrong in chains before import'
      )
      resolve()
    })
  })

  it('Confirm auction is working as expected before and after first import', () => {
    return new Promise(async (resolve, reject) => {
      let fee = 3e24
      const amountToExport = 2.00144e24
      // get some balance for export
      const exporter = accounts[4]
      let amount = 80e18
      // Time travel to just a minute before auction end and buy all MET
      await BlockTime.timeTravel(8 * SECS_IN_DAY - SECS_IN_MINUTE)
      await BlockTime.mineBlock()
      await ethContracts.auctions.sendTransaction({
        from: exporter,
        value: amount
      })
      var balanceOfBuyer = await ethContracts.metToken.balanceOf(exporter)
      assert.isAbove(
        balanceOfBuyer.toNumber(),
        amountToExport,
        'Balance of buyer after purchase is not correct'
      )
      let currentMintable = await etcContracts.auctions.currentMintable()
      assert.equal(
        currentMintable.valueOf(),
        0,
        'current mintable before first import is wrong'
      )
      let lastPurchasePrice = await etcContracts.auctions.lastPurchasePrice()
      let lastPurchaseTick = await etcContracts.auctions.lastPurchaseTick()
      assert.equal(
        lastPurchaseTick.valueOf(),
        0,
        'Last purchase tick before first import is wrong'
      )
      assert.equal(
        lastPurchasePrice.valueOf(),
        1e18,
        'Last purchase price before first import in etc is wrong'
      )
      await Utils.importExport(
        'ETH',
        ethContracts,
        etcContracts,
        amountToExport,
        fee,
        exporter,
        accounts[8],
        OWNER,
        accounts[1]
      )
      currentMintable = await etcContracts.auctions.currentMintable()
      assert.equal(
        currentMintable.valueOf(),
        0,
        'current mintable after first import is wrong'
      )
      lastPurchasePrice = await etcContracts.auctions.lastPurchasePrice()
      lastPurchaseTick = await etcContracts.auctions.lastPurchaseTick()
      let currentTick = await etcContracts.auctions.currentTick()
      assert.equal(
        lastPurchaseTick.valueOf(),
        currentTick.valueOf(),
        'Last purchase tick after first import is wrong'
      )
      assert.equal(
        lastPurchasePrice.valueOf(),
        1e18,
        'Last purchase price after first import is wrong'
      )
      await BlockTime.timeTravel(await Utils.secondsToNextMidnight())
      await BlockTime.mineBlock()
      currentMintable = await etcContracts.auctions.currentMintable()
      assert.equal(
        currentMintable.valueOf(),
        1440e18,
        'current mintable is wrong after first auction starts'
      )
      let currentAuction = await etcContracts.auctions.currentAuction()
      assert.equal(
        currentAuction.valueOf(),
        2,
        'currentAuction is wrong'
      )

      let currentPrice = await etcContracts.auctions.currentPrice()
      assert.equal(
        currentPrice.valueOf(),
        2e18,
        'current price is wrong after first auction starts'
      )
      amount = 10e18
      let balanceBefore = await etcContracts.metToken.balanceOf(exporter)
      await etcContracts.auctions.sendTransaction({
        from: exporter,
        value: amount
      })
      let balanceAfter = await etcContracts.metToken.balanceOf(exporter)
      assert.equal(
        balanceAfter.sub(balanceBefore),
        5e18,
        'Met balance of buyer is wrong'
      )
      currentMintable = await etcContracts.auctions.currentMintable()
      assert.equal(
        currentMintable.valueOf(),
        1435e18,
        'Current mintable is wrong'
      )
      await BlockTime.timeTravel(SECS_IN_DAY)
      await BlockTime.mineBlock()
      currentMintable = await etcContracts.auctions.currentMintable()
      assert.equal(
        currentMintable.valueOf(),
        1435e18 + 1440e18,
        'Current mintable is wrong'
      )
      resolve()
    })
  })
})
