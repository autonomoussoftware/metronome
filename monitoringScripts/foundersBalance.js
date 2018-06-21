const Web3 = require('web3')
var fs = require('fs')
var founder = process.argv.slice(2)
const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/6GO3REaLghR6wPhNJQcc"))
eval(fs.readFileSync('./metronome.js') + '')
eval(fs.readFileSync('./common.js') + '')
/* globals eval, Proceeds, Auctions, AutonomousConverter, METToken, TokenPorter, ChainLedger, Validator  */

const ethContracts = {
  web3: web3,
  proceeds: Proceeds,
  auctions: Auctions,
  autonomousConverter: AutonomousConverter,
  metToken: METToken,
  tokenPorter: TokenPorter,
  chainLedger: ChainLedger,
  validator: Validator,
  tokenLocker: TokenLocker
}

console.log('Founder address = ', founder[0])
var lockerAddress = ethContracts.auctions.tokenLockers(founder)
var locker = ethContracts.tokenLocker.at(lockerAddress)
console.log('tokenLocker contract address of this founder =', lockerAddress)
var metBalanceInLocker = (locker.deposited()).valueOf()
console.log('deposited =', metBalanceInLocker)
var owner = locker.owner()
console.log('owner of the contract =', owner)
var lastWithdrawTime = (locker.lastWithdrawTime()).valueOf()

// for (var i = 0; i < 60; i++) {
//   var founderAddress = ethContracts.auctions.founders(i)
//   var locker = ethContracts.tokenLocker.at(ethContracts.auctions.tokenLockers(founderAddress))
//   console.log('founderAddress=', founderAddress)
//   var metBalanceInLocker = (locker.deposited()).valueOf()
//   console.log('deposited=', metBalanceInLocker)
// }
