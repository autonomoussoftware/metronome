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
    const stringValue = JSON.stringify(value)
    return this.client
      .rpushAsync(key, stringValue)
      .then(response => {
        logger.debug('Pushed new value in %s queue, value = %s', key, stringValue)
        return response
      })
      .catch(error => {
        logger.error('Error while pushing value in %s queue, %s', key, error)
      })
  }

  // Remove first value from queue and return the same
  pop (key) {
    return this.client
      .lpopAsync(key)
      .then(response => {
        const outcome = JSON.parse(response)
        logger.debug('Poped value from %s queue is %s', key, response)
        return outcome
      })
      .catch(error => {
        logger.error('Error while poping value from %s queue, %s', key, error)
      })
  }

  // Read first value from queue and return it
  get (key) {
    logger.debug('Calling get function for key %s', key)
    return this.client
      .lrangeAsync(key, 0, 0)
      .then(response => {
        const outcome = JSON.parse(response)
        logger.debug('Retrieved value from %s queue is %s', key, response)
        return outcome
      })
      .catch(error => {
        logger.error('Error while retrieving value from %s queue, %s', key, error)
      })
  }

  set (key, index, value) {
    const stringValue = JSON.stringify(value)
    return this.client
      .lsetAsync(key, index, stringValue)
      .then(response => {
        logger.debug('Updated %s queue at index %s with new value as %s', key, index, value)
        return response
      })
      .catch(error => {
        logger.error('Error while updating %s queue, %s', key, error)
      })
  }

  length (key) {
    return this.client
      .llenAsync(key)
      .then(response => {
        logger.debug('Length of %s queue is %s', key, response)
        return response
      })
      .catch(error => {
        logger.error('Error while retrieving length of %s queue, %s', key, error)
      })
  }
}

module.exports = Queue
