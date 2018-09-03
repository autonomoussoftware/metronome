const Parser = require('./parser')
const Validator = require('./validator')

function listen (config, metronome) {
  console.log('listening...', config)
  let configuration = Parser.parseConfig(config)
  let metronomeContracts = Parser.parseMetronome(metronome)
  console.log('Eth url is ', configuration.eth.nodeUrl)
  console.log('Proceeds address', metronomeContracts.eth.Proceeds.address)
  // create validator object
  let ethValidator = new Validator(configuration.eth, metronomeContracts.eth)
  let etcValidator = new Validator(configuration.etc, metronomeContracts.etc)
  console.log('Founder', ethValidator.getFounder(0))
}

module.exports = {listen}
