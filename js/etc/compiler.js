var shell = require('shelljs')
const fs = require('fs-extra')

function compile (sourcePath) {
  console.log('compiling for', sourcePath)
  var buildPath = './build/etc'
  try {
    if (fs.existsSync(buildPath)) {
      fs.removeSync(buildPath)
    }
    fs.mkdirSync(buildPath)
  } catch (err) {
    console.error(err)
  }
  var arg = 'solc --combined-json abi,bin ' + sourcePath + ' --evm-version  spuriousDragon > ' + buildPath + '/output.json'
  console.log(arg)
  shell.exec(arg, function (code, stdout, stderr) {
    console.log('Exit code:', code)
    // console.log('Program output:', stdout);
    console.log('Program stderr:', stderr)
  })
}
module.exports = { compile }
