const Web3 = require('web3')

/**
 * Class reprensenting a Metronome Validator for off chain validations
 * @namespace MetronomeValidator
 */
class Validator {
  /**
     * @desc Metronome off chain validator.
     * @param configuration - contains owner address for validator, passord and URL ( with port)
     *  of blockchain node i.e. http://host:port
     * @param {Object} contracts
     */
  constructor (configuration, contracts = {}) {
    this.configuration = configuration
    this.web3 = new Web3(new Web3.providers.HttpProvider(configuration.url))
    this.auctionContract = this.web3.eth.contract(JSON.parse(contracts.Auctions.abi)).at(contracts.Auctions.address)
  }

  getFounder (index) {
    return this.auctionContract.founders(index)
  }
}

module.exports = Validator
