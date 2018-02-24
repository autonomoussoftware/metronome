# Metronome Deployment and Testing

## Three tiers of deploy and test

The metronome contracts are complex, and will reward significant testing, unit tests and integration tests.

The fastest test infrastructure is through the New Alchemy tevm. However, this environment does not make it easy to check real deployed code, or to have more integration testing. 


`go test` will run tests using the NA tevm and seth tools.

`./deploy` will run a deployment on a parity testnet, homed in `/tmp/paritydev`. It will politely turn off existing parity, and save data files separately.

The same tool can deploy to livenet or NA's internal testnet:

`./deploy live -p <password>` will deploy to NA's internal testnet. Note that this is a real, mined subchain and will take some time to inclue all of your transactions.

## After deploy

metronome.js will have Contract objects ready for import into geth. 
