const { asyncStorage } = require('@mojaloop/central-services-logger/src/contextLogger')
const { logger } = require('./logger') // pass though options

const loggingPlugin = {
  name: 'loggingPlugin',
  version: '1.0.0',
  once: true,
  register: async (server, options) => {
    // const { logger } = options;
    server.ext({
      type: 'onPreHandler',
      method: (request, h) => {
        const { path, method, headers, payload, query } = request
        const { remoteAddress } = request.info
        const requestId = request.info.id = `${request.info.id}__${headers.traceid}`
        asyncStorage.enterWith({ requestId })

        logger.isInfoEnabled && logger.info(`[==> req] ${method.toUpperCase()} ${path}`, { headers, payload, query, remoteAddress })
        return h.continue
      }
    })

    server.ext({
      type: 'onPreResponse',
      method: (request, h) => {
        if (logger.isInfoEnabled) {
          const { path, method, headers, payload, query, response } = request
          const { received } = request.info

          const statusCode = response instanceof Error
            ? response.output?.statusCode
            : response.statusCode
          const respTimeSec = ((Date.now() - received) / 1000).toFixed(3)

          logger.info(`[<== ${statusCode}][${respTimeSec} s] ${method.toUpperCase()} ${path}`, { headers, payload, query })
        }
        return h.continue
      }
    })
  }
}

module.exports = loggingPlugin
