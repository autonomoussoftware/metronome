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
const Metronome = require('../test/shared/inits')

contract('Proceeds', accounts => {
  describe('Constructor and Owner only functions', () => {
    it('Should initialize proceeds correctly', () => {
      return new Promise(async (resolve, reject) => {
        const time = new Date().getTime() / 1000
        const {auctions, proceeds, autonomousConverter} = await Metronome.initContracts(accounts, time, 0, 0, 1)
        assert.equal(await proceeds.autonomousConverter(), autonomousConverter.address, 'autonomousConverter is not setup correctly')
        assert.equal(await proceeds.auction(), auctions.address, 'Auctions is not set up correctly')

        resolve()
      })
    })

    it('Should verify that only Auctions can send fund to Proceeds', () => {
      return new Promise(async (resolve, reject) => {
        const amount = 1e18
        const auctionsMock = accounts[1]
        const proceedsBalanceBefore = await metToken.balanceOf(proceeds.address)
        await proceeds.handleFund({from: auctionsMock, value: amount})
        const proceedsBalanceAfter = await metToken.balanceOf(autonomousConverter.address)

        assert(proceedsBalanceAfter.sub(proceedsBalanceBefore).valueOf(), amount, 'Auctions to Proceeds fund transfer failed')

        let thrown = false
        try {
          await proceeds.handleFund({from: accounts[2], value: 1e18})
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'Proceeds should throw error')
        resolve()
      })
    })
  })
})
