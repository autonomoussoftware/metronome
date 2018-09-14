#!/usr/bin/env node

const program = require('commander')
const _ = require('lodash')
const fs = require('fs')
const process = require('process')
const path = require('path')
const listener = require('./lib/listener')
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
  listener.listen(config, metronome)
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
