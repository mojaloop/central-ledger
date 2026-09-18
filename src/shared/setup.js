/*****
 * @file This registers all handlers for the central-ledger API
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 - Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

'use strict'

// Defensive: apply the legacy util shim at service bootstrap. The hapi-openapi
// route plugins also require it themselves; keep those requires so the modules
// stay self-contained when loaded directly (e.g. by tests).
require('./legacyUtilShim')
const Hapi = require('@hapi/hapi')
const MongoUriBuilder = require('mongo-uri-builder')
const ObjStoreDb = require('@mojaloop/object-store-lib').Db
const Logger = require('../shared/logger').logger
const Metrics = require('@mojaloop/central-services-metrics')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const Migrator = require('../lib/migrator')
const Config = require('../lib/config')
const Db = require('../lib/db')
const ProxyCache = require('../lib/proxyCache')
const Cache = require('../lib/cache')
const EnumCached = require('../lib/enumCached')
const SettlementEnums = require('../settlement/models/lib/enums')
const RegisterHandlers = require('../handlers/register')
const ParticipantCached = require('../models/participant/participantCached')
const ParticipantCurrencyCached = require('../models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('../models/participant/participantLimitCached')
const externalParticipantCached = require('../models/participant/externalParticipantCached')
const BatchPositionModelCached = require('../models/position/batchCached')
const SettlementModelCached = require('../models/settlement/settlementModelCached')
const Plugins = require('./plugins')
const { DispatchTransferHandler } = require('../handlers/dispatch-transfer-handler')
const { MessageBus } = require('../messaging/message-bus')
const { PositionHandlerV2 } = require('../handlers/position-v2')
const { LedgerSql } = require('../domain/ledger/ledger-sql')
const { TimeoutHandlerV2 } = require('../handlers/timeout-v2')
const { default: HandlerV2 } = require('../api/participants/handler-v2')
const routesAdminBuilder = require('../api/routes-v2').default
const routesSettlement = require('../api_settlement/routes')

const migrate = (runMigrations) => {
  return runMigrations ? Migrator.migrate() : true
}

const connectDatabase = async () => {
  Logger.isDebugEnabled && Logger.debug(`Connecting to DB ${JSON.stringify(Config.DATABASE)}`)
  await Db.connect(Config.DATABASE)
  const dbLoadedTables = Db._tables ? Db._tables.length : -1
  Logger.isDebugEnabled && Logger.debug(`DB.connect loaded '${dbLoadedTables}' tables!`)
}

const connectMongoose = async () => {
  if (!Config.MONGODB_DISABLED) {
    try {
      if (Config.MONGODB_DEBUG) {
        Logger.isWarnEnabled && Logger.warn('Enabling debug for Mongoose...')
        ObjStoreDb.Mongoose.set('debug', Config.MONGODB_DEBUG) // enable debug
      }
      const connectionString = MongoUriBuilder({
        username: encodeURIComponent(Config.MONGODB_USER),
        password: encodeURIComponent(Config.MONGODB_PASSWORD),
        host: Config.MONGODB_HOST,
        port: Config.MONGODB_PORT,
        database: Config.MONGODB_DATABASE
      })

      return await ObjStoreDb.connect(connectionString)
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

const getSettlementEnums = (id) => {
  return SettlementEnums[id]()
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
      },
      cache: [
        {
          provider: {
            constructor: require('@hapi/catbox-memory').Engine,
            options: {
              partition: 'cache'
            }
          },
          name: 'memCache'
        }
      ]
    })

    // Merged from settlement api - isuses the memCache to provide `request.server.methods.enums`.
    server.method({
      name: 'enums',
      method: getSettlementEnums,
      options: {
        cache: {
          cache: 'memCache',
          expiresIn: 20 * 1000,
          generateTimeout: 30 * 1000
        }
      }
    })

    await Plugins.registerPlugins(server)
    await server.register(modules)
    await server.start()
    Logger.warn(`Server running at: ${server.info.uri}`)
    return server
  })()
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
  await BatchPositionModelCached.initialize()
  await SettlementModelCached.initialize()
  // all cached models initialize-methods are SYNC!!
  externalParticipantCached.initialize()
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
  try {
    initializeInstrumentation()
    await migrate(runMigrations)
    await connectDatabase()
    await connectMongoose()
    await initializeCache()
    if (Config.PROXY_CACHE_CONFIG?.enabled) {
      await ProxyCache.connect()
    }
    const enums = await EnumCached.getEnums('all')

    // Set up the MessageBus.
    const {
      createRemittanceEntityPayment,
      createRemittanceEntityForex,
    } = require('../handlers/transfers/createRemittanceEntity')
    const { definePositionParticipant } = require('../handlers/transfers/prepare')
    const positionHandlerV2 = new PositionHandlerV2(Config)
    const ledger = new LedgerSql({
      config: Config,
      enums: enums,
      proxyCache: ProxyCache,
      positionHandler: positionHandlerV2,
      createRemittanceEntity: createRemittanceEntityPayment,
      definePositionParticipant
    })
    const dispatchHandler = new DispatchTransferHandler(Config, ledger)
    const timeoutHandlerV2 = new TimeoutHandlerV2(Config, ledger)
    const messageBus = new MessageBus({
      config: Config,
      handlers: {
        dispatchTransferHandler: dispatchHandler,
        positionBatchHandler: positionHandlerV2,
        timeoutHandler: timeoutHandlerV2,
      }
    })

    // Build the routes.
    const handlerParticipant = new HandlerV2({
      config: Config,
      ledger,
    })
    const routesAdmin = routesAdminBuilder(handlerParticipant)
    
    let server
    switch (service) {
      case 'api':
      case 'admin': {
        server = await createServer(port, [...modules, routesAdmin, routesSettlement])
        break
      }
      case 'handler': {
        server = await createServer(port, [...modules])
        if (!Config.HANDLERS_API_DISABLED) {
          Logger.warn(`initialize() - service=hander, and HANDLERS_API_DISABLED=${Config.HANDLERS_API_DISABLED}, skipping creating server`)        }
        break
      }
      default: {
        Logger.isErrorEnabled && Logger.error(`No valid service type ${service} found!`)
        throw ErrorHandler.Factory.createInternalServerFSPIOPError(`No valid service type ${service} found!`)
      }
    }

    if (!runHandlers) {
      Logger.warn(`initialize() - runHandlers is false, not calling messageBus.init().`)
      // Skip running handlers.
      return server
    } else {
      Logger.warn(`initialize() - runHandlers is true, calling messageBus.init().`)
    }

    const handlerNames = handlers.map(handler => handler.type)
    await messageBus.init(handlerNames)
    return {
      server,
      messageBus
    }
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(`Error while initializing ${err}`, err)

    await Db.disconnect()
    if (Config.PROXY_CACHE_CONFIG?.enabled) {
      await ProxyCache.disconnect()
    }
    throw err
  }
}

module.exports = {
  initialize,
  createServer
}
