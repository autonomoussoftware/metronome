const program = require('commander')
const compiler = require('./compiler')
const deployer = require('./deployer.js')
var inquirer = require('inquirer')
var ethers = require('ethers')
const fs = require('fs')
var questionsSet1 = [
  {
    type: 'input',
    name: 'keystore',
    message: 'Please enter keystore file path'
  },
  {
    type: 'password',
    name: 'password',
    message: 'Please enter keystore file password to unlock keys'
  }
]
function init () {
  program
    .command('compile')
    .description('compile')
    .action(function () {
      compiler.compile('./contracts/monolithic.sol', 'spuriousDragon')
    })
  program
    .command('deploy')
    .description('deploy')
    .action(async function () {
      inquirer.prompt(questionsSet1).then(async answers => {
        deployer.deploy(answers.keystore, answers.password)
      })
    })
  program
    .command('configure')
    .description('configure')
    .action(async function () {
      inquirer.prompt(questionsSet1).then(async answers => {
        deployer.configureContracts(answers.keystore, answers.password)
      })
    })
  program
    .command('launch')
    .description('launch')
    .action(async function () {
      inquirer.prompt(questionsSet1).then(async answers => {
        deployer.launchContracts(answers.keystore, answers.password)
      })
    })
  program.parse(process.argv)
}

init()
