/*****
 * @file This registers all handlers for the central-settlement API
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
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
 --------------
 ******/
'use strict'

const ErrorHandling = require('@mojaloop/central-services-error-handling')
const { logger } = require('../shared/logger')
const requireGlob = require('require-glob')
const DeferredSettlementHandler = require('./deferredSettlement/handler')
const GrossSettlementHandler = require('./grossSettlement/handler')
const RulesHandler = require('./rules/handler')

/**
 * @module src/handlers
 */

/**
 * @function RegisterAllHandlers
 *
 * @async
 * @description Registers all handlers by using the require-glob to retrieve all handler exports in sub directories and access the registerAllHandlers()
 * in each of them. Every handler in the sub-folders must have a registerAllHandlers() function
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */

const registerAllHandlers = async () => {
  try {
    const modules = await requireGlob(['./**/handler.js'])
    logger.info(JSON.stringify(modules))
    for (const key in modules) {
      logger.info(`Registering handler module[${key}]: ${JSON.stringify(modules[key])}`)
      if (Object.prototype.hasOwnProperty.call(modules[key], 'handler')) {
        const handlerObject = modules[key]
        logger.info(JSON.stringify(handlerObject.handler))
        await handlerObject.handler.registerAllHandlers()
      } else {
        for (const i in modules[key]) {
          const handlerObject = modules[key][i]
          logger.info(JSON.stringify(handlerObject.handler))
          await handlerObject.handler.registerAllHandlers()
        }
      }
    }
    return true
  } catch (err) {
    logger.error(err)
    throw ErrorHandling.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  registerAllHandlers,
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
