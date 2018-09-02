
function parseConfig (input) {
  try {
    return JSON.parse(input)
  } catch (e) {
    console.log('ERROR: Configuration file [config.json] is not a valid JSON!\n')
    process.exit(0)
  }
}

function parseMetronome (input) {
  let chains = []
  for (let i = 0; i < input.length; i++) {
    chains[i] = parseContracts(input[i])
  }
  return chains
}

function parseContracts (input) {
  try {
    // var proceeds = inputData.slice((inputData.indexOf('var Proceeds = ') + 'var Proceeds = '.length), inputData.indexOf(');') + 1)
    var contracts = {}
    while (input.includes('var')) {
      let contractName = fetchContactName(input)
      let contractString = fetchContractString(input)

      let contractObj = {}
      contractObj['abi'] = fetchAbi(contractString)
      contractObj['address'] = fetchAddress(contractString)
      contracts[contractName] = contractObj

      input = input.replace(contractString, '')
    }

    return contracts
  } catch (e) {
    console.log('ERROR: error while processing contents of metronome.js')
    process.exit(0)
  }
}

function fetchContactName (input) {
  return fetchSubString(input, 'var', '=').trim()
}

function fetchContractString (input) {
  return input.slice(0, input.indexOf(';') + 1)
}

function fetchAbi (input) {
  var startSubString = 'web3.eth.contract('
  var endSubString = ').at("'
  return fetchSubString(input, startSubString, endSubString)
}

function fetchAddress (input) {
  var startSubString = '.at("'
  var endSubString = '")'
  return fetchSubString(input, startSubString, endSubString)
}

function fetchSubString (input, startSubString, endSubString) {
  return input.slice((input.indexOf(startSubString) + startSubString.length), input.indexOf(endSubString))
}

module.exports = {parseConfig, parseContracts, parseMetronome}
