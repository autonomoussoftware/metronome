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

/* globals eval, Proceeds, Auctions, AutonomousConverter, METToken, TokenPorter, Validator  */
var fs = require('fs')
const assert = require('chai').assert
// const ethjsABI = require('ethjs-abi')
const Web3 = require('web3')
const ethNodeUrl = 'http://localhost:8545'
const etcNodeUrl = 'http://localhost:8555'
var web3 = new Web3(new Web3.providers.HttpProvider(ethNodeUrl))
eval(fs.readFileSync('./js/eth/metronome.js') + '')
const ethContracts = {
  web3: web3,
  proceeds: Proceeds,
  auctions: Auctions,
  autonomousConverter: AutonomousConverter,
  metToken: METToken,
  tokenPorter: TokenPorter,
  validator: Validator

}
web3 = new Web3(new Web3.providers.HttpProvider(etcNodeUrl))
eval(fs.readFileSync('./js/etc/metronome.js') + '')
const etcContracts = {
  web3: web3,
  proceeds: Proceeds,
  auctions: Auctions,
  autonomousConverter: AutonomousConverter,
  metToken: METToken,
  tokenPorter: TokenPorter,
  validator: Validator
}

// function waitForTx (hash, eth) {
//   var receipt = eth.getTransactionReceipt(hash)
//   while (receipt === null) {
//     receipt = eth.getTransactionReceipt(hash)
//   }
//   console.log('tx hash', hash)
//   return receipt
// }
const chain = {
  eth: {
    metToken: ethContracts.metToken,
    auctions: ethContracts.auctions,
    tokenPorter: ethContracts.tokenPorter,
    validator: ethContracts.validator,
    web3: ethContracts.web3
  },
  etc: {
    metToken: etcContracts.metToken,
    auctions: etcContracts.auctions,
    tokenPorter: etcContracts.tokenPorter,
    validator: etcContracts.validator,
    web3: etcContracts.web3
  },
  validateHash: (destinationMetronomeAddr, exportReceipt, web3, validator, caller) => {
    console.log('Start validating hash for import')

    try {
      console.log('is validator?', caller)
      let isValidator = validator.isValidator(caller)
      console.log('is validator?', isValidator)
      assert.isTrue(isValidator, 'Provided address is not validator')
      let _originChain = exportReceipt.originChain
      let _destinationChain = exportReceipt.destinationRecipientAddr
      let _addresses = [destinationMetronomeAddr, exportReceipt.destinationRecipientAddr]
      let _extraData = exportReceipt.extraData
      let _burnHashes = [exportReceipt.prevBurnHash, exportReceipt.currentBurnHash]
      // let _supplyOnAllChains = exportReceipt.supplyOnAllChains
      let _importData = [exportReceipt.blockTimestamp, exportReceipt.amountToImport, exportReceipt.fee, exportReceipt.burntAtTick, exportReceipt.genesisTime, exportReceipt.dailyMintable, exportReceipt.burnSequence]
      let _proof = ''
      validator.validateHash(chain.eth.web3.fromAscii(_originChain), _destinationChain, _addresses, _extraData, _burnHashes, _importData, _proof, {from: caller})
      let hashClaimable = validator.hashClaimable(_burnHashes[1])
      console.log('hashClaimable', hashClaimable)
      // const decoder = ethjsABI.logDecoder(validator.abi)
      // const logAttestation = decoder(reciept.logs)[0]
      // assert(logAttestation._eventName, 'LogAttestation', 'Wrong event emitted for attestation')
      console.log('hash validation done successfully')
    } catch (e) {
      console.log('error thrown------')
      console.log(e)
    }
  },
  importHash: (exportReceipt, web3, validator, tokenPorter, metToken, _originChain) => {
    let claimable = validator.hashClaimable(exportReceipt.currentBurnHash, {from: web3.eth.accounts[0]})
    console.log('claimable', claimable)
    try {
      let _destinationChain = exportReceipt.destinationChain
      let _addresses = [exportReceipt.destinationMetronomeAddr, exportReceipt.destinationRecipientAddr]
      let _extraData = exportReceipt.extraData
      let _burnHashes = [exportReceipt.prevBurnHash, exportReceipt.currentBurnHash]
      let _supplyOnAllChains = exportReceipt.supplyOnAllChains
      let _importData = [exportReceipt.blockTimestamp, exportReceipt.amountToBurn, exportReceipt.fee, exportReceipt.currentTick, exportReceipt.genesisTime, exportReceipt.dailyMintable, exportReceipt.burnSequence, exportReceipt.dailyAuctionStartTime]
      let _proof = ''

      // let valid = validator.isReceiptClaimable(_originChain, _destinationChain, _addresses, _extraData, _burnHashes, _supplyOnAllChains, _importData, _proof)
      // assert.isTrue(valid, 'Import receipt is not valid')
      metToken.importMET(_originChain, _destinationChain, _addresses, _extraData, _burnHashes, _supplyOnAllChains, _importData, _proof, {from: web3.eth.accounts[0]})

      // let receipt = waitForTx(tx, web3.eth)
      // const decoder = ethjsABI.logDecoder(tokenPorter.abi)
      // const logImportReceipt = decoder(receipt.logs)[0]
      // assert(logImportReceipt._eventName, 'ImportReceiptLog', 'Wrong event emitted for import')
      console.log('Import request sent')
    } catch (e) {
      console.log('error thrown------')
      console.log(e)
    }
  }

}

module.exports = chain
