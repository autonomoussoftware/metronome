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

/* globals eth, Auctions, Proceeds, personal, METToken */

// In Dev mode, we want to trigger timestamp updates every 2.3 seconds
setInterval(function () {
  eth.sendTransaction({ from: eth.accounts[0], to: eth.accounts[1], value: 1 })
}, 1000)

console.log(
  'Price', Auctions.currentPrice(),
  'MTN Left:', Auctions.mintable() / 1e18,
  'Proceeds has:', eth.getBalance(Proceeds.address) / 1e18,
  'Current Tick', Auctions.currentTick(),
  'Current Auction', Auctions.currentAuction(),
  'Next Auction Starts:', Auctions.nextAuction()[0] - eth.getBlock('latest').timestamp, ' secs')

setInterval(function () {
  // Tell user current status of Auctions:
  console.log(
    'Price', Auctions.currentPrice(),
    'MTN Left:', Auctions.mintable() / 1e18,
    'Proceeds:', eth.getBalance(Proceeds.address) / 1e18,
    'Tick', Auctions.currentTick(),
    'Auction', Auctions.currentAuction(),
    'Next Auction In', Auctions.nextAuction()[0] - eth.getBlock('latest').timestamp,
    'lastPrice', Auctions.lastPurchasePrice(),
    'lastTick', Auctions.lastPurchaseTick())
}, 30000)

console.log('Use pingBuy() to initiate a 1 eth purchase')

var pingtx

var pingBuy = function () {
  pingtx = eth.sendTransaction({to: Auctions.address, from: buyer1Account, value: web3.toWei(1, 'ether')})
  console.log('pingtx', pingtx, 'buyer 1 has', METToken.balanceOf(buyer1Account))
}

var pingBuy2 = function () {
  pingtx = eth.sendTransaction({to: Auctions.address, from: buyer2Account, value: web3.toWei(1, 'ether')})
  console.log('pingtx2', pingtx, 'buyer 2 has', METToken.balanceOf(buyer2Account));
}

var pingBig = function () {
  pingtx = eth.sendTransaction({to: Auctions.address, from: buyer1Account, value: web3.toWei(100, 'ether')})
  console.log('pingtx', pingtx, 'buyer 1 has', METToken.balanceOf(buyer1Account))
}

var pingWei = function () {
  pingtx = eth.sendTransaction({ to: Auctions.address, from: buyer1Account, value: 10000 })
  console.log('pingtx', pingtx, 'buyer 1 has', METToken.balanceOf(buyer1Account))
}

// Setup: two buyers, two traders

console.log('Giving money away..')
var buyer1Account = personal.newAccount('buyer1Pass')
var buyer2Account = personal.newAccount('buyer2Pass')
var trader1Account = personal.newAccount('trader1Pass')
var trader2Account = personal.newAccount('trader2Pass')

eth.sendTransaction({to: buyer1Account, from: eth.accounts[0], value: web3.toWei(1000, 'ether')})
eth.sendTransaction({to: buyer2Account, from: eth.accounts[0], value: web3.toWei(1000, 'ether')})
eth.sendTransaction({to: trader1Account, from: eth.accounts[0], value: web3.toWei(1000, 'ether')})
eth.sendTransaction({to: trader2Account, from: eth.accounts[0], value: web3.toWei(1000, 'ether')})

function unlock () {
  personal.unlockAccount(buyer1Account, 'buyer1Pass')
  personal.unlockAccount(buyer2Account, 'buyer2Pass')
  personal.unlockAccount(trader1Account, 'trader1Pass')
  personal.unlockAccount(trader2Account, 'trader2Pass')
}

unlock()

// Buyers 1 and 2 buy

var b1buy1 = eth.sendTransaction({to: Auctions.address, from: buyer1Account, value: web3.toWei(20, 'ether')})

// console.log('Sleeping');
// await sleep(100);
// console.log('Awake');

var b2buy1 = eth.sendTransaction({to: Auctions.address, from: buyer2Account, value: web3.toWei(200, 'ether')})

console.log('Buyer 1 MTN:', METToken.balanceOf(buyer1Account) / 1e18)
console.log('Buyer 2 MTN:', METToken.balanceOf(buyer2Account) / 1e18)

// Check transfers can't happen yet

// Smart Token Purchase

// var autonomousconverterbuy1 = AutonomousConverter.mintFromEth(1, {from: trader1Account, value:web3.toWei(10, 'ether')});

// console.log('Trader 1 Smart Tokens:', SmartToken.balanceOf(trader1Account)/1e18);
