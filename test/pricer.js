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

const assert = require('chai').assert
const Pricer = artifacts.require('Pricer')

contract('Pricer', accounts => {
  let pricer

  beforeEach(async () => {
    pricer = await Pricer.new()
    await pricer.initPricer()
  })

  it('Should verify that pricer calculated 10x, 100x and 1000x of 0.99 correctly', () => {
    return new Promise(async (resolve, reject) => {
      const tentimes = 904382075008804490
      assert.equal(await pricer.tentimes(), tentimes, 'tentimes of 0.99 is not calculated correctly')

      const hundredtimes = 366032341273229501
      assert.equal(await pricer.hundredtimes(), hundredtimes, 'hundredtimes of 0.99 is not calculated correctly')

      const thousandtimes = 43171247410657
      assert.equal(await pricer.thousandtimes(), thousandtimes, 'thousandtimes 0.99 is not calculated correctly')

      resolve()
    })
  })

  it('Should test correct priceAt every minute for 2 ETH', () => {
    return new Promise(async (resolve, reject) => {
      var initialPrice = 2e18
      const delta = 1400
      for (var i = 1; i <= 1440; i++) {
        const expectedPrice = initialPrice * Math.pow(0.99, i)
        const actualPrice = await pricer.priceAt(initialPrice, i)
        assert.closeTo(actualPrice.toNumber(), expectedPrice, delta, 'Price calculation is not correct for i = ' + i)
      }

      resolve()
    })
  })

  it('Should return correct priceAt 7th minute for 2 ETH', () => {
    return new Promise(async (resolve, reject) => {
      const expectedPrice = 1864130695813980000
      const output = await pricer.priceAt(2e18, 7)
      assert.equal(output.valueOf(), expectedPrice, 'Calcualted price at 7th minute is not correct')

      resolve()
    })
  })

  it('Should return correct priceAt 50th minute for 2 ETH', () => {
    return new Promise(async (resolve, reject) => {
      const expectedPrice = 1210012134275073296
      const output = await pricer.priceAt(2e18, 50)
      assert.equal(output.valueOf(), expectedPrice, 'Calcualted price at 50th minute is not correct')
      resolve()
    })
  })

  it('Should return correct priceAt 101st minute for 2 ETH', () => {
    return new Promise(async (resolve, reject) => {
      const expectedPrice = 724744035720994410
      const output = await pricer.priceAt(2e18, 101)
      assert.equal(output.valueOf(), expectedPrice, 'Calcualted price at 101st minute is not correct')

      resolve()
    })
  })

  it('Should return correct priceAt 1200th minute for 2 ETH', () => {
    return new Promise(async (resolve, reject) => {
      const expectedPrice = 11568139382584
      const output = await pricer.priceAt(2e18, 1200)
      assert.equal(output.valueOf(), expectedPrice, 'Calcualted price at 1200th minute is not correct')

      resolve()
    })
  })
})
