const { Qtum } = require('qtumjs')
const Web3 = require('web3')
var config = require('config')
const confirmCount = 1

async function deploy (wallet, bin, opts = { 'gasLimit': 5000000 }) {
  var tx = await wallet.contractCreate(bin, opts)
  console.log('tx submitted to node', tx.id)
  return confirm(wallet, tx.id)
}

async function contractSend (wallet, abi, address, methodName, params, _options = {}) {
  const contractsRepo = { contracts: { '': { abi, address } } }
  const qtum = new Qtum('', contractsRepo)
  const contract = qtum.contract('')
  var options = { gasLimit: 1000000 }
  if (_options.gas) {
    delete Object.assign(options, _options, { gasLimit: _options['gas'] })['gas']
  }
  options = Object.assign(options, _options)
  return wallet.contractSend(contract.info.address, encodeData(contract, methodName, params), options)
}

async function contractCall (wallet, abi, address, methodName, params, _options = {}) {
  console.log(params)
  const contractsRepo = { contracts: { '': { abi, address } } }
  const qtum = new Qtum('', contractsRepo)
  const contract = qtum.contract('')
  var response = await wallet.contractCall(address, encodeData(contract, methodName, params))
  var methodAbi = contract.methodMap.findMethod(methodName, params)
  var web3 = new Web3()
  response = web3.eth.abi.decodeParameters(methodAbi.outputs, response.executionResult.output)
  if (response.__length__ === 0) {
    return null
  } else if (response.__length__ === 1) {
    return response['0']
  }
  return response
}

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

const encodeData = (contract, methodName, params) => {
  var methodAbi = contract.methodMap.findMethod(methodName, params)
  var web3 = new Web3()
  var encodedData = web3.eth.abi.encodeFunctionCall(methodAbi, params)
  return encodedData.replace('0x', '')
}

const confirm = async (wallet, txid, count = 1) => {
  console.log('waiting for confirmation', txid)
  await sleep(45000)
  while (true) {
    var txinfo = await wallet.getTransactionInfo(txid)
    if (!txinfo) {
      return 'can not fetch tx information'
    }
    if (txinfo.confirmations >= count) {
      console.log('Tx confirmed. Contract address', txinfo.outputs[0].address)
      return txinfo
    }
    await sleep(30000)
  }
}

module.exports = { deploy, contractSend, contractCall, confirm }
