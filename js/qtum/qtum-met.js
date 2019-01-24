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

const contracts = require('./qtum-contracts.js').getContractInstance()
const program = require('commander')
const process = require('process')

function init () {
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

async function initContracts () {
  try {
    console.log('Configuring metToken')
    var tx = await contracts.METToken.send('initMETToken', [contracts.AutonomousConverter.info.address, contracts.Auctions.info.address, 0, 0])
    await tx.confirm(1)

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
  } catch (e) {
    console.log(e)
  }
}

async function launchContracts () {
  console.log('Launching metronome in qtum')

  // console.log('\nInitializing AutonomousConverter Contract')
  // var tx = await contracts.AutonomousConverter.send('init', [contracts.METToken.info.address, contracts.SmartToken.info.address, contracts.Auctions.info.address])
  // await tx.confirm(1)

  // console.log('\nInitializing Proceeds')
  // tx = await contracts.Proceeds.send('initProceeds', [contracts.AutonomousConverter.info.address, contracts.Auctions.info.address])
  // await tx.confirm(1)

  // console.log('\nInitializing Auctions')
  // var qtum = '0x7174756d'
  // var START = 1529280060
  // var ISA_ENDTIME = 1529883999
  // var MINPRICE = 3300000000000 // Same as current min price in eth chain
  // var PRICE = 2 // start price for first daily auction. This may be average start price at eth chain
  // var TIMESCALE = 1 // hard coded
  // console.log('Initialized auctions', (await contracts.Auctions.call('initialized')).outputs[0])
  // tx = await contracts.Auctions.send('skipInitBecauseIAmNotOg', [contracts.METToken.info.address, contracts.Proceeds.info.address, START, MINPRICE, PRICE, TIMESCALE, qtum, ISA_ENDTIME], {gasLimit: 5000000})
  // await tx.confirm(1)
  var isa =  (await contracts.Auctions.call('initialAuctionEndTime')).outputs[0]
  console.log('ISA end time', isa.toString())
  var tx = await contracts.Auctions.call('isInitialAuctionEnded')
  console.log(tx.outputs[0])
  tx = await contracts.Auctions.call('whatisnow')
  console.log(tx.outputs[0].toString())
  console.log('Initialized auctions', (await contracts.Auctions.call('initialized')).outputs[0])
  console.log('Enabling MET transfer', (await contracts.METToken.call('transferAllowed')).outputs[0])
  tx = await contracts.METToken.send('enableMETTransfers')
  await tx.confirm(1)
  console.log('Enabled', (await contracts.METToken.call('transferAllowed')).outputs[0])
}
// Todo: use sender address from env
// Todo: ownership transfer and acceptance
// Todo: unlock account
// Todo: block.timestamp and now always return 0 . Check latest version
init()
