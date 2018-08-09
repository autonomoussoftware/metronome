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

// TODO: These should happen only once.
// ETH Setup
let owner = chain.eth.tokenPorter.owner()
chain.eth.web3.personal.unlockAccount(owner, 'newOwner')
chain.eth.tokenPorter.addDestinationChain(chain.eth.web3.fromAscii('ETC'), chain.etc.tokenPorter.token(), {from: owner})

// ETC Setup
owner = chain.etc.tokenPorter.owner()
chain.etc.web3.personal.unlockAccount(owner, 'newOwner')
chain.etc.tokenPorter.addDestinationChain(chain.etc.web3.fromAscii('ETH'), chain.eth.tokenPorter.token(), {from: owner})

console.log('Listening for LogImportRequest for eth...')
chain.eth.tokenPorter.LogImportRequest().watch(function (err, response) {
  if (err) {
    console.log('export error', err)
  } else {
    console.log('import receipt found in ETC', JSON.stringify(response))
    console.log('current burn hash=', response.args.currentHash)
    console.log(response)
    var exportLogEvent = chain.eth.tokenPorter.ExportReceiptLog({currentBurnHash: response.args.currentBurnHash}, {fromBlock: 0, toBlock: 'latest'})
    console.log('exportLogEvent=', exportLogEvent)
    exportLogEvent.get(async function (err, res) {
      if (err) {
        console.log('Error in reading the export log at source chain', err)
      } else {
        console.log('exportLogEvent found in ETH', res)
        console.log('exportLogEvent found in ETH. Array length', res.length)
        let response = await chain.validateHash(chain.eth.web3.fromAscii('ETC'), res[0].args, chain.eth.web3, chain.eth.validator, chain.eth.tokenPorter.owner())
        console.log('response=', response)
      }
    })
  }
})

console.log('Listening for LogImportRequest for etc...')
chain.etc.tokenPorter.LogImportRequest().watch(function (err, response) {
  if (err) {
    console.log('export error', err)
  } else {
    console.log('import receipt found in ETC', JSON.stringify(response))
    console.log('current burn hash=', response.args.currentHash)
    console.log(response)
    var exportLogEvent = chain.eth.tokenPorter.ExportReceiptLog({currentBurnHash: response.args.currentBurnHash}, {fromBlock: 0, toBlock: 'latest'})
    console.log('exportLogEvent=', exportLogEvent)
    exportLogEvent.get(async function (err, res) {
      if (err) {
        console.log('Error in reading the export log at source chain', err)
      } else {
        console.log('exportLogEvent found in ETH', res)
        console.log('exportLogEvent found in ETH. Array length', res.length)
        await chain.validateHash(chain.eth.web3.fromAscii('ETC'), res[0].args, chain.etc.web3, chain.etc.validator, chain.etc.tokenPorter.owner())
      }
    })
  }
})
