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

/* globals OWNER_ADDRESS */
/* globals Auctions, AutonomousConverter, METToken, TokenPorter, Validator, Validator */

function test () {
  console.log('verifying post deployment. Smoke test')

  console.log('checking ownership..')
  var error = false
  if (METToken.owner() !== OWNER_ADDRESS) {
    console.log('Error: Ownership of MET token is wrong. It should be ', METToken.owner())
    error = true
  }

  if (Auctions.owner() !== OWNER_ADDRESS) {
    console.log('Error: Ownership of Auctions contract is wrong. It should be ')
    error = true
  }

  if (Validator.owner() !== OWNER_ADDRESS) {
    console.log('Error: Ownership of Validator contract is wrong. It should be ')
    error = true
  }

  if (TokenPorter.owner() !== OWNER_ADDRESS) {
    console.log('Error: Ownership of TokenPorter contract is wrong. It should be ')
    error = true
  }

  if (error) {
    console.log('Error: Ownership of some contract is wrong. Please check message above')
  } else {
    console.log('Ownership verified. Looks ok')
  }
  var expectedGenesisTime = 1529280060
  var expectedISAEndTime = 1529883999
  error = false
  if (Auctions.genesisTime() !== expectedGenesisTime) {
    console.log('Error: Genesis time is not correct. ')
    error = true
  }

  if (Auctions.initialAuctionEndTime() !== expectedISAEndTime) {
    console.log('Error:  initialAuctionEndTime is not correct. ')
    error = true
  }

  if (!error) {
    console.log('Genesis time or ISA end time looks fine')
  }
  error = false

  if (Validator.getValidatorsCount() < 3) {
    console.log('Error:  Validator count must be >= 3. ')
  }

  console.log('verifying cross contract references')

  if (AutonomousConverter.auctions() !== Auctions.address) {
    console.log('Error:  Auction address in AC wrong. ')
    error = true
  }

  if (AutonomousConverter.reserveToken() !== METToken.address) {
    console.log('Error:  Auction address in AC wrong. ')
    error = true
  }

  if (METToken.autonomousConverter() !== AutonomousConverter.address) {
    console.log('Error:  Auction address in AC wrong. ')
    error = true
  }

  if (METToken.minter() !== Auctions.address) {
    console.log('Error:  Auction address in AC wrong. ')
    error = true
  }

  if (METToken.minter() !== Auctions.address) {
    console.log('Error:  Auction address in METToken wrong. ')
    error = true
  }

  if (METToken.tokenPorter() !== TokenPorter.address) {
    console.log('Error:  TokenPorter address in METToken wrong. ')
    error = true
  }

  if (METToken.tokenPorter() !== TokenPorter.address) {
    console.log('Error:  TokenPorter address in METToken wrong. ')
    error = true
  }

  if (TokenPorter.token() !== METToken.address) {
    console.log('Error:  METToken address in TokenPorter wrong. ')
    error = true
  }

  if (TokenPorter.validator() !== Validator.address) {
    console.log('Error:  Validator address in TokenPorter wrong. ')
    error = true
  }

  if (Validator.tokenPorter() !== TokenPorter.address) {
    console.log('Error:  TokenPorter address in Validator wrong. ')
    error = true
  }

  if (Validator.token() !== METToken.address) {
    console.log('Error:  METToken address in Validator wrong. ')
    error = true
  }

  if (Validator.auctions() !== Auctions.address) {
    console.log('Error:  Auctions address in Validator wrong. ')
    error = true
  }

  if (error) {
    console.log('Error: Cross contract reference error')
  } else {
    console.log('Looks ok.')
  }

  if (!METToken.transferAllowed()) {
    console.log('Error: MET transfer is not enabled yet')
  } else {
    console.log('MET transfer enabled')
  }
}

test()
