module.exports = Object.freeze({
  queueName: {
    eth: {
      validationQ: 'ETHpending-validation',
      attestationQ: 'ETHpending-attestion',
      block: 'eth-block'
    },
    etc: {
      validationQ: 'ETCpending-validation',
      attestationQ: 'ETCpending-attestion',
      block: 'etc-block'
    }
  },
  safeBlockHeight: 0,
  cronJobPattern: '*/5 * * * * *',
  retryCount: 10
})
