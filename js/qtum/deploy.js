const program = require('commander')
var config = require('config')
var qwallet = require('qtumjs-wallet')
require('dotenv').config()
const compiler = require('./compiler.js')
const provider = require('./provider.js')
const fs = require('fs')
var contractsList = ['Proposals', 'Proceeds', 'Auctions', 'AutonomousConverter', 'SmartToken', 'METToken', 'TokenPorter', 'Validator']
var contracts
function init () {
  program
    .command('deploy')
    .description('Launch Metronome in qtum')
    .action(deploy)
  program
    .command('compile')
    .description('Launch Metronome in qtum')
    .action(compile)
  program
    .command('init')
    .description('Launch Metronome in qtum')
    .action(initContracts)
  program
    .command('launch')
    .description('Launch Metronome in qtum')
    .action(launchContracts)
  program.parse(process.argv)
}

async function compile () {
  console.log('Compile qtum contracts')
  let path = './contracts'
  for (let contract of contractsList) {
    await compiler.compile(`${path}/${contract}.sol`, contract)
  }
}

async function deploy () {
  console.log('Deploying qtum contracts')
  let network = qwallet.networks[config.network]
  let wallet = network.fromMnemonic(config.walletMnemonic)
  let path = './build/qtum'
  var contracts = {}
  for (let name of contractsList) {
    console.log(`Deploying ${name} contract`)
    let contract = JSON.parse(fs.readFileSync(`${path}/compiled/${name}.json`)).contracts
    contract = contract[`./contracts/${name}.sol:${name}`]
    let tx = await provider.deploy(wallet, contract.bin)
    if (tx.outputs[0].receipt.excepted !== 'None') {
      console.log('Contract deployment failed', tx)
      return
    }
    contract.tx = tx.id
    contract.address = tx.outputs[0].address
    fs.writeFileSync(`${path}/deployed/${name}.json`, JSON.stringify(contract), 'utf8')
    contracts[name] = contract
  }
}

async function initContracts () {
  let network = qwallet.networks[config.network]
  let wallet = network.fromMnemonic(config.walletMnemonic)
  console.log('Configuring metToken')
  var { metToken, acc, auctions, tokenPorter, smartToken, validator, proposals } = getContractObjects()
  var output = await provider.contractCall(wallet, JSON.parse(metToken.abi), metToken.address, 'autonomousConverter', [])
  console.log('output', output)
  var tx = await provider.contractSend(wallet, JSON.parse(metToken.abi), metToken.address, 'initMETToken', [acc.address, auctions.address, 0, 0])
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)
  output = await provider.contractCall(wallet, JSON.parse(metToken.abi), metToken.address, 'autonomousConverter', [])
  console.log('output', output)

  tx = await provider.contractSend(wallet, JSON.parse(metToken.abi), metToken.address, 'setTokenPorter', [tokenPorter.address])
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)
  output = await provider.contractCall(wallet, JSON.parse(metToken.abi), metToken.address, 'tokenPorter', [])
  console.log('output', output)

  console.log('Configuring Smart Token')
  tx = await provider.contractSend(wallet, JSON.parse(smartToken.abi), smartToken.address, 'initSmartToken', [acc.address, acc.address, 2])
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)

  console.log('\nConfiguring TokenPorter')
  tx = await provider.contractSend(wallet, JSON.parse(tokenPorter.abi), tokenPorter.address, 'initTokenPorter', [metToken.address, auctions.address])
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)

  tx = await provider.contractSend(wallet, JSON.parse(tokenPorter.abi), tokenPorter.address, 'setValidator', [validator.address])
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)

  console.log('\nConfiguring Validator')
  tx = await provider.contractSend(wallet, JSON.parse(validator.abi), validator.address, 'initValidator', [metToken.address, auctions.address, tokenPorter.address])
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)

  tx = await provider.contractSend(wallet, JSON.parse(validator.abi), validator.address, 'setProposalContract', [proposals.address])
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)

  for (let val of config.qtum.validators) {
    console.log('adding validator', val)
    tx = await provider.contractSend(wallet, JSON.parse(validator.abi), validator.address, 'addValidator', [val])
    console.log('tx', tx)
    await provider.confirm(wallet, tx.id, 1)
  }

  console.log('\nConfiguring Proposal contract')
  tx = await provider.contractSend(wallet, JSON.parse(proposals.abi), proposals.address, 'setValidator', [validator.address])
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)

  // Todo: add validators
  // Todo: change ownership
  console.log('Deployment Phase 1 Completed')
}

async function launchContracts () {
  let network = qwallet.networks[config.network]
  let wallet = network.fromMnemonic(config.walletMnemonic)
  var { metToken, acc, auctions, tokenPorter, smartToken, validator, proposals, proceeds } = getContractObjects()
  var tx, output
  var ethHex = '0x455448'
  tx = await provider.contractSend(wallet, JSON.parse(tokenPorter.abi), tokenPorter.address, 'addDestinationChain', [ethHex, config.qtum.destinationChain.eth])
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)
  output = await provider.contractCall(wallet, JSON.parse(tokenPorter.abi), tokenPorter.address, 'destinationChains', [ethHex])
  console.log('output', output)

  var etcHex = '0x455443'
  tx = await provider.contractSend(wallet, JSON.parse(tokenPorter.abi), tokenPorter.address, 'addDestinationChain', [etcHex, config.qtum.destinationChain.etc])
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)
  output = await provider.contractCall(wallet, JSON.parse(tokenPorter.abi), tokenPorter.address, 'destinationChains', [etcHex])
  console.log('output', output)
  var chainHopStartTime = Math.floor((new Date().getTime()) / 1000) + (60 * 5)
  tx = await provider.contractSend(wallet, JSON.parse(tokenPorter.abi), tokenPorter.address, 'setChainHopStartTime', [chainHopStartTime])
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)

  console.log('\nInitializing AutonomousConverter Contract')
  tx = await provider.contractSend(wallet, JSON.parse(acc.abi), acc.address, 'init', [metToken.address, smartToken.address, auctions.address], {amount: 100000000})
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)

  tx = await provider.contractSend(wallet, JSON.parse(proceeds.abi), proceeds.address, 'initProceeds', [acc.address, auctions.address])
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)

  console.log('\nInitializing Auctions')
  var qtum = '0x7174756d'
  var MINPRICE = 3300000000000 // Same as current min price in eth chain
  var PRICE = 2 // start price for first daily auction. This may be average start price at eth chain
  var TIMESCALE = 1 // hard coded
  tx = await provider.contractSend(wallet, JSON.parse(auctions.abi), auctions.address, 'skipInitBecauseIAmNotOg', [metToken.address, proceeds.address, config.genesisTime, MINPRICE, PRICE, TIMESCALE, qtum, config.isa_endtime])
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)
  output = await provider.contractCall(wallet, JSON.parse(auctions.abi), auctions.address, 'genesisTime', [])
  console.log('genesisTime', output)
  output = await provider.contractCall(wallet, JSON.parse(auctions.abi), auctions.address, 'initialized', [])
  console.log('initialized', output)

  tx = await provider.contractSend(wallet, JSON.parse(metToken.abi), metToken.address, 'enableMETTransfers', [])
  console.log('tx', tx)
  await provider.confirm(wallet, tx.id, 1)
  output = await provider.contractCall(wallet, JSON.parse(metToken.abi), metToken.address, 'transferAllowed', [])
  console.log('Enabled', output)
}

function getContractObjects () {
  let path = './build/qtum/deployed'
  return {
    metToken: JSON.parse(fs.readFileSync(`${path}/METToken.json`)),
    auctions: JSON.parse(fs.readFileSync(`${path}/Auctions.json`)),
    acc: JSON.parse(fs.readFileSync(`${path}/AutonomousConverter.json`)),
    tokenPorter: JSON.parse(fs.readFileSync(`${path}/TokenPorter.json`)),
    proceeds: JSON.parse(fs.readFileSync(`${path}/Proceeds.json`)),
    smartToken: JSON.parse(fs.readFileSync(`${path}/SmartToken.json`)),
    validator: JSON.parse(fs.readFileSync(`${path}/Validator.json`)),
    proposals: JSON.parse(fs.readFileSync(`${path}/Proposals.json`))
  }
}

init()
