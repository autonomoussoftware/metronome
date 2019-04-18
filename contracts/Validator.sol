/*
    The MIT License (MIT)

    Copyright 2018 - 2019, Autonomous Software.

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
pragma solidity ^0.4.21;

import "./TokenPorter.sol";
import "./Owned.sol";
import "./SafeMath.sol";
import "./Auctions.sol";
import "./METToken.sol";
import "./Proposals.sol";


/// @title Validator contract for off chain validators to validate hash
contract Validator is Owned {

    using SafeMath for uint;

    /// @notice Mapping to store the attestation done by each offchain validator for a hash
    mapping (bytes32 => mapping (address => bool)) public hashAttestations;
    mapping (bytes32 => mapping (address => bool)) public hashRefutation;
    mapping (bytes32 => uint) public attestationCount;
    mapping (address => bool) public isValidator;
    address[] public validators;
    METToken public token;
    TokenPorter public tokenPorter;
    Auctions public auctions;
    Proposals public proposals;

    mapping (bytes32 => bool) public hashClaimed;

    // Miniumum quorum require for various voting like import, add new validators, add new chain
    uint public threshold = 1;

    event LogAttestation(bytes32 indexed hash, address indexed recipientAddr, bool isValid);

    /// @dev Throws if called by unauthorized account
    modifier onlyAuthorized() {
        require(msg.sender == owner || msg.sender == address(proposals));
        _;
    }
    
    /// @param _validator validator address
    function addValidator(address _validator) public onlyAuthorized {
        require(!isValidator[_validator]);
        validators.push(_validator);
        isValidator[_validator] = true;
    }

    /// @param _validator validator address
    function removeValidator(address _validator) public onlyAuthorized {
        // Must add new validators before removing to maintain minimum one validator active
        require(validators.length > 1);
        delete isValidator[_validator];
        for (uint i = 0; i < (validators.length); i++) {
            if (validators[i] == _validator) {
                if (i != (validators.length - 1)) {
                    validators[i] = validators[validators.length - 1];
                }
                validators.length--; 
                break;
            }
        }

        if (threshold >= validators.length) {
            if (validators.length == 1) {
                threshold = 1;
            } else {
                threshold = validators.length - 1;
            }
        }
    }

    /// @notice fetch count of validators
    function getValidatorsCount() public view returns (uint) { 
        return  validators.length;
    }

    /// @notice set threshold for validation and minting
    /// @param _threshold threshold count
    /// @return true/false
    function updateThreshold(uint _threshold) public onlyAuthorized returns (bool) {
        require(isNewThresholdValid(validators.length, _threshold));
        threshold = _threshold;
        return true;
    }

    function isNewThresholdValid(uint _valCount, uint _threshold) public pure returns (bool) {
        if (_threshold == 1 && _valCount == 2) {
            return true;
        } else if (_threshold >= 1 && _threshold < _valCount && (_threshold > (_valCount / 2))) {
            return true;
        }
        return false;
    }

    /// @notice set address of Proposals contract
    /// @param _proposals address of token porter
    /// @return true/false
    function setProposalContract(address _proposals) public onlyOwner returns (bool) {
        require(_proposals != 0x0);
        proposals = Proposals(_proposals);
        return true;
    }

    /// @notice set address of token porter
    /// @param _tokenPorter address of token porter
    /// @return true/false
    function setTokenPorter(address _tokenPorter) public onlyOwner returns (bool) {
        require(_tokenPorter != 0x0);
        tokenPorter = TokenPorter(_tokenPorter);
        return true;
    }

    /// @notice set contract addresses in validator contract.
    /// @param _tokenAddr address of MetToken contract
    /// @param _auctionsAddr address of Auction contract
    /// @param _tokenPorterAddr address of TokenPorter contract
    function initValidator(address _tokenAddr, address _auctionsAddr, address _tokenPorterAddr) public onlyOwner {
        require(_tokenAddr != 0x0);
        require(_auctionsAddr != 0x0);
        require(_tokenPorterAddr != 0x0);
        tokenPorter = TokenPorter(_tokenPorterAddr);
        auctions = Auctions(_auctionsAddr);
        token = METToken(_tokenAddr);
    }

    /// @notice Off chain validator call this function to validate and attest the hash. 
    /// @param _burnHash current burnHash
    /// @param _originChain source chain
    /// @param _recipientAddr recipientAddr
    /// @param _amount amount to import
    /// @param _fee fee for import-export
    /// @param _proof proof
    /// @param _extraData extra information for import
    /// @param _globalSupplyInOtherChains total supply in all other chains except this chain
    function attestHash(bytes32 _burnHash, bytes8 _originChain, address _recipientAddr, 
        uint _amount, uint _fee, bytes32[] _proof, bytes _extraData,
        uint _globalSupplyInOtherChains) public {
        require(isValidator[msg.sender]);
        require(_burnHash != 0x0);
        require(!hashAttestations[_burnHash][msg.sender]);
        require(!hashRefutation[_burnHash][msg.sender]);
        require(verifyProof(tokenPorter.merkleRoots(_burnHash), _burnHash, _proof));
        hashAttestations[_burnHash][msg.sender] = true;
        attestationCount[_burnHash]++;
        emit LogAttestation(_burnHash, _recipientAddr, true);
        
        if (attestationCount[_burnHash] >= threshold && !hashClaimed[_burnHash]) {
            hashClaimed[_burnHash] = true;
            require(tokenPorter.mintToken(_originChain, _recipientAddr, _amount, _fee, 
                _extraData, _burnHash, _globalSupplyInOtherChains, validators));
        }
    }

    /// @notice off chain validator can refute hash, if given export hash is not verified in origin chain.
    /// @param _burnHash Burn hash
    function refuteHash(bytes32 _burnHash, address _recipientAddr) public {
        require(isValidator[msg.sender]);
        require(!hashAttestations[_burnHash][msg.sender]);
        require(!hashRefutation[_burnHash][msg.sender]);
        hashRefutation[_burnHash][msg.sender] = true;
        emit LogAttestation(_burnHash, _recipientAddr, false);
    }

    /// @notice verify that the given leaf is in merkle root.
    /// @param _root merkle root
    /// @param _leaf leaf node, current burn hash
    /// @param _proof merkle path
    /// @return true/false outcome of the verification.
    function verifyProof(bytes32 _root, bytes32 _leaf, bytes32[] _proof) private pure returns (bool) {
        require(_root != 0x0 && _leaf != 0x0 && _proof.length != 0);

        bytes32 _hash = _leaf;
        for (uint i = 0; i < _proof.length; i++) {
            _hash = sha256(_proof[i], _hash);
        } 
        return (_hash == _root);
    }

}