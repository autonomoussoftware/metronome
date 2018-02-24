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

const assert = require('assert')
const Formula = artifacts.require('MockFormula')

contract('Formula', accounts => {
  let formula

  beforeEach(async () => {
    formula = await Formula.new()
  })

  it('Should verify  return for mint test 1', () => {
    return new Promise(async (resolve, reject) => {
      const s = 1000e18
      const e = 3e18
      const r = 6e18
      const expectedOutput = 224.744871391589049e18
      const output = await formula.returnForMintTest(s, e, r)
      assert.equal(output, expectedOutput, 'Expected smart token minted from reserved token  is not correct')

      resolve()
    })
  })

  it('Should verify  return for mint test 2', () => {
    return new Promise(async (resolve, reject) => {
      const s = 1000e18
      const e = 3e19
      const r = 6e19
      const expectedOutput = 224.744871391589049e18
      const output = await formula.returnForMintTest(s, e, r)
      assert.equal(output, expectedOutput, 'Expected smart token minted from reserved token is not correct')

      resolve()
    })
  })

  it('Should verify  return for mint. Test 3', () => {
    return new Promise(async (resolve, reject) => {
      const s = 1000e18
      const e = 5e18
      const r = 2e18
      const expectedOutput = 870.828693386970693e18
      const output = await formula.returnForMintTest(s, e, r)
      assert.equal(output, expectedOutput, 'Expected smart token minted from reserved token  is not correct')

      resolve()
    })
  })

  it('Should verify  return for mint. Test 4', () => {
    return new Promise(async (resolve, reject) => {
      const S = 1000e18
      const E = 5
      const R = 2
      const expectedOutput = 870.828693386970693e18
      const output = await formula.returnForMintTest(S, E, R)
      assert.equal(output, expectedOutput, 'Expected smart token minted from reserved token  is not correct')

      resolve()
    })
  })

  it('Should verify  return for mint. Test 5', () => {
    return new Promise(async (resolve, reject) => {
      const S = 10000e18
      const E = 100e18
      const R = 2000e18
      const expectedOutput = 246950765959598380000
      const output = await formula.returnForMintTest(S, E, R)
      assert.equal(output, expectedOutput, 'Expected smart token minted from reserved token  is not correct')

      resolve()
    })
  })

  it('Should verify  return for smart token. Test 1', () => {
    return new Promise(async (resolve, reject) => {
      const S = 1000e18
      const T = 5e18
      const R = 100e18
      const expectedOutput = 0.9975e18
      const output = await formula.returnForRedemptionTest(S, T, R)
      assert.equal(output, expectedOutput, 'Expected reserved token redeemd from smart token  is not correct')

      resolve()
    })
  })

  it('Should verify  return for smart token. Test 2', () => {
    return new Promise(async (resolve, reject) => {
      const S = 1000e18
      const T = 5e18
      const R = 10e18
      const expectedOutput = 0.09975e18
      const output = await formula.returnForRedemptionTest(S, T, R)
      assert.equal(output, expectedOutput, 'Expected reserved token redeemd from smart token  is not correct')

      resolve()
    })
  })

  it('Should verify  return for smart token. Test 3', () => {
    return new Promise(async (resolve, reject) => {
      const S = 10247e18
      const T = 247e18
      const R = 1000e18
      const expectedOutput = 47628199458540441000
      const output = await formula.returnForRedemptionTest(S, T, R)
      assert.equal(output, expectedOutput, 'Expected reserved token redeemd from smart token  is not correct')

      resolve()
    })
  })
})
