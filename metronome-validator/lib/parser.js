
function parseConfig (input) {
  try {
    return JSON.parse(input)
  } catch (e) {
    console.log('ERROR: Configuration file [config.json] is not a valid JSON!\n')
    process.exit(0)
  }
}

function parseMetronome (input) {
  let metronome = {}
  for (var chain in input) {
    metronome[chain] = parseContracts(input[chain])
  }
  return metronome
}

function parseContracts (input) {
  try {
    // var proceeds = inputData.slice((inputData.indexOf('var Proceeds = ') + 'var Proceeds = '.length), inputData.indexOf(');') + 1)
    var contracts = {}
    while (input.includes('var')) {
      let contractName = fetchContactName(input)
      let contractString = fetchContractString(input)

      let contract = {}
      contract['abi'] = fetchAbi(contractString)
      contract['address'] = fetchAddress(contractString)
      contracts[contractName] = contract

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
