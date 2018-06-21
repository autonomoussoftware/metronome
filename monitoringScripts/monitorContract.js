const Web3 = require('web3')
var fs = require('fs')
const sesEmail = require('./notification')
const pingService = require('./pingContracts')
const cron = require('cron')
// const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/6GO3REaLghR6wPhNJQcc"))
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'))
eval(fs.readFileSync('./metronome.js') + '')
// const myContract = web3.eth.contract([{"constant":true,"inputs":[],"name":"limitGasPrice","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"maxTokensRaised","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"crowdsaleBalances","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"tokensBought","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"rateTier4","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"rate","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"endTime","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"limitTier2","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"minPurchase","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_endTime","type":"uint256"}],"name":"setEndDate","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[],"name":"unpause","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"weiRaised","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"wallet","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"rateTier2","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[],"name":"checkCompletedCrowdsale","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"paused","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"tokensRaised","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"},{"name":"tokensThisTier","type":"uint256"},{"name":"tierSelected","type":"uint256"},{"name":"_rate","type":"uint256"}],"name":"calculateExcessTokens","outputs":[{"name":"totalTokens","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"startTime","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"goalReached","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":false,"inputs":[],"name":"pause","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"tier1","type":"uint256"},{"name":"tier2","type":"uint256"},{"name":"tier3","type":"uint256"},{"name":"tier4","type":"uint256"}],"name":"setTierRates","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"maxPurchase","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"isRefunding","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"isEnded","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"limitTier3","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[],"name":"claimRefund","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"rateTier3","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"minimumGoal","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[],"name":"buyTokens","outputs":[],"payable":true,"type":"function"},{"constant":true,"inputs":[],"name":"limitTier1","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"hasEnded","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"numberOfTransactions","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"vault","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"token","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"inputs":[{"name":"_wallet","type":"address"},{"name":"_tokenAddress","type":"address"},{"name":"_startTime","type":"uint256"},{"name":"_endTime","type":"uint256"}],"payable":false,"type":"constructor"},{"payable":true,"type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"buyer","type":"address"},{"indexed":false,"name":"value","type":"uint256"},{"indexed":false,"name":"amountOfTokens","type":"uint256"}],"name":"TokenPurchase","type":"event"},{"anonymous":false,"inputs":[],"name":"Finalized","type":"event"},{"anonymous":false,"inputs":[],"name":"Pause","type":"event"},{"anonymous":false,"inputs":[],"name":"Unpause","type":"event"}])

// const crowdsale = myContract.at("0x77b275827eB3cf1792852b128a6DBC7a699BBD91")
/* globals eval, Proceeds, Auctions, AutonomousConverter, METToken, TokenPorter, ChainLedger, Validator  */

const ethContracts = {
  web3: web3,
  proceeds: Proceeds,
  auctions: Auctions,
  autonomousConverter: AutonomousConverter,
  metToken: METToken,
  tokenPorter: TokenPorter,
  chainLedger: ChainLedger,
  validator: Validator
}
// sesEmail.sendEmail('Auction running', messageBody)
var messageBody
// var task = cron.schedule('00 30 11 * * 1-5', function () {
//   messageBody = pingService.checkStatus()
//   console.log(messageBody)
// })

var task
try {
  task = new cron.CronJob({
    cronTime: '0 0 */4 * * *',
    onTick: function () {
      messageBody = pingService.checkStatus()
      console.log(messageBody)
      sesEmail.sendEmail('Auction Report', messageBody)
    },
    start: false,
    runOnInit: false
  })
} catch (err) {
  console.log('cron pattern not valid')
}
console.log('Cront job = ', task)
task.start()
console.log('Cront job status = ', task.running)

// console.log('Listening LogAuctionFundsIn....')
// ethContracts.auctions.LogAuctionFundsIn().watch(function (err, response) {
//   if (err) {
//     console.log(' error', err)
//   } else {
//     console.log('New purchase : Transaciton type', response.type)
//     console.log('Amount', (response.args.amount).valueOf())
//     console.log('Buyer address', response.args.sender)
//     // sesEmail.sendEmail('New purchase done', response + '')
//   }
// })
