'use strict'

const Package = require('../../package')
const Inert = require('inert')
const Vision = require('vision')
const Blipp = require('blipp')
const Good = require('good')

const HapiSwagger = require('hapi-swagger')
const Logger = require('@mojaloop/central-services-shared').Logger
const ErrorHandling = require('@mojaloop/central-services-error-handling')
const Auth = require('@mojaloop/central-services-auth')

const registerPlugins = (server) => {
  server.register({
    register: HapiSwagger,
    options: {
      info: {
        'title': 'Central Ledger API Documentation',
        'version': Package.version
      }
    }
  })

  server.register({
    register: Good,
    options: {
      ops: {
        interval: 1000
      },
      reporters: {
        // winston: [{
        //   module: 'good-winston',
        //   args: [
        //     Logger,
        //     {
        //       error_level: 'error',
        //       ops_level: 'debug',
        //       request_level: 'debug',
        //       response_level: 'info',
        //       other_level: 'info'
        //     }
        //   ]
        // }]
      }
    }
  })

  server.register([Inert, Vision, Blipp, ErrorHandling, Auth])
}

module.exports = {
  registerPlugins
}
