module.exports = Object.freeze({
  queueName: {
    eth: {
      pendingImport: 'ETHpending-import',
      pendingAttestation: 'ETHpending-attestion'
    },
    etc: {
      pendingImport: 'ETCpending-import',
      pendingAttestation: 'ETCpending-attestion'
    }
  },
  safeBlockHeight: 0,
  cronJobPattern: '*/20 * * * * *'
})
