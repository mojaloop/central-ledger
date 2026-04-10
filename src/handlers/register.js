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
 - Lazola Lucas <lazola.lucas@modusbox.com>
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 - Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @module src/handlers
 */

/**
 * @function RegisterAllHandlers
 *
 * @async
 * @description Registers all handlers in ./handlers and ../settlement/handlers.
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed.
 */

const Logger = require('../shared/logger').logger
const TransferHandlers = require('./transfers/handler')
const PositionHandlers = require('./positions/handler')
const PositionHandlersBatch = require('./positions/handlerBatch')
const TimeoutHandlers = require('./timeouts/handler')
const AdminHandlers = require('./admin/handler')
const BulkHandlers = require('./bulk')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const DeferredSettlementHandler = require('../settlement/handlers/deferredSettlement/handler')
const GrossSettlementHandler = require('../settlement/handlers/grossSettlement/handler')
const RulesHandler = require('../settlement/handlers/rules/handler')

const handlers = {
  transfers: {
    registerAllHandlers: TransferHandlers.registerAllHandlers,
    registerPrepareHandler: TransferHandlers.registerPrepareHandler,
    registerGetHandler: TransferHandlers.registerGetTransferHandler,
    registerFulfilHandler: TransferHandlers.registerFulfilHandler
  },
  positions: {
    registerAllHandlers: PositionHandlers.registerAllHandlers,
    registerPositionHandler: PositionHandlers.registerPositionHandler
  },
  positionsBatch: {
    registerAllHandlers: PositionHandlersBatch.registerAllHandlers,
    registerPositionHandler: PositionHandlersBatch.registerPositionHandler
  },
  timeouts: {
    registerAllHandlers: TimeoutHandlers.registerAllHandlers,
    registerTimeoutHandler: TimeoutHandlers.registerTimeoutHandler,
    registerFxTimeoutHandler: TimeoutHandlers.registerFxTimeoutHandler
  },
  admin: {
    registerAdminHandlers: AdminHandlers.registerAllHandlers
  },
  bulk: {
    registerAllHandlers: BulkHandlers.registerAllHandlers,
    registerBulkPrepareHandler: BulkHandlers.registerBulkPrepareHandler,
    registerBulkFulfilHandler: BulkHandlers.registerBulkFulfilHandler,
    registerBulkProcessingHandler: BulkHandlers.registerBulkProcessingHandler,
    registerBulkGetHandler: BulkHandlers.registerGetBulkTransferHandler
  },
  deferredSettlement: {
    registerAllHandlers: DeferredSettlementHandler.registerAllHandlers,
    registerSettlementWindowHandler: DeferredSettlementHandler.registerSettlementWindowHandler
  },
  grossSettlement: {
    registerAllHandlers: GrossSettlementHandler.registerAllHandlers,
    registerTransferSettlementHandler: GrossSettlementHandler.registerTransferSettlement,
    registerRulesHandler: RulesHandler.registerRules
  },
  rules: {
    registerAllHandlers: RulesHandler.registerAllHandlers,
    registerRulesHandler: RulesHandler.registerRules
  }
}

const registerAllHandlers = async () => {
  try {
    Logger.isInfoEnabled && Logger.info('registerAllHandlers() - Registering all handlers.')
    await handlers.transfers.registerAllHandlers()
    await handlers.positions.registerAllHandlers()
    await handlers.timeouts.registerAllHandlers()
    await handlers.admin.registerAdminHandlers()
    await handlers.bulk.registerAllHandlers()
    await handlers.deferredSettlement.registerAllHandlers()
    await handlers.grossSettlement.registerAllHandlers()
    await handlers.rules.registerAllHandlers()

    return true
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  registerAllHandlers,
  ...handlers
}
