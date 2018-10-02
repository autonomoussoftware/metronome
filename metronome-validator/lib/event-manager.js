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
const Validator = require('./validator')
const constant = require('./const.js')
const logger = require('./logger')(__filename)
var CronJob = require('cron').CronJob

class EventManager {
  constructor (queue, source, destination) {
    this.queue = queue
    this.source = source
    this.destination = destination
    this.validator = new Validator(source, destination)
    if (this.destination.name === 'ETH') {
      this.validationQ = constant.queueName.eth.validationQ
      this.attestationQ = constant.queueName.eth.attestationQ
    } else if (this.destination.name === 'ETC') {
      this.validationQ = constant.queueName.etc.validationQ
      this.attestationQ = constant.queueName.etc.attestationQ
    }
  }

  setupAndTriggerJob () {
    let validationJob = new CronJob(constant.cronJobPattern, () => {
      logger.log('info', 'Cron job started to process pending validations')
      this.processPendingValidations()
    }, null, false, 'UTC')
    validationJob.start()

    let attestationJob = new CronJob(constant.cronJobPattern, () => {
      logger.log('info', 'Cron job started to process pending attestation')
      this.processPendingAttestation()
    }, null, false, 'UTC')
    attestationJob.start()
  }

  async processPendingValidations () {
    // Todo: implement logic to avoid multiple cron triggering this method without earlier execution finish
    var count = await this.queue.length(this.validationQ)
    while (count > 0) {
      count--
      try {
        var value = await this.queue.pop(this.validationQ)
        var processLater = false
        logger.log('info', 'Processing pending validations for value=', value)
        var valueObj = JSON.parse(value)
        var safeBlockHeight = (this.destination.web3.eth.blockNumber >= (valueObj.blockNumber + constant.safeBlockHeight))
        if (safeBlockHeight) {
          let response = await this.validator.validateHash(valueObj.args.currentBurnHash)
          if (response.hashExist) {
            // Hash found in source chain
            var exportReceiptObj = (response.exportReceipt)[0]
            let readyForAttest = (this.source.web3.eth.blockNumber >= (exportReceiptObj.blockNumber + constant.safeBlockHeight))
            if (readyForAttest) {
              exportReceiptObj.failedAttempts = 0
              this.queue.push(this.attestationQ, JSON.stringify(exportReceiptObj))
            } else {
              processLater = true
            }
          } else {
            logger.log('info', 'Processing pending validations: export receipt not found in source chain for burn hash %s', valueObj.args.currentBurnHash)
            let currentBlockTimestmap = (await this.source.web3.eth.getBlock('latest')).timestamp
            if (currentBlockTimestmap < valueObj.args.exportTimeStamp) {
              logger.log('info', 'Source chain is not synced properly. Should wait and try again. Burn hash %s', valueObj.args.currentBurnHash)
              processLater = true
            } else {
              await this.validator.attestHash(valueObj.args.currentBurnHash)
            }
          }
        } else {
          processLater = true
        }
        if (processLater & valueObj.failedAttempts < constant.retryCount) {
          valueObj.failedAttempts++
          this.queue.push(this.validationQ, JSON.stringify(valueObj))
        }
      } catch (error) {
        logger.log('error', 'Processing pending validations: Error while processing pending validations, %s . value was %s   . export receipt was', error, JSON.stringify(value), JSON.stringify(exportReceiptObj))
      }
    }
  }

  async processPendingAttestation () {
    // Todo: implement logic to avoid multiple cron triggering this method without earlier execution finish

    logger.log('info', 'Processing pending attestation.')
    // Process all pending attestion
    var count = await this.queue.length(this.attestationQ)
    while (count > 0) {
      count--
      try {
        var value = await this.queue.pop(this.attestationQ)
        var valueObj = JSON.parse(value)
        logger.log('info', 'Processing pending attestation: Safe block heigh reached. attesting hash now %s.', value)
        // Todo: shall we check in smart contract whether tokenPorter.merkleRoots() has value for this hash?
        var receipt = await this.validator.attestHash(this.source.name, valueObj)
        if (receipt && receipt.status === '0x1') {
          logger.log('info', 'Processing pending attestation: Attestation done. %s', JSON.stringify(receipt))
        } else {
          let hashClaimed = await this.destination.contracts.validator.hashClaimed(valueObj.args.currentBurnHash)
          logger.log('error', 'Processing pending attestation: Attestation failed. %s', JSON.stringify(valueObj))
          if (!hashClaimed && valueObj.failedAttempts < constant.retryCount) {
          // Push again at end of queue to try again in future
            logger.log('error', 'Processing pending attestation: Adding in queue to try again %s', JSON.stringify(valueObj))
            valueObj.failedAttempts++
            await this.queue.push(this.attestationQ, JSON.stringify(valueObj))
          }
        }
      } catch (error) {
        logger.log('error', 'Processing pending attestation: Error while processing pending attestation, %s. value was %s', error, value)
      }
    }
  }
}

module.exports = EventManager
