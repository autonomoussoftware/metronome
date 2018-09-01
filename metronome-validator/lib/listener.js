const Processor = require('./processor')
const Validator = require('./validator')

function listen (configStr, metronome) {
  console.log('listening...', configStr)
  let configuration = Processor.parseConfig(configStr)
  // TODO: parse abi
  console.log('Eth url is ', configuration.ETH.nodeUrl)
}

module.exports = {listen}
