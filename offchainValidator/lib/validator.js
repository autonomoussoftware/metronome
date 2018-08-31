const Web3 = require('web3')

/**
 * Class reprensenting a Metronome Validator for off chain validations
 * @namespace MetronomeValidator
 */
class Validator {
  /**
     * @desc Metronome off chain validator.
     * @param blockChainNodeURL - URL ( with port) of blockchain node. For example ETH, ETC.
     * If local full node available then it may be http://localhost:port
     * @param web3
     * @param {Object} contracts
     * @param auctionContract
     */
  constructor (blockChainNodeURL, contracts = {}) {
    this.blockChainNodeURL = blockChainNodeURL
    this.web3 = new Web3(new Web3.providers.HttpProvider(blockChainNodeURL))
    this.auctionContract = web3.eth.contract(contracts.auctions.abi).at(contracts.auctions.address)
  }

  getFounder (index) {
    return this.auctionContract.founders(index)
  }
}
