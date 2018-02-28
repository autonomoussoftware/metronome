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

const MockERC = artifacts.require('MockFixedSupplyToken')
const assert = require('chai').assert
const ethjsABI = require('ethjs-abi')
const MetronomeInit = require('./inits')

const Tests = {
  tests: (accounts, contractNameToTest) => {
    const OWNER = accounts[0]
    const FOUNDER = accounts[1]
    const ALICE = accounts[2]
    const EXT_FOUNDER = accounts[6]

    const amount = 1e18
    const initialSupply = 100e18
    let airdrop, testContract

    beforeEach(async () => {
      const contracts = await MetronomeInit.initContracts(OWNER, FOUNDER, EXT_FOUNDER, ALICE)
      testContract = contracts[contractNameToTest]

      // simulate an airdrop into AC contract
      airdrop = await MockERC.new({from: OWNER})
      const ownerBalance = await airdrop.balanceOf(OWNER)
      assert.equal(ownerBalance.toNumber(), initialSupply, 'Intial supply for airdrop is wrong')
      await airdrop.transfer(testContract.address, amount, {from: OWNER})
      const acBalance = await airdrop.balanceOf(testContract.address)
      assert.equal(acBalance.toNumber(), amount, 'Airdrop was not successful')
    })

    it('only ' + contractNameToTest + ' owner can claim tokens', () => {
      return new Promise(async (resolve, reject) => {
        let thrown = false
        try {
          await testContract.claimTokens(airdrop.address, amount, {from: ALICE})
        } catch (error) {
          thrown = true
        }
        assert.isTrue(thrown, 'claimTokens did not throw')

        resolve()
      })
    })

    it(contractNameToTest + ' can claim tokens from airdrop', () => {
      return new Promise(async (resolve, reject) => {
        const beforeBalances = {
          ac: await airdrop.balanceOf(testContract.address),
          owner: await airdrop.balanceOf(OWNER)
        }

        const tx = await testContract.claimTokens(airdrop.address, amount, {from: OWNER})

        // validate transfer event
        assert.equal(tx.receipt.logs.length, 1, 'Incorrect number of logs')
        const decoder = ethjsABI.logDecoder(airdrop.abi)
        const logs = decoder(tx.receipt.logs)
        const log = logs[0]
        assert.equal(log._eventName, 'Transfer', 'Transfer event was not emitted')
        assert.equal(log._from, testContract.address, 'From is wrong')
        assert.equal(log._to, OWNER, 'To is wrong')
        assert.equal(parseInt(log._value.toString(), 10), amount, 'Amount is wrong')

        // validate balances
        const afterBalances = {
          ac: await airdrop.balanceOf(testContract.address),
          owner: await airdrop.balanceOf(OWNER)
        }
        assert.equal(beforeBalances.ac.toNumber() - afterBalances.ac.toNumber(), amount, 'AC balance is wrong')
        assert.equal(afterBalances.owner.toNumber() - beforeBalances.owner.valueOf(), amount, 'Owner balance is wrong')

        resolve()
      })
    })
  }
}

module.exports = Tests
