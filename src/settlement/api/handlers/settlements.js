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

 * ModusBox
 - Deon Botha <deon.botha@modusbox.com>
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Miguel de Barros <miguel.debarros@modusbox.com>
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 - Valentin Genev <valentin.genev@modusbox.com>
 --------------
 ******/
'use strict'

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Settlements = require('../../domain/settlement/index')
const Utility = require('@mojaloop/central-services-shared').Util
const Enum = require('@mojaloop/central-services-shared').Enum
const EventSdk = require('@mojaloop/event-sdk')

/**
 * Operations on /settlements
 */
module.exports = {
  /**
     * summary: Returns Settlement(s) as per parameter(s).
     * description:
     * parameters: currency, participantId, settlementWindowId, accountId, state, fromDateTime, toDateTime
     * produces: application/json
     * responses: 200, 400, 401, 404, 415, default
     */
  get: async function getSettlementsByParams (request, h) {
    try {
      const { span, headers } = request
      const spanTags = Utility.EventFramework.getSpanTags(
        Enum.Events.Event.Type.SETTLEMENT,
        Enum.Events.Event.Action.GET,
        undefined,
        headers[Enum.Http.Headers.FSPIOP.SOURCE],
        headers[Enum.Http.Headers.FSPIOP.DESTINATION]
      )
      span.setTags(spanTags)
      await span.audit({
        headers: request.headers,
        params: request.params
      }, EventSdk.AuditEventAction.start)

      const Enums = await request.server.methods.enums('settlementStates')
      const settlementResult = await Settlements.getSettlementsByParams({ query: request.query }, Enums)
      return h.response(settlementResult)
    } catch (err) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  },
  /**
     * summary: Trigger the creation of a settlement event, that does the calculation of the net settlement position per participant and marks all transfers in the affected windows as Pending settlement. Returned dataset is the net settlement report for the settlement window
     * description:
     * parameters: settlementEventPayload
     * produces: application/json
     * responses: 200, 400, 401, 404, 415, default
     */

  post: async function createSettlementEvent (request, h) {
    try {
      const { span, payload, headers } = request
      const spanTags = Utility.EventFramework.getSpanTags(
        Enum.Events.Event.Type.SETTLEMENT,
        Enum.Events.Event.Action.POST,
        payload.settlementWindows.map(id => id.id).join(''),
        headers[Enum.Http.Headers.FSPIOP.SOURCE],
        headers[Enum.Http.Headers.FSPIOP.DESTINATION]
      )
      span.setTags(spanTags)
      await span.audit(request.payload, EventSdk.AuditEventAction.start)

      const Enums = {
        ledgerEntryTypes: await request.server.methods.enums('ledgerEntryTypes'),
        settlementDelay: await request.server.methods.enums('settlementDelay'),
        settlementGranularity: await request.server.methods.enums('settlementGranularity'),
        settlementInterchange: await request.server.methods.enums('settlementInterchange'),
        settlementStates: await request.server.methods.enums('settlementStates'),
        settlementWindowStates: await request.server.methods.enums('settlementWindowStates'),
        transferParticipantRoleTypes: await request.server.methods.enums('transferParticipantRoleTypes'),
        transferStates: await request.server.methods.enums('transferStates')
      }
      const settlementResult = await Settlements.settlementEventTrigger(request.payload, Enums)
      return h.response(settlementResult)
    } catch (err) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }
}
