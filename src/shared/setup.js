'use strict'

const Hapi = require('hapi')
const ErrorHandling = require('@mojaloop/central-services-error-handling')
const P = require('bluebird')
const Migrator = require('../lib/migrator')
const Db = require('../db')
const Plugins = require('./plugins')
const Config = require('../lib/config')
const Sidecar = require('../lib/sidecar')
const RequestLogger = require('../lib/requestLogger')
const Uuid = require('uuid4')
const UrlParser = require('../lib/urlParser')
const Logger = require('@mojaloop/central-services-shared').Logger
// const Participant = require('../domain/participant')
const Boom = require('boom')
const RegisterHandlers = require('../handlers/handlers')

const migrate = (runMigrations) => {
  return runMigrations ? Migrator.migrate() : P.resolve()
}

const connectDatabase = async () => await Db.connect(Config.DATABASE_URI)

const createServer = (port, modules) => {
  return (async () => {
    const server = await new Hapi.Server({
      port,
      routes: {
        validate: {
          options: ErrorHandling.validateRoutes(),
          failAction: async (request, h, err) => {
            throw Boom.boomify(err)
          }
        }
      }
    })
    server.ext('onRequest', function (request, h) {
      const transferId = UrlParser.idFromTransferUri(`${Config.HOSTNAME}${request.url.path}`)
      request.headers.traceid = request.headers.traceid || transferId || Uuid()
      RequestLogger.logRequest(request)
      return h.continue
    })
    server.ext('onPreResponse', function (request, h) {
      RequestLogger.logResponse(request)
      return h.continue
    })
    await Plugins.registerPlugins(server)
    await server.register(modules)
    await server.start()
    Logger.info('Server running at: ', server.info.uri)
    return server
  })()
}

// Migrator.migrate is called before connecting to the database to ensure all new tables are loaded properly.
const initialize = async function ({service, port, modules = [], runMigrations = false}) {
  await migrate(runMigrations)
  await connectDatabase()
  await Sidecar.connect(service)
  const server = await createServer(port, modules)
  if (service === 'api') {
    await RegisterHandlers.registerAllHandlers()
    // await Participant.createLedgerParticipant(Config.LEDGER_ACCOUNT_NAME, Config.LEDGER_ACCOUNT_PASSWORD, Config.LEDGER_ACCOUNT_EMAIL)
  }
  return server
}

module.exports = {
  initialize,
  createServer
}
