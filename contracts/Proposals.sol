pragma solidity ^0.4.21;

import "./TokenPorter.sol";
import "./Validator.sol";


/// @title Proposal intiated by validators.  
contract Proposals is Owned {
    uint public votingPeriod = 60 * 60 * 24 * 15;

    Validator public validator;

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

    function proposeNewValidator(address _validator, uint _newThreshold) public onlyValidator returns (uint) {
        require(_validator != 0x0);
        require(!validator.isValidator(_validator));
        if (_newThreshold > 0) {
            uint valCount = validator.getValidatorsCount();
            require(validator.isNewThresholdValid(valCount + 1, _newThreshold));
        }
        return createNewProposal(_validator, msg.sender, actions[0], _newThreshold);
    }

    function proposeRemoveValidator(address _validator, uint _newThreshold) public onlyValidator {
        require(_validator != 0x0);
        require(validator.isValidator(_validator));
        if (_newThreshold > 0) {
            uint valCount = validator.getValidatorsCount();
            require(validator.isNewThresholdValid(valCount - 1, _newThreshold));
        }
        createNewProposal(_validator, msg.sender, actions[1], _newThreshold);
    }

    function proposeNewThreshold(uint _newThreshold) public onlyValidator {
        uint valCount = validator.getValidatorsCount();
        require(validator.isNewThresholdValid(valCount, _newThreshold));
        createNewProposal(0x0, msg.sender, actions[2], _newThreshold);
    }

    function voteForProposal(uint _proposalId, bool _support) public onlyValidator {
        require(proposals[_proposalId].expiry != 0);
        require(now < proposals[_proposalId].expiry);
        require(!(proposals[_proposalId]).voted[msg.sender]);
        proposals[_proposalId].voters.push(msg.sender);
        proposals[_proposalId].voted[msg.sender] = true;
        if (_support) {
            proposals[_proposalId].supportCount++;
        }
        emit LogVoted(_proposalId, msg.sender, _support);
    }
    
    function closeProposal(uint _proposalId) public {
        require(proposals[_proposalId].expiry != 0);
        if (proposals[_proposalId].supportCount >= validator.threshold()) {
            executeProposal(_proposalId, proposals[_proposalId].newThreshold);
        } else if (now > proposals[_proposalId].expiry) {
            // Proposal to remove idle validator if no one take objection
            if ((proposals[_proposalId].action == actions[1]) && 
                (proposals[_proposalId].voters.length == proposals[_proposalId].supportCount)) {
                // new threshold count should never go below 50% remaining validators
                uint _t = (validator.getValidatorsCount() + 1) / 2;
                uint newThreshold = validator.threshold() - 1;
                if (newThreshold < _t) {
                    newThreshold = _t;
                }
                executeProposal(_proposalId, newThreshold);
            }
        }   
    }

    function executeProposal(uint _proposalId, uint _newThreshold) private {
        proposals[_proposalId].passed = true;
        if (proposals[_proposalId].action == actions[0]) {
            validator.addValidator(proposals[_proposalId].validator);
        } else if (proposals[_proposalId].action == actions[1]) {
            validator.removeValidator(proposals[_proposalId].validator);
        }
        if (_newThreshold != 0) {
            validator.updateThreshold(_newThreshold);
        }
        emit LogProposalClosed(_proposalId, proposals[_proposalId].validator, 
            _newThreshold, proposals[_proposalId].action, proposals[_proposalId].expiry, 
            proposals[_proposalId].supportCount, true);
    }

    function createNewProposal(address _validator, address _creator, bytes32 _action, 
        uint _newThreshold) private returns (uint proposalId) {
        proposalId = proposals.length++;
        uint expiry = now + votingPeriod;
        Proposal storage p = proposals[proposalId];
        p.proposalId = proposalId;
        p.action = _action;
        p.expiry = expiry;
        p.validator = _validator;
        p.newThreshold = _newThreshold;
        emit LogProposalCreated(_newThreshold, _validator, _newThreshold, _creator, expiry, _action);
    }
}