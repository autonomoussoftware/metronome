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

import "./Mintable.sol";
import "./Proceeds.sol";
import "./Auctions.sol";
import "./ERC20.sol";


/// @title Token contract
contract Token is ERC20, Mintable {
    mapping(address => mapping(address => uint256)) internal _allowance;

    function initToken(address _autonomousConverter, address _minter,
    uint _initialSupply, uint _decmult) public onlyOwner {
        initMintable(_autonomousConverter, _minter, _initialSupply, _decmult);
    }

    /// @notice Provide allowance information
    /// @param _owner owner address
    /// @param _spender  spender address
    function allowance(address _owner, address _spender) public constant returns (uint256) {
        return _allowance[_owner][_spender];
    }

    /// @notice Transfer tokens from sender to the provided address.
    /// @param _to Receiver of the tokens
    /// @param _value Amount of token
    /// @return true/false
    function transfer(address _to, uint256 _value) public returns (bool) {
        require(_to != address(0));
        require(_to != minter);
        require(_to != address(this));
        require(_to != autonomousConverter);
        Proceeds proceeds = Auctions(minter).proceeds();
        require((_to != address(proceeds)));

        _balanceOf[msg.sender] = _balanceOf[msg.sender].sub(_value);
        _balanceOf[_to] = _balanceOf[_to].add(_value);

        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    /// @notice Transfer tokens based on allowance.
    /// msg.sender must have allowance for spending the tokens from owner ie _from
    /// @param _from Owner of the tokens
    /// @param _to Receiver of the tokens
    /// @param _value Amount of tokens to transfer
    /// @return true/false
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) { 
        require(_to != address(0));       
        require(_to != minter && _from != minter);
        require(_to != address(this) && _from != address(this));
        Proceeds proceeds = Auctions(minter).proceeds();
        require(_to != address(proceeds) && _from != address(proceeds));
        //AC can accept MET via this function, needed for MetToEth conversion
        require(_from != autonomousConverter);
        require(_allowance[_from][msg.sender] >= _value);
        
        _balanceOf[_from] = _balanceOf[_from].sub(_value);
        _balanceOf[_to] = _balanceOf[_to].add(_value);
        _allowance[_from][msg.sender] = _allowance[_from][msg.sender].sub(_value);

        emit Transfer(_from, _to, _value);
        return true;
    }

    /// @notice Approve spender to spend the tokens ie approve allowance
    /// @param _spender Spender of the tokens
    /// @param _value Amount of tokens that can be spent by spender
    /// @return true/false
    function approve(address _spender, uint256 _value) public returns (bool) {
        require(_spender != address(this));
        _allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /// @notice Transfer the tokens from sender to all the address provided in the array.
    /// @dev Left 160 bits are the recipient address and the right 96 bits are the token amount.
    /// @param bits array of uint
    /// @return true/false
    function multiTransfer(uint[] bits) public returns (bool) {
        for (uint i = 0; i < bits.length; i++) {
            address a = address(bits[i] >> 96);
            uint amount = bits[i] & ((1 << 96) - 1);
            if (!transfer(a, amount)) revert();
        }

        return true;
    }

    /// @notice Increase allowance of spender
    /// @param _spender Spender of the tokens
    /// @param _value Amount of tokens that can be spent by spender
    /// @return true/false
    function approveMore(address _spender, uint256 _value) public returns (bool) {
        uint previous = _allowance[msg.sender][_spender];
        uint newAllowance = previous.add(_value);
        _allowance[msg.sender][_spender] = newAllowance;
        emit Approval(msg.sender, _spender, newAllowance);
        return true;
    }

    /// @notice Decrease allowance of spender
    /// @param _spender Spender of the tokens
    /// @param _value Amount of tokens that can be spent by spender
    /// @return true/false
    function approveLess(address _spender, uint256 _value) public returns (bool) {
        uint previous = _allowance[msg.sender][_spender];
        uint newAllowance = previous.sub(_value);
        _allowance[msg.sender][_spender] = newAllowance;
        emit Approval(msg.sender, _spender, newAllowance);
        return true;
    }
}