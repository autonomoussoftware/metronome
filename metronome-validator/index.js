#!/usr/bin/env node

const program = require('commander')
const _ = require('lodash')
const fs = require('fs')
const process = require('process')
const Validator = require('./lib/validator')
const Listener = require('./lib/listener')
const Processor = require('./lib/processor')

function init () {
  program
    .command('init-config')
    .description('create in current directory configuration file for validator')
  //    .option('--path [file_path]', 'path where sample config file should be generated')
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
  console.log('I am in launchValidator function')
  const configStr = readConfig()
  // fs.readFileSync('node_modules/metronome-validator/abi/etc/met.json').toString()
  var contracts = Processor.parseMetronomeContractString(readMetronomeContractString())
  console.log('contracts=', contracts)
  Listener.listen(configStr) // TODO: pass abiStr
}

function writeSampleConfigFile () {
  console.log('writing sample config file')
  const configPath = 'config.json'
  const sampleConfig = [
    '{                                              ',
    '    "extends": "default",                      ',
    '    "ETH": {                                   ',
    '       "nodeUrl": "http://localhost:8545",     ',
    '        "address": "0x0",                      ',
    '        "password": "password1"                ',
    '    },                                         ',
    '    "ETC": {                                   ',
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

const readMetronomeContractString = _.memoize(function () {
  return fs.readFileSync('./abi/eth/metronome.js').toString()
})

init()
