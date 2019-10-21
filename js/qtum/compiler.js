var shell = require('shelljs')
const fs = require('fs-extra')

function compile (sourcePath, name) {
  console.log('compiling for', sourcePath)
  var buildPath = './build/qtum/compiled'
  try {
    // if (fs.existsSync(buildPath)) {
    //   fs.removeSync(buildPath)
    // }
    fs.mkdirSync(buildPath, { recursive: true })
  } catch (err) {
    console.error(err)
  }
  var arg = 'solc --combined-json abi,bin --optimize ' + sourcePath + ' > ' + buildPath + '/' + name + '.json'
  console.log(arg)
  shell.exec(arg, function (code, stdout, stderr) {
    console.log('Exit code:', code)
    console.log('Program output:', stdout);
    console.log('Program stderr:', stderr)
  })
}
module.exports = { compile }
