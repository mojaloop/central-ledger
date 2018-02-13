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
const Logger = require('@mojaloop/central-services-shared').Logger
const Account = require('../domain/account')

const migrate = (runMigrations) => {
  return runMigrations ? Migrator.migrate() : P.resolve()
}

const connectDatabase = () => Db.connect(Config.DATABASE_URI)

const startEventric = (loadEventric) => {
  return loadEventric ? Eventric.getContext() : P.resolve()
}

const createServer = (port, modules) => {
  (async () => {
    const server = await new Hapi.Server({
      port,
      routes: {
        validate: ErrorHandling.validateRoutes()
      }
    })
    await server.ext('onRequest', function (request, h) {
      const transferId = UrlParser.idFromTransferUri(`${Config.HOSTNAME}${request.url.path}`)
      request.headers.traceid = request.headers.traceid || transferId || Uuid()
      RequestLogger.logRequest(request)
      return h.continue
    })
    await server.ext('onPreResponse', function (request, h) {
      RequestLogger.logResponse(request)
      return h.continue
    })
    await Plugins.registerPlugins(server)
    await server.register(modules)
    await server.start()
    Logger.info('Server running at: %s', server.info.uri)
  })()
}

// Migrator.migrate is called before connecting to the database to ensure all new tables are loaded properly.
// Eventric.getContext is called to replay all events through projections (creating the read-model) before starting the server.
const initialize = ({service, port, modules = [], loadEventric = false, runMigrations = false}) => {
  async function initialization () {
    await migrate(runMigrations).catch((error) => {
      Logger.error(error)
    })
    await connectDatabase()
    await Sidecar.connect(service)
    await startEventric(loadEventric)
    await createServer(port, modules)
    Logger.info('Service is: ' + service)
    if (service === 'api') {
      await Account.createLedgerAccount(Config.LEDGER_ACCOUNT_NAME, Config.LEDGER_ACCOUNT_PASSWORD, Config.LEDGER_ACCOUNT_EMAIL)
    }
  }

  initialization()
}

module.exports = {
  initialize,
  createServer
}
