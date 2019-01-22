/*****
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

 * Lazola Lucas <lazola.lucas@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * Kafka Consumer Handler Routes
 * @module src/handlers
 */

const RegisterAllHandler = require('../../register')
const TransferHandler = require('../../transfers/handler')
const PositionHandler = require('../../positions/handler')

module.exports = [
  /**
   * @function RegisterAllHandlersRoute
   *
   * @async
   * @description Registers all consumer handlers for all participants
   * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
   */
  {
    method: 'POST',
    path: '/register',
    handler: RegisterAllHandler.registerAllHandlers,
    options: {
      id: 'handlers',
      description: 'Register all Kafka consumer handlers'
    }
  },
  /**
   * @function RegisterAllTransferHandlersRoute
   *
   * @async
   * @description Registers all consumer handlers for all transfers processes for all participants
   * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
   */
  {
    method: 'POST',
    path: '/register/transfer',
    handler: TransferHandler.registerAllHandlers,
    options: {
      id: 'transfer',
      description: 'Register all transfer Kafka consumer handlers'
    }
  },
  /**
   * @function RegisterFulfilHandlerRoute
   *
   * @async
   * @description Registers consumer handlers for fulfil transfer this is one topic for all transfers as fulfills do not need to keep order
   * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
   */
  {
    method: 'POST',
    path: '/register/transfer/fulfil',
    handler: TransferHandler.registerFulfilHandler,
    options: {
      id: 'fulfil',
      description: 'Register fulfil transfer Kafka consumer handler'
    }
  },
  /**
   * @function RegisterAllPositionHandlersRoute
   *
   * @async
   * @description Registers consumer handlers for positions all participants
   * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
   */
  {
    method: 'POST',
    path: '/register/position',
    handler: PositionHandler.registerAllHandlers,
    options: {
      id: 'position',
      description: 'Register position Kafka consumer handler'
    }
  },
  {
    method: 'POST',
    path: '/register/transfer/get',
    handler: TransferHandler.registerGetTransferHandler,
    options: {
      id: 'getTransfer',
      description: 'Register get transfer Kafka consumer handler'
    }
  }
]
