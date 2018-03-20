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

/* globals ETHER_ADDR, MINPRICE, NUMTOKENS, ONE, PRICE, START, TIMESCALE */
/* globals eth, personal */
/* globals Auctions, AutonomousConverter, METTokenJSON, Proceeds, SmartTokenJSON */
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

console.log('Founder is', ETHER_ADDR)
eth.defaultAccount = ETHER_ADDR

console.log('Configuring METToken')
var evmDataForMTN = web3.eth.contract(METTokenJSON.abi).new.getData(AutonomousConverter.address, Auctions.address, 0, 0, {data: METTokenJSON.bytecode})
hash = eth.sendTransaction({from: ETHER_ADDR, data: evmDataForMTN, gas: 4700000})
var receipt = waitForTx(hash)
var METToken = web3.eth.contract(METTokenJSON.abi).at(receipt.contractAddress)
console.log('METToken published at ' + METToken.address)

console.log('Configuring Smart Token')
var evmDataForST = web3.eth.contract(SmartTokenJSON.abi).new.getData(AutonomousConverter.address, AutonomousConverter.address, 2, {data: SmartTokenJSON.bytecode})
hash = eth.sendTransaction({from: ETHER_ADDR, data: evmDataForST, gas: 4700000})
receipt = waitForTx(hash)
var SmartToken = web3.eth.contract(SmartTokenJSON.abi).at(receipt.contractAddress)
console.log('Smart Token published at ' + SmartToken.address)

var founders = []
// Since we are appending it with hexadecimal address so amount should also be
// in hexa decimal. Hence 999999e18 = 0000d3c20dee1639f99c0000 in 24 character ( 96 bits)
// 1000000e18 =  0000d3c20dee1639f99c0000
founders.push(ETHER_ADDR + '0000D3C214DE7193CD4E0000')
founders.push('0xf17f52151ebef6c7334fad080c5704d77216b732' + '0000D3C214DE7193CD4E0000')
var gasForMint = Auctions.mintInitialSupply.estimateGas(founders, METToken.address, Proceeds.address, AutonomousConverter.address)
console.log('gas for mint', gasForMint)
hash = Auctions.mintInitialSupply(founders, METToken.address, Proceeds.address, AutonomousConverter.address, {gas: gasForMint})
waitForTx(hash)

console.log('Minted', Auctions.minted())
console.log('Deployment Phase 1 Complete')

console.log('Changing Ownership')
var newOwner = personal.newAccount('newOwner')
hash = eth.sendTransaction({to: newOwner, from: ETHER_ADDR, value: web3.toWei(1000, 'ether')})
waitForTx(hash)
// need to keep account unlocked since testnet txns can take a long time
personal.unlockAccount(newOwner, 'newOwner')

hash = METToken.changeOwnership(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
personal.unlockAccount(newOwner, 'newOwner')
hash = AutonomousConverter.changeOwnership(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
personal.unlockAccount(newOwner, 'newOwner')
hash = Auctions.changeOwnership(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
personal.unlockAccount(newOwner, 'newOwner')
hash = Proceeds.changeOwnership(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
personal.unlockAccount(newOwner, 'newOwner')
hash = SmartToken.changeOwnership(newOwner, {from: ETHER_ADDR})
waitForTx(hash)
personal.unlockAccount(newOwner, 'newOwner')
console.log('Ownership has been transfered to', newOwner)

console.log('Configuring AutonomousConverter Contract')
var gasForAc = AutonomousConverter.init.estimateGas(METToken.address, SmartToken.address, Auctions.address, { from: newOwner, value: web3.toWei(1, 'ether') })
console.log('gas for ac', gasForAc)
hash = AutonomousConverter.init(METToken.address, SmartToken.address, Auctions.address, { from: newOwner, value: web3.toWei(1, 'ether'), gas: gasForAc })
waitForTx(hash)
personal.unlockAccount(newOwner, 'newOwner')
console.log('Configuring Proceeds')
var gasForProceeds = Proceeds.initProceeds.estimateGas(AutonomousConverter.address, Auctions.address, { from: newOwner })
console.log('gas for proceeds', gasForProceeds)
hash = Proceeds.initProceeds(AutonomousConverter.address, Auctions.address, { from: newOwner, gas: gasForProceeds })
waitForTx(hash)
personal.unlockAccount(newOwner, 'newOwner')

var gasForAuction = Auctions.initAuctions.estimateGas(START, MINPRICE, PRICE, TIMESCALE, { from: newOwner })
console.log('gas for init', gasForAuction)
hash = Auctions.initAuctions(START, MINPRICE, PRICE, TIMESCALE, {from: newOwner, gas: gasForAuction})
waitForTx(hash)
personal.unlockAccount(newOwner, 'newOwner')
console.log('Initialized', Auctions.initialized())
