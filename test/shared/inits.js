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

const AutonomousConverter = artifacts.require('AutonomousConverter')
const Auctions = artifacts.require('Auctions')
const METToken = artifacts.require('METToken')
const Proceeds = artifacts.require('Proceeds')
const SmartToken = artifacts.require('SmartToken')
const TokenPorter = artifacts.require('TokenPorter')
const Validator = artifacts.require('Validator')

const Metronome = {
  initContracts: (accounts, START_TIME, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE) => {
    return new Promise(async (resolve, reject) => {
      const OWNER = accounts[0]
      const FOUNDER = accounts[1]

      const autonomousConverter = await AutonomousConverter.new({from: OWNER})
      const auctions = await Auctions.new({from: OWNER})
      const proceeds = await Proceeds.new({from: OWNER})
      const metToken = await METToken.new({from: OWNER})
      const smartToken = await SmartToken.new({from: OWNER})
      const tokenPorter = await TokenPorter.new({from: OWNER})
      const validator = await Validator.new({from: OWNER})
      const founders = []
      founders.push(OWNER + '0000D3C21BCECCEDA1000000') // 1000000e18
      founders.push(FOUNDER + '0000D3C20DEE1639F99C0000') // 999999e18

      const MET_INITIAL_SUPPLY = 0
      const ST_INITIAL_SUPPLY = 2
      const DECMULT = 10 ** 18

      await metToken.initMETToken(autonomousConverter.address, auctions.address, MET_INITIAL_SUPPLY, DECMULT, {from: OWNER})
      await metToken.setTokenPorter(tokenPorter.address, {from: OWNER})

      await smartToken.initSmartToken(autonomousConverter.address, autonomousConverter.address, ST_INITIAL_SUPPLY, {from: OWNER})

      await autonomousConverter.init(metToken.address, smartToken.address, auctions.address, { from: OWNER, value: web3.toWei(1, 'ether') })
      await proceeds.initProceeds(autonomousConverter.address, auctions.address, {from: OWNER})
      await auctions.createTokenLocker(OWNER, metToken.address, {from: OWNER})
      await auctions.createTokenLocker(FOUNDER, metToken.address, {from: OWNER})
      await auctions.mintInitialSupply(founders, metToken.address, proceeds.address, autonomousConverter.address, {from: OWNER})
      await auctions.initAuctions(START_TIME, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE, {from: OWNER})

      await tokenPorter.initTokenPorter(metToken.address, auctions.address, {from: OWNER})
      await tokenPorter.setValidator(validator.address, {from: OWNER})
      await validator.initValidator(metToken.address, auctions.address, tokenPorter.address, {from: OWNER})
      await validator.addValidator(OWNER, {from: OWNER})
      await validator.addValidator(accounts[1], {from: OWNER})
      await validator.addValidator(accounts[2], {from: OWNER})
      resolve({
        metToken: metToken,
        autonomousConverter: autonomousConverter,
        auctions: auctions,
        proceeds: proceeds,
        smartToken: smartToken,
        tokenPorter: tokenPorter,
        validator: validator,
        founders: founders
      })
    })
  },
  initNonOGContracts: (accounts, START_TIME, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE, INITIAL_AUCTION_END_TIME) => {
    return new Promise(async (resolve, reject) => {
      const OWNER = accounts[0]

      const autonomousConverter = await AutonomousConverter.new({from: OWNER})
      const auctions = await Auctions.new({from: OWNER})
      const proceeds = await Proceeds.new({from: OWNER})
      const metToken = await METToken.new({from: OWNER})
      const smartToken = await SmartToken.new({from: OWNER})
      const tokenPorter = await TokenPorter.new({from: OWNER})
      const validator = await Validator.new({from: OWNER})
      const MET_INITIAL_SUPPLY = 0
      const ST_INITIAL_SUPPLY = 2
      const DECMULT = 10 ** 18

      await metToken.initMETToken(autonomousConverter.address, auctions.address, MET_INITIAL_SUPPLY, DECMULT, {from: OWNER})
      await metToken.setTokenPorter(tokenPorter.address, {from: OWNER})

      await smartToken.initSmartToken(autonomousConverter.address, autonomousConverter.address, ST_INITIAL_SUPPLY, {from: OWNER})

      await autonomousConverter.init(metToken.address, smartToken.address, auctions.address, { from: OWNER, value: web3.toWei(1, 'ether') })
      await proceeds.initProceeds(autonomousConverter.address, auctions.address, {from: OWNER})
      await auctions.skipInitBecauseIAmNotOg(metToken.address, proceeds.address, START_TIME, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE, web3.fromAscii('ETC'), INITIAL_AUCTION_END_TIME, {from: OWNER})

      await tokenPorter.initTokenPorter(metToken.address, auctions.address, {from: OWNER})
      await tokenPorter.setValidator(validator.address, {from: OWNER})
      await validator.initValidator(metToken.address, auctions.address, tokenPorter.address, {from: OWNER})
      await validator.addValidator(OWNER, {from: OWNER})
      await validator.addValidator(accounts[1], {from: OWNER})
      await validator.addValidator(accounts[2], {from: OWNER})
      resolve({
        metToken: metToken,
        autonomousConverter: autonomousConverter,
        auctions: auctions,
        proceeds: proceeds,
        smartToken: smartToken,
        tokenPorter: tokenPorter,
        validator: validator
      })
    })
  }
}

module.exports = Metronome
