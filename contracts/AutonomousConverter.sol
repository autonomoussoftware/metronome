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

import "./Formula.sol";
import "./Owned.sol";
import "./SmartToken.sol";
import "./METToken.sol";
import "./Auctions.sol";


/// @title Autonomous Converter contract for MET <=> ETH exchange
contract AutonomousConverter is Formula, Owned {

    SmartToken public smartToken;
    METToken public reserveToken;
    Auctions public auctions;

    enum WhichToken { Eth, Met }
    bool internal initialized = false;

    event LogFundsIn(address indexed from, uint value);
    event ConvertEthToMet(address indexed from, uint eth, uint met);
    event ConvertMetToEth(address indexed from, uint eth, uint met);

    function init(address _reserveToken, address _smartToken, address _auctions) 
        public onlyOwner payable 
    {
        require(!initialized);
        auctions = Auctions(_auctions);
        reserveToken = METToken(_reserveToken);
        smartToken = SmartToken(_smartToken);
        initialized = true;
    }

    function handleFund() public payable {
        require(msg.sender == address(auctions.proceeds()));
        emit LogFundsIn(msg.sender, msg.value);
    }

    function getMetBalance() public view returns (uint) {
        return balanceOf(WhichToken.Met);
    }

    function getEthBalance() public view returns (uint) {
        return balanceOf(WhichToken.Eth);
    }

    /// @notice return the expected MET for ETH
    /// @param _depositAmount ETH.
    /// @return expected MET value for ETH
    function getMetForEthResult(uint _depositAmount) public view returns (uint256) {
        return convertingReturn(WhichToken.Eth, _depositAmount);
    }

    /// @notice return the expected ETH for MET
    /// @param _depositAmount MET.
    /// @return expected ETH value for MET
    function getEthForMetResult(uint _depositAmount) public view returns (uint256) {
        return convertingReturn(WhichToken.Met, _depositAmount);
    }

    /// @notice send ETH and get MET
    /// @param _minReturn execute conversion only if return is equal or more than _mintReturn
    /// @return returnedMet MET retured after conversion
    function convertEthToMet(uint _minReturn) public payable returns (uint returnedMet) {
        returnedMet = convert(WhichToken.Eth, _minReturn, msg.value);
        emit ConvertEthToMet(msg.sender, msg.value, returnedMet);
    }

    /// @notice send MET and get ETH
    /// @dev Caller will be required to approve the AutonomousConverter to initiate the transfer
    /// @param _amount MET amount
    /// @param _minReturn execute conversion only if return is equal or more than _mintReturn
    /// @return returnedEth ETh returned after conversion
    function convertMetToEth(uint _amount, uint _minReturn) public returns (uint returnedEth) {
        returnedEth = convert(WhichToken.Met, _minReturn, _amount);
        emit ConvertMetToEth(msg.sender, returnedEth, _amount);
    }

    function balanceOf(WhichToken which) internal view returns (uint) {
        if (which == WhichToken.Eth) return address(this).balance;
        if (which == WhichToken.Met) return reserveToken.balanceOf(this);
        revert();
    }

    function convertingReturn(WhichToken whichFrom, uint _depositAmount) internal view returns (uint256) {
        
        WhichToken to = WhichToken.Met;
        if (whichFrom == WhichToken.Met) {
            to = WhichToken.Eth;
        }

        uint reserveTokenBalanceFrom = balanceOf(whichFrom).add(_depositAmount);
        uint mintRet = returnForMint(smartToken.totalSupply(), _depositAmount, reserveTokenBalanceFrom);
        
        uint newSmartTokenSupply = smartToken.totalSupply().add(mintRet);
        uint reserveTokenBalanceTo = balanceOf(to);
        return returnForRedemption(
            newSmartTokenSupply,
            mintRet,
            reserveTokenBalanceTo);
    }

    function convert(WhichToken whichFrom, uint _minReturn, uint amnt) internal returns (uint) {
        WhichToken to = WhichToken.Met;
        if (whichFrom == WhichToken.Met) {
            to = WhichToken.Eth;
            require(reserveToken.transferFrom(msg.sender, this, amnt));
        }

        uint mintRet = mint(whichFrom, amnt);
        
        return redeem(to, mintRet, _minReturn);
    }

    function mint(WhichToken which, uint _depositAmount) internal returns (uint256 amount) {
        amount = mintingReturn(which, _depositAmount);
        require(amount > 0);
        require(smartToken.mint(msg.sender, amount));
    }

    function mintingReturn(WhichToken which, uint _depositAmount) internal view returns (uint256) {
        uint256 smartTokenSupply = smartToken.totalSupply();
        uint256 reserveBalance = balanceOf(which);
        return returnForMint(smartTokenSupply, _depositAmount, reserveBalance);
    }

    function redeem(WhichToken which, uint _amount, uint _minReturn) internal returns (uint redeemable) {
        require(_amount <= smartToken.balanceOf(msg.sender));
        require(_minReturn > 0);

        redeemable = redemptionReturn(which, _amount);
        require(redeemable >= _minReturn);

        uint256 reserveBalance = balanceOf(which);
        require(reserveBalance >= redeemable);

        uint256 tokenSupply = smartToken.totalSupply();
        require(_amount < tokenSupply);

        smartToken.destroy(msg.sender, _amount);
        if (which == WhichToken.Eth) {
            msg.sender.transfer(redeemable);
        } else {
            require(reserveToken.transfer(msg.sender, redeemable));
        }
    }

    function redemptionReturn(WhichToken which, uint smartTokensSent) internal view returns (uint256) {
        uint smartTokenSupply = smartToken.totalSupply();
        uint reserveTokenBalance = balanceOf(which);
        return returnForRedemption(
            smartTokenSupply,
            smartTokensSent,
            reserveTokenBalance);
    }
}