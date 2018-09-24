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
const logger = require('./logger')
var CronJob = require('cron').CronJob

class EventManager {
  constructor (queue, source, destination) {
    this.queue = queue
    this.source = source
    this.destination = destination
    this.validator = new Validator(source, destination)
  }

  setupAndTriggerJob () {
    let job1 = new CronJob(constant.cronJobPattern, () => {
      logger.log('info', 'Cron job started to process pending validations')
      this.processPendingValidations()
    }, null, false, 'UTC')
    job1.start()

    let job2 = new CronJob(constant.cronJobPattern, () => {
      logger.log('info', 'Cron job started to process pending attestation')
      this.processPendingAttestation()
    }, null, true, 'UTC')
    job2.start()
  }

  async processPendingValidations () {
    // Todo: implement logic to avoid multiple cron triggering this method without earlier execution finish
    let key1, key2
    console.log('this.destination=', this.destination.name)
    if (this.destination.name === 'ETH') {
      key1 = constant.queueName.eth.pendingImport
      key2 = constant.queueName.eth.pendingAttestation
    } else {
      key1 = constant.queueName.etc.pendingImport
      key2 = constant.queueName.etc.pendingAttestation
    }
    try {
      var burnHash
      var safeBlockHeightReached
      var value
      logger.log('info', 'Processing pending validations.')
      do {
        burnHash = ''
        safeBlockHeightReached = false
        value = ''
        value = await this.queue.get(key1)
        logger.log('info', 'Processing pending validations for value=', value)
        if (!value) {
          break
        }
        var valueObj = JSON.parse(value)
        burnHash = valueObj.args.currentBurnHash
        let response = await this.validator.validateHash(burnHash)
        let currentBlockTimestmap = (await this.source.web3.eth.getBlock('latest')).timestamp
        if (!response) {
          logger.log('info', 'Processing pending validations: export receipt not found in source chain hence poping up from queue for burnHash %s', burnHash)
          await this.queue.pop(key1)
          // Todo: refute hash. call validator function
        } else if (!response.hashExist) {
          if (currentBlockTimestmap < valueObj.args.exportTimeStamp) {
            // Source chain is not synced properly. should wait.
            // To avoid waiting infinite on one hash, push it at last of queue.
            logger.log('info', 'Processing pending validations: export receipt not found in source chain because source chain is not synced properly. Should wait and try again. Burn hash %s', burnHash)
            value = await this.queue.pop(key1)
            this.queue.push(key1, value)
          } else {
            logger.log('info', 'Processing pending validations: export receipt not found in source chain. Burn hash %s', burnHash)
            value = await this.queue.pop(key1)
          }
        } else {
          // response.hashExist = true . Hash found in source chain
          var exportReceiptObj = (response.exportReceipt)[0]
          safeBlockHeightReached = (this.source.web3.eth.blockNumber >= (exportReceiptObj.blockNumber + constant.safeBlockHeight))
          exportReceiptObj.blockNumberInDestinationChain = valueObj.blockNumber
          exportReceiptObj.attestationAttempt = 0
          var exportReceiptStr = JSON.stringify(exportReceiptObj)
          logger.log('info', 'Processing pending validations: export receipt found in source chain. Burn hash %s  . Export receipt is %s', burnHash, exportReceiptStr)
          logger.log('debug', 'Processing pending validations: safeBlockHeightReached %s', safeBlockHeightReached)
          if (safeBlockHeightReached) {
            value = await this.queue.pop(key1)
            logger.log('info', 'Processing pending validations: safe block height reached hence poping and pushing in other queue for further processing %s', value)
            logger.log('info', 'Processing pending validations: pushing in attestation queue %s', exportReceiptStr)
            this.queue.push(key2, exportReceiptStr)
          }
        }
      } while (safeBlockHeightReached)
    } catch (error) {
      logger.log('error', 'Processing pending validations: Error while processing pending validations, %s . value was %s   . export receipt was', error, JSON.stringify(value), exportReceiptStr)
    }
  }

  async processPendingAttestation () {
    // Todo: implement logic to avoid multiple cron triggering this method without earlier execution finish
    let key
    if (this.destination.name === 'ETH') {
      key = constant.queueName.eth.pendingAttestation
    } else {
      key = constant.queueName.etc.pendingAttestation
    }
    try {
      var safeBlockHeightReached
      var value
      logger.log('info', 'Processing pending attestation.')
      do {
        safeBlockHeightReached = false
        value = ''
        value = await this.queue.get(key)
        if (!value || value.length === 0) {
          logger.log('info', 'Processing pending attestation: empty queue')
          break
        }
        value = JSON.parse(value)
        safeBlockHeightReached = (this.destination.web3.eth.blockNumber >= (value.blockNumberInDestinationChain + constant.safeBlockHeight))
        logger.log('debug', 'Processing pending attestation: safeBlockHeightReached %s.', safeBlockHeightReached)
        if (safeBlockHeightReached) {
          logger.log('info', 'Processing pending attestation: Safe block heigh reached. attesting hash now %s.', JSON.stringify(value))
          // Todo: shall we check in smart contract whether tokenPorter.merkleRoots has value for this hash?
          var receipt = await this.validator.attestHash(this.source.name, value)
          if (receipt && receipt.status === '0x1') {
            value = await this.queue.pop(key)
            logger.log('info', 'Processing pending attestation: Attestation done. %s', JSON.stringify(receipt))
          } else {
            let hashClaimed = await this.destination.contracts.validator.hashClaimed(value.args.currentBurnHash)
            await this.queue.pop(key)
            logger.log('debug', 'Hash claimed %s ', hashClaimed)
            if (!hashClaimed && value.attestationAttempt < 10) {
              // Push again at end of queue to try again in future
              value.attestationAttempt = value.attestationAttempt + 1
              await this.queue.push(key, value)
              logger.log('error', 'Processing pending attestation: Attestation failed. adding in queue to try again %s', JSON.stringify(receipt))
            } else {
              logger.log('error', 'Processing pending attestation: Attestation failed. %s', JSON.stringify(receipt))
            }
          }
        }
      } while (safeBlockHeightReached)
    } catch (error) {
      logger.log('error', 'Processing pending attestation: Error while processing pending attestation, %s. value was %s', error, JSON.stringify(value))
    }
  }
}

module.exports = EventManager
