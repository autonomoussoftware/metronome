/*
    The MIT License (MIT)

    Copyright 2017 - 2018, Autonomous Software.

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

/* globals ETHER_ADDR, OWNER_ADDRESS, OWNER_PASS, VALIDATORS */
/* globals eth, personal */
/* globals Auctions, METToken, TokenPorter, Validator, Validator */
var hash
function waitForTx (hash) {
  var receipt = eth.getTransactionReceipt(hash)
  while (receipt === null) {
    receipt = eth.getTransactionReceipt(hash)
  }
  console.log('tx', hash)
  return receipt
}

eth.defaultAccount = ETHER_ADDR
var newOwner = OWNER_ADDRESS
var newOwnerPassword = OWNER_PASS
console.log('\nConfiguring Token Porter')
hash = TokenPorter.initTokenPorter(METToken.address, Auctions.address, {from: ETHER_ADDR})
waitForTx(hash)
hash = TokenPorter.setValidator(Validator.address, {from: ETHER_ADDR})
waitForTx(hash)
// Todo: take this value from input param? 
hash = TokenPorter.setExportFeePerTenThousand(200, {from: ETHER_ADDR})
waitForTx(hash)
// Todo: take this value from input param? 
hash = TokenPorter.setMinimumExportFee(2e12, {from: ETHER_ADDR})
waitForTx(hash)

console.log('TokenPorter published at ' + TokenPorter.address)

console.log('\nConfiguring Validator')
// initValidator will take address of off-chain validators. Strictly passing three validators from deploy script
hash = Validator.initValidator(METToken.address, Auctions.address, TokenPorter.address, {from: ETHER_ADDR})
waitForTx(hash)
hash = Validator.addValidator(VALIDATORS[0], {from: ETHER_ADDR})
waitForTx(hash)
hash = Validator.addValidator(VALIDATORS[1], {from: ETHER_ADDR})
waitForTx(hash)
hash = Validator.addValidator(VALIDATORS[2], {from: ETHER_ADDR})
waitForTx(hash)
console.log('Validator published at ' + Validator.address)

console.log('\nChanging Ownership of new TokenPorter and Validator contracts to', newOwner)

hash = Validator.changeOwnership(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
hash = TokenPorter.changeOwnership(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
console.log('\nOwnership has been transfered to', newOwner)

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

hash = Validator.acceptOwnership({from: newOwner})
waitForTx(hash)

personal.unlockAccount(newOwner, newOwnerPassword)
hash = TokenPorter.acceptOwnership({from: newOwner})
waitForTx(hash)

console.log('\nUpdating tokenPorter address in METToken contract')
hash = METToken.setTokenPorter(TokenPorter.address, {from: ETHER_ADDR})
waitForTx(hash)
