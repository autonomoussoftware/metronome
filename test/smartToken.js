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

const assert = require('assert')
const SmartToken = artifacts.require('SmartToken')
const MockContractReceiver = artifacts.require('MockContractReceiver')

contract('SmartToken', accounts => {
  const actors = {
    owner: accounts[0],
    alice: accounts[1],
    bob: accounts[2],
    charlie: accounts[4],
    minter: accounts[3],
    autonomousConverter: accounts[4]
  }

  const contracts = {
    smartToken: null,
    receiverMock: null
  }

  const decMult = 10 ** 18
  const mintAmount = 500 * decMult
  const initialSupply = 1000

  beforeEach(async () => {
    contracts.smartToken = await SmartToken.new()
    contracts.receiverMock = await MockContractReceiver.new({ from: actors.owner })
    await contracts.smartToken.initSmartToken(actors.autonomousConverter, actors.minter, initialSupply, { from: actors.owner })

    await contracts.smartToken.mint(actors.alice, mintAmount, { from: actors.minter })
    await contracts.smartToken.mint(actors.autonomousConverter, mintAmount, { from: actors.minter })
  })

  describe('Balance and Total Supply', () => {
    it('any one can get balances and total supply', () => {
      return new Promise(async (resolve, reject) => {
        const aliceBalance = await contracts.smartToken.balanceOf(actors.alice, { from: actors.bob })
        assert.equal(aliceBalance.toNumber(), mintAmount, 'Alice balance is incorrect')

        const totalSupply = await contracts.smartToken.totalSupply({ from: actors.owner })
        assert.equal(totalSupply.toNumber(), initialSupply * decMult * 2, 'Total Supply is incorrect')
        resolve()
      })
    })

    it('AutonomousConverter can get balances and total supply', () => {
      return new Promise(async (resolve, reject) => {
        const aliceBalance = await contracts.smartToken.balanceOf(actors.alice, { from: actors.autonomousConverter })
        assert.equal(aliceBalance.toNumber(), mintAmount, 'Alice balance is incorrect')

        const totalSupply = await contracts.smartToken.totalSupply({ from: actors.autonomousConverter })
        assert.equal(totalSupply.toNumber(), initialSupply * decMult * 2, 'Total Supply is incorrect')
        resolve()
      })
    })
  })
})
