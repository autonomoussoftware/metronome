/*
    The MIT License (MIT)

    Copyright 2017 - 2018, Alchemy Limited, LLC.

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
const Web3 = require('web3')
const camelCase = require('camelcase')

class Chain {
  /**
   * @desc Metronome off chain validator.
   * @param configuration - contains owner address for validator, passord and URL ( with port)
   *  of blockchain node i.e. http://host:port
   * @param {object} contracts
   */
  constructor (configuration, contracts = {}) {
    this.nodeUrl = configuration.nodeUrl
    this.name = configuration.chainName
    this.configuration = configuration
    this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl))
    this.createContractObj(contracts)
  }

  createContractObj (_contracts) {
    this.contracts = {}
    for (var name in _contracts) {
      let contractName = camelCase(name)
      let contract = this.web3.eth
        .contract(JSON.parse(_contracts[name].abi))
        .at(_contracts[name].address)
      this.contracts[contractName] = contract
    }
  }
}
module.exports = Chain
