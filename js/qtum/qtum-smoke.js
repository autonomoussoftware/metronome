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

async function test () {
  console.log('verifying post deployment. Smoke test')
  var expectedGenesisTime = '1529280060'
  var expectedISAEndTime = '1529883999'
  var error = false
  var output = (await contracts.Auctions.call('genesisTime')).outputs[0].toString()
  console.log(output)
  if (output !== expectedGenesisTime) {
    console.log('Error: Genesis time is not correct. Actual: ' + output + ' expected ' + expectedGenesisTime)
    error = true
  }
  output = (await contracts.Auctions.call('initialAuctionEndTime')).outputs[0].toString()
  if (output !== expectedISAEndTime) {
    console.log('Error:  initialAuctionEndTime is not correct. ' + output + ' expected ' + expectedISAEndTime)
    error = true
  }

  if (!error) {
    console.log('Genesis time or ISA end time looks fine')
  }
  error = false
  output = (await contracts.Validator.call('getValidatorsCount')).outputs[0]
  if (output < 3) {
    console.log('Error:  Validator count must be >= 3. ', output)
  }

  console.log('verifying cross contract references')
  output = (await contracts.AutonomousConverter.call('auctions')).outputs[0]
  if (output !== contracts.Auctions.info.address) {
    console.log('Error:  Auction address in AC wrong. ' + output + ' expected ' + contracts.Auctions.info.address)
    error = true
  }

  output = (await contracts.AutonomousConverter.call('reserveToken')).outputs[0]
  if (output !== contracts.METToken.info.address) {
    console.log('Error:  Auction address in AC wrong. ' + output + ' expected ' + contracts.METToken.info.address)
    error = true
  }

  output = (await contracts.METToken.call('autonomousConverter')).outputs[0]
  if (output !== contracts.AutonomousConverter.info.address) {
    console.log('Error:  Auction address in AC wrong. ' + output + ' expected ' + contracts.AutonomousConverter.info.address)
    error = true
  }

  output = (await contracts.METToken.call('minter')).outputs[0]
  if (output !== contracts.Auctions.info.address) {
    console.log('Error:  Auction address in MET wrong. ' + output + ' expected ' + contracts.Auctions.info.address)
    error = true
  }

  output = (await contracts.METToken.call('tokenPorter')).outputs[0]
  if (output !== contracts.TokenPorter.info.address) {
    console.log('Error:  TokenPorter address in MET wrong. ' + output + ' expected ' + contracts.TokenPorter.info.address)
    error = true
  }

  output = (await contracts.TokenPorter.call('token')).outputs[0]
  if (output !== contracts.METToken.info.address) {
    console.log('Error:  METToken address in TokenPorter wrong. ' + output + ' expected ' + contracts.METToken.info.address)
    error = true
  }

  output = (await contracts.TokenPorter.call('validator')).outputs[0]
  if (output !== contracts.Validator.info.address) {
    console.log('Error:  Validator address in TokenPorter wrong. ' + output + ' expected ' + contracts.Validator.info.address)
    error = true
  }

  output = (await contracts.Validator.call('tokenPorter')).outputs[0]
  if (output !== contracts.TokenPorter.info.address) {
    console.log('Error:  TokenPorter address in Validator wrong. ' + output + ' expected ' + contracts.TokenPorter.info.address)
    error = true
  }

  output = (await contracts.Validator.call('token')).outputs[0]
  if (output !== contracts.METToken.info.address) {
    console.log('Error:  METToken address in Validator wrong. ' + output + ' expected ' + contracts.METToken.info.address)
    error = true
  }

  output = (await contracts.Validator.call('auctions')).outputs[0]
  if (output !== contracts.Auctions.info.address) {
    console.log('Error:  Auctions address in Validator wrong. ' + output + ' expected ' + contracts.Auctions.info.address)
    error = true
  }

  if (error) {
    console.log('Error: Cross contract reference error')
  } else {
    console.log('Looks ok.')
  }

  output = (await contracts.METToken.call('transferAllowed')).outputs[0]
  if (!output) {
    console.log('Error: MET transfer is not enabled yet')
  } else {
    console.log('MET transfer enabled')
  }
}

module.exports = { test }
