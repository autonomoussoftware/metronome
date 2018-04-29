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

const AutonomousConverter = artifacts.require('AutonomousConverter')
// const Auctions = artifacts.require('Auctions')
const METToken = artifacts.require('METToken')
const Proceeds = artifacts.require('Proceeds')
const SmartToken = artifacts.require('SmartToken')
const Auctions = artifacts.require('Auctions')

contract('Proceeds', accounts => {
  let metToken, autonomousConverter, auctions, proceeds, smartToken
  const OWNER = accounts[0]

  describe('Constructor and Owner only functions', () => {
    beforeEach(async () => {
      autonomousConverter = await AutonomousConverter.new()
      proceeds = await Proceeds.new()
      auctions = await Auctions.new()

      metToken = await METToken.new(autonomousConverter.address, auctions.address, 0, 0, {from: OWNER})
      smartToken = await SmartToken.new(autonomousConverter.address, autonomousConverter.address, 0, {from: OWNER})

      await autonomousConverter.init(metToken.address, smartToken.address, auctions.address, {from: OWNER})
      // we just need one address as auction to perform fund transfer and closeAuction
      // using contract's address make it difficult as we cannot invoke function on behalf of contract
      await proceeds.initProceeds(autonomousConverter.address, accounts[1], {from: OWNER})
    })

    it('Should initialize proceeds correctly', () => {
      return new Promise(async (resolve, reject) => {
        assert.equal(await proceeds.autonomousConverter(), autonomousConverter.address, 'autonomousConverter is not setup correctly')
        assert.equal(await proceeds.auction(), accounts[1], 'Auctions is not set up correctly')

        resolve()
      })
    })

    it('Should verify that only Auctions can send fund to Proceeds', () => {
      return new Promise(async (resolve, reject) => {
        const amount = 1e18
        const auctionsMock = accounts[1]
        const proceedsBalanceBefore = await metToken.balanceOf(proceeds.address)
        await proceeds.sendTransaction({from: auctionsMock, value: amount})
        const proceedsBalanceAfter = await metToken.balanceOf(autonomousConverter.address)

        assert(proceedsBalanceAfter.sub(proceedsBalanceBefore).valueOf(), amount, 'Auctions to Proceeds fund transfer failed')

        let thrown = false
        try {
          await proceeds.sendTransaction({from: accounts[2], value: 1e18})
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'Proceeds should throw error')
        resolve()
      })
    })
  })
})
