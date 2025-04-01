const rethrow = require('@mojaloop/central-services-shared').Util.rethrow
const loggerOverride = require('./logger').logger

module.exports = {
  rethrowAndCountFspiopError: (error, options) => rethrow.rethrowAndCountFspiopError(error, {...options, loggerOverride}, 'CL')
}
