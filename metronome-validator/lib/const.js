module.exports = Object.freeze({
  queueName: {
    eth: {
      validationQ: 'ETHpending-import',
      attestationQ: 'ETHpending-attestion'
    },
    etc: {
      validationQ: 'ETCpending-import',
      attestationQ: 'ETCpending-attestion'
    }
  },
  safeBlockHeight: 0,
  cronJobPattern: '*/5 * * * * *',
  retryCount: 10
})
