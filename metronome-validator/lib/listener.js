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
const Validator = require('./validator')
const Chain = require('./chain')
const logger = require('./logger')

function listen (config, metronome) {
  let configuration = parser.parseConfig(config)
  let metronomeContracts = parser.parseMetronome(metronome)

  let ethChain = new Chain(configuration.eth, metronomeContracts.eth)
  let etcChain = new Chain(configuration.etc, metronomeContracts.etc)

  let ethValidator = new Validator(etcChain, ethChain)
  let etcValidator = new Validator(ethChain, etcChain)
  try {
    ethValidator.watchImportEvent()
    etcValidator.watchImportEvent()
  } catch (e) {
    logger.log('error', 'Error occurred while listening events, %s', e)
  }
}

module.exports = {listen}
