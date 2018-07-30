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
const Validator = artifacts.require('Validator')

contract('Validator', accounts => {
  const OWNER = accounts[0]
  let validator
  let validatorAddress1 = accounts[7]
  let validatorAddress2 = accounts[8]
  beforeEach(async () => {
    validator = await Validator.new({from: OWNER})
  })

  it('Only owner should be able to add new validator', () => {
    return new Promise(async (resolve, reject) => {
      let thrown = false
      try {
        await validator.addValidator(validatorAddress1, {from: accounts[1]})
      } catch (error) {
        thrown = true
      }
      assert.isTrue(thrown, 'addValidator did not throw')
      resolve()
    })
  })

  it('Owner should be able to add new validator', () => {
    return new Promise(async (resolve, reject) => {
      await validator.addValidator(validatorAddress2, {from: OWNER})
      assert.equal(await validator.validators(0), validatorAddress2, 'New validator is not added correctly')
      assert.isTrue(await validator.isValidator(validatorAddress2), 'validator is not set correctly')
      resolve()
    })
  })

  it('Owner should be able to remove validators and array should shrink', () => {
    return new Promise(async (resolve, reject) => {
      await validator.addValidator(accounts[1], {from: OWNER})
      await validator.addValidator(accounts[2], {from: OWNER})
      await validator.addValidator(accounts[3], {from: OWNER})
      await validator.addValidator(accounts[4], {from: OWNER})
      await validator.addValidator(accounts[5], {from: OWNER})
      assert.equal(await validator.validators(4), accounts[5], 'New validator is not added correctly')
      await validator.removeValidator(accounts[5], {from: OWNER})
      assert.isFalse(await validator.isValidator(accounts[5]), 'validator is not removed correctly')
      let thrown = false
      try {
        let temp = await validator.validators(4)
        console.log(temp)
        console.log(accounts[5])
      } catch (error) {
        thrown = true
      }
      assert.isTrue(thrown, 'Last validator not removed correctly. Array lenght not decreased')

      await validator.removeValidator(accounts[2], {from: OWNER})
      assert.isFalse(await validator.isValidator(accounts[2]), 'validator is not removed correctly')
      thrown = false
      try {
        let temp = await validator.validators(3)
        console.log(temp)
        console.log(accounts[5])
      } catch (error) {
        thrown = true
      }
      assert.isTrue(thrown, 'Validator not removed correctly. Array lenght not decreased')
      assert.equal(await validator.validators(0), accounts[1], 'Validator is not correct at index 0')
      assert.equal(await validator.validators(1), accounts[3], 'Validator is not correct at index 1')
      assert.equal(await validator.validators(2), accounts[4], 'Validator is not correct at index 2')
      resolve()
    })
  })
})
