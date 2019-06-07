const Web3 = require('web3')
var config = require('config')
const fs = require('fs')

async function test (chain) {
  var contracts = JSON.parse(fs.readFileSync('./build/' + chain + '/contracts.json'))
  console.log(config[chain].nodeURL)
  var web3 = new Web3(new Web3.providers.HttpProvider(config[chain].nodeURL))
  var auctions = new web3.eth.Contract(JSON.parse(contracts.Auctions.abi), contracts.Auctions.address)

  var validator = new web3.eth.Contract(JSON.parse(contracts.Validator.abi), contracts.Validator.address)

  if (await validator.methods.getValidatorsCount().call() < 3) {
    console.log('Error:  Validator count must be >= 3. ')
  }

  if (await validator.methods.tokenPorter().call() !== contracts.TokenPorter.address) {
    console.log('Error:  TokenPorter address in Validator wrong. ')
  }

  if (await validator.methods.token().call() !== contracts.METToken.address) {
    console.log('Error:  METToken address in Validator wrong. ')
  }

  if (await validator.methods.auctions().call() !== contracts.Auctions.address) {
    console.log('Error:  Auctions address in Validator wrong. ')
  }

  var expectedGenesisTime = 1529280060
  var expectedISAEndTime = 1529883999
  var actual = await auctions.methods.genesisTime().call()
  if (actual !== expectedGenesisTime) {
    console.log('Error: Genesis time is not correct. Actual=', actual, 'expected =' + expectedGenesisTime)
  }
  console.log(3)
  actual = await auctions.methods.initialAuctionEndTime().call()
  if (actual !== expectedISAEndTime) {
    console.log('Error: Genesis time is not correct. Actual=', actual, 'expected =' + expectedISAEndTime)
  }

  console.log('#######verifying cross contract references#######################')
  var ac = new web3.eth.Contract(JSON.parse(contracts.AutonomousConverter.abi), contracts.AutonomousConverter.address)

  if (await ac.methods.auctions().call() !== contracts.Auctions.address) {
    console.log('Error:  Auction address in AC wrong. ')
  } else {
    console.log('Auction address in AC looks fine.')
  }

  if (await ac.methods.reserveToken().call() !== contracts.METToken.address) {
    console.log('Error:  METToken address in AC wrong. ')
  } else {
    console.log('METToken address in AC looks fine.')
  }

  var metToken = new web3.eth.Contract(JSON.parse(contracts.METToken.abi), contracts.METToken.address)

  if (await metToken.methods.autonomousConverter().call() !== contracts.AutonomousConverter.address) {
    console.log('Error:  AutonomousConverter address in metToken wrong. ')
  } else {
    console.log('AutonomousConverter address in metToken looks fine.')
  }

  if (await metToken.methods.minter().call() !== contracts.Auctions.address) {
    console.log('Error:  Auctions address in metToken wrong. ')
  } else {
    console.log('Auctions address in metToken looks fine.')
  }

  if (await metToken.methods.tokenPorter().call() !== contracts.TokenPorter.address) {
    console.log('Error:  TokenPorter address in metToken wrong. ')
  } else {
    console.log('TokenPorter address in metToken looks fine.')
  }

  var tokenPorter = new web3.eth.Contract(JSON.parse(contracts.TokenPorter.abi), contracts.TokenPorter.address)

  if (await tokenPorter.methods.token().call() !== contracts.METToken.address) {
    console.log('Error:  METToken address in tokenPorter wrong. ')
  } else {
    console.log('METToken address in tokenPorter looks fine.')
  }

  if (await tokenPorter.methods.validator().call() !== contracts.Validator.address) {
    console.log('Error:  Validator address in tokenPorter wrong. ')
  } else {
    console.log('Validator address in tokenPorter fine.')
  }

  console.log('#######verifying validators addresses#############################')
  for (let val of config[chain].validators) {
    if (await validator.methods.isValidator(val).call()) {
      console.log(val, 'added as validator')
    } else {
      console.log('something wrong. this validator still not added', val)
    }
  }
}

test('etc')
