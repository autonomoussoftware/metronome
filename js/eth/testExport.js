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

/* globals eth, personal, waitForTx, Auctions, METToken, web3, TokenPorter */
var funder = eth.accounts[0]

var buyers = [
  personal.newAccount('password'),
  personal.newAccount('password'),
  personal.newAccount('password')
]

var fundBuyers = (function () {
  for (var i = 0; i < buyers.length; i++) {
    var tx = eth.sendTransaction({to: buyers[i], from: funder, value: web3.toWei(1000, 'ether')})
    waitForTx(tx)
    console.log('fund buyer', i)
  }
}())

var buyMETFor = function (i) {
  var buyer = buyers[i]
  personal.unlockAccount(buyer, 'password')
  var tx = eth.sendTransaction({to: Auctions.address, from: buyer, value: web3.toWei(1, 'ether')})
  waitForTx(tx)
  console.log('buyer', i, 'purchases MET')
  console.log('buyer', i, 'has', METToken.balanceOf(buyer))
}

var buyMETForAll = (function () {
  for (var i = 0; i < buyers.length; i++) {
    buyMETFor(i)
  }
}())

var exportMETFor = function (i) {
  var buyer = buyers[i]
  exportMETFromAddress(buyer)
}

var exportMETFromAddress = function (address) {
  personal.unlockAccount(address, 'password')

  var destChain = 'ETC'

  var destMETAddr = TokenPorter.destinationChains(web3.fromAscii(destChain)) // using same contract ideally replace with mock contract
  console.log('destMETAddr=', destMETAddr)
  var destRecipAddr = '0x0851edaa94e8c9c0daa0672130f0e112825e2c43'

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
