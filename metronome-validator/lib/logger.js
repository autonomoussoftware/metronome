/*
    The MIT License (MIT)

    Copyright 2017 - 2018, Alchemy Limited, LLC.

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be included
    in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
    IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
    CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
    TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
    SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const winston = require('winston')
const { combine, splat, timestamp, printf } = winston.format
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
    splat(),
    timestamp(),
    printf(info => {
      return `${info.timestamp} [${info.level}] ${info.message}`
    })
  ),
  transports: [
    new winston.transports.File(options.infoFile),
    new winston.transports.File(options.errorFile),
    new winston.transports.Console(options.console)
  ],
  exitOnError: false // do not exit on handled exceptions
})

function getModuleName (fileName) {
  let start = fileName.indexOf('lib\\')
  const unixStart = fileName.indexOf('lib/')
  const end = fileName.indexOf('.js')

  if (start === -1) {
    start = unixStart
  }
  return fileName.slice(start + 4, end)
}
// module.exports = logger

module.exports = function (fileName) {
  var moduleName = getModuleName(fileName)

  var myLogger = {
    log: function (level, msg, ...vars) {
      if (level === 'error') {
        this.error(msg, ...vars)
      } else if (level === 'info') {
        this.info(msg, ...vars)
      } else {
        this.debug(msg, ...vars)
      }
    },
    error: function (msg, ...vars) {
      logger.error(moduleName + ': ' + msg, ...vars)
    },
    info: function (msg, ...vars) {
      logger.info(moduleName + ': ' + msg, ...vars)
    },
    debug: function (msg, ...vars) {
      logger.debug('[' + moduleName + ']: ' + msg, ...vars)
    }
  }

  return myLogger
}
