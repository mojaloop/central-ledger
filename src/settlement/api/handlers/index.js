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
 --------------
 ******/
'use strict'

const OpenapiBackend = require('@mojaloop/central-services-shared').Util.OpenapiBackend
const health = require('./health')
const settlementWindows = require('./settlementWindows')
const settlementWindowsById = require('./settlementWindows/{id}')
const settlements = require('./settlements')
const settlementsById = require('./settlements/{id}')
const settlementsByIdParticipants = require('./settlements/{sid}/participants/{pid}')
const settlementsByIdParticipantsAccounts = require('./settlements/{sid}/participants/{pid}/accounts/{aid}')

/**
 * Map of OpenAPI operationIds to their handlers, consumed by
 * `OpenapiBackend.initialise` (openapi-backend).
 */
module.exports = {
  getHealth: health.get,
  getSettlementWindowsByParams: settlementWindows.get,
  getSettlementWindowById: settlementWindowsById.get,
  closeSettlementWindow: settlementWindowsById.post,
  getSettlementsByParams: settlements.get,
  createSettlement: settlements.post,
  getSettlementById: settlementsById.get,
  updateSettlementById: settlementsById.put,
  getSettlementBySettlementParticipant: settlementsByIdParticipants.get,
  updateSettlementBySettlementParticipant: settlementsByIdParticipants.put,
  getSettlementBySettlementParticipantAccount: settlementsByIdParticipantsAccounts.get,
  updateSettlementBySettlementParticipantAccount: settlementsByIdParticipantsAccounts.put,
  validationFail: OpenapiBackend.validationFail,
  notFound: OpenapiBackend.notFound,
  methodNotAllowed: OpenapiBackend.methodNotAllowed
}
