<h1 align="center">
  <img src="./logo.png" alt="Metronome" width="50%">
</h1>

Ⓜ️ Metronome Token Contracts as described in the [Metronome User's Manual](https://www.metronome.io/pdf/owners_manual.pdf)

## Index
1. [Requirements](#requirements)
1. [Getting Started](#getting-started)
1. [Installation](#installation)
1. [Test Suite](#test-suite)
1. [License](#license)

## Requirements

You will need a MacOS or Linux system.

- Install the latest version of `parity`.
- Install the latest version of `solc`.
- Install the latest version of `npm`.

Local development is worked against TestRPC (which will be installed via `npm`).   Parity is used to test against a local dev-chain (see `parity-spec.json`) and can also be used to test agains Ropsten TestNet or the Public MainNet.

## Getting Started

### Production Environment

* **Explorer URL**: https://explorer.metronome.io
* **Auction Board URL**: https://metronome.io

### Production Contracts

**Version**: autonomoussoftware/metronome#35a6cd3

Contract | Address
--- | ---
Auctions | 0x9d9BcDd249E439AAaB545F59a33812E39A8e3072
AutonomousConverter | 0x686e5ac50D9236A9b7406791256e47feDDB26AbA
METToken | 0xa3d58c4E56fedCae3a7c43A725aeE9A71F0ece4e

### Developement environment

#### Installation
- `npm install` to install all module dependencies
- `npm test` to compile all the contracts and run the entire test suite agains TestRPC
- `TESTFILE=test/<testfile>.js npm run testrpc:single` to compile and run a single test file

#### Parity Local Dev Chain Testing
- `./deploy` to compile all the contracts and deploy them to a local parity dev-chain (this script will automatically start Parity)
- `geth attach --preload js/metronome.js,js/const.js,js/initMetronome.js` to open a geth console and start metronome
- `geth attach --preload js/metronome.js,js/const.js,js/initPostAuction.js` to open a geth console and start metronme (bypassing the initial auction)

Here geth console commands to emulate auction transactions
- `loadScript('js/testStart.js')` to load a geth test script for auction buys
- call `pingBuy()` to simulate a buy (this will also initiate a buy every 30 seconds)

## Test Suite

Sample code of how to interact with the smart contracts can be viewed in the Truffle tests.

### Unit Tests (`./test`)

- `shared` folder contains utility code shared amongs multiple test cases
- `auctions.js` tests for the Auction contract
- `deployment.js` tests for emulating actual deployment process for all the contracts
- `erc-compliance.js` tests for ERC20 and ERC827 compliance
- `fixedMath.js` tests for the Fixed Math contract (internal functions used by Metronome)
- `formula.js` tests for the Formula contract (math for minting calculations)
- `metronome.js` tests for Metronome use cases involving the AutonomousConverter
- `mtnToken.js` tests for MET Token use cases (i.e., transfering tokens)
- `owned.js` tests for Ownership operations (i.e., changeOwnership)
- `pricer.js` tests for Pricer contract (internal functions used by Metronome)
- `proceeds.js` tests for Proceeds contract to manage ETH funds
- `smartToken.js` tests for internal SmartToken contract used by AutonomousConverter
- `tokenLocker.js` tests used for time locking founder tokens
- `tokenPorter.js` tests for exporting MET tokens to be imported to another chain

### Timed Tests (`./timed-tests`)

Simuating time proved to be a challenge, so we had to migrate a seperate suite of tests so that we can take advantage of `evm_increaseTime`.  This allowed us to better test targeted scenarios that depended on system time.

- `ac.js` timed tests for AutonomousConverter
- `auctions.js` timed tests for Auctions
- `proceeds.js` timed tests for Proceeds
- `subscriptions.js` timed tests for MET Token subscriptions
- `tokenLocker.js` timed tests for TokenLocker withdraws

## LICENSE
[MIT License](https://github.com/autonomoussoftware/metronome/blob/master/LICENSE).
