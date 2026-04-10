/*****
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

 * Valentin Genev <valentin.genev@modusbox.com>
 * Deon Botha <deon.botha@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

'use strict'
const Mockgen = require('../../../mockgen.js')
/**
 * Operations on /settlements/{settlementId}/participants/{participantId}
 */
module.exports = {
  /**
     * summary: Acknowledgement of settlement by updating with Settlements Id and Participant Id.
     * description:
     * parameters: settlementId, participantId, settlementParticipantUpdatePayload
     * produces: application/json
     * responses: 200, 400, 401, 404, 415, default
     * operationId: updateSettlementBySettlementIdParticipantId
     */
  put: {
    200: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/settlements/{settlementId}/participants/{participantId}',
        operation: 'put',
        response: '200'
      }, callback)
    },
    400: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/settlements/{settlementId}/participants/{participantId}',
        operation: 'put',
        response: '400'
      }, callback)
    },
    401: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/settlements/{settlementId}/participants/{participantId}',
        operation: 'put',
        response: '401'
      }, callback)
    },
    404: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/settlements/{settlementId}/participants/{participantId}',
        operation: 'put',
        response: '404'
      }, callback)
    },
    415: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/settlements/{settlementId}/participants/{participantId}',
        operation: 'put',
        response: '415'
      }, callback)
    },
    default: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/settlements/{settlementId}/participants/{participantId}',
        operation: 'put',
        response: 'default'
      }, callback)
    }
  }
}
