
function parseConfig (configStr) {
  try {
    return JSON.parse(configStr)
  } catch (e) {
    console.log('ERROR: Configuration file [config.json] is not a valid JSON!\n')
    process.exit(0)
  }
}
module.exports = {parseConfig}
