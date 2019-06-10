/*
    The MIT License (MIT)

    Copyright 2017 - 2018, Alchemy Limited, LLC.

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be included
    in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
    IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
    CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
    TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
    SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const assert = require('chai').assert
const METToken = artifacts.require('METToken')
const SmartToken = artifacts.require('SmartToken')
const Proceeds = artifacts.require('Proceeds')
const AutonomousConverter = artifacts.require('AutonomousConverter')
const Auctions = artifacts.require('Auctions')
const TokenPorter = artifacts.require('TokenPorter')
const Validator = artifacts.require('Validator')
const Proposals = artifacts.require('Proposals')
const BlockTime = require('../test/shared/time')

contract('Proposal contract', accounts => {
  const OWNER = accounts[0]
  const MET_INITIAL_SUPPLY = 0
  const SMART_INITIAL_SUPPLY = 0
  const DECMULT = 10 ** 18
  const MINIMUM_PRICE = 33 * 10 ** 11 // minimum wei per token
  const STARTING_PRICE = 2 // 2ETH per MET
  const TIME_SCALE = 1

  let metToken, smartToken, proceeds, autonomousConverter, auctions, tokenPorter, validator, proposals

  function getCurrentBlockTime () {
    var defaultBlock = web3.eth.defaultBlock
    return web3.eth.getBlock(defaultBlock).timestamp
  }

  async function initContracts (startTime, minimumPrice, startingPrice, timeScale) {
    metToken = await METToken.new()
    smartToken = await SmartToken.new()
    tokenPorter = await TokenPorter.new()
    proposals = await Proposals.new()
    validator = await Validator.new({from: OWNER})
    await metToken.initMETToken(autonomousConverter.address, auctions.address, MET_INITIAL_SUPPLY, DECMULT, {from: OWNER})
    await smartToken.initSmartToken(autonomousConverter.address, autonomousConverter.address, SMART_INITIAL_SUPPLY, {from: OWNER})
    await autonomousConverter.init(metToken.address, smartToken.address, auctions.address,
      {
        from: OWNER,
        value: web3.toWei(1, 'ether')
      })
    await proceeds.initProceeds(autonomousConverter.address, auctions.address, {from: OWNER})
    await auctions.skipInitBecauseIAmNotOg(metToken.address, proceeds.address, process.env.genesisTime, 3300000000000, process.env.START_PRICE, 1, web3.fromAscii('ETC'), process.env.ISA_ENDTIME)
    await tokenPorter.initTokenPorter(metToken.address, auctions.address, {from: OWNER})
    await tokenPorter.setValidator(validator.address, {from: OWNER})
    await metToken.setTokenPorter(tokenPorter.address, {from: OWNER})
    await validator.initValidator(OWNER, accounts[1], accounts[2], {from: OWNER})
    await validator.setTokenPorter(tokenPorter.address, {from: OWNER})
    await validator.setProposalContract(proposals.address, {from: OWNER})
    await proposals.setValidator(validator.address, {from: OWNER})
  }

  // Create contracts and initilize them for each test case
  beforeEach(async () => {
    proceeds = await Proceeds.new()
    autonomousConverter = await AutonomousConverter.new()
    auctions = await Auctions.new()
  })

  describe('Proposal contract test cases', () => {
    it('proper initialization', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)

        const proposalAddress = await validator.proposals()
        assert.equal(proposalAddress, proposals.address, 'proposalAddress address is not the same')

        const validatorAddr = await proposals.validator()
        assert.equal(validatorAddr, validator.address, 'validator address is not the same')
        var votingPeriod = await proposals.votingPeriod()
        const newVotingPeriod = 3600
        await proposals.updateVotingPeriod(newVotingPeriod, {from: OWNER})
        votingPeriod = await proposals.votingPeriod()
        assert.equal(votingPeriod, newVotingPeriod, 'voting period not updated correctly')
        resolve()
      })
    })

    it('Non-owner should be not able to change proposal and validators address', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
        var thrown = false
        try {
          await validator.setProposalContract(metToken.address, {from: accounts[8]})
        } catch (e) {
          thrown = true
        }
        assert(thrown, 'Non owner should not be able to change contract address')

        thrown = false
        try {
          await proposals.setValidator(validator.address, {from: accounts[8]})
        } catch (e) {
          thrown = true
        }
        assert(thrown, 'Non owner should not be able to change contract address')
        const proposalAddress = await validator.proposals()
        assert.equal(proposalAddress, proposals.address, 'proposalAddress address is not the same')

        const validatorAddr = await proposals.validator()
        assert.equal(validatorAddr, validator.address, 'validator address is not the same')

        resolve()
      })
    })

    it('Only validator should be able to create new proposals', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
        await validator.addValidator(accounts[1])
        var val = await validator.validators(0)
        assert.equal(val, accounts[1], 'validators not correct')
        var tx = await proposals.proposeNewValidator(accounts[4], 0, {from: accounts[1]})
        var log = tx.logs[0]
        console.log(await proposals.proposals(0))
        assert.equal(log.args.newThreshold, 0, 'Proposal not created correctly')
        assert.equal(log.args.newValidator, accounts[4], 'Proposal not created correctly')
        await validator.addValidator(accounts[3])
        await proposals.proposeNewValidator(accounts[6], 2, {from: accounts[1]})
        var prop = await proposals.proposals(1)
        assert.equal(prop[0], 1, 'propsal id is wrong')
        let thrown = false
        try {
          await proposals.proposeNewValidator(accounts[7], 0, {from: accounts[2]})
        } catch (e) {
          thrown = true
        }
        assert(thrown, 'Non validator should not be able to create proposal')
        resolve()
      })
    })

    it('validator should be able to vote for proposals', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
        await validator.addValidator(accounts[1])
        var tx = await proposals.proposeNewValidator(accounts[4], 1, {from: accounts[1]})
        var log = tx.logs[0]
        assert.equal(log.args.newThreshold, 1, 'Proposal not created correctly')
        assert.equal(log.args.newValidator, accounts[4], 'Proposal not created correctly')
        tx = await proposals.voteForProposal(0, true, {from: accounts[1]})
        var supportCountAfter = (await proposals.proposals(0))[5].toString()
        assert.equal(supportCountAfter, '1', 'Support count is wrong')
        var thrown = false
        try {
          await proposals.voteForProposal(0, true, {from: accounts[1]})
        } catch (e) {
          thrown = true
        }
        assert(thrown, 'Validator should be able to vote only once')
        resolve()
      })
    })

    it('Only validator should be able to vote for proposals', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
        await validator.addValidator(accounts[1])
        await validator.addValidator(accounts[3])
        var tx = await proposals.proposeNewValidator(accounts[4], 2, {from: accounts[1]})
        var log = tx.logs[0]
        assert.equal(log.args.newThreshold, 2, 'Proposal not created correctly')
        assert.equal(log.args.newValidator, accounts[4], 'Proposal not created correctly')
        var thrown = false
        try {
          await proposals.voteForProposal(0, true, {from: accounts[2]})
        } catch (e) {
          thrown = true
        }
        assert(thrown, 'Only validator should be able to vote')
        resolve()
      })
    })

    it('Add validator and proposal should be closed successfully', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
        await validator.addValidator(accounts[1])
        await validator.addValidator(accounts[2])
        await validator.addValidator(accounts[3])
        var tx = await proposals.proposeNewValidator(accounts[4], 3, {from: accounts[1]})
        var log = tx.logs[0]
        assert.equal(log.args.newThreshold, 3, 'Proposal not created correctly')
        assert.equal(log.args.newValidator, accounts[4], 'Proposal not created correctly')
        await proposals.voteForProposal(0, true, {from: accounts[1]})
        await proposals.voteForProposal(0, true, {from: accounts[2]})
        await proposals.voteForProposal(0, false, {from: accounts[3]})
        tx = await proposals.closeProposal(0, {from: accounts[4]})
        var newValidator = await validator.validators(3)
        assert.equal(newValidator.toString(), accounts[4], 'new validator is not added correctly')
        var newThreshold = await validator.threshold()
        assert.equal(newThreshold.toString(), '3', 'New threshold is not correct')
        var prop = await proposals.proposals(0)
        assert.equal(prop[6], true, 'Propose is not passed')
        resolve()
      })
    })

    it('Should be create remove proposal after new val added', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
        await validator.addValidator(accounts[1])
        await validator.addValidator(accounts[2])
        await validator.addValidator(accounts[3])
        var tx = await proposals.proposeNewValidator(accounts[4], 3, {from: accounts[1]})
        var log = tx.logs[0]
        assert.equal(log.args.newThreshold, 3, 'Proposal not created correctly')
        assert.equal(log.args.newValidator, accounts[4], 'Proposal not created correctly')
        await proposals.voteForProposal(0, true, {from: accounts[1]})
        await proposals.voteForProposal(0, true, {from: accounts[2]})
        await proposals.voteForProposal(0, false, {from: accounts[3]})
        tx = await proposals.closeProposal(0, {from: accounts[4]})
        var newValidator = await validator.validators(3)
        assert.equal(newValidator.toString(), accounts[4], 'new validator is not added correctly')
        var newThreshold = await validator.threshold()
        assert.equal(newThreshold.toString(), '3', 'New threshold is not correct')
        var prop = await proposals.proposals(0)
        assert.equal(prop[6], true, 'Propose is not passed')
        tx = await proposals.proposeRemoveValidator(accounts[4], 2, {from: accounts[1]})
        log = tx.logs[0]
        assert.equal(log.args.newThreshold, 2, 'Proposal not created correctly')
        assert.equal(log.args.newValidator, accounts[4], 'Proposal not created correctly')
        resolve()
      })
    })

    it('Proposal should be closed after expiry', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
        await validator.addValidator(accounts[1])
        await validator.addValidator(accounts[2])
        await validator.addValidator(accounts[3])
        await validator.updateThreshold(2, {from: OWNER})
        var votingPeriod = 3 * 60
        await proposals.updateVotingPeriod(votingPeriod, {from: OWNER})
        var tx = await proposals.proposeNewValidator(accounts[4], 3, {from: accounts[1]})
        var log = tx.logs[0]
        assert.equal(log.args.newThreshold, 3, 'Proposal not created correctly')
        assert.equal(log.args.newValidator, accounts[4], 'Proposal not created correctly')
        await proposals.voteForProposal(0, true, {from: accounts[1]})
        await proposals.voteForProposal(0, false, {from: accounts[2]})
        await proposals.voteForProposal(0, false, {from: accounts[3]})
        await BlockTime.timeTravel(2 * votingPeriod)
        await BlockTime.mineBlock()
        tx = await proposals.closeProposal(0, {from: accounts[4]})
        var thresholdAfter = await validator.threshold()
        assert.equal(thresholdAfter.toString(), '2', 'New threshold is not correct')
        var prop = await proposals.proposals(0)
        assert.equal(prop[6], false, 'Propose is not passed')
        resolve()
      })
    })

    it('Remove validator and proposal should be closed successfully', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
        await validator.addValidator(accounts[1])
        await validator.addValidator(accounts[2])
        await validator.addValidator(accounts[3])
        await validator.addValidator(accounts[4])
        var tx = await proposals.proposeRemoveValidator(accounts[4], 2, {from: accounts[1]})
        var log = tx.logs[0]
        assert.equal(log.args.newThreshold, 2, 'Proposal not created correctly')
        assert.equal(log.args.newValidator, accounts[4], 'Proposal not created correctly')
        await proposals.voteForProposal(0, true, {from: accounts[1]})
        await proposals.voteForProposal(0, true, {from: accounts[2]})
        await proposals.voteForProposal(0, true, {from: accounts[3]})
        tx = await proposals.closeProposal(0, {from: accounts[4]})
        var valCounAfter = await validator.getValidatorsCount()
        assert.equal(valCounAfter.toString(), '3', 'Validator is not removed')
        resolve()
      })
    })

    it('Proposal should not remove validator if majority not support it', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
        await validator.addValidator(accounts[1])
        await validator.addValidator(accounts[2])
        await validator.addValidator(accounts[3])
        await validator.addValidator(accounts[4])
        await validator.updateThreshold(3)
        var tx = await proposals.proposeRemoveValidator(accounts[4], 2, {from: accounts[1]})
        var log = tx.logs[0]
        assert.equal(log.args.newThreshold, 2, 'Proposal not created correctly')
        assert.equal(log.args.newValidator, accounts[4], 'Proposal not created correctly')
        await proposals.voteForProposal(0, true, {from: accounts[1]})
        await proposals.voteForProposal(0, false, {from: accounts[2]})
        await proposals.voteForProposal(0, false, {from: accounts[3]})
        var valCounAfter = await validator.getValidatorsCount()
        tx = await proposals.closeProposal(0, {from: accounts[4]})
        valCounAfter = await validator.getValidatorsCount()
        assert.equal(valCounAfter.toString(), '4', 'Validator is not removed')
        resolve()
      })
    })

    it('Proposal should remove idle validator when total vote count=support count', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
        await validator.addValidator(accounts[1])
        await validator.addValidator(accounts[2])
        await validator.addValidator(accounts[3])
        await validator.addValidator(accounts[4])
        await validator.addValidator(accounts[5])
        var votingPeriod = 3 * 60
        await proposals.updateVotingPeriod(votingPeriod, {from: OWNER})
        var tx = await proposals.proposeRemoveValidator(accounts[4], 3, {from: accounts[1]})
        var log = tx.logs[0]
        assert.equal(log.args.newThreshold, 3, 'Proposal not created correctly')
        assert.equal(log.args.newValidator, accounts[4], 'Proposal not created correctly')
        await proposals.voteForProposal(0, true, {from: accounts[1]})
        await BlockTime.timeTravel(2 * votingPeriod)
        await BlockTime.mineBlock()
        var thrown = false
        try {
          await proposals.voteForProposal(0, false, {from: accounts[2]})
        } catch (e) {
          thrown = true
        }
        assert.equal(thrown, true, 'validator should not able to vote after expiry')
        tx = await proposals.closeProposal(0, {from: accounts[4]})
        var valCounAfter = await validator.getValidatorsCount()
        assert.equal(valCounAfter.toString(), '4', 'Validator is not removed')
        resolve()
      })
    })

    it('Should not be able to create new proposal to remove val if one already exist', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
        await validator.addValidator(accounts[1])
        await validator.addValidator(accounts[2])
        await validator.addValidator(accounts[3])
        await validator.addValidator(accounts[4])
        await validator.addValidator(accounts[5])
        var votingPeriod = 3 * 60
        await proposals.updateVotingPeriod(votingPeriod, {from: OWNER})
        var tx = await proposals.proposeRemoveValidator(accounts[4], 3, {from: accounts[1]})
        var log = tx.logs[0]
        console.log(tx.logs[0].args)
        assert.equal(log.args.newThreshold, 3, 'Proposal not created correctly')
        assert.equal(log.args.newValidator, accounts[4], 'Proposal not created correctly')
        let thrown = false
        try {
          tx = await proposals.proposeRemoveValidator(accounts[4], 3, {from: accounts[1]})
          console.log(tx.logs[0].args)
          tx = await proposals.proposeRemoveValidator(accounts[4], 3, {from: accounts[1]})
          console.log(tx.logs[0].args)
        } catch (e) {
          thrown = true
        }
        console.log('thrown', thrown)
        assert(thrown, 'should not be able to create validator if one already exist')
        resolve()
      })
    })

    it('Should not be able to create new proposal to add val if one already exist', () => {
      return new Promise(async (resolve, reject) => {
        await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
        await validator.addValidator(accounts[1])
        await validator.addValidator(accounts[2])
        await validator.addValidator(accounts[3])
        var votingPeriod = 3 * 60
        await proposals.updateVotingPeriod(votingPeriod, {from: OWNER})
        var tx = await proposals.proposeNewValidator(accounts[4], 3, {from: accounts[1]})
        var log = tx.logs[0]
        console.log(tx.logs[0].args)
        assert.equal(log.args.newThreshold, 3, 'Proposal not created correctly')
        assert.equal(log.args.newValidator, accounts[4], 'Proposal not created correctly')
        let thrown = false
        try {
          tx = await proposals.proposeNewValidator(accounts[5], 3, {from: accounts[1]})
          console.log(tx.logs[0].args)
          tx = await proposals.proposeNewValidator(accounts[5], 3, {from: accounts[1]})
          console.log(tx.logs[0].args)
        } catch (e) {
          thrown = true
        }
        console.log('thrown', thrown)
        assert(thrown, 'should not be able to create validator if one already exist')
        resolve()
      })
    })
  })

  it('Update threshold and proposal should be closed successfully', () => {
    return new Promise(async (resolve, reject) => {
      await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      await validator.addValidator(accounts[1])
      await validator.addValidator(accounts[2])
      await validator.addValidator(accounts[3])
      await validator.addValidator(accounts[4])
      var tx = await proposals.proposeNewThreshold(3, {from: accounts[1]})
      var log = tx.logs[0]
      assert.equal(log.args.newThreshold, 3, 'Proposal not created correctly')
      assert.equal(log.args.newValidator, 0x0, 'Proposal not created correctly')
      await proposals.voteForProposal(0, true, {from: accounts[1]})
      await proposals.voteForProposal(0, true, {from: accounts[2]})
      await proposals.voteForProposal(0, true, {from: accounts[3]})
      await proposals.voteForProposal(0, false, {from: accounts[4]})
      tx = await proposals.closeProposal(0, {from: accounts[4]})
      var newThreshold = await validator.threshold()
      assert.equal(newThreshold.toString(), '3', 'New threshold is not correct')
      var prop = await proposals.proposals(0)
      assert.equal(prop[6], true, 'Propose is not passed')
      resolve()
    })
  })

  it('threshold not be updated if majoriy do not support it', () => {
    return new Promise(async (resolve, reject) => {
      await initContracts(getCurrentBlockTime() - 60, MINIMUM_PRICE, STARTING_PRICE, TIME_SCALE)
      await validator.addValidator(accounts[1])
      await validator.addValidator(accounts[2])
      await validator.addValidator(accounts[3])
      await validator.addValidator(accounts[4])
      await validator.addValidator(accounts[5])
      await validator.updateThreshold(3, {from: OWNER})
      var votingPeriod = 3 * 60
      await proposals.updateVotingPeriod(votingPeriod, {from: OWNER})
      var tx = await proposals.proposeNewThreshold(4, {from: accounts[1]})
      var log = tx.logs[0]
      assert.equal(log.args.newThreshold, 4, 'Proposal not created correctly')
      assert.equal(log.args.newValidator, 0x0, 'Proposal not created correctly')
      await proposals.voteForProposal(0, true, {from: accounts[1]})
      await proposals.voteForProposal(0, false, {from: accounts[2]})
      await proposals.voteForProposal(0, false, {from: accounts[3]})
      await BlockTime.timeTravel(2 * votingPeriod)
      await BlockTime.mineBlock()
      tx = await proposals.closeProposal(0, {from: accounts[4]})
      var newThreshold = await validator.threshold()
      assert.equal(newThreshold.toString(), '3', 'New threshold is not correct')
      var prop = await proposals.proposals(0)
      assert.equal(prop[6], false, 'Propose is not passed')
      resolve()
    })
  })
})
