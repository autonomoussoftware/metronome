/*
 The MIT License (MIT)

 Copyright 2018 - 2019, Autonomous Software.

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
  // Create contracts and initilize them for each test case

  describe('export ETH to Mock ETC', () => {
    var exportFee, amountToExport, ethContracts, etcContracts

    beforeEach(async () => {
      ethContracts = await METGlobal.initContracts(
        accounts,
        TestRPCTime.getCurrentBlockTime(),
        MINIMUM_PRICE,
        STARTING_PRICE,
        TIME_SCALE
      )
      let initialAuctionEndTime = await ethContracts.auctions.initialAuctionEndTime()
      etcContracts = await METGlobal.initNonOGContracts(
        accounts,
        TestRPCTime.getCurrentBlockTime(),
        MINIMUM_PRICE,
        STARTING_PRICE / 2,
        TIME_SCALE,
        initialAuctionEndTime.valueOf()
      )
      let miniumExportFee = 100
      await ethContracts.tokenPorter.setMinimumExportFee(miniumExportFee, {
        from: OWNER
      })
      let fee = 10
      await ethContracts.tokenPorter.setExportFeePerTenThousand(fee, {
        from: OWNER
      })
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
    it('Verify calculated leakage is correct', () => {
      return new Promise(async (resolve, reject) => {
        await TestRPCTime.timeTravel(7 * SECS_IN_DAY - SECS_IN_MINUTE)
        await TestRPCTime.mineBlock()
        exportFee = 1e20
        amountToExport = 2e22
        const exporter = accounts[7]
        const amount = 10e18
        await ethContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })
        await Utils.importExport(
          'ETH',
          ethContracts,
          etcContracts,
          amountToExport,
          exportFee,
          exporter,
          accounts[8],
          OWNER,
          accounts[1]
        )

        let expectedLeakage = 5788800000000000000
        let leakage = await etcContracts.metToken.leakage()
        assert.equal(expectedLeakage, leakage.toString(), 'calcualted leakage is wrong')
        resolve()
      })
    })

    it('Verify that leakage adjust global supply if import is done after x days of export. ETH to ETC', () => {
      return new Promise(async (resolve, reject) => {
        await TestRPCTime.timeTravel(7 * SECS_IN_DAY - SECS_IN_MINUTE)
        await TestRPCTime.mineBlock()
        exportFee = 1e20
        amountToExport = 2e22
        const exporter = accounts[7]
        const amount = 10e18
        await ethContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })
        await Utils.importExport(
          'ETH',
          ethContracts,
          etcContracts,
          amountToExport,
          exportFee,
          exporter,
          accounts[8],
          OWNER,
          accounts[1]
        )
        // restart auction
        await TestRPCTime.timeTravel(1 * SECS_IN_DAY)
        await TestRPCTime.mineBlock()
        await etcContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })
        await ethContracts.auctions.sendTransaction({
          from: accounts[3],
          value: amount
        })
        var globalSupplyETH = await ethContracts.auctions.globalMetSupply()
        let actualGlobalSupply = (await ethContracts.auctions.mintable())
          .add(await ethContracts.metToken.totalSupply())
          .add(await etcContracts.auctions.mintable())
          .add(await etcContracts.metToken.totalSupply())
        var diff = globalSupplyETH.sub(actualGlobalSupply)
        assert.closeTo(diff.toNumber(), 0, 100, 'Global supply is wrong.')
        resolve()
      })
    })
  })
})
