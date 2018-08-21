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
const TokenPorter = artifacts.require('TokenPorter')
const Validator = artifacts.require('Validator')
const ethjsABI = require('ethjs-abi')

contract('TokenPorter', accounts => {
  const OWNER = accounts[0]
  const MET_INITIAL_SUPPLY = 0
  const SMART_INITIAL_SUPPLY = 0
  const DECMULT = 10 ** 18
  const MINIMUM_PRICE = 33 * 10 ** 11 // minimum wei per token
  const STARTING_PRICE = 2 // 2ETH per MET
  const TIME_SCALE = 1

  let metToken, smartToken, proceeds, autonomousConverter, auctions, tokenPorter, validator

  function getCurrentBlockTime () {
    var defaultBlock = web3.eth.defaultBlock
    return web3.eth.getBlock(defaultBlock).timestamp
  }

  async function initContracts (startTime, minimumPrice, startingPrice, timeScale) {
    metToken = await METToken.new()
    smartToken = await SmartToken.new()
    tokenPorter = await TokenPorter.new()
    validator = await Validator.new({from: OWNER})
    await metToken.initMETToken(autonomousConverter.address, auctions.address, MET_INITIAL_SUPPLY, DECMULT, {from: OWNER})
    await smartToken.initSmartToken(autonomousConverter.address, autonomousConverter.address, SMART_INITIAL_SUPPLY, {from: OWNER})
    await autonomousConverter.init(metToken.address, smartToken.address, auctions.address,
      {
        from: OWNER,
        value: web3.toWei(1, 'ether')
      })
    await proceeds.initProceeds(autonomousConverter.address, auctions.address, {from: OWNER})
    const founders = []
    // Since we are appending it with hexadecimal address so amount should also be
    // in hexa decimal. Hence 999999e18 = 0000d3c20dee1639f99c0000 in 24 character ( 96 bits)
    // 1000000e18 = 0000d3c20dee1639f99c0000
    founders.push(OWNER + '0000D3C214DE7193CD4E0000')
    founders.push(accounts[1] + '0000D3C214DE7193CD4E0000')
    await auctions.createTokenLocker(OWNER, metToken.address, {from: OWNER})
    await auctions.createTokenLocker(accounts[1], metToken.address, {from: OWNER})

    await auctions.mintInitialSupply(founders, metToken.address, proceeds.address, autonomousConverter.address, {from: OWNER})
    await auctions.initAuctions(startTime, minimumPrice, startingPrice, timeScale, {from: OWNER})
    await tokenPorter.initTokenPorter(metToken.address, auctions.address, {from: OWNER})
    await tokenPorter.setValidator(validator.address, {from: OWNER})
    await metToken.setTokenPorter(tokenPorter.address, {from: OWNER})
    await validator.initValidator(OWNER, accounts[1], accounts[2], {from: OWNER})
    await validator.setTokenPorter(tokenPorter.address, {from: OWNER})
  }

  // Create contracts and initilize them for each test case
  beforeEach(async () => {
    proceeds = await Proceeds.new()
    autonomousConverter = await AutonomousConverter.new()
    auctions = await Auctions.new()
  })

  describe('initialized', () => {
    it('proper initialization', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

        const auctionAddr = await tokenPorter.auctions()
        assert.equal(auctionAddr, auctions.address, 'Auctions address is not the same')

        const tokenAddr = await tokenPorter.token()
        assert.equal(tokenAddr, metToken.address, 'Token address is not the same')

        resolve()
      })
    })
  })

  describe('add destination chains', () => {
    const destChain = web3.fromAscii('XVG')
    let destAddr

    beforeEach(async () => {
      await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      destAddr = accounts[8]
    })

    it('cant add zero chain', () => {
      return new Promise(async (resolve, reject) => {
        let thrown = false
        try {
          await tokenPorter.addDestinationChain(0x0, destAddr, { from: OWNER })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'addDestinationChain did not throw')
        resolve()
      })
    })

    it('cant add zero address', () => {
      return new Promise(async (resolve, reject) => {
        let thrown = false
        try {
          await tokenPorter.addDestinationChain(destChain, 0x0, { from: OWNER })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'addDestinationChain did not throw')
        resolve()
      })
    })

    it('only owner can add', () => {
      return new Promise(async (resolve, reject) => {
        let thrown = false
        try {
          await tokenPorter.addDestinationChain(destChain, destAddr, { from: accounts[7] })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'addDestinationChain did not throw')
        resolve()
      })
    })

    it('add valild chain', () => {
      return new Promise(async (resolve, reject) => {
        const success = await tokenPorter.addDestinationChain.call(destChain, destAddr, { from: OWNER })
        assert.isTrue(success, 'addDestinationChain did not return true')

        await tokenPorter.addDestinationChain(destChain, destAddr, { from: OWNER })
        const addr = await tokenPorter.destinationChains(destChain)
        assert.equal(addr, destAddr, 'chain was not added to destinationChains')

        resolve()
      })
    })
  })

  describe('Update threshold', () => {
    beforeEach(async () => {
      await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      validator.addValidator(accounts[1])
      validator.addValidator(accounts[2])
      validator.addValidator(accounts[3])
    })

    it('cant add zero value in threshold', () => {
      return new Promise(async (resolve, reject) => {
        let thrown = false
        try {
          await validator.updateThreshold(0, { from: OWNER })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'updateThreshold did not throw when trying to set 0 value')
        resolve()
      })
    })

    it('Non owner cant add value in threshold', () => {
      return new Promise(async (resolve, reject) => {
        let thrown = false
        try {
          await validator.updateThreshold(1, { from: accounts[4] })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'updateThreshold did not throw when non-owner user trying to update threeshold')
        resolve()
      })
    })

    it('Owner should be able to update threshold value', () => {
      return new Promise(async (resolve, reject) => {
        let newThreshold = 2
        await validator.updateThreshold(newThreshold, { from: OWNER })
        let threshold = await validator.threshold()
        assert.equal(threshold.valueOf(), newThreshold, 'Threshold value is not updated correctly')
        resolve()
      })
    })

    it('Owner should not be able to set threshold value greater than total validator count', () => {
      return new Promise(async (resolve, reject) => {
        let newThreshold = 4
        let thrown = false
        try {
          await validator.updateThreshold(newThreshold, { from: OWNER })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'Owner should not be able to set threshold value greater than total validator count')
        newThreshold = 3
        await validator.updateThreshold(newThreshold, { from: OWNER })
        let threshold = await validator.threshold()
        assert.equal(threshold.valueOf(), newThreshold, 'Threshold value is not updated correctly')

        resolve()
      })
    })
  })

  describe('remove destination chains', () => {
    const destChain = web3.fromAscii('XVG')
    let destAddr

    beforeEach(async () => {
      await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      destAddr = accounts[8]
      await tokenPorter.addDestinationChain(destChain, destAddr, { from: OWNER })
    })

    it('cant remove zero chain', () => {
      return new Promise(async (resolve, reject) => {
        let thrown = false
        try {
          await tokenPorter.removeDestinationChain(0x0, { from: OWNER })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'removeDestinationChain did not throw')
        resolve()
      })
    })

    it('only owner can remove', () => {
      return new Promise(async (resolve, reject) => {
        let thrown = false
        try {
          await tokenPorter.removeDestinationChain(destChain, { from: accounts[7] })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'removeDestinationChain did not throw')
        resolve()
      })
    })

    it('throw on duplicate removes', () => {
      return new Promise(async (resolve, reject) => {
        await tokenPorter.removeDestinationChain(destChain, { from: OWNER })

        let thrown = false
        try {
          await tokenPorter.removeDestinationChain(destChain, { from: OWNER })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'removeDestinationChain did not throw')
        resolve()
      })
    })

    it('remove valild chain', () => {
      return new Promise(async (resolve, reject) => {
        const success = await tokenPorter.removeDestinationChain.call(destChain, { from: OWNER })
        assert.isTrue(success, 'removeDestinationChain did not return true')

        await tokenPorter.removeDestinationChain(destChain, { from: OWNER })
        const addr = await tokenPorter.destinationChains(destChain)
        assert.equal(addr, 0x0, 'chain was not removed from destinationChains')

        resolve()
      })
    })
  })

  describe('export to invalid chain', () => {
    it('should throw for unknown destination', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

        // get some balance for export, half MET
        const buyer = accounts[7]
        const amount = 1e18
        await auctions.sendTransaction({ from: buyer, value: amount })

        const mtTokenBalanceBefore = await metToken.balanceOf(buyer)
        assert.isAbove(mtTokenBalanceBefore.toNumber(), 0, 'Buyer has no MET Tokens to export')
        let thrown = false
        const expectedDestChain = 'ETC'
        const expectedExtraData = 'extra data'
        try {
          await metToken.export(
            web3.fromAscii(expectedDestChain),
            metToken.address,
            buyer,
            mtTokenBalanceBefore,
            0,
            web3.fromAscii(expectedExtraData),
            { from: buyer })
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'export did not throw')

        resolve()
      })
    })
  })

  describe('export off chain', () => {
    const destChain = web3.fromAscii('ETH')
    let destAddr

    it('successful export', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
        destAddr = accounts[2]
        await tokenPorter.addDestinationChain(destChain, destAddr, { from: OWNER })

        // get some balance for export, half MET
        const buyer = accounts[7]
        const amount = 1e18
        await auctions.sendTransaction({ from: buyer, value: amount })

        var totalSupplyBefore = await metToken.totalSupply()
        var mtTokenBalanceBefore = await metToken.balanceOf(buyer)
        assert.isAbove(mtTokenBalanceBefore.toNumber(), 0, 'Buyer has no MET Tokens to export')

        // export all tokens tokens
        const expectedExtraData = 'extra data'
        const tx = await metToken.export(
          destChain,
          destAddr,
          buyer,
          mtTokenBalanceBefore,
          0,
          web3.fromAscii(expectedExtraData),
          { from: buyer })

        const claimable = await tokenPorter.claimables(metToken.address, buyer)
        assert.equal(claimable.toNumber(), 0, 'Claimable should not have been recorded')

        // check for burn
        assert.equal(tx.logs.length, 2, 'Incorrect number of logs emitted')
        const burnLog = tx.logs[1]
        assert.equal(burnLog.event, 'Transfer', 'Burn was not emitted')
        assert.equal(burnLog.args._from, buyer, 'From is wrong')
        assert.equal(burnLog.args._to, 0x0, 'To is wrong')
        assert.equal(burnLog.args._value.toNumber(), mtTokenBalanceBefore.toNumber(), 'Value is wrong')

        // check for export receipt
        const decoder = ethjsABI.logDecoder(tokenPorter.abi)
        const tokenPorterEvents = decoder(tx.receipt.logs)
        assert.equal(tokenPorterEvents.length, 1, 'Incorrect number of logs emitted')
        const logExportReceipt = tokenPorterEvents[0]
        assert.equal(logExportReceipt._eventName, 'ExportReceiptLog', 'Log name is wrong')
        const amountToBurn = parseInt(logExportReceipt.amountToBurn.toString(), 10)
        assert.equal(amountToBurn, mtTokenBalanceBefore.toNumber(), 'Amounts are different')
        const destinationChain = logExportReceipt.destinationChain
        assert.equal(web3.toHex(destinationChain), web3.toHex(destChain) + '0000000000', 'Dest Chain is different')
        const destMetronomeAddr = logExportReceipt.destinationMetronomeAddr
        assert.equal(destMetronomeAddr, destAddr, 'Dest MetronomeAddr is different')
        const destinationRecipientAddr = logExportReceipt.destinationRecipientAddr
        assert.equal(destinationRecipientAddr, buyer, 'Dest Recipient is different')

        const extraData = logExportReceipt.extraData
        assert.equal(web3.toHex(extraData), web3.toHex(web3.fromAscii(expectedExtraData)), 'Extra Data is different')
        const currentTick = logExportReceipt.currentTick
        assert.equal(currentTick.toNumber(), (await auctions.currentTick()).toNumber(), 'Current Tick is different')
        const burnSequence = logExportReceipt.burnSequence
        assert.equal(burnSequence.toNumber(), 1, 'burnSequence is different')

        // TODO: is there a way to validate without an import?
        var totalSupplyAfter = await metToken.totalSupply()
        const currentBurnHash = logExportReceipt.currentBurnHash
        assert.isNotEmpty(currentBurnHash, 'Burn Hash is empty')
        const prevBurnHash = logExportReceipt.prevBurnHash
        assert.isNotEmpty(prevBurnHash, 'Prev Burn Hash is empty')
        const dailyMintable = logExportReceipt.dailyMintable
        assert.isNotEmpty(dailyMintable, 'Prev Burn Hash is empty')
        const supplyOnAllChains = logExportReceipt.supplyOnAllChains
        assert.equal(supplyOnAllChains.length, 6, 'Supply On All Chains is wrong length')
        assert.equal(parseInt(supplyOnAllChains[0].toString(), 10), totalSupplyAfter.toNumber(), 'First chain is not non-zero')
        assert.equal(supplyOnAllChains[1].toString(), '0', 'First chain is not non-zero')
        assert.equal(supplyOnAllChains[2].toString(), '0', 'First chain is not zero')
        assert.equal(supplyOnAllChains[3].toString(), '0', 'First chain is not zero')
        assert.equal(supplyOnAllChains[4].toString(), '0', 'First chain is not zero')
        assert.equal(supplyOnAllChains[5].toString(), '0', 'First chain is not zero')

        assert.isAbove(logExportReceipt.genesisTime.toNumber(), 0, 'genesisTime is wrong')

        // reconcile balances
        var mtTokenBalanceAfter = await metToken.balanceOf(buyer)
        assert.equal(totalSupplyBefore.sub(totalSupplyAfter).toNumber(), amountToBurn, 'After export, total supply is not correct')
        assert.equal(mtTokenBalanceBefore.sub(mtTokenBalanceAfter).toNumber(), amountToBurn, 'After export, metTokenBalance is not correct')
        assert.equal(mtTokenBalanceAfter.toNumber(), 0, 'metTokenBalance after export should be zero')

        resolve()
      })
    })
  })

  describe('export on chain', () => {
    const destChain = web3.fromAscii('ETH')
    let destAddr

    it('successful export', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
        destAddr = accounts[3]
        await tokenPorter.addDestinationChain(destChain, destAddr, { from: OWNER })

        // get some balance for export, half MET
        const buyers = [accounts[7], accounts[8], accounts[9]]
        const claims = []
        const destMET = destAddr
        for (let i = 0; i < buyers.length; i++) {
          const buyer = accounts[i]
          const amount = 1e18
          await auctions.sendTransaction({ from: buyer, value: amount })

          var totalSupplyBefore = await metToken.totalSupply()
          var mtTokenBalanceBefore = await metToken.balanceOf(buyer)
          assert.isAbove(mtTokenBalanceBefore.toNumber(), 0, 'Buyer has no MET Tokens to export')

          // export all tokens tokens
          const expectedExtraData = 'extra data'
          const tx = await metToken.export(
            destChain,
            destMET,
            buyer,
            mtTokenBalanceBefore,
            0,
            web3.fromAscii(expectedExtraData),
            { from: buyer })

          // check for burn
          assert.equal(tx.logs.length, 2, 'Incorrect number of logs emitted')
          const burnLog = tx.logs[1]
          assert.equal(burnLog.event, 'Transfer', 'Burn was not emitted')
          assert.equal(burnLog.args._from, buyer, 'From is wrong')
          assert.equal(burnLog.args._to, 0x0, 'To is wrong')
          assert.equal(burnLog.args._value.toNumber(), mtTokenBalanceBefore.toNumber(), 'Value is wrong')

          const claimable = await tokenPorter.claimables(destMET, buyer)
          assert.equal(claimable.toNumber(), mtTokenBalanceBefore.toNumber(), 'Claimable was not recorded')

          // check for export receipt
          const decoder = ethjsABI.logDecoder(tokenPorter.abi)
          const tokenPorterEvents = decoder(tx.receipt.logs)
          assert.equal(tokenPorterEvents.length, 1, 'Incorrect number of logs emitted')
          const logExportReceipt = tokenPorterEvents[0]
          assert.equal(logExportReceipt._eventName, 'ExportReceiptLog', 'Log name is wrong')
          const amountToBurn = parseInt(logExportReceipt.amountToBurn.toString(), 10)
          assert.equal(amountToBurn, mtTokenBalanceBefore.toNumber(), 'Amounts are different')
          const destinationChain = logExportReceipt.destinationChain
          assert.equal(web3.toHex(destinationChain), web3.toHex(destChain) + '0000000000', 'Dest Chain is different')
          const destMetronomeAddr = logExportReceipt.destinationMetronomeAddr
          assert.equal(destMetronomeAddr, destMET, 'Dest MetronomeAddr is different')
          const destinationRecipientAddr = logExportReceipt.destinationRecipientAddr
          assert.equal(destinationRecipientAddr, buyer, 'Dest Recipient is different')
          claims.push({ address: destinationRecipientAddr, amount: amountToBurn })

          const extraData = logExportReceipt.extraData
          assert.equal(web3.toHex(extraData), web3.toHex(web3.fromAscii(expectedExtraData)), 'Extra Data is different')
          const currentTick = logExportReceipt.currentTick
          assert.equal(currentTick.toNumber(), (await auctions.currentTick()).toNumber(), 'Current Tick is different')
          const burnSequence = logExportReceipt.burnSequence
          assert.equal(burnSequence.toNumber(), i + 1, 'burnSequence is different')

          // TODO: is there a way to validate without an import?
          var totalSupplyAfter = await metToken.totalSupply()
          const currentBurnHash = logExportReceipt.currentBurnHash
          assert.isNotEmpty(currentBurnHash, 'Burn Hash is empty')
          const prevBurnHash = logExportReceipt.prevBurnHash
          assert.isNotEmpty(prevBurnHash, 'Prev Burn Hash is empty')
          const dailyMintable = logExportReceipt.dailyMintable
          assert.isNotEmpty(dailyMintable, 'Prev Burn Hash is empty')
          const supplyOnAllChains = logExportReceipt.supplyOnAllChains
          assert.equal(supplyOnAllChains.length, 6, 'Supply On All Chains is wrong length')
          assert.equal(parseInt(supplyOnAllChains[0].toString(), 10), totalSupplyAfter.toNumber(), 'First chain is not non-zero')
          assert.equal(supplyOnAllChains[1].toString(), '0', 'First chain is not non-zero')
          assert.equal(supplyOnAllChains[2].toString(), '0', 'First chain is not zero')
          assert.equal(supplyOnAllChains[3].toString(), '0', 'First chain is not zero')
          assert.equal(supplyOnAllChains[4].toString(), '0', 'First chain is not zero')
          assert.equal(supplyOnAllChains[5].toString(), '0', 'First chain is not zero')

          assert.isAbove(logExportReceipt.genesisTime.toNumber(), 0, 'genesisTime is wrong')

          // reconcile balances
          var mtTokenBalanceAfter = await metToken.balanceOf(buyer)
          assert.equal(totalSupplyBefore.sub(totalSupplyAfter).toNumber(), amountToBurn, 'After export, total supply is not correct')
          assert.equal(mtTokenBalanceBefore.sub(mtTokenBalanceAfter).toNumber(), amountToBurn, 'After export, metTokenBalance is not correct')
          assert.equal(mtTokenBalanceAfter.toNumber(), 0, 'metTokenBalance after export should be zero')
        }

        const count = await tokenPorter.claimReceivables.call(claims.map(c => c.address), {from: destMET})
        assert.equal(count.toNumber(), claims.length, 'Not all claims were processed')

        const tx = await tokenPorter.claimReceivables(claims.map(c => c.address), {from: destMET})
        assert.equal(tx.logs.length, claims.length, 'Not all claim logs were emitted')

        for (let i = 0; i < claims.length; i++) {
          const claim = claims[i]
          const log = tx.logs[i]
          assert.equal(log.args.destinationMetronomeAddr, destMET, 'Destination MET address does not match')
          assert.equal(log.args.destinationRecipientAddr, claim.address, 'Recipient address does not match')
          assert.equal(log.args.amount.toNumber(), claim.amount, 'Burned amount is not correct')

          const claimableAfter = await tokenPorter.claimables(destMET, claim.address)
          assert.equal(claimableAfter.toNumber(), 0, 'Claimable was not set to zero')
        }

        resolve()
      })
    })
  })
})
