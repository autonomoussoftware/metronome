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

import "./FixedMath.sol";


/// @title A formula contract for converter
contract Formula is FixedMath {

    /// @notice Trade in reserve(ETH/MET) and mint new smart tokens
    /// @param smartTokenSupply Total supply of smart token
    /// @param reserveTokensSent Amount of token sent by caller
    /// @param reserveTokenBalance Balance of reserve token in the contract
    /// @return Smart token minted
    function returnForMint(uint smartTokenSupply, uint reserveTokensSent, uint reserveTokenBalance) 
        internal pure returns (uint)
    {
        uint s = smartTokenSupply;
        uint e = reserveTokensSent;
        uint r = reserveTokenBalance;
        /// smartToken for mint(T) = S * (sqrt(1 + E/R) - 1)
        /// DECMULT is same as 1 for values with 18 decimal places
        return ((fMul(s, (fSub(fSqrt(fAdd(DECMULT, fDiv(e, r))), DECMULT)))).mul(METDECMULT)).div(DECMULT);
    }

    /// @notice Redeem smart tokens, get back reserve(ETH/MET) token
    /// @param smartTokenSupply Total supply of smart token
    /// @param smartTokensSent Smart token sent
    /// @param reserveTokenBalance Balance of reserve token in the contract
    /// @return Reserve token redeemed
    function returnForRedemption(uint smartTokenSupply, uint smartTokensSent, uint reserveTokenBalance)
        internal pure returns (uint)
    {
        uint s = smartTokenSupply;
        uint t = smartTokensSent;
        uint r = reserveTokenBalance;
        /// reserveToken (E) = R * (1 - (1 - T/S)**2)
        /// DECMULT is same as 1 for values with 18 decimal places
        return ((fMul(r, (fSub(DECMULT, fSqr(fSub(DECMULT, fDiv(t, s))))))).mul(METDECMULT)).div(DECMULT);
    }
}