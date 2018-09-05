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
     * @param auctions
     * @param proceeds
     * @param autonomousConverter
     * @param metToken
     * @param tokenPorter
     * @param validator
     */
  constructor (configuration, contracts = {}) {
    this.configuration = configuration
    this.web3 = new Web3(new Web3.providers.HttpProvider(configuration.nodeUrl))
    this.auctions = this.web3.eth.contract(JSON.parse(contracts.Auctions.abi)).at(contracts.Auctions.address)
    this.proceeds = this.web3.eth.contract(JSON.parse(contracts.Proceeds.abi)).at(contracts.Proceeds.address)
    this.autonomousConverter = this.web3.eth.contract(JSON.parse(contracts.AutonomousConverter.abi)).at(contracts.AutonomousConverter.address)
    this.metToken = this.web3.eth.contract(JSON.parse(contracts.METToken.abi)).at(contracts.METToken.address)
    this.tokenPorter = this.web3.eth.contract(JSON.parse(contracts.TokenPorter.abi)).at(contracts.TokenPorter.address)
    this.validator = this.web3.eth.contract(JSON.parse(contracts.Validator.abi)).at(contracts.Validator.address)
  }

  getFounder (index) {
    return this.auctions.founders(index)
  }

  watchImportEvent () {
    console.log('watching event')
    this.tokenPorter.ImportReceiptLog().watch(function (err, response) {
      if (err) {
        console.log('export error', err)
      } else {
        console.log('New import request received', response)
      }
    })
  }

  watchExportEvent () {
    console.log('watching event')
    this.tokenPorter.ExportReceiptLog().watch(function (err, response) {
      if (err) {
        console.log('export error', err)
      } else {
        console.log('reNew export request received', response)
      }
    })
  }
}

module.exports = Validator
