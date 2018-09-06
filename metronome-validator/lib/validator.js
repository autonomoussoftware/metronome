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

const Web3 = require('web3')
const ValidatorAdapter = require('../lib/validatorAdapter')

/**
 * Class reprensenting a Metronome Validator for off chain validations
 * @namespace MetronomeValidator
 */
class Validator {
  /**
     * @desc Metronome off chain validator.
     * @param configuration - contains owner address for validator, passord and URL ( with port)
     *  of blockchain node i.e. http://host:port
     * @param auctions
     * @param proceeds
     * @param autonomousConverter
     * @param metToken
     * @param tokenPorter
     * @param validator
     */
  constructor (configuration, contracts = {}) {
    this.configuration = configuration
    this.web3 = new Web3(new Web3.providers.HttpProvider(configuration.nodeUrl))
    this.auctions = this.web3.eth.contract(JSON.parse(contracts.Auctions.abi)).at(contracts.Auctions.address)
    this.proceeds = this.web3.eth.contract(JSON.parse(contracts.Proceeds.abi)).at(contracts.Proceeds.address)
    this.autonomousConverter = this.web3.eth.contract(JSON.parse(contracts.AutonomousConverter.abi)).at(contracts.AutonomousConverter.address)
    this.metToken = this.web3.eth.contract(JSON.parse(contracts.METToken.abi)).at(contracts.METToken.address)
    this.tokenPorter = this.web3.eth.contract(JSON.parse(contracts.TokenPorter.abi)).at(contracts.TokenPorter.address)
    this.validator = this.web3.eth.contract(JSON.parse(contracts.Validator.abi)).at(contracts.Validator.address)
  }

  watchImportEvent () {
    console.log('watching import event')
    this.tokenPorter.LogImportRequest().watch((err, response) => {
      if (err) {
        console.log('export error', err)
      } else {
        var sourceChain
        // Todo: remove this hard coded check
        // some weird issue- when passing string by converting web3.toAscii, its not calling correct object.
        if (response.args.originChain === '0x4554480000000000' || response.args.originChain === '0x6574680000000000') {
          sourceChain = 'ETH'
        } else {
          sourceChain = 'ETC'
        }
        this.web3.personal.unlockAccount(this.configuration.address, this.configuration.password)
        this.validateAndAttestHash(sourceChain, response.args.currentBurnHash)
      }
    })
  }

  validateAndAttestHash (sourceChain, burnHash) {
    try {
      ValidatorAdapter.readExportEvent(sourceChain, burnHash, (err, res) => {
        if (err) {
          console.log('error=', err)
        } else {
          let importDataObj = this.prepareImportData(res)
          this.validator.attestHash(importDataObj.burnHashes[1], importDataObj.burnHashes[0], sourceChain, importDataObj.addresses[1], parseInt(importDataObj.importData[1]), parseInt(importDataObj.importData[2]), importDataObj.merkelProof, importDataObj.extraData, {from: this.configuration.address})
        }
        // Todo: handle scenario if burnHash is not found in source chain.
        // Todo: hanle scenario of temperatory forking issue.
        // Todo: catch errors.
      })
    } catch (e) {
      console.log(e)
    }
  }

  prepareImportData (data) {
    return {
      addresses: [data.destinationMetronomeAddr, data.destinationRecipientAddr],
      burnHashes: [data.prevBurnHash, data.currentBurnHash],
      importData: [data.blockTimestamp, data.amountToBurn, data.fee,
        data.currentTick, data.genesisTime, data.dailyMintable,
        data.burnSequence, data.dailyAuctionStartTime],
      merkelProof: data.merkleProof,
      root: data.root,
      extraData: data.extraData
    }
  }
}

module.exports = Validator
