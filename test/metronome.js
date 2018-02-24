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
const MTNToken = artifacts.require('MTNToken')
const SmartToken = artifacts.require('SmartToken')
const Proceeds = artifacts.require('Proceeds')
const AutonomousConverter = artifacts.require('AutonomousConverter')
const Auctions = artifacts.require('Auctions')

contract('AutonomousConverter', accounts => {
  const OWNER = accounts[0]
  const INITIAL_SUPPLY = 1000
  const SMART_INITIAL_SUPPLY = 1000
  const DECMULT = 10 ** 18
  let timeInSeconds = new Date().getTime() / 1000
  const START_TIME = (Math.floor(timeInSeconds / 60) * 60) - (7 * 24 * 60 * 60) - 120
  const MINIMUM_PRICE = 1000
  const STARTING_PRICE = 0.5
  const TIME_SCALE = 1

  let mtnToken, smartToken, proceeds, autonomousConverter, auctions

  // Create contracts and initilize them for each test case
  beforeEach(async () => {
    proceeds = await Proceeds.new()
    autonomousConverter = await AutonomousConverter.new()
    auctions = await Auctions.new()

    mtnToken = await MTNToken.new(autonomousConverter.address, auctions.address, INITIAL_SUPPLY, DECMULT, {from: OWNER})
    smartToken = await SmartToken.new(autonomousConverter.address, autonomousConverter.address, SMART_INITIAL_SUPPLY, {from: OWNER})
    await autonomousConverter.init(mtnToken.address, smartToken.address, proceeds.address, auctions.address,
      {
        from: OWNER,
        value: web3.toWei(1, 'ether')
      })
    await proceeds.initProceeds(autonomousConverter.address, auctions.address, {from: OWNER})
    const founders = []
    // Since we are appending it with hexadecimal address so amount should also be
    // in hexa decimal. Hence 999999e18 = 0000d3c20dee1639f99c0000 in 24 character ( 96 bits)
    // 1000000e18 =  0000d3c20dee1639f99c0000
    founders.push(OWNER + '0000d3c20dee1639f99c0000')
    founders.push(accounts[1] + '000069e10de76676d0000000')
    const EXT_FOUNDER = accounts[6]
    await auctions.mintInitialSupply(founders, EXT_FOUNDER, mtnToken.address, proceeds.address, {from: OWNER})
    await auctions.initAuctions(START_TIME, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE, {from: OWNER})
  })
  it('Should verify that AutonomousConverter is initialized correctly', () => {
    return new Promise(async (resolve, reject) => {
      assert.equal(await autonomousConverter.reserveToken(), mtnToken.address, 'MTNToken address isn\'t correct')
      assert.equal(await autonomousConverter.smartToken(), smartToken.address, 'SmartToken address isn\'t correct')

      resolve()
    })
  })

  it('Should return correct balance of Eth and Mtn token', () => {
    return new Promise(async (resolve, reject) => {
      // 1 MTN is added during initilization of Auctions
      const mtnBalance = (INITIAL_SUPPLY) * DECMULT

      var balance = await autonomousConverter.getEthBalance()
      assert.equal(web3.fromWei(balance), 1, 'ETH balance should be equal to 1')

      balance = await autonomousConverter.getMtnBalance()
      assert.equal(balance, mtnBalance + 1e18, 'MTN balance should be equal to INITIAL_SUPPLY+1')

      resolve()
    })
  })

  it('Should buy MTN from ETH', () => {
    return new Promise(async (resolve, reject) => {
      const WEI_SENT = 10e18
      const MIN_MTN_RETURN = 1

      const prediction = await autonomousConverter.getMtnForEthResult(WEI_SENT, { from: OWNER })
      assert(prediction.toNumber() > 0, 'ETH to MTN prediction is not greater than zero')
      const reserveSupply = await autonomousConverter.getMtnBalance({ from: OWNER })
      assert(prediction.toNumber() <= reserveSupply.toNumber(), 'Prediction is larger than reserve supply')

      const ethBalanceOfACBefore = await web3.eth.getBalance(autonomousConverter.address)
      const mtnBalanceOfACBefore = await mtnToken.balanceOf(autonomousConverter.address)
      const txChange = await autonomousConverter.convertEthToMtn(MIN_MTN_RETURN, {from: OWNER, value: WEI_SENT})
      assert(txChange, 'ETH to MTN transaction failed')

      const ethBalanceOfACAfter = await web3.eth.getBalance(autonomousConverter.address)
      const mtnBalanceOfACAfter = await mtnToken.balanceOf(autonomousConverter.address)
      const mtTokenBalanceOfOwnerAfter = await mtnToken.balanceOf(OWNER)
      const smartTokenAfterBalance = await smartToken.balanceOf(OWNER, { from: autonomousConverter.address })

      assert.equal(mtTokenBalanceOfOwnerAfter.valueOf(), prediction.valueOf(), 'Prediction and actual is not correct')
      assert.equal(smartTokenAfterBalance.toNumber(), 0, 'Smart Tokens were not destroyed')
      assert(mtTokenBalanceOfOwnerAfter.toNumber(), mtnBalanceOfACBefore.toNumber() - mtnBalanceOfACAfter.toNumber(), 'MTN  not recieved after ETH exchange')
      assert(ethBalanceOfACAfter.toNumber() > ethBalanceOfACBefore.toNumber(), 'ETH  not recieved after ETH exchange')

      resolve()
    })
  })

  it('Should buy ETH from MTN ', () => {
    return new Promise(async (resolve, reject) => {
      const weiSent = 10e18
      const MIN_ETH_RETURN = 1

      const txChange = await autonomousConverter.convertEthToMtn(1, {from: OWNER, value: weiSent})
      assert(txChange, 'ETH to MTN transaction failed')

      const ethBalanceOfACBefore = await web3.eth.getBalance(autonomousConverter.address)
      const ethBalanceOfOwnerBefore = await web3.eth.getBalance(OWNER)
      const mtnBalanceOfOwnerBefore = await mtnToken.balanceOf(OWNER)
      const mtnBalanceOfACBefore = await mtnToken.balanceOf(autonomousConverter.address)

      const prediction = await autonomousConverter.getEthForMtnResult(mtnBalanceOfOwnerBefore, { from: OWNER })
      assert(prediction.toNumber() >= MIN_ETH_RETURN, 'ETH to MTN prediction is not greater than zero')

      const txApprove = await mtnToken.approve(autonomousConverter.address, mtnBalanceOfOwnerBefore.valueOf(), { from: OWNER })
      assert(txApprove, 'Transfer Approve failed')
      const txRedeem = await autonomousConverter.convertMtnToEth(mtnBalanceOfOwnerBefore.valueOf(), MIN_ETH_RETURN, { from: OWNER })
      assert(txRedeem, 'MTN to ETH transaction failed')
      const ethBalanceOfACAfter = await web3.eth.getBalance(autonomousConverter.address)
      const ethBalanceOfOwnerAfter = await web3.eth.getBalance(OWNER)
      const mtnBalanceOfACAfter = await mtnToken.balanceOf(autonomousConverter.address)
      const mtTokenBalanceOfOwnerAfter = await mtnToken.balanceOf(OWNER)
      const smartTokenAfterBalance = await smartToken.balanceOf(OWNER, { from: autonomousConverter.address })

      assert.equal(ethBalanceOfACBefore.sub(ethBalanceOfACAfter).toNumber(), prediction.toNumber(), 'Prediction and actual is not correct')
      assert.equal(smartTokenAfterBalance.toNumber(), 0, 'Smart Tokens were not destroyed')
      assert.equal(mtnBalanceOfACAfter.toNumber(), mtnBalanceOfACBefore.toNumber() + mtnBalanceOfOwnerBefore.toNumber(), 'MTN not recieved after MTN exchange')
      assert.equal(mtTokenBalanceOfOwnerAfter.toNumber(), 0, 'MTN token not sent after MTN exchange')
      assert(ethBalanceOfACAfter.toNumber() < ethBalanceOfACBefore.toNumber(), 'ETH not sent from AC  after MTN exchange')
      assert(ethBalanceOfOwnerBefore.toNumber() < ethBalanceOfOwnerAfter.toNumber(), 'ETH not recieved after MTN exchange')

      resolve()
    })
  })
})
