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
const TestRPCTime = require('../test/shared/time')
const METGlobal = require('../test/shared/inits')
const Utils = require('../test/shared/utils')

contract('TokenPorter', accounts => {
  const OWNER = accounts[0]
  const MINIMUM_PRICE = 33 * 10 ** 11 // minimum wei per token
  const STARTING_PRICE = 2 // 2ETH per MET
  const TIME_SCALE = 1
  const SECS_IN_DAY = 86400
  const SECS_IN_MINUTE = 60
  var ethContracts, etcContracts

  // Create contracts and initilize them for each test case
  beforeEach(async () => {
    ethContracts = await METGlobal.initContracts(
      accounts,
      TestRPCTime.getCurrentBlockTime(),
      MINIMUM_PRICE,
      STARTING_PRICE,
      TIME_SCALE
    )
    let miniumExportFee = 100
    await ethContracts.tokenPorter.setMinimumExportFee(miniumExportFee, {
      from: OWNER
    })
    let fee = 10
    await ethContracts.tokenPorter.setExportFeePerTenThousand(fee, {
      from: OWNER
    })

    let initialAuctionEndTime = await ethContracts.auctions.initialAuctionEndTime()
    // await initNonOGContracts(accounts, TestRPCTime.getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE, initialAuctionEndTime.valueOf())
    etcContracts = await METGlobal.initNonOGContracts(
      accounts,
      TestRPCTime.getCurrentBlockTime(),
      MINIMUM_PRICE,
      STARTING_PRICE / 2,
      TIME_SCALE,
      initialAuctionEndTime.valueOf()
    )
    await etcContracts.tokenPorter.setMinimumExportFee(miniumExportFee, {
      from: OWNER
    })
    await etcContracts.tokenPorter.setExportFeePerTenThousand(fee, {
      from: OWNER
    })
    await ethContracts.tokenPorter.addDestinationChain(
      web3.fromAscii('ETC'),
      etcContracts.metToken.address,
      {
        from: OWNER
      }
    )
    await etcContracts.tokenPorter.addDestinationChain(
      web3.fromAscii('ETH'),
      ethContracts.metToken.address,
      { from: OWNER }
    )
  })

  it('Init ETC - Move half MET to other chain and verify mintable', () => {
    return new Promise(async (resolve, reject) => {
      let fee = 3e24
      const amountToExport = 2.00144e24
      // get some balance for export
      const exporter = accounts[7]
      const amount = 80e18
      // Time travel to just a minute before auction end and buy all MET
      await TestRPCTime.timeTravel(8 * SECS_IN_DAY - SECS_IN_MINUTE)
      await TestRPCTime.mineBlock()
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

  // it('Test Auction in ETC after import.', () => {
  //   return new Promise(async (resolve, reject) => {
  //     const exportFee = 1e16
  //     const amountToExport = 1e17

  //     // Time travel to just a minute before initial auction end
  //     await TestRPCTime.timeTravel(7 * SECS_IN_DAY - SECS_IN_MINUTE)
  //     await TestRPCTime.mineBlock()

  //     // get some balance for export
  //     const exporter = accounts[7]
  //     const amount = 20e18
  //     await ethContracts.auctions.sendTransaction({
  //       from: exporter,
  //       value: amount
  //     })
  //     let balance = await ethContracts.metToken.balanceOf(exporter)
  //     assert.isAbove(
  //       balance.toNumber(),
  //       amountToExport + exportFee,
  //       'Balance of buyer after purchase is not correct'
  //     )
  //     await Utils.importExport(
  //       'ETH',
  //       ethContracts,
  //       etcContracts,
  //       amountToExport,
  //       exportFee,
  //       exporter,
  //       accounts[9],
  //       OWNER,
  //       accounts[1]
  //     )
  //     // After minting

  //     await TestRPCTime.timeTravel(1 * SECS_IN_DAY)
  //     await TestRPCTime.mineBlock()
  //     const amountUsedForPurchase = 1e18

  //     const expectedTokenPurchase = 552863677660940280
  //     let expectedWeiPerToken = 1808764150017608980
  //     // const tokensInNextAuction = 8e24 + 3 * 2880e18
  //     // perform actual transaction
  //     const mtTokenBalanceBefore = await etcContracts.metToken.balanceOf(
  //       OWNER
  //     )

  //     await etcContracts.auctions.sendTransaction({
  //       from: OWNER,
  //       value: amountUsedForPurchase
  //     })

  //     let lastPurchasePrice = await etcContracts.auctions.lastPurchasePrice()
  //     assert.equal(
  //       lastPurchasePrice.valueOf(),
  //       expectedWeiPerToken,
  //       'last Purchase price is not correct'
  //     )

  //     const mtTokenBalanceAfter = await etcContracts.metToken.balanceOf(OWNER)
  //     assert.equal(
  //       mtTokenBalanceAfter.sub(mtTokenBalanceBefore).valueOf(),
  //       expectedTokenPurchase,
  //       'Total purchased/minted tokens are not correct'
  //     )

  //     await TestRPCTime.timeTravel(SECS_IN_DAY)
  //     await TestRPCTime.mineBlock()
  //     // const expectedNextAuctionPrice = 20736727076

  //     await etcContracts.auctions.sendTransaction({
  //       from: OWNER,
  //       value: amountUsedForPurchase
  //     })

  //     expectedWeiPerToken = 1875392426219

  //     lastPurchasePrice = await etcContracts.auctions.lastPurchasePrice()
  //     assert.closeTo(
  //       lastPurchasePrice.toNumber(),
  //       expectedWeiPerToken,
  //       200,
  //       'Expected purchase price is wrong'
  //     )
  //     resolve()
  //   })
  // })
})
