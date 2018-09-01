
function parseConfig (configStr) {
  try {
    return JSON.parse(configStr)
  } catch (e) {
    console.log('ERROR: Configuration file [config.json] is not a valid JSON!\n')
    process.exit(0)
  }
}

function parseMetronomeContractString (inputData) {
  try {
    // var proceeds = inputData.slice((inputData.indexOf('var Proceeds = ') + 'var Proceeds = '.length), inputData.indexOf(');') + 1)
    var startSubString = 'var Proceeds = '
    var endSubString = ';'
    var proceeds = fetchSubString(inputData, startSubString, endSubString)
    var proceedsABI = fetchABISubString(proceeds)
    var proceedAddress = fetchAddressSubString(proceeds)
    var contracts = {}
    var contractObj = {}
    contractObj['abi'] = proceedsABI
    contractObj['address'] = proceedAddress
    contracts['proceeds'] = contractObj
 
    inputData = inputData.replace(startSubString + proceeds + endSubString, '')
    startSubString = 'var Auctions = '
    var auctions = fetchSubString(inputData, startSubString, endSubString)
    inputData = inputData.replace(startSubString + auctions + endSubString, '')
    var auctionsABI = fetchABISubString(auctions)
    var auctionsAddress = fetchAddressSubString(auctions)
    contractObj = {}
    contractObj['abi'] = auctionsABI
    contractObj['address'] = auctionsAddress
    contracts['auctions'] = contractObj

    inputData = inputData.replace(startSubString + auctions + endSubString, '')
    startSubString = 'var AutonomousConverter = '
    var ac = fetchSubString(inputData, startSubString, endSubString)
    inputData = inputData.replace(startSubString + ac + endSubString, '')
    var acABI = fetchABISubString(ac)
    var acAddress = fetchAddressSubString(ac)
    contractObj = {}
    contractObj['abi'] = acABI
    contractObj['address'] = acAddress
    contracts['ac'] = contractObj

    inputData = inputData.replace(startSubString + ac + endSubString, '')
    startSubString = 'var SmartToken = '
    var smartToken = fetchSubString(inputData, startSubString, endSubString)
    inputData = inputData.replace(startSubString + smartToken + endSubString, '')
    var smartTokenABI = fetchABISubString(smartToken)
    var smartTokenAddress = fetchAddressSubString(smartToken)
    contractObj = {}
    contractObj['abi'] = smartTokenABI
    contractObj['address'] = smartTokenAddress
    contracts['smartToken'] = contractObj

    inputData = inputData.replace(startSubString + smartToken + endSubString, '')
    startSubString = 'var METToken = '
    var metToken = fetchSubString(inputData, startSubString, endSubString)
    inputData = inputData.replace(startSubString + metToken + endSubString, '')
    var metTokenABI = fetchABISubString(metToken)
    var metTokenAddress = fetchAddressSubString(metToken)
    contractObj = {}
    contractObj['abi'] = metTokenABI
    contractObj['address'] = metTokenAddress
    contracts['metToken'] = contractObj

    inputData = inputData.replace(startSubString + metToken + endSubString, '')
    startSubString = 'var TokenPorter = '
    var tokenPorter = fetchSubString(inputData, startSubString, endSubString)
    inputData = inputData.replace(startSubString + tokenPorter + endSubString, '')
    var tokenPorterABI = fetchABISubString(tokenPorter)
    var tokenPorterAddress = fetchAddressSubString(tokenPorter)
    contractObj = {}
    contractObj['abi'] = tokenPorterABI
    contractObj['address'] = tokenPorterAddress
    contracts['tokenPorter'] = contractObj

    inputData = inputData.replace(startSubString + tokenPorter + endSubString, '')
    startSubString = 'var Validator = '
    var validator = fetchSubString(inputData, startSubString, endSubString)
    inputData = inputData.replace(startSubString + validator + endSubString, '')
    var validatorABI = fetchABISubString(validator)
    var validatorAddress = fetchAddressSubString(validator)
    contractObj = {}
    contractObj['abi'] = validatorABI
    contractObj['address'] = validatorAddress
    contracts['validator'] = contractObj

    return contracts
  } catch (e) {
    console.log('ERROR: error while processing metronome.js contents')
    process.exit(0)
  }
}

function fetchABISubString (inputData) {
  var startSubString = 'web3.eth.contract('
  var endSubString = ').at("'
  return fetchSubString(inputData, startSubString, endSubString)
}

function fetchAddressSubString (inputData) {
  var startSubString = '.at("'
  var endSubString = '")'
  return fetchSubString(inputData, startSubString, endSubString)
}

function fetchSubString (inputData, startSubString, endSubString) {
  return inputData.slice((inputData.indexOf(startSubString) + startSubString.length), inputData.indexOf(endSubString))
}

module.exports = {parseConfig, parseMetronomeContractString}
