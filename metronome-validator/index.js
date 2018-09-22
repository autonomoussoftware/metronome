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
const _ = require('lodash')
const fs = require('fs')
const process = require('process')
const path = require('path')
const launcher = require('./lib/launcher')

function init () {
  program
    .command('init-config')
    .description('create in current directory configuration file for validator')
    .action(writeSampleConfigFile)

  program
    .command('launch')
    .description('Launch metronome off chain validator to listen the import-export events and validate hash')
    .action(launchValidator)

  program
    .parse(process.argv)

  program.args.length < 1 &&
        program.help()
}

function launchValidator () {
  const config = readConfig()
  const metronome = readMetronome()
  launcher.launch(config, metronome)
}

function writeSampleConfigFile () {
  console.log('writing sample config file')
  const configPath = 'config.json'
  const sampleConfig = [
    '{                                              ',
    '    "extends": "default",                      ',
    '    "eth": {                                   ',
    '       "nodeUrl": "http://localhost:8545",     ',
    '        "address": "0x0",                      ',
    '        "password": "password1"                ',
    '    },                                         ',
    '    "etc": {                                   ',
    '       "nodeUrl": "http://localhost:8555",     ',
    '        "address": "0x0",                      ',
    '        "password": "password1"                ',
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

const readConfig = _.memoize(function () {
  return fs.readFileSync('config.json').toString()
})

const readMetronome = _.memoize(function () {
  let chainPath = path.join(__dirname, '/abi/')
  let fileName = '/metronome.js'
  let metronome = {}
  let supportedChains = fs.readdirSync(chainPath)

  for (let i = 0; i < supportedChains.length; i++) {
    metronome[supportedChains[i]] = fs.readFileSync(chainPath + supportedChains[i] + fileName).toString()
  }
  return metronome
})

init()
