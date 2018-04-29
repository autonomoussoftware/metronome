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
const BigNumber = require('bignumber.js')

function exchange (S, E, R, R2) {
  S = new BigNumber(S)
  E = new BigNumber(E)
  R = new BigNumber(R)
  R2 = new BigNumber(R2)
  S = S.dividedBy(1e18)
  E = E.dividedBy(1e18)
  R = R.dividedBy(1e18)
  R2 = R2.dividedBy(1e18)
  let one = new BigNumber(1)
  let temp = new BigNumber(0)
  temp = E.dividedBy(R)
  temp = temp.plus(one)
  let T = new BigNumber(0)
  temp = temp.squareRoot()
  temp = temp.minus(one)
  T = temp.multipliedBy(S)
  S = S.plus(T)
  temp = T.dividedBy(S)
  temp = one.minus(temp)
  temp = temp.multipliedBy(temp)
  temp = one.minus(temp)
  E = R2.multipliedBy(temp)
  E = E.multipliedBy(1e18)
  return E
}

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

  let metToken, smartToken, proceeds, autonomousConverter, auctions

  // Create contracts and initilize them for each test case
  beforeEach(async () => {
    proceeds = await Proceeds.new()
    autonomousConverter = await AutonomousConverter.new()
    auctions = await Auctions.new()

    metToken = await METToken.new(autonomousConverter.address, auctions.address, INITIAL_SUPPLY, DECMULT, {from: OWNER})
    smartToken = await SmartToken.new(autonomousConverter.address, autonomousConverter.address, SMART_INITIAL_SUPPLY, {from: OWNER})
    await autonomousConverter.init(metToken.address, smartToken.address, auctions.address,
      {
        from: OWNER,
        value: web3.toWei(1, 'ether')
      })
    await proceeds.initProceeds(autonomousConverter.address, auctions.address, {from: OWNER})
    const founders = []
    // Since we are appending it with hexadecimal address so amount should also be
    // in hexa decimal. Hence 999999e18 = 0000d3c20dee1639f99c0000 in 24 character ( 96 bits)
    // 1000000e18 =  0000d3c20dee1639f99c0000
    founders.push(OWNER + '0000D3C214DE7193CD4E0000')
    founders.push(accounts[1] + '0000D3C214DE7193CD4E0000')
    await auctions.mintInitialSupply(founders, metToken.address, proceeds.address, autonomousConverter.address, {from: OWNER})
    await auctions.initAuctions(START_TIME, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE, {from: OWNER})
    await metToken.enableMETTransfers()
  })
  it('Should verify that AutonomousConverter is initialized correctly', () => {
    return new Promise(async (resolve, reject) => {
      assert.equal(await autonomousConverter.reserveToken(), metToken.address, 'METToken address isn\'t correct')
      assert.equal(await autonomousConverter.smartToken(), smartToken.address, 'SmartToken address isn\'t correct')

      resolve()
    })
  })

  it('Should verify that only Proceeds can send fund to AC', () => {
    return new Promise(async (resolve, reject) => {
      proceeds = await Proceeds.new()
      autonomousConverter = await AutonomousConverter.new()
      auctions = await Auctions.new()
      metToken = await METToken.new(autonomousConverter.address, auctions.address, INITIAL_SUPPLY, DECMULT, {from: OWNER})
      await autonomousConverter.init(metToken.address, smartToken.address, auctions.address, { from: OWNER, value: web3.toWei(1, 'ether') })
      const founders = []
      founders.push(OWNER + '0000D3C214DE7193CD4E0000')
      founders.push(accounts[1] + '0000D3C214DE7193CD4E0000')
      const proceedsMock = accounts[3]
      await auctions.mintInitialSupply(founders, metToken.address, proceedsMock, autonomousConverter.address, {from: OWNER})

      const amount = 1e18
      const acBalanceBefore = await metToken.balanceOf(autonomousConverter.address)
      await autonomousConverter.handleFund({from: proceedsMock, value: amount})
      const acBalanceAfter = await metToken.balanceOf(autonomousConverter.address)

      assert(acBalanceAfter.sub(acBalanceBefore).valueOf(), amount, 'Proceeds to AC fund transfer failed')

      let thrown = false
      try {
        await autonomousConverter.handleFund({from: accounts[2], value: 1e18})
      } catch (error) {
        thrown = true
      }
      assert.isTrue(thrown, 'AC should throw error')
      resolve()
    })
  })

  it('Should return correct balance of Eth and Met token', () => {
    return new Promise(async (resolve, reject) => {
      // 1 MET is added during initilization of Auctions
      const metBalance = (INITIAL_SUPPLY) * DECMULT

      var balance = await autonomousConverter.getEthBalance()
      assert.equal(web3.fromWei(balance), 1, 'ETH balance should be equal to 1')

      balance = await autonomousConverter.getMetBalance()
      assert.equal(balance, metBalance + 1e18, 'MET balance should be equal to INITIAL_SUPPLY+1')

      resolve()
    })
  })

  it('Should buy MET from ETH', () => {
    return new Promise(async (resolve, reject) => {
      const WEI_SENT = 10e18
      const MIN_MET_RETURN = 1

      const prediction = await autonomousConverter.getMetForEthResult(WEI_SENT, { from: OWNER })
      assert(prediction.toNumber() > 0, 'ETH to MET prediction is not greater than zero')
      const reserveSupply = await autonomousConverter.getMetBalance({ from: OWNER })
      assert(prediction.toNumber() <= reserveSupply.toNumber(), 'Prediction is larger than reserve supply')

      const ethBalanceOfACBefore = await web3.eth.getBalance(autonomousConverter.address)
      const metBalanceOfACBefore = await metToken.balanceOf(autonomousConverter.address)
      const mtTokenBalanceOfOwnerBefore = await metToken.balanceOf(OWNER)
      const txChange = await autonomousConverter.convertEthToMet(MIN_MET_RETURN, {from: OWNER, value: WEI_SENT})
      assert(txChange, 'ETH to MET transaction failed')
      let log = txChange.logs[0]

      const ethBalanceOfACAfter = await web3.eth.getBalance(autonomousConverter.address)
      const metBalanceOfACAfter = await metToken.balanceOf(autonomousConverter.address)
      let S = await smartToken.totalSupply()
      let R = ethBalanceOfACAfter
      let E = WEI_SENT
      let expectedMet = exchange(S, E, R, metBalanceOfACBefore)
      // Due to rounding effect , there is delta around 0-1000 wei
      assert.closeTo(log.args.met.toNumber(), expectedMet.toNumber(), 1000)
      const mtTokenBalanceOfOwnerAfter = await metToken.balanceOf(OWNER)
      const smartTokenAfterBalance = await smartToken.balanceOf(OWNER, { from: autonomousConverter.address })

      assert.equal(mtTokenBalanceOfOwnerAfter.toNumber() - mtTokenBalanceOfOwnerBefore.toNumber(), prediction.toNumber(), 'Prediction and actual is not correct for owner')
      assert.equal(metBalanceOfACBefore.toNumber() - metBalanceOfACAfter.toNumber(), prediction.toNumber(), 'Prediction and actual is not correct for AC')
      assert.equal(smartTokenAfterBalance.toNumber(), 0, 'Smart Tokens were not destroyed')
      assert(mtTokenBalanceOfOwnerAfter.toNumber(), metBalanceOfACBefore.toNumber() - metBalanceOfACAfter.toNumber(), 'MET  not recieved after ETH exchange')
      assert(ethBalanceOfACAfter.toNumber() > ethBalanceOfACBefore.toNumber(), 'ETH  not recieved after ETH exchange')

      resolve()
    })
  })

  it('Should buy ETH from MET ', () => {
    return new Promise(async (resolve, reject) => {
      const weiSent = 10e18
      const MIN_ETH_RETURN = 1

      const txChange = await autonomousConverter.convertEthToMet(1, {from: OWNER, value: weiSent})
      assert(txChange, 'ETH to MET transaction failed')

      const ethBalanceOfACBefore = await web3.eth.getBalance(autonomousConverter.address)
      const ethBalanceOfOwnerBefore = await web3.eth.getBalance(OWNER)
      const metBalanceOfOwnerBefore = await metToken.balanceOf(OWNER)
      const metBalanceOfACBefore = await metToken.balanceOf(autonomousConverter.address)

      const prediction = await autonomousConverter.getEthForMetResult(metBalanceOfOwnerBefore, { from: OWNER })
      assert(prediction.toNumber() >= MIN_ETH_RETURN, 'ETH to MET prediction is not greater than zero')

      const txApprove = await metToken.approve(autonomousConverter.address, metBalanceOfOwnerBefore.valueOf(), { from: OWNER })
      let gasCost = txApprove.receipt.gasUsed * web3.eth.gasPrice
      assert(txApprove, 'Transfer Approve failed')

      const txRedeem = await autonomousConverter.convertMetToEth(metBalanceOfOwnerBefore.valueOf(), MIN_ETH_RETURN, { from: OWNER })
      gasCost += txRedeem.receipt.gasUsed * web3.eth.gasPrice
      assert(txRedeem, 'MET to ETH transaction failed')
      const ethBalanceOfACAfter = await web3.eth.getBalance(autonomousConverter.address)
      const ethBalanceOfOwnerAfter = await web3.eth.getBalance(OWNER)
      const metBalanceOfACAfter = await metToken.balanceOf(autonomousConverter.address)
      const mtTokenBalanceOfOwnerAfter = await metToken.balanceOf(OWNER)
      const smartTokenAfterBalance = await smartToken.balanceOf(OWNER, { from: autonomousConverter.address })
      let log = txRedeem.logs[0]
      let S = await smartToken.totalSupply()
      let R = metBalanceOfACBefore.add(metBalanceOfOwnerBefore)
      let E = metBalanceOfOwnerBefore
      let expectedEth = exchange(S, E, R, ethBalanceOfACBefore)
      // Due to rounding effect , there may be delta around 0-1000 wei
      assert.closeTo(log.args.eth.toNumber(), expectedEth.toNumber(), 1000)
      assert.closeTo(ethBalanceOfOwnerAfter.add(gasCost).sub(ethBalanceOfOwnerBefore).toNumber(), prediction.toNumber(), 0.014e18, 'Prediction and actual is not correct for owner')
      assert.equal(ethBalanceOfACBefore.sub(ethBalanceOfACAfter).toNumber(), prediction.toNumber(), 'Prediction and actual is not correct for AC')
      assert.equal(smartTokenAfterBalance.toNumber(), 0, 'Smart Tokens were not destroyed')
      assert.equal(metBalanceOfACAfter.toNumber(), metBalanceOfACBefore.toNumber() + metBalanceOfOwnerBefore.toNumber(), 'MET not recieved after MET exchange')
      assert.equal(mtTokenBalanceOfOwnerAfter.toNumber(), 0, 'MET token not sent after MET exchange')
      assert(ethBalanceOfACAfter.toNumber() < ethBalanceOfACBefore.toNumber(), 'ETH not sent from AC  after MET exchange')
      assert(ethBalanceOfOwnerBefore.toNumber() < ethBalanceOfOwnerAfter.toNumber(), 'ETH not recieved after MET exchange')

      resolve()
    })
  })
})
