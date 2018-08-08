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

/* globals MINPRICE, PRICE, START, TIMESCALE */
/* globals eth, personal, OWNER_ADDRESS, OWNER_PASS */
/* globals Auctions, AutonomousConverter, METToken, Proceeds, SmartToken, Validator, TokenPorter */

var hash
function waitForTx (hash) {
  var receipt = eth.getTransactionReceipt(hash)
  while (receipt === null) {
    receipt = eth.getTransactionReceipt(hash)
  }
  console.log('tx', hash)
  return receipt
}

// For live net , enter new owner address and password
var newOwner = OWNER_ADDRESS
var newOwnerPassword = OWNER_PASS
console.log('\nOwner address=', OWNER_ADDRESS)
var balanceOfNewOwner = eth.getBalance(newOwner)
console.log('Balance of Owner', balanceOfNewOwner)
if (balanceOfNewOwner < 1e18) {
  console.log('New owner should have sufficient balance to launch the metronome. Should have 1 ether atleast')
  throw new Error('Insufficient balance in owner`s account')
}

console.log('unlocking owner`s account')
personal.unlockAccount(newOwner, newOwnerPassword)

console.log('\nAccepting ownership of contracts')

// Accept ownership of all contracts before launching
hash = METToken.acceptOwnership({from: newOwner})
waitForTx(hash)

hash = AutonomousConverter.acceptOwnership({from: newOwner})
waitForTx(hash)

personal.unlockAccount(newOwner, newOwnerPassword)
hash = Auctions.acceptOwnership({from: newOwner})
waitForTx(hash)

hash = Proceeds.acceptOwnership({from: newOwner})
waitForTx(hash)

personal.unlockAccount(newOwner, newOwnerPassword)
hash = SmartToken.acceptOwnership({from: newOwner})
waitForTx(hash)

hash = Validator.acceptOwnership({from: newOwner})
waitForTx(hash)

personal.unlockAccount(newOwner, newOwnerPassword)
hash = TokenPorter.acceptOwnership({from: newOwner})
waitForTx(hash)

console.log('\nLaunching AutonomousConverter Contract')
personal.unlockAccount(newOwner, newOwnerPassword)
hash = AutonomousConverter.init(METToken.address, SmartToken.address, Auctions.address, {from: newOwner, value: web3.toWei(0.1, 'ether')})
waitForTx(hash)

console.log('\nLaunching Proceeds')
personal.unlockAccount(newOwner, newOwnerPassword)
hash = Proceeds.initProceeds(AutonomousConverter.address, Auctions.address, {from: newOwner})
waitForTx(hash)

console.log('\nLaunching Auctions')
personal.unlockAccount(newOwner, newOwnerPassword)
console.log('Auction start time=', START)
console.log('Is auctions initialized already? ', Auctions.initialized())
hash = Auctions.initAuctions(START, MINPRICE, PRICE, TIMESCALE, {from: newOwner, gas: 2000000})
waitForTx(hash)
console.log('Initialized auctions', Auctions.initialized())
if (!Auctions.initialized()) {
  throw new Error('Error occured while launching auction')
}

console.log('Launch completed\n')
