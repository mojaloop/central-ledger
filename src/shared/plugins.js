'use strict'

const Path = require('path')
const Inert = require('@hapi/inert')
const Vision = require('@hapi/vision')
const Blipp = require('blipp')
const ErrorHandling = require('@mojaloop/central-services-error-handling')
const APIDocumentation = require('@mojaloop/central-services-shared').Util.Hapi.APIDocumentation
const Config = require('../lib/config')

const registerPlugins = async (server) => {
  if (Config.API_DOC_ENDPOINTS_ENABLED) {
    await server.register({
      plugin: APIDocumentation,
      options: {
        documentPath: Path.resolve(__dirname, '../api/interface/swagger.json')
      }
    })
  }

  await server.register({
    plugin: require('@hapi/good'),
    options: {
      ops: {
        interval: 10000
      }
    }
  })

  await server.register({
    plugin: require('hapi-auth-basic')
  })

  await server.register({
    plugin: require('@now-ims/hapi-now-auth')
  })

  await server.register({
    plugin: require('hapi-auth-bearer-token')
  })

  await server.register([Inert, Vision, Blipp, ErrorHandling])
}

module.exports = {
  registerPlugins
}
