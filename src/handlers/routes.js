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

const RegisterAllHandler = require('./handlers')
const TransferHandler = require('./transfers/handler')
const PositionHandler = require('./positions/handler')
const testProducer = require('../../testPI2/integration/helpers/testProducer')

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
    path: '/register/all',
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
    path: '/register/transfer/all',
    handler: TransferHandler.registerAllHandlers,
    options: {
      id: 'transfer',
      description: 'Register all transfer Kafka consumer handlers'
    }
  },
  /**
   * @function RegisterPrepareHandlerRoute
   *
   * @async
   * @description Registers consumer handlers for prepare transfer all participants
   * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
   */
  {
    method: 'POST',
    path: '/register/transfer/prepare',
    handler: TransferHandler.registerPrepareHandlers,
    options: {
      id: 'prepare',
      description: 'Register prepare transfer Kafka consumer handler'
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
    handler: TransferHandler.registerFulfillHandler,
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
    path: '/register/position/all',
    handler: PositionHandler.registerAllHandlers,
    options: {
      id: 'position',
      description: 'Register position Kafka consumer handler'
    }
  },

  // Following are for testing purposes so that we can produce transfers without the ML-API. To be removed later.
  {
    method: 'POST',
    path: '/test/producer/transfer/prepare',
    handler: testProducer.transferPrepare,
    options: {
      id: 'transferPrepareTestProducer',
      description: 'Produces transfer prepare message to Kafka'
    }
  },
  {
    method: 'POST',
    path: '/test/producer/transfer/fulfil',
    handler: testProducer.transferFulfil,
    options: {
      id: 'transferFulfilTestProducer',
      description: 'Produces transfer fulfil message to Kafka'
    }
  },
  {
    method: 'POST',
    path: '/test/producer/transfer/reject',
    handler: testProducer.transferReject,
    options: {
      id: 'transferRejectTestProducer',
      description: 'Produces transfer reject message to Kafka'
    }
  }
]
