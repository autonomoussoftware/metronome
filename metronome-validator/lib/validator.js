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

const MerkleTreeJs = require('merkletreejs')
const crypto = require('crypto')
const logger = require('./logger')(__filename)

/**
 * Class reprensenting a Metronome Validator for off chain validations
 * @namespace MetronomeValidator
 */
class Validator {
  /**
   * @desc Metronome off chain validator.
   */

  constructor (sourceChain, destinationChain) {
    this.address = destinationChain.configuration.address
    this.password = destinationChain.configuration.password
    this.web3 = destinationChain.web3
    this.sourceTokenPorter = sourceChain.contracts.tokenPorter
    this.sourceMetToken = sourceChain.contracts.metToken
    this.tokenPorter = destinationChain.contracts.tokenPorter
    this.validator = destinationChain.contracts.validator
  }

  validateHash (burnHash) {
    return new Promise((resolve, reject) => {
      var burnSequence = this.sourceTokenPorter.burnHashes(burnHash).toNumber()
      if (burnSequence <= 0) {
        logger.log('info', 'Burn hash not found in source chain. ' + burnHash)
        let obj = { hashExist: false }
        resolve(obj)
      } else {
        var exportLogEvent = this.sourceTokenPorter.ExportReceiptLog(
          { currentBurnHash: burnHash },
          { fromBlock: 0, toBlock: 'latest' }
        )
        exportLogEvent.get((error, response) => {
          if (error) {
            logger.log(
              'error',
              'Error occurred while reading export receipt on source chain, %s ',
              error
            )
            reject(
              new Error(
                'Error occurred while reading export receipt on source chain'
              )
            )
          } else {
            if (response && response.length > 0) {
              logger.log(
                'info',
                'Burn hash found in source chain. Current burn hash is ' +
                  response[0].args.currentBurnHash +
                  '. Previous burn hash is ' +
                  response[0].args.prevBurnHash
              )
              let obj = { hashExist: true }
              obj.exportReceipt = response
              resolve(obj)
            }
          }
        })
      }
    })
  }

  attestHash (sourceChainName, data) {
    return new Promise((resolve, reject) => {
      let merklePath = this.createMerklePath(data.args.burnSequence)
      let importDataObj = this.prepareImportData(data.args)
      this.web3.personal.unlockAccount(this.address, this.password)
      let signature = this.web3.eth.sign(
        this.address,
        importDataObj.burnHashes[1]
      )
      let totalSupplyAtSourceChain = this.sourceMetToken
        .totalSupply()
        .toNumber()
      let tx = this.validator.attestHash(
        importDataObj.burnHashes[1],
        sourceChainName,
        importDataObj.addresses[1],
        parseInt(importDataObj.importData[1]),
        parseInt(importDataObj.importData[2]),
        merklePath,
        importDataObj.extraData,
        signature,
        totalSupplyAtSourceChain,
        { from: this.address }
      )
      let receipt = this.web3.eth.getTransactionReceipt(tx)
      logger.log('info', 'Attested burn hash ' + data.args.currentBurnHash)
      resolve(receipt)
    })
  }

  refuteHash (burnHash) {
    return new Promise((resolve, reject) => {
      this.web3.personal.unlockAccount(this.address, this.password)
      let signature = this.web3.eth.sign(this.address, burnHash)
      let tx = this.validator.refuteHash(burnHash, signature, {
        from: this.address
      })
      let receipt = this.web3.eth.getTransactionReceipt(tx)
      logger.log('info', 'Refuted burn hash %s', burnHash)
      logger.log('info', 'Refuted burn hash receipt %s', JSON.stringify(receipt))
      resolve(receipt)
    })
  }

  createMerklePath (burnSequence) {
    var leaves = []
    var i = 0
    if (burnSequence > 15) {
      i = burnSequence - 15
    }
    var leave
    while (i <= burnSequence) {
      leave = this.sourceTokenPorter.exportedBurns(i)
      leave = Buffer.from(leave.slice(2), 'hex')
      leaves.push(leave)
      i++
    }
    const tree = new MerkleTreeJs(leaves, this.sha256)
    var merkleProof = []
    var buffer = tree.getProof(leaves[leaves.length - 1])
    for (let j = 0; j < buffer.length; j++) {
      merkleProof.push('0x' + buffer[j].data.toString('hex'))
    }

    return merkleProof
  }

  sha256 (data) {
    // returns Buffer
    return crypto
      .createHash('sha256')
      .update(data)
      .digest()
  }

  prepareImportData (data) {
    return {
      addresses: [data.destinationMetronomeAddr, data.destinationRecipientAddr],
      burnHashes: [data.prevBurnHash, data.currentBurnHash],
      importData: [
        data.blockTimestamp,
        data.amountToBurn,
        data.fee,
        data.currentTick,
        data.genesisTime,
        data.dailyMintable,
        data.burnSequence,
        data.dailyAuctionStartTime
      ],
      extraData: data.extraData
    }
  }
}

module.exports = Validator
