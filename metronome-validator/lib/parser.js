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

const logger = require('./logger')(__filename)

function parseMetronome (input) {
  let metronome = {}
  for (var chain in input) {
    metronome[chain] = parseContracts(input[chain])
  }
  return metronome
}

function parseContracts (input) {
  try {
    var contracts = {}
    while (input.includes('var')) {
      let contractName = fetchContactName(input)
      let contractString = fetchContractString(input)

      let contract = {}
      contract['abi'] = fetchAbi(contractString)
      contract['address'] = fetchAddress(contractString)
      contracts[contractName] = contract

      input = input.replace(contractString, '')
    }

    return contracts
  } catch (e) {
    logger.error('Error occurred while processing contents of metronome.js %s', e)
    process.exit(1)
  }
}

function fetchContactName (input) {
  return fetchSubString(input, 'var', '=').trim()
}

function fetchContractString (input) {
  return input.slice(0, input.indexOf(';') + 1)
}

function fetchAbi (input) {
  var startSubString = 'web3.eth.contract('
  var endSubString = ').at("'
  return fetchSubString(input, startSubString, endSubString)
}

function fetchAddress (input) {
  var startSubString = '.at("'
  var endSubString = '")'
  return fetchSubString(input, startSubString, endSubString)
}

function fetchSubString (input, startSubString, endSubString) {
  return input.slice(
    input.indexOf(startSubString) + startSubString.length,
    input.indexOf(endSubString)
  )
}

module.exports = { parseMetronome }
