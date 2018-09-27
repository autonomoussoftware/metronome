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

const logger = require('./logger')
const constant = require('./const.js')

class Listener {
  constructor (queue, destinationChain) {
    this.chainName = destinationChain.name
    this.web3 = destinationChain.web3
    this.tokenPorter = destinationChain.contracts.tokenPorter
    this.queue = queue
    if (this.chainName === 'ETH') {
      this.valiationQ = constant.queueName.eth.validationQ
    } else if (this.chainName === 'ETC') {
      this.valiationQ = constant.queueName.etc.validationQ
    }
  }

  watchImportEvent () {
    logger.log('info', 'Started watching import request event')
    this.tokenPorter.LogImportRequest().watch((error, response) => {
      if (error) {
        logger.log('error', 'Error occurred while watching for import request %s', error)
      } else {
        response.failedAttempts = 0
        logger.log('debug', 'Pushing value in redis queue %s', response)
        this.queue.push(this.valiationQ, JSON.stringify(response))
      }
    })
  }
}

module.exports = Listener
