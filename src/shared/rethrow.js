const rethrow = require('@mojaloop/central-services-shared').Util.rethrow
const loggerOverride = require('./logger').logger

module.exports = {
  rethrowDatabaseError: (error, options) => rethrow.rethrowDatabaseError(error, { ...options, loggerOverride }),
  rethrowCachedDatabaseError: (error, options) => rethrow.rethrowCachedDatabaseError(error, { ...options, loggerOverride }),
  rethrowAndCountFspiopError: (error, options) => rethrow.rethrowAndCountFspiopError(error, { ...options, loggerOverride }, 'CL')
}
