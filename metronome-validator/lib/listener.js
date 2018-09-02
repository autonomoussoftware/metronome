const Parser = require('./processor')
const Validator = require('./validator')

function listen (config, metronome) {
  console.log('listening...', config)
  let configuration = Parser.parseConfig(config)
  let contracts = Parser.parseMetronome(metronome)
  console.log('Eth url is ', configuration.ETH.nodeUrl)
  console.log('Proceeds address', contracts[1].Proceeds.address)
}

module.exports = {listen}
