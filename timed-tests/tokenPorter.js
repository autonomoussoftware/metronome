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
const ethers = require('ethers')

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
    const METTokenETCInitialSupply = 0

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

    it('set export fee correctly', () => {
      return new Promise(async (resolve, reject) => {
        let miniumExportFee = 100
        await ethContracts.tokenPorter.setMinimumExportFee(miniumExportFee, {
          from: OWNER
        })
        assert.equal(
          (await ethContracts.tokenPorter.minimumExportFee()).valueOf(),
          miniumExportFee,
          'miniumExportFee is not set correctly'
        )

        let exportFee = 10
        await ethContracts.tokenPorter.setExportFeePerTenThousand(exportFee, {
          from: OWNER
        })
        assert.equal(
          (await ethContracts.tokenPorter.exportFee()).valueOf(),
          exportFee,
          'exportFeeInPercent is not set correctly'
        )
        let thrown = false
        miniumExportFee = 0
        try {
          await ethContracts.tokenPorter.setMinimumExportFee(miniumExportFee, {
            from: OWNER
          })
        } catch (error) {
          thrown = true
        }

        assert.isTrue(thrown, 'Minimum export fee must be > 0')

        resolve()
      })
    })

    it('set export fee correctly- Non owner user should not be able to set export fee', () => {
      return new Promise(async (resolve, reject) => {
        let thrown = false
        let miniumExportFee = 100
        let exportFee = 10
        try {
          await ethContracts.tokenPorter.setMinimumExportFee(miniumExportFee, {
            from: accounts[1]
          })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(
          thrown,
          'Only owner should be able to set minium export fee'
        )
        thrown = false
        try {
          await ethContracts.tokenPorter.setExportFeePerTenThousand(exportFee, {
            from: accounts[1]
          })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'Only owner should be able to set export fee')
        resolve()
      })
    })

    it('Basic export test . ETH to ETC', () => {
      return new Promise(async (resolve, reject) => {
        // Time travel to just a minute before initial auction end
        await TestRPCTime.timeTravel(7 * SECS_IN_DAY - SECS_IN_MINUTE)
        await TestRPCTime.mineBlock()
        exportFee = 1e16
        amountToExport = 1e17 - exportFee
        // get some balance for export
        const exporter = accounts[7]
        const amount = 1e18
        await ethContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })

        var balance = await ethContracts.metToken.balanceOf(exporter)
        assert.isAbove(
          balance.toNumber(),
          amountToExport + exportFee,
          'Balance of buyer after purchase is not correct'
        )
        // Before Minting
        var totalSupply = await etcContracts.metToken.totalSupply()

        assert.equal(totalSupply.valueOf(), 0, 'Total supply in ETC is not 0')

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

        // After minting
        let globalSupplyETH = await ethContracts.auctions.globalMetSupply()
        let globalSupplyETC = await etcContracts.auctions.globalMetSupply()
        assert.equal(
          globalSupplyETC.toNumber(),
          globalSupplyETH.toNumber(),
          'Global supply in two chain is not correct'
        )
        let balanceAfterImport = await etcContracts.metToken.balanceOf(
          accounts[8]
        )

        assert.equal(balanceAfterImport.valueOf(), amountToExport)
        totalSupply = await etcContracts.metToken.totalSupply()
        assert.equal(
          totalSupply.sub(METTokenETCInitialSupply).valueOf(),
          amountToExport + exportFee,
          'Total supply after import is not correct'
        )
        globalSupplyETH = await ethContracts.auctions.globalMetSupply()
        globalSupplyETC = await etcContracts.auctions.globalMetSupply()
        assert.equal(
          globalSupplyETC.toNumber(),
          globalSupplyETH.toNumber(),
          'Global supply in two chain is not correct'
        )
        let dailyMintableETC = await etcContracts.auctions.dailyMintable()
        let dailyMintableETH = await ethContracts.auctions.dailyMintable()

        assert.equal(
          dailyMintableETC.add(dailyMintableETH.toNumber()),
          2880e18,
          'Daily mintable is wrong'
        )

        resolve()
      })
    })

    it('Daily minting should be correct if any auction missed in one chain.', () => {
      return new Promise(async (resolve, reject) => {
        // Time travel to just a minute before initial auction end
        await TestRPCTime.timeTravel(12 * SECS_IN_DAY - SECS_IN_MINUTE)
        await TestRPCTime.mineBlock()
        exportFee = 1e16
        amountToExport = 1e16
        // get some balance for export
        const exporter = accounts[8]
        const amount = 1e19
        await ethContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })

        var balance = await ethContracts.metToken.balanceOf(exporter)
        assert.isAbove(
          balance.toNumber(),
          amountToExport + exportFee,
          'Balance of buyer after purchase is not correct'
        )
        // Before Minting
        var totalSupply = await etcContracts.metToken.totalSupply()

        assert.equal(totalSupply.valueOf(), 0, 'Total supply in ETC is not 0')

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

        // After minting
        await TestRPCTime.timeTravel(1 * SECS_IN_DAY - SECS_IN_MINUTE)
        await TestRPCTime.mineBlock()
        await ethContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })
        await TestRPCTime.timeTravel(1 * SECS_IN_DAY - SECS_IN_MINUTE)
        await TestRPCTime.mineBlock()
        await ethContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })
        await TestRPCTime.timeTravel(1 * SECS_IN_DAY - SECS_IN_MINUTE)
        await TestRPCTime.mineBlock()
        await ethContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })
        await TestRPCTime.timeTravel(1 * SECS_IN_DAY - SECS_IN_MINUTE)
        await TestRPCTime.mineBlock()
        await ethContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })
        await Utils.importExport(
          'ETH',
          ethContracts,
          etcContracts,
          1e19,
          exportFee,
          exporter,
          accounts[8],
          OWNER,
          accounts[1]
        )
        // await ethContracts.auctions.updateMintable()
        // await ethContracts.auctions.updateMintable()
        await TestRPCTime.timeTravel(1 * SECS_IN_DAY)
        await TestRPCTime.mineBlock()
        await ethContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })
        await etcContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })
        let etcMintable = await etcContracts.auctions.mintable()
        let ethMintable = await ethContracts.auctions.mintable()
        let etcTotalSupply = await etcContracts.metToken.totalSupply()
        let ethTotalSupply = await ethContracts.metToken.totalSupply()
        let globalSupply = etcMintable.add(ethMintable.valueOf()).add(etcTotalSupply.valueOf()).add(ethTotalSupply.valueOf())
        let expectedGlobalSupply = ethers.utils.bigNumberify(web3.toHex(1.003456e25))
        globalSupply = ethers.utils.bigNumberify(web3.toHex(globalSupply.valueOf()))
        assert(expectedGlobalSupply.gte(globalSupply), 'Global supply is wrong')
        assert(expectedGlobalSupply.sub(globalSupply).lt(ethers.utils.bigNumberify(10)), 'Global supply is wrong')

        await TestRPCTime.timeTravel(1 * SECS_IN_DAY - SECS_IN_MINUTE)
        await TestRPCTime.mineBlock()
        await ethContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })

        // Some auction missed in etc.
        await etcContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })
        etcMintable = await etcContracts.auctions.mintable()
        ethMintable = await ethContracts.auctions.mintable()
        etcTotalSupply = await etcContracts.metToken.totalSupply()
        ethTotalSupply = await ethContracts.metToken.totalSupply()
        globalSupply = etcMintable.add(ethMintable.valueOf()).add(etcTotalSupply.valueOf()).add(ethTotalSupply.valueOf())
        globalSupply = ethers.utils.bigNumberify(web3.toHex(globalSupply.valueOf()))
        expectedGlobalSupply = ethers.utils.bigNumberify(web3.toHex(1.003744E25))
        assert(expectedGlobalSupply.gte(globalSupply), 'Global supply is wrong')
        assert(expectedGlobalSupply.sub(globalSupply).lte(ethers.utils.bigNumberify(10)), 'Global supply is wrong')
        resolve()
      })
    })

    it('Should be able to update validator and wrong validtor should not be able to do validation', () => {
      return new Promise(async (resolve, reject) => {
        // get some balance for export
        const exporter = accounts[7]
        const amount = 1e18
        await TestRPCTime.timeTravel(7 * SECS_IN_DAY - SECS_IN_MINUTE)
        await TestRPCTime.mineBlock()
        await ethContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })
        exportFee = 1e16
        amountToExport = 1e17 - exportFee
        var balance = await ethContracts.metToken.balanceOf(exporter)
        assert.isAbove(
          balance.toNumber(),
          amountToExport + exportFee,
          'Balance of buyer after purchase is not correct'
        )
        let thrown = false
        try {
          await Utils.importExport(
            'ETH',
            ethContracts,
            etcContracts,
            amountToExport,
            exportFee,
            exporter,
            accounts[8],
            accounts[5],
            accounts[1]
          )
        } catch (e) {
          thrown = true
        }
        assert(thrown, 'Wrong validator should not be able to validate hash')
        thrown = false
        try {
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
        } catch (e) {
          thrown = true
        }
        assert.isFalse(thrown, 'Validator is not able validate hash')
        resolve()
      })
    })

    it('Basic export test . ETC to ETH', () => {
      return new Promise(async (resolve, reject) => {
        let exportFee = 1e16
        let amountToExport = 1e17

        // Time travel to just a minute before initial auction end
        await TestRPCTime.timeTravel(7 * SECS_IN_DAY - SECS_IN_MINUTE)
        await TestRPCTime.mineBlock()

        // get some balance for export
        const exporter = accounts[4]
        const amount = 1e18
        await ethContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })

        var balance = await ethContracts.metToken.balanceOf(exporter)
        assert.isAbove(
          balance.toNumber(),
          amountToExport + exportFee,
          'Balance of buyer after purchase is not correct'
        )
        await Utils.importExport(
          'ETH',
          ethContracts,
          etcContracts,
          amountToExport,
          exportFee,
          exporter,
          accounts[9],
          OWNER,
          accounts[1]
        )
        let balanceAfterImport = await etcContracts.metToken.balanceOf(
          accounts[9]
        )
        assert.equal(balanceAfterImport.valueOf(), amountToExport)
        exportFee = 1e16
        amountToExport = 1e16
        await TestRPCTime.timeTravel(SECS_IN_MINUTE)
        await TestRPCTime.mineBlock()
        let totalSuppllyETCBefore = await etcContracts.metToken.totalSupply()
        let totalSuppllyETHBefore = await ethContracts.metToken.totalSupply()
        // export to ETH from ETC
        balance = await etcContracts.metToken.balanceOf(accounts[9])
        assert.isAbove(
          balance.toNumber(),
          amountToExport + exportFee,
          'Balance of buyer after purchase is not correct'
        )
        await Utils.importExport(
          'ETC',
          etcContracts,
          ethContracts,
          amountToExport,
          exportFee,
          accounts[9],
          accounts[3],
          OWNER,
          accounts[1]
        )
        let totalSuppllyETCAfter = await etcContracts.metToken.totalSupply()
        let totalSuppllyETHAfter = await ethContracts.metToken.totalSupply()
        assert.equal(
          totalSuppllyETCBefore.sub(totalSuppllyETCAfter).valueOf(),
          amountToExport + exportFee,
          'total supply of ETC after export is wrong'
        )
        assert.equal(
          totalSuppllyETHAfter.sub(totalSuppllyETHBefore).valueOf(),
          amountToExport + exportFee,
          'total supply of ETH after import is wrong'
        )
        resolve()
      })
    })

    it('Test AC in ETC after import.', () => {
      return new Promise(async (resolve, reject) => {
        const exportFee = 1e16
        const amountToExport = 1e17

        // Time travel to just a minute before initial auction end
        await TestRPCTime.timeTravel(7 * SECS_IN_DAY - SECS_IN_MINUTE)
        await TestRPCTime.mineBlock()

        // get some balance for export
        const exporter = accounts[7]
        const amount = 1e18
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
          accounts[9],
          OWNER,
          accounts[1]
        )
        await TestRPCTime.timeTravel(SECS_IN_DAY)
        await TestRPCTime.mineBlock()
        const WEI_SENT = 1e18
        const MIN_MET_RETURN = 1
        let metBalanceOfImporter = await etcContracts.metToken.balanceOf(
          accounts[9]
        )
        await etcContracts.metToken.enableMETTransfers()
        await etcContracts.metToken.approve(
          accounts[9],
          metBalanceOfImporter.toNumber(),
          { from: accounts[9] }
        )
        await etcContracts.metToken.transferFrom(
          accounts[9],
          etcContracts.autonomousConverter.address,
          metBalanceOfImporter.toNumber(),
          { from: accounts[9] }
        )
        const reserveSupply = await etcContracts.autonomousConverter.getMetBalance(
          {
            from: OWNER
          }
        )
        const ethBalanceOfACBefore = await web3.eth.getBalance(
          etcContracts.autonomousConverter.address
        )
        const prediction = await etcContracts.autonomousConverter.getMetForEthResult(
          WEI_SENT,
          { from: OWNER }
        )
        assert(
          prediction.toNumber() > 0,
          'ETH to MET prediction is not greater than zero'
        )
        assert(
          prediction.toNumber() <= reserveSupply.toNumber(),
          'Prediction is larger than reserve supply'
        )

        const metBalanceOfACBefore = await etcContracts.metToken.balanceOf(
          etcContracts.autonomousConverter.address
        )
        const mtTokenBalanceOfOwnerBefore = await etcContracts.metToken.balanceOf(
          OWNER
        )

        const txChange = await etcContracts.autonomousConverter.convertEthToMet(
          MIN_MET_RETURN,
          { from: OWNER, value: WEI_SENT }
        )
        assert(txChange, 'ETH to MET transaction failed')

        const ethBalanceOfACAfter = await web3.eth.getBalance(
          etcContracts.autonomousConverter.address
        )
        const metBalanceOfACAfter = await etcContracts.metToken.balanceOf(
          etcContracts.autonomousConverter.address
        )
        const mtTokenBalanceOfOwnerAfter = await etcContracts.metToken.balanceOf(
          OWNER
        )
        const smartTokenAfterBalance = await etcContracts.smartToken.balanceOf(
          OWNER,
          {
            from: etcContracts.autonomousConverter.address
          }
        )

        assert.equal(
          mtTokenBalanceOfOwnerAfter.toNumber() -
            mtTokenBalanceOfOwnerBefore.toNumber(),
          prediction.toNumber(),
          'Prediction and actual is not correct for owner'
        )
        assert.closeTo(
          metBalanceOfACBefore.toNumber() - metBalanceOfACAfter.toNumber(),
          prediction.toNumber(),
          1000,
          'Prediction and actual is not correct for AC'
        )
        assert.equal(
          smartTokenAfterBalance.toNumber(),
          0,
          'Smart Tokens were not destroyed'
        )
        assert(
          mtTokenBalanceOfOwnerAfter.toNumber(),
          metBalanceOfACBefore.toNumber() - metBalanceOfACAfter.toNumber(),
          'MET not recieved after ETH exchange'
        )
        assert(
          ethBalanceOfACAfter.toNumber() > ethBalanceOfACBefore.toNumber(),
          'ETH not recieved after ETH exchange'
        )

        resolve()
      })
    })

    it('Export test with merkle path . ETH to ETC', () => {
      return new Promise(async (resolve, reject) => {
        const exportFee = 1e16
        const amountToExport = 1e17 - exportFee
        // Time travel to just a minute before initial auction end
        await TestRPCTime.timeTravel(7 * SECS_IN_DAY - SECS_IN_MINUTE)
        await TestRPCTime.mineBlock()

        // get some balance for export
        const exporter = accounts[7]
        const amount = 1e18
        await ethContracts.auctions.sendTransaction({
          from: exporter,
          value: amount
        })

        var balance = await ethContracts.metToken.balanceOf(exporter)
        assert.isAbove(
          balance.toNumber(),
          amountToExport,
          'Balance of buyer after purchase is not correct'
        )
        var totalSupplyBefore = await etcContracts.metToken.totalSupply()
        for (let i = 0; i < 8; i++) {
          await Utils.importExport(
            'ETH',
            ethContracts,
            etcContracts,
            amountToExport,
            exportFee,
            exporter,
            accounts[9],
            OWNER,
            accounts[1]
          )
        }
        var totalSupplyAfter = await etcContracts.metToken.totalSupply()
        assert.equal(
          totalSupplyAfter.sub(totalSupplyBefore).valueOf(),
          (amountToExport + exportFee) * 8
        )
        // After minting
        let globalSupplyETH = await ethContracts.auctions.globalMetSupply()
        let globalSupplyETC = await etcContracts.auctions.globalMetSupply()
        assert.equal(
          globalSupplyETC.toNumber(),
          globalSupplyETH.toNumber(),
          'Global supply in two chain is not correct'
        )
        let balanceAfterImport = await etcContracts.metToken.balanceOf(
          accounts[9]
        )

        assert.equal(balanceAfterImport.valueOf(), amountToExport * 8)

        resolve()
      })
    })
  })
})
