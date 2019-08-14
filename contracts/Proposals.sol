pragma solidity ^0.4.21;

import "./TokenPorter.sol";
import "./Validator.sol";


/// @title Proposal intiated by validators.  
contract Proposals is Owned {
    uint public votingPeriod = 60 * 60 * 24 * 15;

    Validator public validator;
    mapping (address => uint) public valProposals;

    bytes32[] public actions;
    
    struct Proposal {
        uint proposalId;
        bytes32 action;
        uint expiry;
        address validator;
        uint newThreshold;
        uint supportCount;
        address[] voters;
        bool passed;
        mapping (address => bool) voted;

    }

    Proposal[] public proposals;

    event LogVoted(uint indexed proposalId, address indexed voter, bool support);

    event LogProposalCreated(uint indexed proposalId, address indexed newValidator, 
        uint newThreshold, address creator, uint expiry, bytes32 indexed action);

    event LogProposalClosed(uint indexed proposalId, address indexed newValidator, 
        uint newThreshold, bytes32 indexed action, uint expiry, uint supportCount, bool passed);

    /// @dev Throws if called by any account other than the validator.
    modifier onlyValidator() {
        require(validator.isValidator(msg.sender));
        _;
    }

    function Proposals() public {
        actions.push("addval");
        actions.push("removeval");
        actions.push("updatethreshold");
    }

    /// @notice set address of validator contract
    /// @param _validator address of validator contract
    function setValidator(address _validator) public onlyOwner returns (bool) {
        require(_validator != 0x0);
        validator = Validator(_validator);
        return true;
    }

    /// @notice set update voting period
    /// @param _t voting period
    function updateVotingPeriod(uint _t) public onlyOwner returns (bool) {
        require(_t != 0);
        votingPeriod = _t;
        return true;
    }

    /// @notice validator can initiate proposal for add new validator.
    /// @param _validator new validator address
    /// @param _newThreshold new threshold value. 0 if do not want to update it
    function proposeNewValidator(address _validator, uint _newThreshold) public onlyValidator returns (uint) {
        require(_validator != 0x0);
        require(!validator.isValidator(_validator));
        if (_newThreshold > 0) {
            uint valCount = validator.getValidatorsCount();
            require(validator.isNewThresholdValid(valCount + 1, _newThreshold));
        }
        return createNewProposal(_validator, msg.sender, actions[0], _newThreshold);
    }

    /// @notice validator can initiate proposal to remove bad actor or idle validators.
    /// validators can be removed if support count >= threshold or  support count == voting count.
    /// Later approach is to remove idle validator from system. 
    /// @param _validator new validator address
    /// @param _newThreshold new threshold value. 0 if do not want to update it
    function proposeRemoveValidator(address _validator, uint _newThreshold) public onlyValidator returns (uint) {
        require(_validator != 0x0);
        require(validator.isValidator(_validator));
        if (_newThreshold > 0) {
            uint valCount = validator.getValidatorsCount();
            require(validator.isNewThresholdValid(valCount - 1, _newThreshold));
        }
        return createNewProposal(_validator, msg.sender, actions[1], _newThreshold);
    }

    /// @notice validator can initiate proposal to update threshold value
    /// @param _newThreshold new threshold value. 0 if do not want to update it
    function proposeNewThreshold(uint _newThreshold) public onlyValidator returns (uint) {
        uint valCount = validator.getValidatorsCount();
        require(validator.isNewThresholdValid(valCount, _newThreshold));
        return createNewProposal(0x0, msg.sender, actions[2], _newThreshold);
    }

    /// @notice validator can vote for a proposal
    /// @param _proposalId ..
    /// @param _support true/false
    function voteForProposal(uint _proposalId, bool _support) public onlyValidator {
        require(proposals[_proposalId].expiry != 0);
        require(now < proposals[_proposalId].expiry);
        require(!proposals[_proposalId].passed);
        require(!(proposals[_proposalId]).voted[msg.sender]);
        proposals[_proposalId].voters.push(msg.sender);
        proposals[_proposalId].voted[msg.sender] = true;
        if (_support) {
            proposals[_proposalId].supportCount++;
        }
        emit LogVoted(_proposalId, msg.sender, _support);
    }
    
    /// @notice public function to close a proposal if expired or majority support received
    /// @param _proposalId ..
    function closeProposal(uint _proposalId) public {
        require(proposals[_proposalId].expiry != 0);
        if (proposals[_proposalId].supportCount >= validator.threshold()) {
            executeProposal(_proposalId, proposals[_proposalId].newThreshold);
        } else if (now > proposals[_proposalId].expiry) {
            // Proposal to remove idle validator if no one take objection
            if ((proposals[_proposalId].action == actions[1]) && 
                (proposals[_proposalId].voters.length == proposals[_proposalId].supportCount)) {
                executeProposal(_proposalId, proposals[_proposalId].newThreshold);
            }
        }   
    }

    /// @notice private function to update outcome of a proposal
    /// @param _proposalId ..
    /// @param _newThreshold ..
    function executeProposal(uint _proposalId, uint _newThreshold) private {
        if (proposals[_proposalId].action == actions[0]) {
            validator.addValidator(proposals[_proposalId].validator);
        } else if (proposals[_proposalId].action == actions[1]) {
            validator.removeValidator(proposals[_proposalId].validator);
        }
        if (_newThreshold != 0 && _newThreshold != validator.threshold()) {
            validator.updateThreshold(_newThreshold);
        }
        proposals[_proposalId].passed = true;
        emit LogProposalClosed(_proposalId, proposals[_proposalId].validator, 
            _newThreshold, proposals[_proposalId].action, proposals[_proposalId].expiry, 
            proposals[_proposalId].supportCount, true);
    }

    /// @notice private function to create a proposal
    /// @param _validator validator address
    /// @param _creator creator
    /// @param _action _action
    /// @param _newThreshold _newThreshold
    function createNewProposal(address _validator, address _creator, bytes32 _action, 
        uint _newThreshold) private returns (uint proposalId) {
        proposalId = proposals.length++;
        if (_validator != 0x0) {
            require((valProposals[_validator] == 0) || (now > proposals[valProposals[_validator]].expiry) 
            || (proposals[valProposals[_validator]].passed));
            valProposals[_validator] = proposalId;
        }
        uint expiry = now + votingPeriod;
        Proposal storage p = proposals[proposalId];
        p.proposalId = proposalId;
        p.action = _action;
        p.expiry = expiry;
        p.validator = _validator;
        p.newThreshold = _newThreshold;
        emit LogProposalCreated(proposalId, _validator, _newThreshold, _creator, expiry, _action);
    }
}