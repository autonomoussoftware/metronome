const winston = require('winston')
const { combine, timestamp, printf } = winston.format
const fs = require('fs')

const logDir = 'logs'

// Create the logs directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir)
}

// define the custom settings for each transport (file, console)
const options = {
  infoFile: {
    level: 'info',
    filename: 'app.log',
    dirname: logDir,
    maxsize: 10000000, // 10MB
    maxFiles: 5,
    handleExceptions: true
  },
  errorFile: {
    level: 'error',
    filename: 'error.log',
    dirname: logDir,
    maxsize: 10000000, // 10MB
    maxFiles: 5,
    handleExceptions: true
  },
  console: {
    level: 'debug',
    handleExceptions: true,
    colorize: true
  }
}

const logger = winston.createLogger({
  format: combine(
    timestamp(),
    printf(info => {
      return `${info.timestamp} [${info.level}]: ${info.message}`
    })
  ),
  transports: [
    new winston.transports.File(options.infoFile),
    new winston.transports.File(options.errorFile),
    new winston.transports.Console(options.console)
  ],
  exitOnError: false // do not exit on handled exceptions
})

module.exports = logger
