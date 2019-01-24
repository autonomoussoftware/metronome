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
const FixedMath = artifacts.require('MockFixedMath')

contract('FixedMath', accounts => {
  let fixedMath

  beforeEach(async () => {
    fixedMath = await FixedMath.new()
  })

  const decMult = 10 ** 18

  describe('multiply', () => {
    const testCases = [
      { a: 2e18, b: 3e18, expected: 6e18 },
      { a: 2e8, b: 3e8, expected: 0 },
      { a: 2e8, b: 0, expected: 0 },
      { a: 0, b: 2e8, expected: 0 },
      { a: 1e18, b: 4.5e18, expected: 4.5e18 },
      { a: 4.5e18, b: 1e18, expected: 4.5e18 },
      { a: 100e18, b: 100e18, expected: 10000e18 },
      { a: 2e17, b: 4.5e18, expected: 9e17 }
    ]

    testCases.forEach((testCase, i) => {
      it((testCase.a / decMult) + ' * ' + (testCase.b / decMult) + ' = ' + (testCase.expected / decMult), () => {
        return new Promise(async (resolve, reject) => {
          const a = testCase.a
          const b = testCase.b
          const expectedOutput = testCase.expected
          const output = await fixedMath.fMulMock(a, b)
          assert.equal(output.toNumber(), expectedOutput, 'multiply math is incorrect for case ' + i)
          resolve()
        })
      })
    })
  })

  describe('divide', () => {
    const testCases = [
      { a: 3e18, b: 2e18, expected: 1.5e18 },
      { a: 3e18, b: 0, expected: NaN },
      { a: 0, b: 2e18, expected: 0 },
      { a: 5e18, b: 2.5e8, expected: 2e28 },
      { a: 2.5e8, b: 3e18, expected: 83333333 },
      { a: 2e8, b: 3e8, expected: 666666666666666666 }

    ]

    testCases.forEach((testCase, i) => {
      it((testCase.a / decMult) + ' / ' + (testCase.b / decMult) + ' = ' + (testCase.expected / decMult), () => {
        return new Promise(async (resolve, reject) => {
          const a = testCase.a
          const b = testCase.b
          const expectedOutput = testCase.expected

          if (isNaN(expectedOutput)) {
            let thrown = false
            try {
              await fixedMath.fDivMock(a, b)
            } catch (error) {
              thrown = true
            }
            assert.isTrue(thrown, 'Error is not thrown when diving by 0 for case ' + i)
          } else {
            const output = await fixedMath.fDivMock(a, b)
            assert.equal(output.toNumber(), expectedOutput, 'div math is incorrect for case ' + i)
          }

          resolve()
        })
      })
    })
  })

  describe('sqrt', () => {
    const testCases = [
      { a: 4e17, expected: 632455532033675867 },
      { a: 0, expected: 0 },
      { a: 1e18, expected: 1e18 }
    ]

    testCases.forEach((testCase, i) => {
      it('sqrt(' + (testCase.a / decMult) + ') = ' + (testCase.expected / decMult), () => {
        return new Promise(async (resolve, reject) => {
          const a = testCase.a
          const expectedOutput = testCase.expected
          const output = await fixedMath.fSqrtMock(a)
          assert.equal(output.toNumber(), expectedOutput, 'sqrt math is incorrect for case ' + i)
          resolve()
        })
      })
    })
  })
})
