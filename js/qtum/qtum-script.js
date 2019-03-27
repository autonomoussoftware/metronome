const contractjs = require('./qtum-contracts.js')
require('dotenv').config()
const contracts = contractjs.getContractInstance()
const program = require('commander')
const process = require('process')
const Web3 = require('web3')

function init () {
  program
    .command('getLogs')
    .description('Get past logs')
    .action(getLogs)
  program
    .command('info')
    .description('Contract info')
    .action(info)
  program
    .command('web3')
    .description('web3')
    .action(web3)
  program
    .command('watch')
    .description('watch')
    .action(watch)
  program
    .command('listValidators')
    .description('listValidators')
    .action(listValidators)
  program
    .command('addValidator <address>')
    .description('addValidator')
    .action(function (address) {
      addValidator(address)
    })
  program
    .command('removeValidator <address>')
    .description('addValidator')
    .action(function (address) {
      removeValidator(address)
    })
  program
    .command('isValidator <address>')
    .description('isValidator')
    .action(function (address) {
      isValidator(address)
    })
  program.parse(process.argv)
}
async function web3 () {
  let web3 = new Web3(new Web3.providers.HttpProvider('http://qtum:test@localhost:3889'))
  console.log('web3 provider connected', web3._provider.connected)
  let Auctions = new web3.eth.Contract(contracts.Auctions.info.abi, contracts.Auctions.info.address)
  console.log('Auctions methods', Auctions.methods.minted())
  let chain = await Auctions.methods.minted().call()
  console.log('chain', chain)
}

async function addValidator (address) {
  console.log('process.env.sender', process.env.sender)
  console.log((await contracts.Validator.call('isValidator', [address])).outputs[0])
  let tx = await contracts.Validator.send('addValidator', [address], {senderAddress: process.env.sender})
  await tx.confirm(1)
  console.log((await contracts.Validator.call('isValidator', [address])).outputs[0])
}

async function removeValidator (address) {
  console.log((await contracts.Validator.call('isValidator', [address])).outputs[0])
  let tx = await contracts.Validator.send('removeValidator', [address], {senderAddress: process.env.sender})
  await tx.confirm(1)
  console.log((await contracts.Validator.call('isValidator', [address])).outputs[0])
}

async function isValidator (address) {
  console.log((await contracts.Validator.call('isValidator', [address])).outputs[0])
}

async function listValidators () {
  console.log('list validators')
  var count = (await contracts.Validator.call('getValidatorsCount')).outputs[0]
  console.log('count', count)
  for (var i = 0; i < count; i++) {
    console.log((await contracts.Validator.call('validators', [i])).outputs[0])
  }
}

async function watch () {
  var emitter1 = contracts.METToken.logEmitter({ minconf: 0 })
  emitter1.on('LogImportRequest', (event) => {
    console.log('1 received event in qtum testEvent1', event)
    // this.processEventData(qtumWrapper.transferQtumEventData(event))
  })
}

async function info () {
  try {
    var burnHash = '0xffc1e6814d4c59b28b11441475cc4a3d276c89f57b16b5c6103a01fc727a19e2'
    var owner = (await contracts.TokenPorter.call('owner')).outputs[0]
    console.log('owner', owner)
    console.log('Auctions address', contracts.Auctions.info.address)
    console.log('MET address', contracts.METToken.info.address)
    console.log('currentTick', (await contracts.Auctions.call('currentTick')).outputs[0].toString())
    console.log('globalMetSupply', (await contracts.Auctions.call('globalMetSupply')).outputs[0].toString())

    console.log('auction running', (await contracts.Auctions.call('isRunning')).outputs[0])
    console.log('auction chain', (await contracts.Auctions.call('chain')).outputs[0])
    console.log('tokenPorter address in MET', (await contracts.METToken.call('tokenPorter')).outputs[0])
    console.log('import sequence', (await contracts.TokenPorter.call('importSequence')).outputs[0].toString())
    console.log('mintHashes', (await contracts.TokenPorter.call('mintHashes', [burnHash])).outputs[0])
    console.log('merkleRoots', (await contracts.TokenPorter.call('merkleRoots', [burnHash])).outputs[0])
    console.log('hashClaimed', (await contracts.Validator.call('hashClaimed', [burnHash])).outputs[0].toString())
    var totalSupply = (await contracts.METToken.call('totalSupply')).outputs[0].toString()
    console.log('totalSupply', totalSupply)
    var mintable = (await contracts.Auctions.call('mintable')).outputs[0].toString()
    console.log('mintable', mintable)
    // burnHash = 4cb17d6154accb7368309773ec68a2fcfb1fabccd142e66f8d821b80b453e0a2
    console.log('Attst count', (await contracts.Validator.call('attestationCount', [burnHash])).outputs[0].toString())
    console.log('getValidatorsCount', (await contracts.Validator.call('getValidatorsCount')).outputs[0].toString())
  } catch (e) {
    console.log(e)
  }
}

async function getLogs (fromBlock = 0, toBlock = 'latest') {
  const pastLogs = await contracts.TokenPorter.logs({fromBlock: 0,
    toBlock: 'latest',
    minconf: 0
  })
  console.log('pastLogs', pastLogs)
  const logs = await contracts.METToken.logs({
    fromBlock,
    toBlock,
    minconf: 0
  })
  console.log(logs)
}

init()
