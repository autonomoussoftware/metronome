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
const BlockTime = require('../test/shared/time')
const exportUtil = require('../test/shared/utils')

contract('ETC - AutonomousConverter', accounts => {
  const SECS_IN_DAY = 86400
  const SECS_IN_MINUTE = 60

  const MINIMUM_PRICE = 1000
  const STARTING_PRICE = 1
  const TIME_SCALE = 1

  var ethContracts, etcContracts

  const OWNER = accounts[0]

  before(async () => {
    ethContracts = await Metronome.initContracts(accounts, BlockTime.getCurrentBlockTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
    let initialAuctionEndTime = await ethContracts.auctions.initialAuctionEndTime()
    etcContracts = await Metronome.initNonOGContracts(accounts, BlockTime.getCurrentBlockTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE, initialAuctionEndTime)
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

  it('should verify proceed forward to AC after 1st auction on ETC chain', () => {
    return new Promise(async (resolve, reject) => {
      const exporter = accounts[6]
      const user = accounts[9]

      // Time travel to just a minute before auction end and buy all MET
      await BlockTime.timeTravel(8 * SECS_IN_DAY - SECS_IN_MINUTE)
      await BlockTime.mineBlock()

      // Purchase MET on ETH chain for export
      await ethContracts.auctions.sendTransaction({from: exporter, value: 1e18})

      // Export 1 MET to AC on ETC chain
      await exportUtil.importExport('ETH', ethContracts, etcContracts, 1e18, 1e18,
        exporter, etcContracts.autonomousConverter.address, accounts[0], accounts[1])

      // EXport some MET to an account on ETC chain
      await exportUtil.importExport('ETH', ethContracts, etcContracts, 997e18, 1e18,
        exporter, accounts[8], accounts[0], accounts[1])

      // Time travel to 1 day from first import(active ETC), which is first auction on ETC
      await BlockTime.timeTravel(1 * SECS_IN_DAY)
      await BlockTime.mineBlock()

      // Purchase all MET in auction on ETC chain
      await etcContracts.auctions.sendTransaction({from: user, value: 1e18})
      const mintable = await etcContracts.auctions.mintable()
      assert.equal(mintable, 0, 'Mintable should be zero')

      // Time travel another day, At this auction restart, our first proceed will be forwarded to AC
      await BlockTime.timeTravel(1 * SECS_IN_DAY)
      await BlockTime.mineBlock()
      // Purchase MET to trigger auction restart and proceed forward
      await etcContracts.auctions.sendTransaction({from: user, value: 1e18})

      // we expect ether balance of AC more than 1, as we send 1 ether at the time of deploy
      const balanceAC = web3.eth.getBalance(etcContracts.autonomousConverter.address)
      assert.isAbove(balanceAC.toNumber(), 1, 'Ether balance of AC on ETC chain should be higher than 1 ether')

      resolve()
    })
  })

  // This test assume that ETC chian is initialized already, which is happening in test 1
  it('Should verify sell MET transaction in AC', () => {
    return new Promise(async (resolve, reject) => {
      // This is one time operation that needs to be done, once chain is active
      await etcContracts.metToken.enableMETTransfers({from: OWNER})

      const user = accounts[9]
      let metBalance = await etcContracts.metToken.balanceOf(user)
      // approve AC to spend user's MET, this is required for selling MET to AC
      await etcContracts.metToken.approve(etcContracts.autonomousConverter.address, metBalance, {from: user})

      const etherBalanceACBefore = web3.eth.getBalance(etcContracts.autonomousConverter.address)
      // convert MET to ether via AC
      await etcContracts.autonomousConverter.convertMetToEth(metBalance, 1, {from: user})

      // User MET balance is expeted to be zero
      metBalance = await etcContracts.metToken.balanceOf(user)
      assert.equal(metBalance.valueOf(), 0, 'MET balance of user should be zero, after selling all MET to AC')

      // Ether balance of AC should lower down due to purchase of MET from user
      const etherBalanceACAfter = web3.eth.getBalance(etcContracts.autonomousConverter.address)
      assert.isBelow(etherBalanceACAfter.toNumber(), etherBalanceACBefore.toNumber(), 'Ether balance of AC should be less after buying MET')

      resolve()
    })
  })

  // This test assume that ETC chian is initialized already, which is happening in test 1
  it('Should verify buy MET transaction in AC', () => {
    return new Promise(async (resolve, reject) => {
      const user = accounts[3]
      let metBalance = await etcContracts.metToken.balanceOf(user)
      // User MET balance is expeted to be zero
      assert.equal(metBalance, 0, 'MET balance of user should be zero')

      const etherBalanceACBefore = web3.eth.getBalance(etcContracts.autonomousConverter.address)
      // convert MET to ether via AC
      await etcContracts.autonomousConverter.convertEthToMet(1, {from: user, value: 5e17}) // half ether

      // User MET balance is expeted to be non-zero
      metBalance = await etcContracts.metToken.balanceOf(user)
      assert.isAbove(metBalance.toNumber(), 0, 'MET balance of user should not be zero, after buying MET from AC')

      // Ether balance of AC should lower down due to purchase of MET from user
      const etherBalanceACAfter = web3.eth.getBalance(etcContracts.autonomousConverter.address)
      assert.isAbove(etherBalanceACAfter.toNumber(), etherBalanceACBefore.toNumber(), 'Ether balance of AC should be higher after selling MET')

      resolve()
    })
  })
})
