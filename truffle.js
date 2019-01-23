module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*'
    },
    ropsten: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
      from: '0xbb9ce05252c0d20a033c25882492771b3075d2c9'
    },
    morden: {
      host: '127.0.0.1',
      port: 8555,
      network_id: '*',
      from: '0x99abd7981b2c2e94a0cc2d0d8f19852ec0ac66d9',
      gas: 2402540
    }
  }
}
