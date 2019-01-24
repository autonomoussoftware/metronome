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


/// @title Math operation when both numbers has decimal places.
/// @notice Use this contract when both numbers has 18 decimal places. 
contract FixedMath {
    
    using SafeMath for uint;
    uint constant internal METDECIMALS = 18;
    uint constant internal METDECMULT = 10 ** METDECIMALS;
    uint constant internal DECIMALS = 18;
    uint constant internal DECMULT = 10 ** DECIMALS;

    /// @notice Multiplication.
    function fMul(uint x, uint y) internal pure returns (uint) {
        return (x.mul(y)).div(DECMULT);
    }

    /// @notice Division.
    function fDiv(uint numerator, uint divisor) internal pure returns (uint) {
        return (numerator.mul(DECMULT)).div(divisor);
    }

    /// @notice Square root.
    /// @dev Reference: https://stackoverflow.com/questions/3766020/binary-search-to-compute-square-root-java
    function fSqrt(uint n) internal pure returns (uint) {
        if (n == 0) {
            return 0;
        }
        uint z = n * n;
        require(z / n == n);

        uint high = fAdd(n, DECMULT);
        uint low = 0;
        while (fSub(high, low) > 1) {
            uint mid = fAdd(low, high) / 2;
            if (fSqr(mid) <= n) {
                low = mid;
            } else {
                high = mid;
            }
        }
        return low;
    }

    /// @notice Square.
    function fSqr(uint n) internal pure returns (uint) {
        return fMul(n, n);
    }

    /// @notice Add.
    function fAdd(uint x, uint y) internal pure returns (uint) {
        return x.add(y);
    }

    /// @notice Sub.
    function fSub(uint x, uint y) internal pure returns (uint) {
        return x.sub(y);
    }
}