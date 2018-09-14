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

/**
 * Class reprensenting a Metronome Validator for off chain validations
 * @namespace MetronomeValidator
 */
class Validator {
  /**
     * @desc Metronome off chain validator.
     */

  constructor (sourceChain, destinationChain) {
    this.configuration = destinationChain.configuration
    this.web3 = destinationChain.web3
    this.sourceTokenPorter = sourceChain.contracts.tokenPorter
    this.sourceMetToken = sourceChain.contracts.metToken
    this.tokenPorter = destinationChain.contracts.tokenPorter
    this.validator = destinationChain.contracts.validator
  }

  watchImportEvent () {
    // TODO: log info/error to log file
    console.log('watching import event')
    this.tokenPorter.LogImportRequest().watch((err, response) => {
      if (err) {
        console.log('export error', err)
      } else {
        this.validateAndAttestHash(response.args.originChain, response.args.currentBurnHash)
      }
    })
  }

  validateAndAttestHash (sourceChain, burnHash) {
    var exportLogEvent = this.sourceTokenPorter.ExportReceiptLog({currentBurnHash: burnHash}, {fromBlock: 0, toBlock: 'latest'})
    exportLogEvent.get((err, res) => {
      if (err) {
        throw new Error(err)
      } else {
        if (res && res.length > 0) {
          let merklePath = this.createMerklePath(res[0].args.burnSequence)
          let importDataObj = this.prepareImportData(res[0].args)
          this.web3.personal.unlockAccount(this.configuration.address, this.configuration.password)
          let signature = this.web3.eth.sign(this.configuration.address, importDataObj.burnHashes[1])
          let totalSupplyAtSourceChain = (this.sourceMetToken.totalSupply()).toNumber()
          this.validator.attestHash(importDataObj.burnHashes[1], sourceChain,
            importDataObj.addresses[1], parseInt(importDataObj.importData[1]), parseInt(importDataObj.importData[2]),
            merklePath, importDataObj.extraData, signature, totalSupplyAtSourceChain, {from: this.configuration.address})
        } else {
          // Todo: Do we need to vote -tive if burnHash not found in source chain?
        }
      }
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
    console.log('leaves=', leaves)
    const tree = new MerkleTreeJs(leaves, this.sha256)
    var merkleProof = []
    var buffer = tree.getProof(leaves[leaves.length - 1])
    for (let j = 0; j < buffer.length; j++) {
      merkleProof.push('0x' + ((buffer[j].data).toString('hex')))
    }

    return merkleProof
  }

  sha256 (data) {
    // returns Buffer
    return crypto.createHash('sha256').update(data).digest()
  }

  prepareImportData (data) {
    return {
      addresses: [data.destinationMetronomeAddr, data.destinationRecipientAddr],
      burnHashes: [data.prevBurnHash, data.currentBurnHash],
      importData: [data.blockTimestamp, data.amountToBurn, data.fee,
        data.currentTick, data.genesisTime, data.dailyMintable,
        data.burnSequence, data.dailyAuctionStartTime],
      extraData: data.extraData
    }
  }
}

module.exports = Validator
