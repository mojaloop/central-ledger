const { loggerFactory } = require('@mojaloop/central-services-logger/src/contextLogger')

const logger = loggerFactory('CS') // global logger

module.exports = {
  logger
}
