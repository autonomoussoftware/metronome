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

import "./SafeMath.sol";
import "./Owned.sol";
import "./AutonomousConverter.sol";
import "./Auctions.sol";


/// @title Proceeds contract
contract Proceeds is Owned {
    using SafeMath for uint256;

    AutonomousConverter public autonomousConverter;
    Auctions public auctions;
    event LogProceedsIn(address indexed from, uint value); 
    event LogClosedAuction(address indexed from, uint value);
    uint latestAuctionClosed;

    function initProceeds(address _autonomousConverter, address _auctions) public onlyOwner {
        require(address(auctions) == 0x0 && _auctions != 0x0);
        require(address(autonomousConverter) == 0x0 && _autonomousConverter != 0x0);

        autonomousConverter = AutonomousConverter(_autonomousConverter);
        auctions = Auctions(_auctions);
    }

    function handleFund() public payable {
        require(msg.sender == address(auctions));
        emit LogProceedsIn(msg.sender, msg.value);
    }

    /// @notice Forward 0.25% of total ETH balance of proceeds to AutonomousConverter contract
    function closeAuction() public {
        uint lastPurchaseTick = auctions.lastPurchaseTick();
        uint currentAuction = auctions.currentAuction();
        uint val = ((address(this).balance).mul(25)).div(10000); 
        if (val > 0 && (currentAuction > auctions.whichAuction(lastPurchaseTick)) 
            && (latestAuctionClosed < currentAuction)) {
            latestAuctionClosed = currentAuction;
            autonomousConverter.handleFund.value(val)();
            emit LogClosedAuction(msg.sender, val);
        }
    }
}