/*
    The MIT License (MIT)

    Copyright 2017 - 2018, Alchemy Limited, LLC.

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

/* globals eth, Auctions, AutonomousConverter, MTNToken, Proceeds, SmartToken */
var auctions = eth.contract(Auctions.abi).at('0xd0aa441ccc3926bcc28d586043bed845d9617ce1')
var autonomousConverter = eth.contract(AutonomousConverter.abi).at('0xe969a7d8ffdbfe8cfd61886890daa3e45f548e0d')
var mtnToken = eth.contract(MTNToken.abi).at('0x2d9a998fa591ef40563dc56bac835d03680f8d23')
var proceeds = eth.contract(Proceeds.abi).at('0xb16cbbba56daa191243cd404ffa3adbf1ac0fc5f')
var smartToken = eth.contract(SmartToken.abi).at('0x10d209fbfd912bb1aaa4e632188c21e3b9601232')

// helper file to connect to testnet, addresses will need to be manually updated to target specific versions
