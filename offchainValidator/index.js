#!/usr/bin/env node

const program = require('commander')
const _ = require('lodash')
const fs = require('fs')
const process = require('process')
const Validator = require('./lib/validator')

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
}

function launchValidator () {
  console.log('I am in launchValidator function')
}

function writeSampleConfigFile () {
  console.log('writing same config file')
  const configPath = '.config.json'
  const sampleConfig = [
    '{                                              ',
    '    "extends": "default",                      ',
    '    "ETH": {                                   ',
    '       "nodeURL": "http://localhost:8545",     ',
    '        "address": "0x0",                      ',
    '        "password": "password1"                ',
    '    },                                         ',
    '    "ETC": {                                   ',
    '       "nodeURL": "http://localhost:8555",     ',
    '        "address": "0x0",                      ',
    '        "password": "password1"                ',
    '    }                                          ',
    '}                                              '
  ]

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, sampleConfig.join('\n'))

    console.log('Configuration file created!')
  } else {
    console.log('Configuration file already exists')
  }
}

const readConfig = _.memoize(function () {
  let config = {}

  try {
    const configStr = fs.readFileSync('.config.json').toString()
    config = JSON.parse(configStr)
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.log('ERROR: Configuration file [.solhint.json] is not a valid JSON!\n')
      exit(0)
    }
  }
  console.log('config=', config)

  return config
})

init()
