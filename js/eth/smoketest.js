const Web3 = require('web3')
var config = require('config')
const fs = require('fs')

async function test (chain) {
  var contracts = JSON.parse(fs.readFileSync('./build/' + chain + '/contracts.json'))
  console.log(config[chain].nodeURL)
  var web3 = new Web3(new Web3.providers.HttpProvider(config[chain].nodeURL))
  var validator = new web3.eth.Contract(JSON.parse(contracts.Validator.abi), contracts.Validator.address)

  if (await validator.methods.getValidatorsCount().call() < 3) {
    console.log('Error:  Validator count must be >= 3. ')
  }

  if (await validator.methods.tokenPorter().call() !== contracts.TokenPorter.address) {
    console.log('Error:  TokenPorter address in Validator wrong. ')
  }

  if (await validator.methods.token().call() !== config[chain].METToken) {
    console.log('Error:  METToken address in Validator wrong. ')
  }

  if (await validator.methods.auctions().call() !== config[chain].Auctions) {
    console.log('Error:  Auctions address in Validator wrong. ')
  }

  console.log('#######verifying cross contract references#######################')

  var tokenPorter = new web3.eth.Contract(JSON.parse(contracts.TokenPorter.abi), contracts.TokenPorter.address)

  if (await tokenPorter.methods.token().call() !== config[chain].METToken) {
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

test('eth')
