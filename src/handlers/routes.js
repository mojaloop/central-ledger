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

const RegisterAllHandler = require('./handlers')
const TransferHandler = require('./transfers/handler')
const PositionHandler = require('./positions/handler')
const NotificationHandler = require('./notification/handler')

module.exports = [
  {
    method: 'POST',
    path: '/register/all',
    handler: RegisterAllHandler.registerAllHandlers,
    options: {
      id: 'handlers',
      description: 'Register all Kafka consumer handlers'
    }
  },
  {
    method: 'POST',
    path: '/register/transfer/all',
    handler: TransferHandler.registerAllHandlers,
    options: {
      id: 'transfer',
      description: 'Register all transfer Kafka consumer handlers'
    }
  },
  {
    method: 'POST',
    path: '/register/transfer/prepare',
    handler: TransferHandler.registerPrepareHandlers,
    options: {
      id: 'prepare',
      description: 'Register prepare transfer Kafka consumer handler'
    }
  },
  {
    method: 'POST',
    path: '/register/transfer/fulfill',
    handler: TransferHandler.registerFulfillHandler,
    options: {
      id: 'fulfill',
      description: 'Register ful;fill transfer Kafka consumer handler'
    }
  },
  {
    method: 'POST',
    path: '/register/transfer/reject',
    handler: TransferHandler.registerRejectHandler,
    options: {
      id: 'reject',
      description: 'Register reject transfer Kafka consumer handler'
    }
  },
  {
    method: 'POST',
    path: '/register/position',
    handler: PositionHandler.registerPositionHandlers,
    options: {
      id: 'position',
      description: 'Register position Kafka consumer handler'
    }
  },
  {
    method: 'POST',
    path: '/register/notification',
    handler: NotificationHandler.registerNotificationHandler,
    options: {
      id: 'notification',
      description: 'Register prepare transfer Kafka consumer handler'
    }
  }
]
