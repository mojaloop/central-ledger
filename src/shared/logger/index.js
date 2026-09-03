const { loggerFactory } = require('@mojaloop/central-services-logger/src/contextLogger');

let logger = loggerFactory('CL') // global logger

module.exports = {
  logger,
}
