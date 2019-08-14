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

import "./ITokenPorter.sol";
import "./Owned.sol";
import "./SafeMath.sol";
import "./Auctions.sol";
import "./METToken.sol";
import "./Validator.sol";


/// @title This contract will provide export functionality for tokens.
contract TokenPorter is ITokenPorter, Owned {
    using SafeMath for uint;
    Auctions public auctions;
    METToken public token;
    Validator public validator;

    uint public burnSequence = 1;
    uint public importSequence = 1;
    uint public chainHopStartTime = now + (2*60*60*24);
    // This is flat fee and must be in 18 decimal value
    uint public minimumExportFee = 1 * (10 ** 12);
    // export fee per 10,000 MET. 1 means 0.01% or 1 met as fee for export of 10,000 met
    uint public exportFee = 50;
    bytes32[] public exportedBurns;
    uint[] public supplyOnAllChains = new uint[](6);
    mapping (bytes32 => bytes32) public merkleRoots;
    mapping (bytes32 => bytes32) public mintHashes;
    mapping (bytes32 => uint) public burnAtTick;
    // store burn hashes and burnSequence to find burn hash exist or not. 
    // Burn sequence may be used to find chain of burn hashes
    mapping (bytes32 => uint) public burnHashes;
    /// @notice mapping that tracks valid destination chains for export
    mapping(bytes8 => address) public destinationChains;

    event LogExportReceipt(bytes8 destinationChain, address destinationMetronomeAddr,
        address indexed destinationRecipientAddr, uint amountToBurn, uint fee, bytes extraData, uint currentTick,
        uint burnSequence, bytes32 indexed currentBurnHash, bytes32 prevBurnHash, uint dailyMintable,
        uint[] supplyOnAllChains, uint blockTimestamp, address indexed exporter);

    event LogImportRequest(bytes8 originChain, bytes32 indexed currentBurnHash, bytes32 prevHash,
        address indexed destinationRecipientAddr, uint amountToImport, uint fee, uint exportTimeStamp,
        uint burnSequence, bytes extraData);
    
    event LogImport(bytes8 originChain, address indexed destinationRecipientAddr, uint amountImported, uint fee,
    bytes extraData, uint indexed importSequence, bytes32 indexed currentHash);
    
    /// @notice Initialize TokenPorter contract.
    /// @param _tokenAddr Address of metToken contract
    /// @param _auctionsAddr Address of auctions contract
    function initTokenPorter(address _tokenAddr, address _auctionsAddr) public onlyOwner {
        require(_tokenAddr != 0x0);
        require(_auctionsAddr != 0x0);
        auctions = Auctions(_auctionsAddr);
        token = METToken(_tokenAddr);
    }

    /// @notice set minimum export fee. Minimum flat fee applicable for export-import 
    /// @param _minimumExportFee minimum export fee
    function setMinimumExportFee(uint _minimumExportFee) public onlyOwner returns (bool) {
        require(_minimumExportFee > 0);
        minimumExportFee = _minimumExportFee;
        return true;
    }

    /// @notice set export fee in percentage. 
    /// @param _exportFee fee amount per 10,000 met
    function setExportFeePerTenThousand(uint _exportFee) public onlyOwner returns (bool) {
        exportFee = _exportFee;
        return true;
    }
    
    /// @notice set chain hop start time. Also, useful if owner want to suspend chain hop 
    // until given time in case anything goes wrong
    /// @param _startTime epoc time
    function setChainHopStartTime(uint _startTime) public onlyOwner returns (bool) {
        require(_startTime >= block.timestamp);
        chainHopStartTime = _startTime;
        return true;
    }

    /// @notice set address of validator contract
    /// @param _validator address of validator contract
    function setValidator(address _validator) public onlyOwner returns (bool) {
        require(_validator != 0x0);
        validator = Validator(_validator);
        return true;
    }

    /// @notice only owner can add destination chains
    /// @param _chainName string of destination blockchain name
    /// @param _contractAddress address of destination MET token to import to
    function addDestinationChain(bytes8 _chainName, address _contractAddress) public onlyOwner returns (bool) {
        require(_chainName != 0 && _contractAddress != address(0));
        destinationChains[_chainName] = _contractAddress;
        return true;
    }

    /// @notice only owner can remove destination chains
    /// @param _chainName string of destination blockchain name
    function removeDestinationChain(bytes8 _chainName) public onlyOwner returns (bool) {
        require(_chainName != 0);
        require(destinationChains[_chainName] != address(0));
        destinationChains[_chainName] = address(0);
        return true;   
    }

    /// @notice holds claims from users that have exported on-chain
    /// @param key is address of destination MET token contract
    /// @param subKey is address of users account that burned their original MET token
    mapping (address  => mapping(address => uint)) public claimables;

    /// @notice destination MET token contract calls claimReceivables to record burned 
    /// tokens have been minted in new chain 
    /// @param recipients array of addresses of each user that has exported from
    /// original chain.  These can be generated by LogExportReceipt
    function claimReceivables(address[] recipients) public returns (uint) {
        require(recipients.length > 0);

        uint total;
        for (uint i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            uint amountBurned = claimables[msg.sender][recipient];
            if (amountBurned > 0) {
                claimables[msg.sender][recipient] = 0;
                emit ExportOnChainClaimedReceiptLog(msg.sender, recipient, amountBurned);
                total = total.add(1);
            }
        }
        return total;
    }

    /// @notice Request for import MET tokens from another chain to this chain. 
    /// Minting will be done once off chain validators validate import request.
    /// @param _originChain source chain name
    /// @param _destinationChain destination chain name
    /// @param _addresses _addresses[0] is destMetronomeAddr and _addresses[1] is recipientAddr
    /// @param _extraData extra information for import
    /// @param _burnHashes _burnHashes[0] is previous burnHash, _burnHashes[1] is current burnHash
    /// @param _supplyOnAllChains MET supply on all supported chains
    /// @param _importData _importData[0] is _blockTimestamp, _importData[1] is _amount, _importData[2] is _fee
    /// _importData[3] is _burnedAtTick, _importData[4] is _genesisTime, _importData[5] is _dailyMintable
    /// _importData[6] is _burnSequence, _importData[7] is _dailyAuctionStartTime
    /// @param _proof merkle root
    /// @return true/false
    function importMET(bytes8 _originChain, bytes8 _destinationChain, address[] _addresses, bytes _extraData, 
        bytes32[] _burnHashes, uint[] _supplyOnAllChains, uint[] _importData, bytes _proof) public returns (bool)
    {
        
        require(msg.sender == address(token));
        require(block.timestamp >= chainHopStartTime);
        require(_importData.length == 8);
        require(_addresses.length == 2);
        require(_burnHashes.length == 2);
        require(!validator.hashClaimed(_burnHashes[1]));
        require(isReceiptValid(_originChain, _destinationChain, _addresses, _extraData, _burnHashes, 
        _supplyOnAllChains, _importData));
        require(_destinationChain == auctions.chain());
        require(_addresses[0] == address(token));
        require(_importData[1] != 0);
        // Update mintable proportionally due for missed auctions
        if (auctions.lastPurchaseTick() > 0) {
            // auction start only after first minting
            auctions.restartAuction();
        }
        
        // We do not want to change already deployed interface, hence accepting '_proof' 
        // as bytes and converting into bytes32. Here _proof is merkle root.
        merkleRoots[_burnHashes[1]] = bytesToBytes32(_proof);
        burnAtTick[_burnHashes[1]] = _importData[3];
        // mint hash is used for further validation before minting and after attestation by off chain validators. 
        mintHashes[_burnHashes[1]] = keccak256(_originChain, _addresses[1], _importData[1], _importData[2]);
        
        emit LogImportRequest(_originChain, _burnHashes[1], _burnHashes[0], _addresses[1], _importData[1],
            _importData[2], _importData[0], _importData[6], _extraData);
        return true;
    }

    /// @notice Export MET tokens from this chain to another chain.
    /// @param tokenOwner Owner of the token, whose tokens are being exported.
    /// @param _destChain Destination chain for exported tokens
    /// @param _destMetronomeAddr Metronome address on destination chain
    /// @param _destRecipAddr Recipient address on the destination chain
    /// @param _amount Amount of token being exported
    /// @param _extraData Extra data for this export
    /// @return boolean true/false based on the outcome of export
    function export(address tokenOwner, bytes8 _destChain, address _destMetronomeAddr,
        address _destRecipAddr, uint _amount, uint _fee, bytes _extraData) public returns (bool) {
        require(msg.sender == address(token));
        require(block.timestamp >= chainHopStartTime);
        require(_destChain != 0x0 && _destMetronomeAddr != 0x0 && _destRecipAddr != 0x0 && _amount != 0);
        require(destinationChains[_destChain] == _destMetronomeAddr);
        
        require(token.balanceOf(tokenOwner) >= _amount.add(_fee));
        require(_fee >= minimumExportFee && _fee >= (_amount.mul(exportFee).div(10000)));
        // Update mintable proportionally due for missed auctions
        auctions.restartAuction();
        token.destroy(tokenOwner, _amount.add(_fee));

        uint dailyMintable = auctions.dailyMintable();
        uint currentTick = auctions.currentTick();
       
       
        if (burnSequence == 1) {
            exportedBurns.push(keccak256(uint8(0)));
        }

        if (_destChain == auctions.chain()) {
            claimables[_destMetronomeAddr][_destRecipAddr] = 
                claimables[_destMetronomeAddr][_destRecipAddr].add(_amount);
        }
        uint blockTime = block.timestamp;
        bytes32 currentBurn = keccak256(
            blockTime, 
            auctions.chain(),
            _destChain, 
            _destMetronomeAddr, 
            _destRecipAddr, 
            _amount,
            _fee,
            currentTick,
            auctions.genesisTime(),
            dailyMintable,
            _extraData,
            exportedBurns[burnSequence - 1]);
       
        exportedBurns.push(currentBurn);
        burnHashes[currentBurn] = burnSequence;
        supplyOnAllChains[0] = token.totalSupply();
        
        emit LogExportReceipt(_destChain, _destMetronomeAddr, _destRecipAddr, _amount, _fee, _extraData, 
            currentTick, burnSequence, currentBurn, exportedBurns[burnSequence - 1], dailyMintable,
            supplyOnAllChains, blockTime, tokenOwner);

        burnSequence = burnSequence + 1;
        return true;
    }

    /// @notice mintToken will be called by validator contract only and that too only after hash attestation.
    /// @param originChain origin chain from where these token burnt.
    /// @param recipientAddress tokens will be minted for this address.
    /// @param amount amount being imported/minted
    /// @param fee fee paid during export
    /// @param extraData any extra data related to export-import process.
    /// @param currentHash current export hash from source/origin chain.
    /// @param validators validators
    /// @return true/false indicating minting was successful or not
    function mintToken(bytes8 originChain, address recipientAddress, uint amount, 
        uint fee, bytes extraData, bytes32 currentHash, uint globalSupplyInOtherChains, 
        address[] validators) public returns (bool) {
        require(msg.sender == address(validator));
        require(originChain != 0x0);
        require(recipientAddress != 0x0);
        require(amount > 0);
        require(currentHash != 0x0);

        //Validate that mint data is same as the data received during import request.
        require(mintHashes[currentHash] == keccak256(originChain, recipientAddress, amount, fee));

        require(isGlobalSupplyValid(amount, fee, globalSupplyInOtherChains));
        
        if (importSequence == 1 && token.totalSupply() == 0) {
            auctions.prepareAuctionForNonOGChain();
        }
        calculateLeakage(amount.add(fee), burnAtTick[currentHash]);
        require(token.mint(recipientAddress, amount));
        // fee amount has already been validated during export and its part of burn hash
        // so we may not need to calculate it again.
        uint feeToDistribute =  fee.div(validators.length);
        for (uint i = 0; i < validators.length; i++) {
            token.mint(validators[i], feeToDistribute);
        }
        emit LogImport(originChain, recipientAddress, amount, fee, extraData, importSequence, currentHash);
        importSequence++;
        return true;
    }
    
    /// @notice Calculate leakage due to missed auction between export and import
    /// @param amount origin chain from where these token burnt.
    /// @param burnTick tick when MET burnt at source chain
    function calculateLeakage(uint amount, uint burnTick) private {
        uint lastAuction = auctions.whichAuction(burnTick);
        uint thisAuction = auctions.currentAuction();
        uint leakage = thisAuction.sub(lastAuction).mul(amount);
        uint globalSupply = auctions.INITIAL_SUPPLY().add(auctions.INITIAL_GLOBAL_DAILY_SUPPLY().mul(lastAuction));
        leakage = (auctions.INITIAL_GLOBAL_DAILY_SUPPLY().mul(leakage)).div(globalSupply);
        token.updateLeakage(leakage);
    }

    /// @notice Convert bytes to bytes32
    function bytesToBytes32(bytes b) private pure returns (bytes32) {
        bytes32 out;

        for (uint i = 0; i < 32; i++) {
            out |= bytes32(b[i] & 0xFF) >> (i * 8);
        }
        return out;
    }

    /// @notice Check global supply is still valid with current import amount and fee
    function isGlobalSupplyValid(uint amount, uint fee, uint globalSupplyInOtherChains) private view returns (bool) {
        uint amountToImport = amount.add(fee);
        uint currentGlobalSupply = globalSupplyInOtherChains.add(token.totalSupply());
        return (amountToImport.add(currentGlobalSupply) <= auctions.globalMetSupply());
    }

    /// @notice validate the export receipt
    function isReceiptValid(bytes8 _originChain, bytes8 _destinationChain, address[] _addresses, bytes _extraData, 
        bytes32[] _burnHashes, uint[] _supplyOnAllChain, uint[] _importData) private pure returns(bool) {

        // Due to stack too deep error and limitation in using number of local 
        // variables we had to use array here.
        // _importData[0] is _blockTimestamp, _importData[1] is _amount, _importData[2] is _fee,
        // _importData[3] is _burnedAtTick, _importData[4] is _genesisTime,
        // _importData[5] is _dailyMintable, _importData[6] is _burnSequence,
        // _addresses[0] is _destMetronomeAddr and _addresses[1] is _recipAddr
        // _burnHashes[0] is previous burnHash, _burnHashes[1] is current burnHash

        if (_burnHashes[1] == keccak256(_importData[0], _originChain, _destinationChain, _addresses[0], 
            _addresses[1], _importData[1], _importData[2], _importData[3], _importData[4], _importData[5], 
            _extraData, _burnHashes[0])) {
            return true;
        }
        
        return false;
    }
} 