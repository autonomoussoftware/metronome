var Tx = require('ethereumjs-tx')
const Web3 = require('web3')
const ethers = require('ethers')
var config = require('config')
const fs = require('fs')

async function deploy (keystorePath, password) {
  var keystore = fs.readFileSync(keystorePath).toString()
  var wallet = await ethers.Wallet.fromEncryptedJson(keystore, password)
  let list = ['METToken', 'TokenPorter', 'Proceeds', 'Auctions', 'AutonomousConverter', 'SmartToken', 'Validator', 'Proposals']
  await deployContracts(wallet, list)
  // await configureContracts(keystorePath, password)
  // await launchContracts(keystorePath, password)
}
async function launchContracts (keystorePath, password) {
  var keystore = fs.readFileSync(keystorePath).toString()
  var wallet = await ethers.Wallet.fromEncryptedJson(keystore, password)
  console.log(wallet)
  var chain = 'etc'
  var contracts = JSON.parse(fs.readFileSync('./build/' + chain + '/contracts.json'))
  var web3 = new Web3(new Web3.providers.HttpProvider(config[chain].nodeURL))
  const account = await web3.eth.accounts.privateKeyToAccount(wallet.signingKey.privateKey)
  web3.eth.accounts.wallet.add(account)
  web3.eth.defaultAccount = account.address
  var receipt
  console.log('adding destination chain address')
  var tokenPorter = new web3.eth.Contract(JSON.parse(contracts.TokenPorter.abi), contracts.TokenPorter.address)
  receipt = await tokenPorter.methods.addDestinationChain(web3.utils.toHex('ETH'), config[chain].destinationChain).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
  var destChain = await tokenPorter.methods.destinationChains(web3.utils.toHex('ETH')).call()
  console.log('destChain', destChain)
  var autonomousConverter = new web3.eth.Contract(JSON.parse(contracts.AutonomousConverter.abi), contracts.AutonomousConverter.address)
  receipt = await autonomousConverter.methods.init(contracts.METToken.address, contracts.SmartToken.address, contracts.Auctions.address).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388, value: '100000000000000000' })
  console.log('AutonomousConvert initiated', receipt.transactionHash)
  receipt = ''
  var proceeds = new web3.eth.Contract(JSON.parse(contracts.Proceeds.abi), contracts.Proceeds.address)
  receipt = await proceeds.methods.initProceeds(contracts.AutonomousConverter.address, contracts.Auctions.address).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
  console.log('initProceeds done', receipt.transactionHash)
  receipt = ''

  var auctions = new web3.eth.Contract(JSON.parse(contracts.Auctions.abi), contracts.Auctions.address)
  receipt = await auctions.methods.skipInitBecauseIAmNotOg(contracts.METToken.address, contracts.Proceeds.address, config.genesisTime, 3300000000000, 2, 1, web3.utils.fromAscii('ETC'), config.isa_endtime).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })

  console.log('skipInitBecauseIAmNotOg done', receipt)
  receipt = ''
  var initialized = await auctions.methods.initialized().call()
  console.log('Initialized auctions', initialized)
  if (!initialized) {
    throw new Error('Error occured while launching auction')
  }

  var metToken = new web3.eth.Contract(JSON.parse(contracts.METToken.abi), contracts.METToken.address)
  receipt = await metToken.methods.enableMETTransfers().send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
  console.log('minter', await metToken.methods.minter().call())
  console.log('enableMETTransfers done', await metToken.methods.transferAllowed().call())
}

async function configureContracts (keystorePath, password) {
  var keystore = fs.readFileSync(keystorePath).toString()
  var wallet = await ethers.Wallet.fromEncryptedJson(keystore, password)
  var contracts = JSON.parse(fs.readFileSync('./build/etc/contracts.json'))
  var chain = 'etc'
  var web3 = new Web3(new Web3.providers.HttpProvider(config[chain].nodeURL))
  const account = web3.eth.accounts.privateKeyToAccount(wallet.signingKey.privateKey)
  web3.eth.accounts.wallet.add(account)
  web3.eth.defaultAccount = account.address
  console.log('\nConfiguring METToken')
  var metToken = new web3.eth.Contract(JSON.parse(contracts.METToken.abi), contracts.METToken.address)
  var receipt = await metToken.methods.initMETToken(contracts.AutonomousConverter.address, contracts.Auctions.address, 0, 0).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
  console.log('initMETToken done', receipt)
  console.log('minter', await metToken.methods.minter().call())
  receipt = ''
  receipt = await metToken.methods.setTokenPorter(contracts.TokenPorter.address).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
  console.log('setTokenPorter done', receipt.transactionHash)
  receipt = ''

  console.log('\nConfiguring Smart Token')
  var smartToken = new web3.eth.Contract(JSON.parse(contracts.SmartToken.abi), contracts.SmartToken.address)
  receipt = await smartToken.methods.initSmartToken(contracts.AutonomousConverter.address, contracts.AutonomousConverter.address, 2).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
  console.log('initSmartToken done', receipt.transactionHash)
  receipt = ''

  console.log('\nConfiguring Token Porter')
  var tokenPorter = new web3.eth.Contract(JSON.parse(contracts.TokenPorter.abi), contracts.TokenPorter.address)
  receipt = await tokenPorter.methods.initTokenPorter(contracts.METToken.address, contracts.Auctions.address).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
  console.log('initTokenPorter done', receipt.transactionHash)
  receipt = ''
  receipt = await tokenPorter.methods.setValidator(contracts.Validator.address).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
  console.log('setValidator done', receipt.transactionHash)
  receipt = ''

  console.log('\nConfiguring Validator')
  var validator = new web3.eth.Contract(JSON.parse(contracts.Validator.abi), contracts.Validator.address)
  receipt = await validator.methods.initValidator(contracts.METToken.address, contracts.Auctions.address, contracts.TokenPorter.address).send({ from: account.address, gasPrice: config[chain].gasPrice, gas: 4512388 })
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
  var chain = 'etc'
  var web3 = new Web3(new Web3.providers.HttpProvider(config[chain].nodeURL))
  var contractsJson = require('../../build/' + chain + '/output.json').contracts
  var nonce = await web3.eth.getTransactionCount(wallet.address, 'pending')
  var contracts = {}
  for (let contractName of list) {
    console.log('deploying contract - ', contractName, ' nonce=' + nonce)
    var rawTx = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(config[chain].gasPrice),
      gasLimit: web3.utils.toHex('4712382'),
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
      var instance = new web3.eth.Contract(JSON.parse(temp.abi), receipt.contractAddress)
      var owner = await instance.methods.owner().call()
      if (owner !== wallet.address) {
        console.log('deployment issue')
        console.log('wallet.address', wallet.address)
        console.log('owner', owner)
        process.exit(0)
      }
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

module.exports = { deploy, configureContracts, launchContracts }
