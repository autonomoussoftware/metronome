/*
    The MIT License (MIT)

    Copyright 2018 - 2019, Autonomous Software.

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

// For live net , enter new owner address and password
var hash
function waitForTx (hash) {
  var receipt = eth.getTransactionReceipt(hash)
  while (receipt === null) {
    receipt = eth.getTransactionReceipt(hash)
  }
  console.log('tx', hash)
  return receipt
}

var newOwner = OWNER_ADDRESS
var newOwnerPassword = OWNER_PASS
var balanceOfNewOwner = eth.getBalance(newOwner)

if (balanceOfNewOwner < 1e18) {
  console.log('New owner should have sufficient balance to launch the metronome. Should have 1 ether atleast')
}

console.log('\nAccepting ownership of contracts')
personal.unlockAccount(newOwner, newOwnerPassword)

// Accept ownership of all contracts before launching
console.log('\nAccepting ownership of METToken')
hash = METToken.acceptOwnership({from: newOwner})
waitForTx(hash)

console.log('\nAccepting ownership of AutonomousConverter')
hash = AutonomousConverter.acceptOwnership({from: newOwner})
waitForTx(hash)

console.log('\nAccepting ownership of Auctions')
hash = Auctions.acceptOwnership({from: newOwner})
waitForTx(hash)

console.log('\nAccepting ownership of Proceeds')
hash = Proceeds.acceptOwnership({from: newOwner})
waitForTx(hash)

console.log('\nAccepting ownership of SmartToken')
hash = SmartToken.acceptOwnership({from: newOwner})
waitForTx(hash)

console.log('\nAccepting ownership of Validator')
hash = Validator.acceptOwnership({from: newOwner})
waitForTx(hash)

console.log('\nAccepting ownership of TokenPorter')
hash = TokenPorter.acceptOwnership({from: newOwner})
waitForTx(hash)

console.log('\nInitializing AutonomousConverter Contract')
hash = AutonomousConverter.init(METToken.address, SmartToken.address, Auctions.address, {from: newOwner, value: web3.toWei(0.1, 'ether')})
waitForTx(hash)

console.log('\nInitializing Proceeds')
personal.unlockAccount(newOwner, newOwnerPassword)
hash = Proceeds.initProceeds(AutonomousConverter.address, Auctions.address, {from: newOwner})
waitForTx(hash)

console.log('\nInitializing Auctions')
personal.unlockAccount(newOwner, newOwnerPassword)
MINPRICE = 3300000000000 // Same as current min price in eth chain
PRICE = 0.02e18. // start price for first daily auction. This may be average start price at eth chain 
TIMESCALE = 1 //hard coded
hash = Auctions.skipInitBecauseIAmNotOg(METToken.address, Proceeds.address, START, MINPRICE, PRICE, TIMESCALE, web3.fromAscii('ETC'), ISA_ENDTIME, {from: newOwner})
waitForTx(hash)
console.log('Initialized auctions', Auctions.initialized())
if (!Auctions.initialized()) {
  throw new Error('Error occured while launching auction')
}
console.log('Launch completed\n')
