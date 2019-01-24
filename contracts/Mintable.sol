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

import "./Owned.sol";
import "./SafeMath.sol";
import "./ITokenPorter.sol";


/// @title Mintable contract to allow minting and destroy.
contract Mintable is Owned {

    using SafeMath for uint256;

    event Mint(address indexed _to, uint _value);
    event Destroy(address indexed _from, uint _value);
    event Transfer(address indexed _from, address indexed _to, uint256 _value);

    uint256 internal _totalSupply;
    mapping(address => uint256) internal _balanceOf;

    address public autonomousConverter;
    address public minter;
    ITokenPorter public tokenPorter;

    /// @notice init reference of other contract and initial supply
    /// @param _autonomousConverter AC address
    /// @param _minter minter address
    /// @param _initialSupply initial supply
    /// @param _decmult Decimal places
    function initMintable(address _autonomousConverter, address _minter, uint _initialSupply, 
        uint _decmult) public onlyOwner {
        require(autonomousConverter == 0x0 && _autonomousConverter != 0x0);
        require(minter == 0x0 && _minter != 0x0);
      
        autonomousConverter = _autonomousConverter;
        minter = _minter;
        _totalSupply = _initialSupply.mul(_decmult);
        _balanceOf[_autonomousConverter] = _totalSupply;
    }

    function totalSupply() public constant returns (uint256) {
        return _totalSupply;
    }

    /// @param _owner address
    function balanceOf(address _owner) public constant returns (uint256) {
        return _balanceOf[_owner];
    }

    /// @notice set address of token porter
    /// @param _tokenPorter address of token porter
    function setTokenPorter(address _tokenPorter) public onlyOwner returns (bool) {
        require(_tokenPorter != 0x0);

        tokenPorter = ITokenPorter(_tokenPorter);
        return true;
    }

    /// @notice allow minter and tokenPorter to mint token and assign to address
    /// @param _to to address
    /// @param _value Amount to be minted  
    function mint(address _to, uint _value) public returns (bool) {
        require(msg.sender == minter || msg.sender == address(tokenPorter));
        _balanceOf[_to] = _balanceOf[_to].add(_value);
        _totalSupply = _totalSupply.add(_value);
        emit Mint(_to, _value);
        emit Transfer(0x0, _to, _value);
        return true;
    }

    /// @notice allow autonomousConverter and tokenPorter to mint token and assign to address
    /// @param _from  from address
    /// @param _value Amount to be destroyed
    function destroy(address _from, uint _value) public returns (bool) {
        require(msg.sender == autonomousConverter || msg.sender == address(tokenPorter));
        _balanceOf[_from] = _balanceOf[_from].sub(_value);
        _totalSupply = _totalSupply.sub(_value);
        emit Destroy(_from, _value);
        emit Transfer(_from, 0x0, _value);
        return true;
    }
}