
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

const MerkleTreeJs = require('merkletreejs')
const crypto = require('crypto')

function sha256 (data) {
  // returns Buffer
  return crypto.createHash('sha256').update(data).digest()
}
var validators = {}

function readExportEvent (sourceChain, burnHash, callBackFunction) {
  var exportLogEvent = validators[sourceChain].tokenPorter.ExportReceiptLog({currentBurnHash: burnHash}, {fromBlock: 0, toBlock: 'latest'})
  exportLogEvent.get(async (err, res) => {
    if (res && res.length > 0) {
      let burnSequence = res[0].args.burnSequence
      var burnHashes = []
      var i = 0
      if (burnSequence > 16) {
        i = burnSequence - 15
      }
      while (i <= burnSequence) {
        burnHashes.push(await validators[sourceChain].tokenPorter.exportedBurns(i))
        i++
      }
      const leaves = burnHashes.map(x => Buffer.from(x.slice(2), 'hex'))

      const tree = new MerkleTreeJs(leaves, sha256)
      var merkleProof = []
      var buffer = tree.getProof(leaves[leaves.length - 1])
      for (let j = 0; j < buffer.length; j++) {
        merkleProof.push('0x' + ((buffer[j].data).toString('hex')))
      }
      let root = '0x' + (tree.getRoot()).toString('hex')
      let exportEventLog = res[0].args
      exportEventLog['root'] = root
      exportEventLog['merkleProof'] = merkleProof
      exportEventLog['address'] = res[0].address
      exportEventLog['blockNumber'] = res[0].blockNumber
      callBackFunction(err, exportEventLog)
    } else {
      callBackFunction(err, null)
    }
  })
}

module.exports = {readExportEvent, validators}
