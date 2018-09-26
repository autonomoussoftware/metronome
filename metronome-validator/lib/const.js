module.exports = Object.freeze({
  queueName: {
    eth: {
      validationQ: 'ETHpending-validation',
      attestationQ: 'ETHpending-attestion'
    },
    etc: {
      validationQ: 'ETCpending-validation',
      attestationQ: 'ETCpending-attestion'
    }
  },
  safeBlockHeight: 0,
  cronJobPattern: '*/5 * * * * *',
  retryCount: 10
})
