const program = require('commander')
var config = require('config')
require('dotenv').config()
const _ = require('./qtum-contracts.js')
var shell = require('shelljs')
// const Web3 = require('web3')
// var web3 = new Web3()
var contractsList = ['Proposals', 'Proceeds', 'Auctions', 'AutonomousConverter', 'SmartToken', 'METToken', 'TokenPorter', 'Validator']
var contracts
function init () {
  program
    .command('deploy')
    .description('Launch Metronome in qtum')
    .action(deploy)
  program.parse(process.argv)
}

async function deploy () {
  console.log('Deploying qtum contracts')
  let path = './contracts/'
  for (let contract of contractsList) {
    shell.exec('solar deploy ' + path + contract + '.sol --force --gasLimit=5000000 --qtum_sender=' + process.env.sender)
  }
  await initContracts()
  await launchContracts()
  const smoke = require('./qtum-smoke.js')
  await smoke.test()
}

async function initContracts () {
  console.log('Configuring metToken')
  contracts = _.getContractInstance(contractsList)
  var output = (await contracts.METToken.call('autonomousConverter')).outputs[0]
  console.log('output', output)
  var tx = await contracts.METToken.send('initMETToken', [contracts.AutonomousConverter.info.address, contracts.Auctions.info.address, 0, 0])
  await tx.confirm(1)
  output = (await contracts.METToken.call('autonomousConverter')).outputs[0]
  console.log('output', output)

  tx = await contracts.METToken.send('setTokenPorter', [contracts.TokenPorter.info.address])
  await tx.confirm(1)

  console.log('Configuring Smart Token')
  tx = await contracts.SmartToken.send('initSmartToken', [contracts.AutonomousConverter.info.address, contracts.AutonomousConverter.info.address, 2])
  await tx.confirm(1)

  console.log('\nConfiguring TokenPorter')
  tx = await contracts.TokenPorter.send('initTokenPorter', [contracts.METToken.info.address, contracts.Auctions.info.address])
  await tx.confirm(1)

  tx = await contracts.TokenPorter.send('setValidator', [contracts.Validator.info.address])
  await tx.confirm(1)

  console.log('\nConfiguring Validator')
  // Todo: initValidator will take address of off-chain validators
  tx = await contracts.Validator.send('initValidator', [contracts.METToken.info.address, contracts.Auctions.info.address, contracts.TokenPorter.info.address])
  await tx.confirm(1)

  tx = await contracts.Validator.send('setProposalContract', [contracts.Proposals.info.address])
  await tx.confirm(1)

  for (let val of config.qtum.validators) {
    console.log('adding validator', val)
    tx = await contracts.Validator.send('addValidator', [val])
    await tx.confirm(1)
  }

  console.log('\nConfiguring Proposal contract')
  // Todo: initValidator will take address of off-chain validators
  tx = await contracts.Proposals.send('setValidator', [contracts.Validator.info.address])
  await tx.confirm(1)

  // Todo: add validators
  // Todo: change ownership
  console.log('Deployment Phase 1 Completed')
}

async function launchContracts () {
  contracts = _.getContractInstance(contractsList)
  // console.log('genesisTime auctions', (await contracts.Auctions.call('genesisTime')).outputs[0])
  // process.exit(0)
  var ethHex = '0x455448'
  var tx = await contracts.TokenPorter.send('addDestinationChain', [ethHex, config.qtum.destinationChain.eth])
  await tx.confirm(1)
  var destChain = await contracts.TokenPorter.call('destinationChains', [ethHex])
  console.log('ETH destChain', destChain)
  var etcHex = '0x455443'
  tx = await contracts.TokenPorter.send('addDestinationChain', [etcHex, config.qtum.destinationChain.etc])
  await tx.confirm(1)
  destChain = await contracts.TokenPorter.call('destinationChains', [etcHex])
  console.log('ETC destChain', destChain)
  var chainHopStartTime = Math.floor((new Date().getTime()) / 1000) + (60 * 5)
  tx = await contracts.TokenPorter.send('setChainHopStartTime', [chainHopStartTime])
  await tx.confirm(1)
  console.log('\nInitializing AutonomousConverter Contract')
  tx = await contracts.AutonomousConverter.send('init', [contracts.METToken.info.address, contracts.SmartToken.info.address, contracts.Auctions.info.address], {amount: 1})
  await tx.confirm(1)

  console.log('\nInitializing Proceeds')
  tx = await contracts.Proceeds.send('initProceeds', [contracts.AutonomousConverter.info.address, contracts.Auctions.info.address])
  await tx.confirm(1)

  console.log('\nInitializing Auctions')
  var qtum = '0x7174756d'
  var MINPRICE = 3300000000000 // Same as current min price in eth chain
  var PRICE = 2 // start price for first daily auction. This may be average start price at eth chain
  var TIMESCALE = 1 // hard coded
  console.log('genesisTime auctions', (await contracts.Auctions.call('genesisTime')).outputs[0])
  tx = await contracts.Auctions.send('skipInitBecauseIAmNotOg', [contracts.METToken.info.address, contracts.Proceeds.info.address, config.genesisTime, MINPRICE, PRICE, TIMESCALE, qtum, config.isa_endtime], {gasLimit: 5000000})
  await tx.confirm(1)
  console.log('Initialized auctions', (await contracts.Auctions.call('initialized')).outputs[0])
  console.log('Enabling MET transfer', (await contracts.METToken.call('transferAllowed')).outputs[0])
  tx = await contracts.METToken.send('enableMETTransfers')
  await tx.confirm(1)
  console.log('Enabled', (await contracts.METToken.call('transferAllowed')).outputs[0])
}

init()