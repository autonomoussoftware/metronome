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

/* globals personal, waitForTx, METToken, web3, TokenPorter */
// var funder = eth.accounts[0]

var exportMETFromAddress = function (address) {
  personal.unlockAccount(address, 'password')

  var destChain = 'ETH'

  var destMETAddr = TokenPorter.destinationChains(web3.fromAscii(destChain)) // using same contract ideally replace with mock contract
  console.log('destMETAddr=', destMETAddr)
  var destRecipAddr = '0x00a329c0648769a73afac7f9381e08fb43dbea72'

  var amount = METToken.balanceOf(address)
  console.log(address, 'has', amount, 'before export')
  var extraData = 'extra data'
  var tx = METToken.export(
    web3.fromAscii(destChain),
    destMETAddr,
    destRecipAddr,
    amount,
    0,
    web3.fromAscii(extraData),
    { from: address })
  waitForTx(tx)
  console.log(address, 'has', METToken.balanceOf(address), 'after burn')
}

console.log('export tests are ready, invoke exportMETFor(i), to test for export receipt monitoring')
