'use strict'

const Package = require('../../package')
const Inert = require('inert')
const Vision = require('vision')
const Blipp = require('blipp')
// const GoodWinston = require('good-winston')
// const goodWinstonStream = new GoodWinston({winston: require('winston')})
const ErrorHandling = require('@mojaloop/central-services-error-handling')

const registerPlugins = async (server) => {
  await server.register({
    plugin: require('hapi-swagger'),
    options: {
      info: {
        title: 'Central Ledger API Documentation',
        version: Package.version
      }
    }
  })

  await server.register({
    plugin: require('good'),
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
