/*****
 * @file This registers all handlers for the central-ledger API
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 - Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

'use strict'

const Hapi = require('@hapi/hapi')
const Migrator = require('../lib/migrator')
const Db = require('../lib/db')
const ObjStoreDb = require('@mojaloop/central-object-store').Db
const Plugins = require('./plugins')
const Config = require('../lib/config')
const Sidecar = require('../lib/sidecar')
const RequestLogger = require('../lib/requestLogger')
const Uuid = require('uuid4')
const UrlParser = require('../lib/urlParser')
const Logger = require('@mojaloop/central-services-logger')
const RegisterHandlers = require('../handlers/register')
const Metrics = require('@mojaloop/central-services-metrics')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Cache = require('../lib/cache')
const EnumCached = require('../lib/enumCached')
const ParticipantCached = require('../models/participant/participantCached')
const ParticipantCurrencyCached = require('../models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('../models/participant/participantLimitCached')

const migrate = (runMigrations) => {
  return runMigrations ? Migrator.migrate() : true
}
const connectDatabase = async () => {
  return Db.connect(Config.DATABASE)
}
const connectMongoose = async () => {
  if (!Config.MONGODB_DISABLED) {
    try {
      return ObjStoreDb.connect(Config.MONGODB_URI)
    } catch (err) {
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
      // TODO: review as code is being changed from returning null to returning a FSPIOPError
      // Logger.isErrorEnabled && Logger.error(`error - ${err}`)
      // return null
    }
  } else {
    return null
  }
}

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
      routes: {
        validate: {
          options: ErrorHandler.validateRoutes(),
          failAction: async (request, h, err) => {
            throw ErrorHandler.Factory.reformatFSPIOPError(err, ErrorHandler.Enums.FSPIOPErrorCodes.MALFORMED_SYNTAX)
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
    Logger.isInfoEnabled && Logger.info('Server running at: ', server.info.uri)
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
  const registeredHandlers = {
    connection: {},
    register: {},
    ext: {},
    start: new Date(),
    info: {},
    handlers: handlers
  }

  for (const handler of handlers) {
    if (handler.enabled) {
      Logger.isInfoEnabled && Logger.info(`Handler Setup - Registering ${JSON.stringify(handler)}!`)
      switch (handler.type) {
        case 'prepare': {
          await RegisterHandlers.transfers.registerPrepareHandler()
          // if (!Config.HANDLERS_CRON_DISABLED) {
          //   Logger.isInfoEnabled && Logger.info('Starting Kafka Cron Jobs...')
          //   await KafkaCron.start('prepare')
          // }
          break
        }
        case 'position': {
          await RegisterHandlers.positions.registerPositionHandler()
          // if (!Config.HANDLERS_CRON_DISABLED) {
          //   Logger.isInfoEnabled && Logger.info('Starting Kafka Cron Jobs...')
          //   await KafkaCron.start('position')
          // }
          break
        }
        case 'fulfil': {
          await RegisterHandlers.transfers.registerFulfilHandler()
          break
        }
        case 'timeout': {
          await RegisterHandlers.timeouts.registerTimeoutHandler()
          break
        }
        case 'admin': {
          await RegisterHandlers.admin.registerAdminHandlers()
          break
        }
        case 'get': {
          await RegisterHandlers.transfers.registerGetHandler()
          break
        }
        case 'bulkprepare': {
          await RegisterHandlers.bulk.registerBulkPrepareHandler()
          break
        }
        case 'bulkfulfil': {
          await RegisterHandlers.bulk.registerBulkFulfilHandler()
          break
        }
        case 'bulkprocessing': {
          await RegisterHandlers.bulk.registerBulkProcessingHandler()
          break
        }
        case 'bulkget': {
          await RegisterHandlers.bulk.registerBulkGetHandler()
          break
        }
        default: {
          const error = `Handler Setup - ${JSON.stringify(handler)} is not a valid handler to register!`
          Logger.isErrorEnabled && Logger.error(error)
          throw new Error(error)
        }
      }
    }
  }

  return registeredHandlers
}

const initializeInstrumentation = () => {
  if (!Config.INSTRUMENTATION_METRICS_DISABLED) {
    Metrics.setup(Config.INSTRUMENTATION_METRICS_CONFIG)
  }
}

const initializeCache = async () => {
  await EnumCached.initialize()
  await ParticipantCached.initialize()
  await ParticipantCurrencyCached.initialize()
  await ParticipantLimitCached.initialize()
  await Cache.initCache()
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
const initialize = async function ({ service, port, modules = [], runMigrations = false, runHandlers = false, handlers = [] }) {
  await migrate(runMigrations)
  await connectDatabase()
  await connectMongoose()
  await initializeCache()
  await Sidecar.connect(service)
  initializeInstrumentation()
  let server
  switch (service) {
    case 'api':
    case 'admin': {
      server = await createServer(port, modules)
      break
    }
    case 'handler': {
      if (!Config.HANDLERS_API_DISABLED) {
        server = await createServer(port, modules)
      }
      break
    }
    default: {
      Logger.isErrorEnabled && Logger.error(`No valid service type ${service} found!`)
      throw ErrorHandler.Factory.createInternalServerFSPIOPError(`No valid service type ${service} found!`)
    }
  }

  if (runHandlers) {
    if (Array.isArray(handlers) && handlers.length > 0) {
      await createHandlers(handlers)
    } else {
      await RegisterHandlers.registerAllHandlers()
      // if (!Config.HANDLERS_CRON_DISABLED) {
      //   Logger.isInfoEnabled && Logger.info('Starting Kafka Cron Jobs...')
      //   // await KafkaCron.start('prepare')
      //   await KafkaCron.start('position')
      // }
    }
  }

  return server
}

module.exports = {
  initialize,
  createServer
}
