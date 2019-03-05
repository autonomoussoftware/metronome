const program = require('commander')
var shell = require('shelljs')
var contractsList = ['Proceeds', 'Auctions', 'AutonomousConverter', 'SmartToken', 'METToken', 'TokenPorter', 'Validator']
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
  const _ = require('./qtum-contracts.js')
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

  tx = await contracts.TokenPorter.send('setExportFeePerTenThousand', [100])
  await tx.confirm(1)

  tx = await contracts.TokenPorter.send('setMinimumExportFee', [1e12])
  await tx.confirm(1)

  console.log('\nConfiguring Validator')
  // Todo: initValidator will take address of off-chain validators
  tx = await contracts.Validator.send('initValidator', [contracts.METToken.info.address, contracts.Auctions.info.address, contracts.TokenPorter.info.address])
  await tx.confirm(1)

  // Todo: add validators
  // Todo: change ownership
  console.log('Deployment Phase 1 Completed')
}

async function launchContracts () {
  console.log('Launching metronome in qtum')
  console.log('\nInitializing AutonomousConverter Contract')
  var tx = await contracts.AutonomousConverter.send('init', [contracts.METToken.info.address, contracts.SmartToken.info.address, contracts.Auctions.info.address])
  await tx.confirm(1)

  console.log('\nInitializing Proceeds')
  tx = await contracts.Proceeds.send('initProceeds', [contracts.AutonomousConverter.info.address, contracts.Auctions.info.address])
  await tx.confirm(1)

  console.log('\nInitializing Auctions')
  var qtum = '0x7174756d'
  var START = 1529280060
  var ISA_ENDTIME = 1529883999
  var MINPRICE = 3300000000000 // Same as current min price in eth chain
  var PRICE = 2 // start price for first daily auction. This may be average start price at eth chain
  var TIMESCALE = 1 // hard coded
  console.log('Initialized auctions', (await contracts.Auctions.call('initialized')).outputs[0])
  tx = await contracts.Auctions.send('skipInitBecauseIAmNotOg', [contracts.METToken.info.address, contracts.Proceeds.info.address, START, MINPRICE, PRICE, TIMESCALE, qtum, ISA_ENDTIME], {gasLimit: 5000000})
  await tx.confirm(1)
  console.log('Initialized auctions', (await contracts.Auctions.call('initialized')).outputs[0])
  console.log('Enabling MET transfer', (await contracts.METToken.call('transferAllowed')).outputs[0])
  tx = await contracts.METToken.send('enableMETTransfers')
  await tx.confirm(1)
  console.log('Enabled', (await contracts.METToken.call('transferAllowed')).outputs[0])
}

init()
