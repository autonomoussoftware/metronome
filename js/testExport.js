var funder = eth.accounts[0]
var owner = METToken.owner()

var buyers = [
	personal.newAccount('password'),
	personal.newAccount('password'),
	personal.newAccount('password')
]

var fundBuyers = function () {
	for (var i = 0; i < buyers.length; i++) {
		var tx = eth.sendTransaction({to: buyers[i], from: funder, value: web3.toWei(1000, 'ether')})
		waitForTx(tx)
		console.log('fund buyer', i)
	}
} ()

var buyMTNFor = function (i) {
	var buyer = buyers[i]
	personal.unlockAccount(buyer, 'password')
  	var tx = eth.sendTransaction({to: Auctions.address, from: buyer, value: web3.toWei(1, 'ether')})
  	waitForTx(tx)
  	console.log('buyer', i, 'purchases MTN')
  	console.log('buyer', i, 'has', METToken.balanceOf(buyer))
}

var buyMTNForAll = function () {
	for (var i = 0; i < buyers.length; i++) {
		buyMTNFor(i)
	}
} ()

var deployTokenPorter = function () {
	console.log('Configuring TokenPorter')
	personal.unlockAccount(owner, 'newOwner')
	var byteCode = web3.eth.contract(TokenPorterJSON.abi).new.getData(METToken.address, Auctions.address, {data: TokenPorterJSON.bytecode})
	var tx = eth.sendTransaction({from: owner, data: byteCode, gas: 4700000})
	var receipt = waitForTx(tx)
	var gas = METToken.setTokenPorter.estimateGas(receipt.contractAddress, {from: owner})
	tx = METToken.setTokenPorter(receipt.contractAddress, {from: owner, gas: gas})
	waitForTx(tx)
	console.log('TokenPorter published at ' + METToken.tokenPorter())

	var TokenPorter = web3.eth.contract(TokenPorterJSON.abi).at(METToken.tokenPorter());
	TokenPorter.ExportReceiptLog().watch(function (err, response) {
		if(err) {
			console.log('export error', err)
		} else {
			console.log('export receipt found', JSON.stringify(response))
		}
	})
} ()

var exportMTNFor = function (i) {
	var buyer = buyers[i]
	personal.unlockAccount(buyer, 'password')

	var destChain = 'ETH'
	var destMTNAddr = METToken.address // using same contract ideally replace with mock contract
	var destRecipAddr = buyer
	var amount = METToken.balanceOf(buyer)
	console.log('buyer', i, 'has', amount, 'before export')
    var extraData = 'extra data'
    var tx = METToken.export(
    	web3.fromAscii(destChain),
        destMTNAddr,
        destRecipAddr,
        amount,
        web3.fromAscii(extraData),
        { from: buyer })
    waitForTx(tx)
    console.log('buyer', i, 'has', METToken.balanceOf(buyer), 'after burn')
}


console.log('export tests are ready, invoke exportMTNFor(i), to test for export receipt monitoring')