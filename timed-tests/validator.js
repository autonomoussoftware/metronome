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

contract('Validator', accounts => {
  const MINIMUM_PRICE = 1000
  const STARTING_PRICE = 1
  const TIME_SCALE = 1

  var ethContracts, etcContracts
  var data

  // Initialize contracts
  async function init () {
    ethContracts = await Metronome.initContracts(accounts, BlockTime.getCurrentBlockTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
    let initialAuctionEndTime = await ethContracts.auctions.initialAuctionEndTime()
    etcContracts = await Metronome.initNonOGContracts(accounts, BlockTime.getCurrentBlockTime(), MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE, initialAuctionEndTime)
    await Metronome.configureImportExport(accounts, ethContracts, etcContracts)
    await Metronome.activateETC(accounts, ethContracts, etcContracts)
  }

  // MET export and MET import request are required to happen before validator test begins
  function testSetup () {
    return new Promise(async (resolve, reject) => {
    // Purchase some MET
      await ethContracts.auctions.sendTransaction({from: accounts[3], value: 1e18})
      // Export 1000 MET
      let tx = await ethContracts.metToken.export(web3.fromAscii('ETC'), etcContracts.metToken.address,
        accounts[4], 1000e18, 1e18, web3.fromAscii('Extra data'), {from: accounts[3]})

      // Prepare data required for import
      const data = await exportUtil.prepareImportData(ethContracts, tx)

      // Request import
      await etcContracts.metToken.importMET(web3.fromAscii('ETH'), data.destinationChain, data.addresses,
        data.extraData, data.burnHashes, data.supplyOnAllChains, data.importData, data.root)
      resolve(data)
    })
  }

  before(async () => {
    await init()
    data = await testSetup()
  })

  it('should verity that atteshHash is working correctly', () => {
    return new Promise(async (resolve, reject) => {
      let totalSupplyInSourceChain = (await ethContracts.metToken.totalSupply()).toNumber()

      const offChainValidator1 = await etcContracts.validator.validators(0)

      // Perform attestation as off-chain validator 1
      await etcContracts.validator.attestHash(
        data.burnHashes[1], web3.fromAscii('ETH'), data.addresses[1], parseInt(data.importData[1]),
        parseInt(data.importData[2]), data.merkelProof, data.extraData, totalSupplyInSourceChain,
        { from: offChainValidator1 })

      let isAttested = await etcContracts.validator.hashAttestations(data.burnHashes[1], offChainValidator1)
      assert.isTrue(isAttested, 'Attestation outcome should be true')
      assert.isFalse(await etcContracts.validator.hashClaimed(data.burnHashes[1]), 'Hash should not be claimed at this point')

      var thrown = false
      try {
        await etcContracts.validator.attestHash(
          data.burnHashes[1], web3.fromAscii('ETH'), data.addresses[1], parseInt(data.importData[1]),
          parseInt(data.importData[2]), data.merkelProof, data.extraData, totalSupplyInSourceChain,
          { from: offChainValidator1 })
      } catch (e) {
        thrown = true
      }
      assert(thrown, 'Validator should not able to do attesttion more than once')
      thrown = false
      try {
        await etcContracts.validator.refuteHash(data.burnHashes[1], { from: offChainValidator1 })
      } catch (e) {
        thrown = true
      }
      assert(thrown, 'Validator should not able to do refutation if did attestation already')

      const offChainValidator2 = await etcContracts.validator.validators(1)

      // Perform attestation as off-chain validator 2
      await etcContracts.validator.attestHash(
        data.burnHashes[1], web3.fromAscii('ETH'), data.addresses[1], parseInt(data.importData[1]),
        parseInt(data.importData[2]), data.merkelProof, data.extraData, totalSupplyInSourceChain,
        { from: offChainValidator2 })

      isAttested = await etcContracts.validator.hashAttestations(data.burnHashes[1], offChainValidator2)
      assert.isTrue(isAttested, 'Attestation outcome should be true')
      // Minting is done as two postive votes are recieved
      assert.isTrue(await etcContracts.validator.hashClaimed(data.burnHashes[1]), 'HashClaimed should return true')

      resolve()
    })
  })

  it('should verity that refuteHash is working correctly', () => {
    return new Promise(async (resolve, reject) => {
      const offChainValidator = await etcContracts.validator.validators(2)
      // Perform refutation as off-chain validator 3
      await etcContracts.validator.refuteHash(data.burnHashes[1], { from: offChainValidator })

      let isAttested = await etcContracts.validator.hashAttestations(data.burnHashes[1], offChainValidator)
      assert.isFalse(isAttested, 'Attestation outcome should be false')

      // Minting was already done and refutation should not affect it
      assert.isTrue(await etcContracts.validator.hashClaimed(data.burnHashes[1]), 'HashClaimed should return true')
      let totalSupplyInSourceChain = (await ethContracts.metToken.totalSupply()).toNumber()
      var thrown = false
      try {
        await etcContracts.validator.attestHash(
          data.burnHashes[1], web3.fromAscii('ETH'), data.addresses[1], parseInt(data.importData[1]),
          parseInt(data.importData[2]), data.merkelProof, data.extraData, totalSupplyInSourceChain,
          { from: offChainValidator })
      } catch (e) {
        thrown = true
      }
      assert(thrown, 'Validator should not able to do attesttion if refutation done')
      thrown = false
      try {
        await etcContracts.validator.refuteHash(data.burnHashes[1], { from: offChainValidator })
      } catch (e) {
        thrown = true
      }
      assert(thrown, 'Validator should not able to do refutation more than once')
      resolve()
    })
  })
})
