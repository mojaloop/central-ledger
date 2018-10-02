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
const RegisterHandlers = require('../handlers/register')
const KafkaCron = require('../handlers/lib/kafka').Cron
const Enums = require('../lib/enum')

const migrate = (runMigrations) => {
  return runMigrations ? Migrator.migrate() : P.resolve()
}
const getEnums = (id) => {
  return Enums[id]()
}
const connectDatabase = async () => await Db.connect(Config.DATABASE_URI)

/**
 * @function createServer
 *
 * @description Create HTTP Server
 *
 * @param {number} port Port to register the Server against
 * @param modules list of Modules to be registered
 * @returns {Promise<Server>} Returns the Server object
 */
const createServer = (port, modules) => {
  return (async () => {
    const server = await new Hapi.Server({
      port,
      cache: [
        {
          name: 'memCache',
          engine: require('catbox-memory'),
          partition: 'cache'
        }
      ],
      routes: {
        validate: {
          options: ErrorHandling.validateRoutes(),
          failAction: async (request, h, err) => {
            throw Boom.boomify(err)
          }
        }
      }
    })
    server.method({
      name: 'enums',
      method: getEnums,
      options: {
        cache: {
          cache: 'memCache',
          expiresIn: 5 * 60 * 1000,
          generateTimeout: 30 * 1000
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

/**
 * @function createHandlers
 *
 * @description Create method to register specific Handlers specified by the Module list as part of the Setup process
 *
 * @typedef handler
 * @type {Object}
 * @property {string} type The type of Handler to be registered
 * @property {boolean} enabled True|False to indicate if the Handler should be registered
 * @property {string[]} [fspList] List of FSPs to be registered
 *
 * @param {handler[]} handlers List of Handlers to be registered
 * @returns {Promise<boolean>} Returns true if Handlers were registered
 */
const createHandlers = async (handlers) => {
  let registeredHandlers = {
    connection: {},
    register: {},
    ext: {},
    start: new Date(),
    info: {},
    handlers: handlers
  }

  for (let handler of handlers) {
    if (handler.enabled) {
      Logger.info(`Handler Setup - Registering ${JSON.stringify(handler)}!`)
      switch (handler.type) {
        case 'prepare':
          await RegisterHandlers.transfers.registerPrepareHandlers(handler.fspList)
          if (!Config.HANDLERS_CRON_DISABLED) {
            Logger.info('Starting Kafka Cron Jobs...')
            await KafkaCron.start('prepare')
          }
          break
        case 'position':
          await RegisterHandlers.positions.registerPositionHandlers(handler.fspList)
          if (!Config.HANDLERS_CRON_DISABLED) {
            Logger.info('Starting Kafka Cron Jobs...')
            await KafkaCron.start('position')
          }
          break
        case 'fulfil':
          await RegisterHandlers.transfers.registerFulfilHandler()
          break
        case 'timeout':
          await RegisterHandlers.timeouts.registerTimeoutHandler()
          break
        default:
          var error = `Handler Setup - ${JSON.stringify(handler)} is not a valid handler to register!`
          Logger.error(error)
          throw new Error(error)
      }
    }
  }

  return registeredHandlers
}

/**
 * @function initialize
 *
 * @description Setup method for API, Admin and Handlers. Note that the Migration scripts are called before connecting to the database to ensure all new tables are loaded properly.
 *
 * @typedef handler
 * @type {Object}
 * @property {string} type The type of Handler to be registered
 * @property {boolean} enabled True|False to indicate if the Handler should be registered
 * @property {string[]} [fspList] List of FSPs to be registered
 *
 * @param {string} service Name of service to start. Available choices are 'api', 'admin', 'handler'
 * @param {number} port Port to start the HTTP Server on
 * @param {object[]} modules List of modules to be loaded by the HTTP Server
 * @param {boolean} runMigrations True to run Migration script, false to ignore them
 * @param {boolean} runHandlers True to start Handlers, false to ignore them, only applicable for service types that are NOT 'handler'
 * @param {handler[]} handlers List of Handlers to be registered
 * @returns {object} Returns HTTP Server object
 */
const initialize = async function ({service, port, modules = [], runMigrations = false, runHandlers = false, handlers = []}) {
  await migrate(runMigrations)
  await connectDatabase()
  await Sidecar.connect(service)

  let server
  switch (service) {
    case 'api':
      server = await createServer(port, modules)
      break
    case 'admin':
      server = await createServer(port, modules)
      break
    case 'handler':
      if (!Config.HANDLERS_API_DISABLED) {
        server = await createServer(port, modules)
      }
      break
    default:
      Logger.error(`No valid service type ${service} found!`)
      throw new Error(`No valid service type ${service} found!`)
  }

  if (runHandlers) {
    if (Array.isArray(handlers) && handlers.length > 0) {
      await createHandlers(handlers)
    } else {
      await RegisterHandlers.registerAllHandlers()
      if (!Config.HANDLERS_CRON_DISABLED) {
        Logger.info('Starting Kafka Cron Jobs...')
        await KafkaCron.start('prepare')
        await KafkaCron.start('position')
      }
    }
  }

  return server
}

module.exports = {
  initialize,
  createServer,
  createHandlers
}
