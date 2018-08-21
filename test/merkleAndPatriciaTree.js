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

const PatriciaTree = artifacts.require('PatriciaTree')
const MerkleTree = artifacts.require('MerkleTree')
const MerkleTreeJs = require('merkletreejs')
const MerkleLib = require('merkle-lib')
const merkleProof = require('merkle-lib/proof')
const crypto = require('crypto')

function sha256 (data) {
  // returns Buffer
  return crypto.createHash('sha256').update(data).digest()
}

contract('PatriciaTree', accounts => {
  const OWNER = accounts[0]
  var patriciaTree
  var merkleTree
  beforeEach(async () => {
    patriciaTree = await PatriciaTree.new({from: OWNER})
    merkleTree = await MerkleTree.new({from: OWNER})
  })

  it('Test case 1: Test merklejs library', () => {
    return new Promise(async (resolve, reject) => {
      const leaves = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(x => sha256(x))
      // console.log('Buffer.from=', Buffer.from('ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb', 'hex'))
      console.log('leaves=', leaves)
      const tree = new MerkleTreeJs(leaves, sha256)
      console.log('tree=', tree)
      var proof = tree.getProof(leaves[5])
      if (proof === null) {
        console.error('No proof exists!')
      }
      console.log('proof=', proof)
      console.log('proof in string=', proof.map(x => x && x.toString('hex')))
      const root = tree.getRoot()
      console.log('root = ', root)
      resolve()
    })
  })

  it('Test case 2: Test merkle-lib library', () => {
    return new Promise(async (resolve, reject) => {
      const leaves = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(x => sha256(x))
      // console.log('Buffer.from=', Buffer.from('ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb', 'hex'))
      console.log('leaves=', leaves)
      const tree = new MerkleLib(leaves, sha256)
      console.log('tree=', tree)
      var proof = merkleProof(tree, leaves[5])
      if (proof === null) {
        console.error('No proof exists!')
      }
      console.log('proof=', proof)
      console.log('proof in string=', proof.map(x => x && x.toString('hex')))
      resolve()
    })
  })

  it('Check gas and root in MerkleTree in method 1', () => {
    return new Promise(async (resolve, reject) => {
      // let hashes = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'nine', 'ten']
      var leaves = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(x => sha256(x))
      await merkleTree.setExportedBurnHashes(leaves)
      let tx = await merkleTree.createMerkleTreeMethod1()
      console.log('Gas used to create merkle tree', tx.receipt.gasUsed)
      console.log('root=', await merkleTree.root())
      resolve()
    })
  })

  it('Check gas and root in MerkleTree in method 2', () => {
    return new Promise(async (resolve, reject) => {
      // let hashes = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'nine', 'ten']
      // var leaves = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(x => sha256(x))
      var leaves = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(x => sha256(x).toString('hex'))
      leaves = leaves.map(x => '0x' + x)
      console.log('temp=', leaves)
      await merkleTree.setExportedBurnHashes(leaves)
      let tx = await merkleTree.createMerkleTreeMethod2()
      console.log('Gas used to create merkle tree', tx.receipt.gasUsed)
      console.log('root=', await merkleTree.root())
      console.log('buffer to string of a', sha256('a').toString('hex'))
      console.log('buffer to string of a', sha256('b').toString('hex'))
      resolve()
    })
  })

  it('Check gas, path and verify path in PatriciaTree', () => {
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
