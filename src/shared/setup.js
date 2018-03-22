'use strict'

const Hapi = require('hapi')
const ErrorHandling = require('@mojaloop/central-services-error-handling')
const P = require('bluebird')
const Migrator = require('../lib/migrator')
const Db = require('../db')
const Eventric = require('../eventric')
const Plugins = require('./plugins')
const Config = require('../lib/config')
const Sidecar = require('../lib/sidecar')
const RequestLogger = require('../lib/request-logger')
const Uuid = require('uuid4')
const UrlParser = require('../lib/urlparser')

const migrate = (runMigrations) => {
  return runMigrations ? Migrator.migrate() : P.resolve()
}

const connectDatabase = () => Db.connect(Config.DATABASE_URI)

// Story #135 : Removing Eventric 21 Mar 2018 D. Botha
// const startEventric = (loadEventric) => {
//  return loadEventric ? Eventric.getContext() : P.resolve()
// }

const createServer = (port, modules, addRequestLogging = true) => {
  return new P((resolve, reject) => {
    const server = new Hapi.Server()
    server.connection({
      port,
      routes: {
        validate: ErrorHandling.validateRoutes()
      }
    })

    if (addRequestLogging) {
      server.ext('onRequest', onServerRequest)
      server.ext('onPreResponse', onServerPreResponse)
    }

    Plugins.registerPlugins(server)
    server.register(modules)
    resolve(server)
  })
}

// Migrator.migrate is called before connecting to the database to ensure all new tables are loaded properly.
// Eventric.getContext is called to replay all events through projections (creating the read-model) before starting the server.
const initialize = ({ service, port, modules = [], loadEventric = false, runMigrations = false }) => {
  return migrate(runMigrations)
    .then(() => connectDatabase())
    .then(() => Sidecar.connect(service))
    // Story #135 : Removing Eventric 21 Mar 2018 D. Botha
    // .then(() => startEventric(loadEventric))
    .then(() => createServer(port, modules))
    .catch(err => {
      cleanup()
      throw err
    })
}

const onServerRequest = (request, reply) => {
  const transferId = UrlParser.idFromTransferUri(`${Config.HOSTNAME}${request.url.path}`)
  request.headers.traceid = request.headers.traceid || transferId || Uuid()
  RequestLogger.logRequest(request)
  reply.continue()
}

const onServerPreResponse = (request, reply) => {
  RequestLogger.logResponse(request)
  reply.continue()
}

const cleanup = () => {
  Db.disconnect()
}

module.exports = {
  initialize,
  createServer
}
