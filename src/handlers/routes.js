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
 * @module Routes
 */

const RegisterAllHandler = require('./handlers')
const TransferHandler = require('./transfers/handler')
const PositionHandler = require('./positions/handler')
const NotificationHandler = require('./notification/handler')
const testProducer = require('./lib/kafka/testProducer')

module.exports = [
  /**
   * @method POST
   *
   * @async
   * Registers all consumer handlers for all participants
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
   * @method POST
   *
   * @async
   * Registers all consumer handlers for all transfers processes for all participants
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
   * @method POST
   *
   * @async
   * Registers consumer handlers for prepare transfer all participants
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
   * @method POST
   *
   * @async
   * Registers consumer handlers for fulfill transfer this is one topic for all transfers as fulfills do not need to keep order
   * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
   */
  {
    method: 'POST',
    path: '/register/transfer/fulfill',
    handler: TransferHandler.registerFulfillHandler,
    options: {
      id: 'fulfill',
      description: 'Register fulfill transfer Kafka consumer handler'
    }
  },
  /**
   * @method POST
   *
   * @async
   * Registers consumer handlers for reject transfer this is one topic for all transfers as rejects do not need to keep order
   * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
   */
  {
    method: 'POST',
    path: '/register/transfer/reject',
    handler: TransferHandler.registerRejectHandler,
    options: {
      id: 'reject',
      description: 'Register reject transfer Kafka consumer handler'
    }
  },
  /**
   * @method POST
   *
   * @async
   * Registers consumer handlers for positions all participants
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
  /**
   * @method POST
   *
   * @async
   * Registers consumer handlers for notifications this is one topic for all participants
   * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
   */
  {
    method: 'POST',
    path: '/register/notification/all',
    handler: NotificationHandler.registerNotificationHandler,
    options: {
      id: 'notification',
      description: 'Register notification Kafka consumer handler'
    }
  },
  // this is for testing purposes so that we can produce transfers without the ML-API. will be removed later
  {
    method: 'POST',
    path: '/test/producer',
    handler: testProducer.testProducer,
    options: {
      id: 'testing',
      description: 'testing'
    }
  }
]
