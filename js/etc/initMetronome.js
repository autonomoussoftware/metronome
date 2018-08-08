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

/* globals ETHER_ADDR, NUMTOKENS, ONE, OWNER_ADDRESS */
/* globals eth */
/* globals Auctions, AutonomousConverter, METToken, Proceeds, SmartToken, TokenPorter, Validator, Validator */
var hash
function waitForTx (hash) {
  var receipt = eth.getTransactionReceipt(hash)
  while (receipt === null) {
    receipt = eth.getTransactionReceipt(hash)
  }
  console.log('tx', hash)
  return receipt
}

console.log('Initializing with ', ONE, 'and ', NUMTOKENS)

eth.defaultAccount = ETHER_ADDR

console.log('\nConfiguring METToken')
hash = METToken.initMETToken(AutonomousConverter.address, Auctions.address, 0, 0, {from: ETHER_ADDR}) // TODO: really? Zero?
waitForTx(hash)
hash = METToken.setTokenPorter(TokenPorter.address, {from: ETHER_ADDR})
waitForTx(hash)
console.log('METToken published at ' + METToken.address + 'auction address:' + METToken.minter)

console.log('\nConfiguring Smart Token')
hash = SmartToken.initSmartToken(AutonomousConverter.address, AutonomousConverter.address, 2, {from: ETHER_ADDR})
waitForTx(hash)
console.log('Smart Token published at ' + SmartToken.address + ' Current Smart Tokens: ' + SmartToken.totalSupply())

console.log('\nConfiguring Token Porter')
hash = TokenPorter.initTokenPorter(METToken.address, Auctions.address, {from: ETHER_ADDR})
waitForTx(hash)
hash = TokenPorter.setValidator(Validator.address, {from: ETHER_ADDR})
waitForTx(hash)
console.log('TokenPorter published at ' + TokenPorter.address)

var newOwner = OWNER_ADDRESS

console.log('\nConfiguring Validator')
// Todo: initValidator will take address of off-chain validators
hash = Validator.initValidator(METToken.address, Auctions.address, TokenPorter.address, {from: ETHER_ADDR})
waitForTx(hash)
hash = Validator.addValidator(ETHER_ADDR, {from: ETHER_ADDR})
waitForTx(hash)
hash = Validator.addValidator(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
console.log('Validator published at ' + Validator.address)

console.log('\nChanging Ownership')
hash = eth.sendTransaction({to: newOwner, from: ETHER_ADDR, value: web3.toWei(2, 'ether')}) // Todo: new owner in prod should already have eth.
waitForTx(hash)
hash = METToken.changeOwnership(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
hash = AutonomousConverter.changeOwnership(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
hash = Auctions.changeOwnership(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
hash = Proceeds.changeOwnership(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
hash = SmartToken.changeOwnership(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
hash = Validator.changeOwnership(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
hash = TokenPorter.changeOwnership(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
console.log('\nOwnership has been transfered to', newOwner)

console.log('Deployment Phase 1 Completed')
