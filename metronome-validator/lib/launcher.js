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

const parser = require('./parser')
const Chain = require('./chain')
const Queue = require('./queue')
const EventManager = require('./event-manager')
const logger = require('./logger')
const Listener = require('./listener')

function launch (config, metronome) {
  let configuration = parser.parseConfig(config)
  let metronomeContracts = parser.parseMetronome(metronome)

  let ethChain = new Chain(configuration.eth, metronomeContracts.eth)
  let etcChain = new Chain(configuration.etc, metronomeContracts.etc)

  let eventQueue = new Queue()

  let ethEventManager = new EventManager(eventQueue)
  let etcEventManager = new EventManager(eventQueue)

  let ethListener = new Listener(ethChain, ethEventManager)
  let etcListener = new Listener(etcChain, etcEventManager)

  // TODO: validator should onle validate and vote/attast
  // TODO: event manager will call validator based on block height of 6

  try {
    ethListener.watchImportEvent()
    etcListener.watchImportEvent()
  } catch (e) {
    logger.log('error', 'Error occurred while listening events, %s', e)
  }
}

module.exports = {launch}
