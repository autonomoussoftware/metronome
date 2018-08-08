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

console.log('Listening for ImportRequestLog for eth...')
chain.eth.tokenPorter.ImportRequestLog().watch(function (err, response) {
  if (err) {
    console.log('export error', err)
  } else {
    console.log('export receipt found in ETH', JSON.stringify(response))
    console.log('current burn hash=', response.args.currentBurnHash)
    chain.validateHash(response.address, response.args, chain.etc.web3, chain.etc.validator, chain.etc.tokenPorter.owner())
  }
})

console.log('Listening for ImportRequestLog for etc...')
chain.etc.tokenPorter.ImportRequestLog().watch(function (err, response) {
  if (err) {
    console.log('export error', err)
  } else {
    console.log('import receipt found in ETC', JSON.stringify(response))
    console.log('current burn hash=', response.args.currentHash)
    chain.validateHash((chain.eth.tokenPorter.token()), response.args, chain.eth.web3, chain.eth.validator, chain.eth.tokenPorter.owner())
  }
})
