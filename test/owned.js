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
const Owned = artifacts.require('Owned')
const Ownable = artifacts.require('Ownable')
contract('Owned', accounts => {
  const actors = {
    owner: accounts[0],
    alice: accounts[1],
    bob: accounts[2]
  }

  const contracts = {
    owned: null,
    ownable: null
  }

  beforeEach(async () => {
    contracts.owned = await Owned.new({ from: actors.owner })
    contracts.ownable = await Ownable.new({ from: actors.owner })
  })

  it('should have an owner', () => {
    return new Promise(async (resolve, reject) => {
      const owner = await contracts.owned.owner()
      assert.equal(owner, actors.owner, 'Owner was not the msg.sender')

      resolve()
    })
  })

  it('Owned contract: change owners', () => {
    return new Promise(async (resolve, reject) => {
      const success = await contracts.owned.changeOwnership.call(actors.alice, {from: actors.owner})
      assert.isTrue(success, 'changeOwnership did not return true')
      await contracts.owned.changeOwnership(actors.alice, {from: actors.owner})
      const tx = await contracts.owned.acceptOwnership({from: actors.alice})
      assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted')
      const log = tx.logs[0]
      assert.equal(log.event, 'OwnershipChanged', 'OwnershipChanged log was not emitted')
      assert.equal(log.args.prevOwner, actors.owner, 'prevOwner is incorrect')
      assert.equal(log.args.newOwner, actors.alice, 'newOwner is incorrect')

      const owner = await contracts.owned.owner()
      assert.equal(owner, actors.alice, 'Ownership did not change correctly')

      resolve()
    })
  })

  it('Owned contract: cannot change to the same owner', () => {
    return new Promise(async (resolve, reject) => {
      let thrown = false
      try {
        await contracts.owned.changeOwnership(actors.owner, {from: actors.owner})
      } catch (error) {
        thrown = true
      }

      assert.isTrue(thrown, 'changeOwnership did not throw')

      resolve()
    })
  })

  it('Owned contract: can change owner more than once', () => {
    return new Promise(async (resolve, reject) => {
      await contracts.owned.changeOwnership(actors.alice, {from: actors.owner})
      await contracts.owned.acceptOwnership({from: actors.alice})
      await contracts.owned.changeOwnership(actors.bob, {from: actors.alice})
      const tx = await contracts.owned.acceptOwnership({from: actors.bob})
      const log = tx.logs[0]
      assert.equal(log.event, 'OwnershipChanged', 'OwnershipChanged log was not emitted')
      assert.equal(log.args.prevOwner, actors.alice, 'prevOwner is incorrect')
      assert.equal(log.args.newOwner, actors.bob, 'newOwner is incorrect')

      const owner = await contracts.owned.owner()
      assert.equal(owner, actors.bob, 'Ownership did not change correctly')

      resolve()
    })
  })

  it('Owned contract: only owner is allowed to change', () => {
    return new Promise(async (resolve, reject) => {
      let thrown = false
      try {
        await contracts.owned.changeOwnership(actors.alice, {from: actors.alice})
      } catch (error) {
        thrown = true
      }

      assert.isTrue(thrown, 'changeOwnership did not throw')

      resolve()
    })
  })

  it('Ownable contract: change owners', () => {
    return new Promise(async (resolve, reject) => {
      const success = await contracts.ownable.changeOwnership.call(actors.alice, {from: actors.owner})
      assert.isTrue(success, 'changeOwnership did not return true')
      const tx = await contracts.ownable.changeOwnership(actors.alice, {from: actors.owner})
      assert.equal(tx.logs.length, 1, 'Incorrect number of logs emitted')
      const log = tx.logs[0]
      assert.equal(log.event, 'OwnershipChanged', 'OwnershipChanged log was not emitted')
      assert.equal(log.args.prevOwner, actors.owner, 'prevOwner is incorrect')
      assert.equal(log.args.newOwner, actors.alice, 'newOwner is incorrect')

      const owner = await contracts.ownable.owner()
      assert.equal(owner, actors.alice, 'Ownership did not change correctly')

      resolve()
    })
  })

  it('Ownable contract: cannot change to the same owner', () => {
    return new Promise(async (resolve, reject) => {
      let thrown = false
      try {
        await contracts.ownable.changeOwnership(actors.owner, {from: actors.owner})
      } catch (error) {
        thrown = true
      }

      assert.isTrue(thrown, 'changeOwnership did not throw')

      resolve()
    })
  })

  it('Ownable contract: can change owner more than once', () => {
    return new Promise(async (resolve, reject) => {
      await contracts.ownable.changeOwnership(actors.alice, {from: actors.owner})
      const tx = await contracts.ownable.changeOwnership(actors.bob, {from: actors.alice})
      const log = tx.logs[0]
      assert.equal(log.event, 'OwnershipChanged', 'OwnershipChanged log was not emitted')
      assert.equal(log.args.prevOwner, actors.alice, 'prevOwner is incorrect')
      assert.equal(log.args.newOwner, actors.bob, 'newOwner is incorrect')

      const owner = await contracts.ownable.owner()
      assert.equal(owner, actors.bob, 'Ownership did not change correctly')

      resolve()
    })
  })

  it('Ownable contract: only owner is allowed to change', () => {
    return new Promise(async (resolve, reject) => {
      let thrown = false
      try {
        await contracts.ownable.changeOwnership(actors.alice, {from: actors.alice})
      } catch (error) {
        thrown = true
      }

      assert.isTrue(thrown, 'changeOwnership did not throw')

      resolve()
    })
  })
})
