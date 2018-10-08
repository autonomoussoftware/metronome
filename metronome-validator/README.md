# Metronome off-chain validator

Metronome off chain validators to validate export receipt and attest the same in destination chain.

### Prerequisites
1. Parity
2. Redis-server
3. Full synced etherum and ethereum classic node. Setting up both nodes on one computer will need to setup different port number for both.  Examples below
      Ethereum:    $ parity --geth --rpcapi=web3,eth,personal,rpc,net,parity  --jsonrpc-port=8545 --ws-port=8546 --port=33333 
      Ethereum classic: $ parity --geth --rpcapi=web3,eth,personal,rpc,net,parity  --jsonrpc-port=8555 --ws-port=8556 --port=30303 

### Installing
Install all depedencies packages by using below command in this directory
npm install

### Setup
1. Ethereum and Ethereum classic node must have two eth address setup on both nodes. Both address should have eth balance to pay for gas cost of attestation. 
2. Update config.json . Below is an example. Update node URL and address. Keep chainName same as example.  Most likely Ethereum and Ethereum classic may run on same computer but different port
{                                                             
    "eth": {
        "chainName":"ETH",                                   
       "nodeUrl": "http://localhost:8545",  // URL of ethereum node. Node must be full synced all time  
        "address": "0x00a329c0648769a73afac7f9381e08fb43dbea72" // Address of validator. Must have ether in balance to pay for gas cost            
    },                                         
    "etc": {         
        "chainName":"ETC",                               
       "nodeUrl": "http://localhost:8555",  // URL of ethereum classic node. Node must be full synced all time   
        "address": "0x00a329c0648769a73afac7f9381e08fb43dbea72" // Address of validator. Must have ether in balance to pay for gas cost            
    }                                          
} 

## Launch
  1. start redis server using command $ redis-server
  2. Launch validators using command $ node index.js launch [eth validator password] [etc validator password]   
       example:
       $ node index.js launch 'mypassword1' 'mypassword2'

For dev environment or no password require for validators then use command $ node index.js launch --dev

## Production environment
  For security reason, redis server port and URL must not be accessible from outside hence firewall must setup to disable http and specific port. 

### License 
MIT