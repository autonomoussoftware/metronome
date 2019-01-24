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


/// @title Pricer contract to calculate descending price during auction.
contract Pricer {

    using SafeMath for uint;
    uint constant internal METDECIMALS = 18;
    uint constant internal METDECMULT = 10 ** METDECIMALS;
    uint public minimumPrice = 33*10**11;
    uint public minimumPriceInDailyAuction = 1;

    uint public tentimes;
    uint public hundredtimes;
    uint public thousandtimes;

    uint constant public MULTIPLIER = 1984320568*10**5;

    /// @notice Pricer constructor, calculate 10, 100 and 1000 times of 0.99.
    function initPricer() public {
        uint x = METDECMULT;
        uint i;
        
        /// Calculate 10 times of 0.99
        for (i = 0; i < 10; i++) {
            x = x.mul(99).div(100);
        }
        tentimes = x;
        x = METDECMULT;

        /// Calculate 100 times of 0.99 using tentimes calculated above.
        /// tentimes has 18 decimal places and due to this METDECMLT is
        /// used as divisor.
        for (i = 0; i < 10; i++) {
            x = x.mul(tentimes).div(METDECMULT);
        }
        hundredtimes = x;
        x = METDECMULT;

        /// Calculate 1000 times of 0.99 using hundredtimes calculated above.
        /// hundredtimes has 18 decimal places and due to this METDECMULT is
        /// used as divisor.
        for (i = 0; i < 10; i++) {
            x = x.mul(hundredtimes).div(METDECMULT);
        }
        thousandtimes = x;
    }

    /// @notice Price of MET at nth minute out during operational auction
    /// @param initialPrice The starting price ie last purchase price
    /// @param _n The number of minutes passed since last purchase
    /// @return The resulting price
    function priceAt(uint initialPrice, uint _n) public view returns (uint price) {
        uint mult = METDECMULT;
        uint i;
        uint n = _n;

        /// If quotient of n/1000 is greater than 0 then calculate multiplier by
        /// multiplying thousandtimes and mult in a loop which runs quotient times.
        /// Also assign new value to n which is remainder of n/1000.
        if (n / 1000 > 0) {
            for (i = 0; i < n / 1000; i++) {
                mult = mult.mul(thousandtimes).div(METDECMULT);
            }
            n = n % 1000;
        }

        /// If quotient of n/100 is greater than 0 then calculate multiplier by
        /// multiplying hundredtimes and mult in a loop which runs quotient times.
        /// Also assign new value to n which is remainder of n/100.
        if (n / 100 > 0) {
            for (i = 0; i < n / 100; i++) {
                mult = mult.mul(hundredtimes).div(METDECMULT);
            }
            n = n % 100;
        }

        /// If quotient of n/10 is greater than 0 then calculate multiplier by
        /// multiplying tentimes and mult in a loop which runs quotient times.
        /// Also assign new value to n which is remainder of n/10.
        if (n / 10 > 0) {
            for (i = 0; i < n / 10; i++) {
                mult = mult.mul(tentimes).div(METDECMULT);
            }
            n = n % 10;
        }

        /// Calculate multiplier by multiplying 0.99 and mult, repeat it n times.
        for (i = 0; i < n; i++) {
            mult = mult.mul(99).div(100);
        }

        /// price is calculated as initialPrice multiplied by 0.99 and that too _n times.
        /// Here mult is METDECMULT multiplied by 0.99 and that too _n times.
        price = initialPrice.mul(mult).div(METDECMULT);
        
        if (price < minimumPriceInDailyAuction) {
            price = minimumPriceInDailyAuction;
        }
    }

    /// @notice Price of MET at nth minute during initial auction.
    /// @param lastPurchasePrice The price of MET in last transaction
    /// @param numTicks The number of minutes passed since last purchase
    /// @return The resulting price
    function priceAtInitialAuction(uint lastPurchasePrice, uint numTicks) public view returns (uint price) {
        /// Price will decrease linearly every minute by the factor of MULTIPLIER.
        /// If lastPurchasePrice is greater than decrease in price then calculated the price.
        /// Return minimumPrice, if calculated price is less than minimumPrice.
        /// If decrease in price is more than lastPurchasePrice then simply return the minimumPrice.
        if (lastPurchasePrice > MULTIPLIER.mul(numTicks)) {
            price = lastPurchasePrice.sub(MULTIPLIER.mul(numTicks));
        }

        if (price < minimumPrice) {
            price = minimumPrice;
        }
    }
}