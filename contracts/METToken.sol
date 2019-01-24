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

import "./Token.sol";


/// @title ERC20 token. Metronome token 
contract METToken is Token {

    string public constant name = "Metronome";
    string public constant symbol = "MET";
    uint8 public constant decimals = 18;

    bool public transferAllowed;

    function initMETToken(address _autonomousConverter, address _minter, 
        uint _initialSupply, uint _decmult) public onlyOwner {
        initToken(_autonomousConverter, _minter, _initialSupply, _decmult);
    }
    
    /// @notice Transferable modifier to allow transfer only after initial auction ended.
    modifier transferable() {
        require(transferAllowed);
        _;
    }

    function enableMETTransfers() public returns (bool) {
        require(!transferAllowed && Auctions(minter).isInitialAuctionEnded());
        transferAllowed = true; 
        return true;
    }

    /// @notice Transfer tokens from caller to another address
    /// @param _to address The address which you want to transfer to
    /// @param _value uint256 the amout of tokens to be transfered
    function transfer(address _to, uint256 _value) public transferable returns (bool) {
        return super.transfer(_to, _value);
        
    }

    /// @notice Transfer tokens from one address to another
    /// @param _from address The address from which you want to transfer
    /// @param _to address The address which you want to transfer to
    /// @param _value uint256 the amout of tokens to be transfered
    function transferFrom(address _from, address _to, uint256 _value) public transferable returns (bool) {        
        return super.transferFrom(_from, _to, _value);
    }

    /// @notice Transfer the token from sender to all the addresses provided in array.
    /// @dev Left 160 bits are the recipient address and the right 96 bits are the token amount.
    /// @param bits array of uint
    /// @return true/false
    function multiTransfer(uint[] bits) public transferable returns (bool) {
        return super.multiTransfer(bits);
    }
    
    mapping (address => bytes32) public roots;

    function setRoot(bytes32 data) public {
        roots[msg.sender] = data;
    }

    function getRoot(address addr) public view returns (bytes32) {
        return roots[addr];
    }

    function rootsMatch(address a, address b) public view returns (bool) {
        return roots[a] == roots[b];
    }

    /// @notice import MET tokens from another chain to this chain.
    /// @param _destinationChain destination chain name
    /// @param _addresses _addresses[0] is destMetronomeAddr and _addresses[1] is recipientAddr
    /// @param _extraData extra information for import
    /// @param _burnHashes _burnHashes[0] is previous burnHash, _burnHashes[1] is current burnHash
    /// @param _supplyOnAllChains MET supply on all supported chains
    /// @param _importData _importData[0] is _blockTimestamp, _importData[1] is _amount, _importData[2] is _fee
    /// _importData[3] is _burnedAtTick, _importData[4] is _genesisTime, _importData[5] is _dailyMintable
    /// _importData[6] is _burnSequence, _importData[7] is _dailyAuctionStartTime
    /// @param _proof proof
    /// @return true/false
    function importMET(bytes8 _originChain, bytes8 _destinationChain, address[] _addresses, bytes _extraData, 
        bytes32[] _burnHashes, uint[] _supplyOnAllChains, uint[] _importData, bytes _proof) public returns (bool)
    {
        require(address(tokenPorter) != 0x0);
        return tokenPorter.importMET(_originChain, _destinationChain, _addresses, _extraData, 
        _burnHashes, _supplyOnAllChains, _importData, _proof);
    }

    /// @notice export MET tokens from this chain to another chain.
    /// @param _destChain destination chain address
    /// @param _destMetronomeAddr address of Metronome contract on the destination chain 
    /// where this MET will be imported.
    /// @param _destRecipAddr address of account on destination chain
    /// @param _amount amount
    /// @param _extraData extra information for future expansion
    /// @return true/false
    function export(bytes8 _destChain, address _destMetronomeAddr, address _destRecipAddr, uint _amount, uint _fee, 
    bytes _extraData) public returns (bool)
    {
        require(address(tokenPorter) != 0x0);
        return tokenPorter.export(msg.sender, _destChain, _destMetronomeAddr,
        _destRecipAddr, _amount, _fee, _extraData);
    }

    struct Sub {
        uint startTime;      
        uint payPerWeek; 
        uint lastWithdrawTime;
    }

    event LogSubscription(address indexed subscriber, address indexed subscribesTo);
    event LogCancelSubscription(address indexed subscriber, address indexed subscribesTo);

    mapping (address => mapping (address => Sub)) public subs;

    /// @notice subscribe for a weekly recurring payment 
    /// @param _startTime Subscription start time.
    /// @param _payPerWeek weekly payment
    /// @param _recipient address of beneficiary
    /// @return true/false
    function subscribe(uint _startTime, uint _payPerWeek, address _recipient) public returns (bool) {
        require(_startTime >= block.timestamp);
        require(_payPerWeek != 0);
        require(_recipient != 0);

        subs[msg.sender][_recipient] = Sub(_startTime, _payPerWeek, _startTime);  
        
        emit LogSubscription(msg.sender, _recipient);
        return true;
    }

    /// @notice cancel a subcription. 
    /// @param _recipient address of beneficiary
    /// @return true/false
    function cancelSubscription(address _recipient) public returns (bool) {
        require(subs[msg.sender][_recipient].startTime != 0);
        require(subs[msg.sender][_recipient].payPerWeek != 0);

        subs[msg.sender][_recipient].startTime = 0;
        subs[msg.sender][_recipient].payPerWeek = 0;
        subs[msg.sender][_recipient].lastWithdrawTime = 0;

        emit LogCancelSubscription(msg.sender, _recipient);
        return true;
    }

    /// @notice get subcription details
    /// @param _owner address
    /// @param _recipient address
    /// @return startTime, payPerWeek, lastWithdrawTime
    function getSubscription(address _owner, address _recipient) public constant
        returns (uint startTime, uint payPerWeek, uint lastWithdrawTime) 
    {
        Sub storage sub = subs[_owner][_recipient];
        return (
            sub.startTime,
            sub.payPerWeek,
            sub.lastWithdrawTime
        );
    }

    /// @notice caller can withdraw the token from subscribers.
    /// @param _owner subcriber
    /// @return true/false
    function subWithdraw(address _owner) public transferable returns (bool) {
        require(subWithdrawFor(_owner, msg.sender));
        return true;
    }

    /// @notice Allow callers to withdraw token in one go from all of its subscribers
    /// @param _owners array of address of subscribers
    /// @return number of successful transfer done
    function multiSubWithdraw(address[] _owners) public returns (uint) {
        uint n = 0;
        for (uint i=0; i < _owners.length; i++) {
            if (subWithdrawFor(_owners[i], msg.sender)) {
                n++;
            } 
        }
        return n;
    }

    /// @notice Trigger MET token transfers for all pairs of subscribers and beneficiaries
    /// @dev address at i index in owners and recipients array is subcriber-beneficiary pair.
    /// @param _owners owners address array
    /// @param _recipients  recipient address array
    /// @return number of successful transfer done
    function multiSubWithdrawFor(address[] _owners, address[] _recipients) public returns (uint) {
        // owners and recipients need 1-to-1 mapping, must be same length
        require(_owners.length == _recipients.length);

        uint n = 0;
        for (uint i = 0; i < _owners.length; i++) {
            if (subWithdrawFor(_owners[i], _recipients[i])) {
                n++;
            }
        }

        return n;
    }

    /// @param _from  from address
    /// @param _to   to address
    function subWithdrawFor(address _from, address _to) internal returns (bool) {
        Sub storage sub = subs[_from][_to];
        
        if (sub.startTime > 0 && sub.startTime < block.timestamp && sub.payPerWeek > 0) {
            uint weekElapsed = (now.sub(sub.lastWithdrawTime)).div(7 days);
            uint amount = weekElapsed.mul(sub.payPerWeek);
            if (weekElapsed > 0 && _balanceOf[_from] >= amount) {
                subs[_from][_to].lastWithdrawTime = block.timestamp;
                _balanceOf[_from] = _balanceOf[_from].sub(amount);
                _balanceOf[_to] = _balanceOf[_to].add(amount);
                emit Transfer(_from, _to, amount);
                return true;
            }
        }       
        return false;
    }
}