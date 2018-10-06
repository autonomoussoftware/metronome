const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const logger = require('./logger')(__filename)

const readFileAsString = _.memoize(function (filepath) {
  return fs.readFileSync(filepath).toString()
})

const readFileAsJson = _.memoize(function (filepath) {
  try {
    const fileAsString = readFileAsString(filepath)
    return JSON.parse(fileAsString)
  } catch (e) {
    logger.error('Provided file %s is not a valid JSON file %s', filepath, e)
    process.exit(0)
  }
})

const readMetronome = _.memoize(function (filepath) {
  let chainPath = path.join(__dirname, '../abi/')

  if (filepath) {
    chainPath = filepath
  }

  let fileName = '/metronome.js'
  let chains = fs.readdirSync(chainPath)
  let metronome = {}

  chains.forEach(function (chain) {
    metronome[chain] = readFileAsString(chainPath + chain + fileName)
  })

  return metronome
})

module.exports = {readFileAsString, readFileAsJson, readMetronome}
