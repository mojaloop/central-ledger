'use strict'

const Logger = require('@mojaloop/central-services-logger')

class NullClient {
  connect () {
    Logger.isDebugEnabled && Logger.debug('Sidecar disabled: connecting in NullClient')
    return Promise.resolve(this)
  }

  write (msg) {
    Logger.isDebugEnabled && Logger.debug(`Sidecar disabled: writing message ${msg} in NullClient`)
  }
}

exports.create = () => {
  return new NullClient()
}
