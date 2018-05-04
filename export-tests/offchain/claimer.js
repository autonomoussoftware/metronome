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

const chain = require('../common/crossChainContracts')
console.log('Listening for validation for eth...')
chain.eth.validator.LogAttestation().watch(function (err, response) {
  if (err) {
    console.log('Attestation error', err)
  } else {
    console.log(response)
    var exportLogEvent = chain.etc.tokenPorter.ExportReceiptLog({currentBurnHash: response.args.hash}, {fromBlock: 0, toBlock: 'latest'})
    console.log('exportLogEvent=', exportLogEvent)
    exportLogEvent.get(function (err, res) {
      if (err) {
        console.log('export error', err)
      } else {
        console.log('Attestation found in ETH', res)
        console.log('Attestation found in ETH array length', res.length)
        if (res.length > 0) {
          chain.importHash(res[0].args, chain.eth.web3, chain.eth.validator, chain.eth.tokenPorter, chain.eth.metToken, chain.eth.web3.fromAscii('ETC'))
        }
      }
    })
  }
})

console.log('Listening for validation for etc...')
chain.etc.validator.LogAttestation().watch(function (err, response) {
  if (err) {
    console.log('Attestation error', err)
  } else {
    console.log(response)
    var exportLogEvent = chain.eth.tokenPorter.ExportReceiptLog({currentBurnHash: response.args.hash}, {fromBlock: 0, toBlock: 'latest'})
    console.log('exportLogEvent=', exportLogEvent)
    exportLogEvent.get(function (err, res) {
      if (err) {
        console.log('export error', err)
      } else {
        console.log('Attestation found in ETC', res)
        console.log('Attestation found in ETC array length', res.length)
        if (res.length > 0) {
          chain.importHash(res[0].args, chain.etc.web3, chain.etc.validator, chain.etc.tokenPorter, chain.etc.metToken, chain.eth.web3.fromAscii('ETH'))
        }
      }
    })
  }
})
