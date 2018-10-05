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

const bluebird = require('bluebird')
const redis = require('redis')
const logger = require('./logger')(__filename)

class Queue {
  constructor () {
    // promisifing redis
    bluebird.promisifyAll(redis)
    this.client = redis.createClient()
  }

  // TODO: how do we want to deal with exception while push and pop
  // Push value at the end of the queue
  push (key, value) {
    return this.client
      .rpushAsync(key, value)
      .then(response => {
        logger.debug('Pushed data with value as %s and key as %s', value, key)
        return response
      })
      .catch(error => {
        logger.error('Error while pushing value %s in queue, %s', value, error)
      })
  }

  // Remove first value from queue and return the same
  pop (key) {
    return this.client
      .lpopAsync(key)
      .then(response => {
        logger.debug('Poped value for key %s is %s', key, response)
        return response
      })
      .catch(error => {
        logger.error('Error while poping value for key %s, error is %s', key, error)
      })
  }

  // Read first value from queue and return it
  get (key) {
    logger.debug('Calling get function for key %s', key)
    return this.client
      .lrangeAsync(key, 0, 0)
      .then(response => {
        if (response.length > 0 && this.isValueValid(response)) {
          logger.debug('Retrieved value for key %s from queue is %s', key, response)
          return response
        } else {
          if (response && response.length > 0) {
            logger.debug(
              'Retrieved value for key %s from queue is %s . Its not valid value hence removing from queue',
              key,
              response
            )
            this.pop(key)
          }
          return null
        }
      })
      .catch(error => {
        logger.error('Error while retrieving value from queue, %s', error)
      })
  }

  length (key) {
    return this.client
      .llenAsync(key)
      .then(response => {
        logger.debug('Length of queue for key %s is %s', key, response)
        return response
      })
      .catch(error => {
        logger.error('Error while poping value from queue, %s', error)
      })
  }

  isValueValid (value) {
    try {
      let obj = JSON.parse(value)
      if (obj) {
        return true
      } else {
        return false
      }
    } catch (e) {
      return false
    }
  }
}

module.exports = Queue
