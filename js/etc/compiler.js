var shell = require('shelljs')
const fs = require('fs-extra')

function compile (sourcePath) {
  console.log('compiling for', sourcePath)
  var buildPath = './build'
  try {
    if (fs.existsSync(buildPath)) {
      fs.removeSync(buildPath)
    }
    buildPath = buildPath + '/etc'
    fs.mkdirSync(buildPath, { recursive: true })
  } catch (err) {
    console.error(err)
  }
  var arg = 'solc --combined-json abi,bin --optimize ' + sourcePath + ' --evm-version  spuriousDragon > ' + buildPath + '/output.json'
  console.log(arg)
  shell.exec(arg, function (code, stdout, stderr) {
    console.log('Exit code:', code)
    // console.log('Program output:', stdout);
    console.log('Program stderr:', stderr)
  })
}
module.exports = { compile }
