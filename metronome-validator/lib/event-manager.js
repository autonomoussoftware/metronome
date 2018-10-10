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
    let validationJob = new CronJob({
      cronTime: constant.cronJobPattern,
      onTick: () => { this.processPendingValidations() },
      start: false,
      timeZone: 'UTC'
    })
    logger.info('Started processing pending validations on source (%s) chain', this.source.name)
    validationJob.start()

    let attestationJob = new CronJob({
      cronTime: constant.cronJobPattern,
      onTick: () => { this.processPendingAttestation() },
      start: false,
      timeZone: 'UTC'
    })
    logger.info('Started processing pending attestation on destination (%s) chain', this.destination.name)
    attestationJob.start()
  }

  async processPendingValidations () {
    // Todo: implement logic to avoid multiple cron triggering this method without earlier execution finish
    var count = await this.queue.length(this.validationQ)
    var processLater
    while (count > 0) {
      count--
      try {
        var value = await this.queue.pop(this.validationQ)
        processLater = false
        logger.info('Processing pending validations for value = %s', value)
        var safeBlockHeight =
          this.destination.web3.eth.blockNumber >=
          value.blockNumber + constant.safeBlockHeight
        if (safeBlockHeight) {
          let response = await this.validator.validateHash(
            value.args.currentBurnHash
          )
          if (response.hashExist) {
            // Hash found in source chain
            var exportReceiptObj = response.exportReceipt[0]
            let readyForAttest =
              this.source.web3.eth.blockNumber >=
              exportReceiptObj.blockNumber + constant.safeBlockHeight
            if (readyForAttest) {
              exportReceiptObj.failedAttempts = 0
              this.queue.push(this.attestationQ, exportReceiptObj)
            } else {
              processLater = true
            }
          } else {
            logger.info(
              'Export receipt not found in source chain for burn hash %s',
              value.args.currentBurnHash
            )
            let currentBlockTimestmap = (await this.source.web3.eth.getBlock(
              'latest'
            )).timestamp
            if (currentBlockTimestmap < value.args.exportTimeStamp) {
              logger.info(
                'Source chain is not synced properly. Will wait and try again for burn hash %s',
                value.args.currentBurnHash
              )
              processLater = true
            } else {
              await this.validator.refuteHash(value.args.currentBurnHash)
            }
          }
        } else {
          processLater = true
        }
      } catch (error) {
        processLater = true
        logger.error(
          'Error while processing pending validations %s. value in queue was %s. export receipt was %s',
          error,
          JSON.stringify(value),
          JSON.stringify(exportReceiptObj)
        )
      }
      try {
        if (processLater & (value.failedAttempts < constant.retryCount)) {
          value.failedAttempts++
          this.queue.push(this.validationQ, value)
        }
      } catch (error) {
        logger.error(
          'Error while processing pending validations and pushing in queue %s',
          error
        )
      }
    }
  }

  async processPendingAttestation () {
    // Todo: implement logic to avoid multiple cron triggering this method without earlier execution finish

    // Process all pending attestion
    var count = await this.queue.length(this.attestationQ)
    var processLater
    while (count > 0) {
      count--
      try {
        processLater = false
        var value = await this.queue.pop(this.attestationQ)
        logger.info(
          'Safe block height reached. attesting hash now %s.', JSON.stringify(value)
        )
        // Todo: shall we check in smart contract whether tokenPorter.merkleRoots() has value for this hash?
        var receipt = await this.validator.attestHash(
          this.source.name,
          value
        )
        if (receipt && receipt.status === '0x1') {
          logger.info(
            'Attestation done. %s',
            JSON.stringify(receipt)
          )
        } else {
          processLater = true
          logger.error(
            'Attestation failed for value %s',
            JSON.stringify(value)
          )
        }
      } catch (error) {
        processLater = true
        logger.error(
          'Error while processing pending attestation, %s. value in queue was %s',
          error,
          JSON.stringify(value)
        )
      }
      try {
        if (processLater && value.failedAttempts < constant.retryCount) {
          // Push again at end of queue to try again in future
          logger.error(
            'Adding the value in queue to try again later, %s',
            JSON.stringify(value)
          )
          value.failedAttempts++
          await this.queue.push(this.attestationQ, value)
        }
      } catch (error) {
        logger.error(
          'Error while processing pending attestation and pushing in queue, %s. value in queue was %s',
          error,
          JSON.stringify(value)
        )
      }
    }
  }
}

module.exports = EventManager
