const { loggerFactory } = require('@mojaloop/central-services-logger/src/contextLogger')

const logger = loggerFactory('CL') // global logger

module.exports = {
  logger
}
