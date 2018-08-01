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
const PatriciaTree = artifacts.require('PatriciaTree')

contract('PatriciaTree', accounts => {
  const OWNER = accounts[0]
  let patriciaTree
  beforeEach(async () => {
    patriciaTree = await PatriciaTree.new({from: OWNER})
  })

  it('Check gas, path and verify path', () => {
    return new Promise(async (resolve, reject) => {
      let tx = await patriciaTree.insert('one', 'one')
      console.log('Gas used to insert a new leaf')
      console.log(tx.receipt.gasUsed)
      console.log(await web3.eth.getTransactionReceipt(tx))
      tx = await patriciaTree.insert('two', 'two')
      console.log('Gas used to insert a new leaf')
      console.log(tx.receipt.gasUsed)
      console.log(await web3.eth.getTransactionReceipt(tx))
      tx = await patriciaTree.insert('three', 'three')
      console.log('Gas used to insert a new leaf')
      console.log(tx.receipt.gasUsed)
      console.log(await web3.eth.getTransactionReceipt(tx))
      tx = await patriciaTree.insert('four', 'four')
      console.log('Gas used to insert a new leaf')
      console.log(tx.receipt.gasUsed)
      console.log(await web3.eth.getTransactionReceipt(tx))

      // Get proof
      var proof = await patriciaTree.getProof('one')
      console.log('siblings', proof[1])
      tx = await patriciaTree.insert('one', 'two')
      console.log('Gas used to update a leaf')
      console.log(tx.receipt.gasUsed)
      proof = await patriciaTree.getProof('two')
      console.log('siblings', proof[1])
      let root = await patriciaTree.root()
      try {
        await patriciaTree.verifyProof(root, 'two', 'two', proof[0], proof[1])
        console.log('verify done successfully')
      } catch (error) {
        console.log('verify failed')
      }

      try {
        await patriciaTree.verifyProof(root, 'two', 'sdf', proof[0], proof[1])
        console.log('verify done successfully')
      } catch (error) {
        console.log('verify failed')
      }

      resolve()
    })
  })
})
