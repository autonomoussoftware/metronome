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

const program = require('commander')
const fs = require('fs')
const process = require('process')
const reader = require('./lib/file-reader')
const launcher = require('./lib/launcher')

function init () {
  program
    .command('init-config')
    .description('Create sample configuration file for validator in current directory')
    .action(writeSampleConfigFile)

  program
    .option('-d, --dev', 'Run app in dev environment (without passwords)')
    .command('launch')
    .description('Launch off-chain metronome validator')
    .arguments('[eth-password] [etc-password]')
    .action(launchValidator)

  program.parse(process.argv)

  program.args.length < 1 &&
        program.help()
}

// TODO: use logger if possible
function launchValidator (ethPassword, etcPassword) {
  const config = reader.readFileAsJson('config.json')
  config.eth.password = processArgument(ethPassword)
  config.etc.password = processArgument(etcPassword)

  const metronome = reader.readMetronome()
  launcher.launch(config, metronome)
}

function writeSampleConfigFile () {
  console.log('writing sample config file')
  const configPath = 'config.json'
  const sampleConfig = [
    '{                                              ',
    '    "eth": {                                   ',
    '       "chainName":"ETH",                      ',
    '       "nodeUrl": "http://localhost:8545",     ',
    '        "address": "0x0",                      ',
    '        "password": "password"                 ',
    '    },                                         ',
    '    "etc": {                                   ',
    '       "chainName":"ETC",                      ',
    '       "nodeUrl": "http://localhost:8555",     ',
    '        "address": "0x0",                      ',
    '        "password": "password"                 ',
    '    }                                          ',
    '}                                              '
  ]

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, sampleConfig.join('\n'))

    console.log('Sample Configuration file created!')
  } else {
    console.log('Configuration file already exists')
  }
}

function processArgument (argument) {
  if (program.dev && !argument) {
    argument = ''
  } else if (!argument) {
    console.error('Password for ETH/ETC is required in production environment, use --dev option for development environment')
    process.exit(1)
  }
  return argument
}

init()
