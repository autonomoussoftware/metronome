var Tx = require('ethereumjs-tx')
const Web3 = require('web3')
const ethers = require('ethers')
var config = require('config')
const fs = require('fs')

async function deploy (keystorePath, password) {
  var keystore = fs.readFileSync(keystorePath).toString()
  var wallet = await ethers.Wallet.fromEncryptedJson(keystore, password)
  let list = ['TokenPorter', 'Validator', 'Proposals']
  await deployContracts(wallet, list)
}

async function configureContracts (keystorePath, password) {
  var keystore = fs.readFileSync(keystorePath).toString()
  var wallet = await ethers.Wallet.fromEncryptedJson(keystore, password)
  var contracts = JSON.parse(fs.readFileSync('./build/eth/contracts.json'))
  var chain = 'eth'
  var web3 = new Web3(new Web3.providers.HttpProvider(config[chain].nodeURL))
  const account = web3.eth.accounts.privateKeyToAccount(wallet.signingKey.privateKey)
  web3.eth.accounts.wallet.add(account)
  web3.eth.defaultAccount = account.address
  console.log('\nConfiguring METToken')
  var receipt
  // var metToken = new web3.eth.Contract(JSON.parse(contracts.METToken.abi), contracts.METToken.address)
  // receipt = await metToken.methods.setTokenPorter(contracts.TokenPorter.address).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
  // console.log('setTokenPorter done', receipt.transactionHash)
  // receipt = ''

  console.log('\nConfiguring Token Porter')
  var tokenPorter = new web3.eth.Contract(JSON.parse(contracts.TokenPorter.abi), contracts.TokenPorter.address)
  receipt = await tokenPorter.methods.initTokenPorter(config[chain].METToken, config[chain].Auctions).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
  console.log('initTokenPorter done', receipt.transactionHash)
  receipt = ''
  receipt = await tokenPorter.methods.setValidator(contracts.Validator.address).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
  console.log('setValidator done', receipt.transactionHash)
  receipt = ''

  console.log('\nConfiguring Validator')
  var validator = new web3.eth.Contract(JSON.parse(contracts.Validator.abi), contracts.Validator.address)
  receipt = await validator.methods.initValidator(config[chain].METToken, config[chain].Auctions, contracts.TokenPorter.address).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
  console.log('initValidator done', receipt.transactionHash)
  receipt = ''
  receipt = await validator.methods.setProposalContract(contracts.Proposals.address).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
  console.log('setProposalContract done', receipt.transactionHash)
  receipt = ''

  for (let val of config[chain].validators) {
    console.log('validator', val)
    receipt = await validator.methods.addValidator(val).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
    console.log('added validator', receipt.transactionHash, val)
    console.log('isValidator', await validator.methods.isValidator(val).call())
    receipt = ''
  }
  // Todo: initValidator will take address of off-chain validators
  console.log('\nConfiguring Proposals')
  var proposals = new web3.eth.Contract(JSON.parse(contracts.Proposals.abi), contracts.Proposals.address)
  receipt = await proposals.methods.setValidator(contracts.Validator.address).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
  console.log('setValidator done', receipt.transactionHash)
}

async function deployContracts (wallet, list) {
  var chain = 'eth'
  var web3 = new Web3(new Web3.providers.HttpProvider(config[chain].nodeURL))
  var contractsJson = require('../../build/' + chain + '/output.json').contracts
  var nonce = await web3.eth.getTransactionCount(wallet.address, 'pending')
  var contracts = {}
  for (let contractName of list) {
    console.log('deploying contract - ', contractName, ' nonce=' + nonce)
    var rawTx = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(config[chain].gasPrice),
      gasLimit: web3.utils.toHex('6702388'),
      chainId: web3.utils.toHex(config[chain].chainId)
    }
    var temp = contractsJson['./contracts/monolithic.sol:' + contractName]
    rawTx.data = '0x' + temp.bin
    var tx = new Tx(rawTx)
    tx.sign(Buffer.from(wallet.signingKey.privateKey.slice(2), 'hex'))
    var serializedTx = tx.serialize()
    var receipt = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
    try {
      nonce = await web3.eth.getTransactionCount(wallet.address, 'pending')
    } catch (e) {
      console.log('increamenting nonce')
      nonce = nonce + 1
    }
    if (!receipt.contractAddress) {
      console.log('something gone wrong. trying once more')
      rawTx.nonce = web3.utils.toHex(nonce)
      tx = new Tx(rawTx)
      tx.sign(Buffer.from(wallet.signingKey.privateKey.slice(2), 'hex'))
      serializedTx = tx.serialize()
      receipt = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
    }

    if (receipt && receipt.contractAddress) {
      console.log('contract deployed successfully', receipt.contractAddress)
      var contracObject = {}
      contracObject.abi = temp.abi
      contracObject.address = receipt.contractAddress
      fs.writeFileSync('./build/' + chain + '/' + contractName + '.json', JSON.stringify(contracObject), 'utf8')
      contracts[contractName] = contracObject
    }
    receipt = ''
  }
  fs.writeFileSync('./build/' + chain + '/contracts.json', JSON.stringify(contracts), 'utf8')
  return contracts
}

module.exports = { deploy, configureContracts }
