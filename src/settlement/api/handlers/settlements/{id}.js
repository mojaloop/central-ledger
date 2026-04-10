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
const { logger } = require('../../../shared/logger')
const Settlements = require('../../../domain/settlement/index')
const Utility = require('@mojaloop/central-services-shared').Util
const Enum = require('@mojaloop/central-services-shared').Enum
const EventSdk = require('@mojaloop/event-sdk')

/**
 * Operations on /settlements/{id}
 */
module.exports = {
  /**
     * summary: Returns Settlement(s) as per parameters/filter criteria.
     * description:
     * parameters: id
     * produces: application/json
     * responses: 200, 400, 401, 404, 415, default
     */
  get: async function getSettlementById (request, h) {
    const settlementId = request.params.id
    try {
      const { span, headers } = request
      const spanTags = Utility.EventFramework.getSpanTags(
        Enum.Events.Event.Type.SETTLEMENT,
        Enum.Events.Event.Action.GET,
        `sid=${settlementId}`,
        headers[Enum.Http.Headers.FSPIOP.SOURCE],
        headers[Enum.Http.Headers.FSPIOP.DESTINATION]
      )
      span.setTags(spanTags)
      await span.audit({
        headers: request.headers,
        params: request.params
      }, EventSdk.AuditEventAction.start)

      const Enums = await request.server.methods.enums('settlementStates')
      request.server.log('info', `get settlement by Id requested with id ${settlementId}`)
      const settlementResult = await Settlements.getById({ settlementId }, Enums)
      return h.response(settlementResult)
    } catch (err) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  },

  /**
     * summary: Acknowledgement of settlement by updating with Settlements Id.
     * description:
     * parameters: id, settlementUpdatePayload
     * produces: application/json
     * responses: 200, 400, 401, 404, 415, default
     */
  put: async function updateSettlementById (request) {
    const settlementId = request.params.id
    try {
      const { span, headers } = request
      const spanTags = Utility.EventFramework.getSpanTags(
        Enum.Events.Event.Type.SETTLEMENT,
        Enum.Events.Event.Action.PUT,
        `sid=${settlementId}`,
        headers[Enum.Http.Headers.FSPIOP.SOURCE],
        headers[Enum.Http.Headers.FSPIOP.DESTINATION]
      )
      span.setTags(spanTags)
      await span.audit(request.payload, EventSdk.AuditEventAction.start)

      const p = request.payload
      if (p.participants && (p.state || p.reason || p.externalReference)) {
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'No other properties are allowed when participants is provided')
      } else if ((p.state && !p.reason) || (!p.state && p.reason)) {
        const error = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MISSING_ELEMENT, 'State and reason are mandatory')
        logger.error(error)
        throw error
      }
      const Enums = {
        ledgerAccountTypes: await request.server.methods.enums('ledgerAccountTypes'),
        ledgerEntryTypes: await request.server.methods.enums('ledgerEntryTypes'),
        participantLimitTypes: await request.server.methods.enums('participantLimitTypes'),
        settlementStates: await request.server.methods.enums('settlementStates'),
        settlementWindowStates: await request.server.methods.enums('settlementWindowStates'),
        transferParticipantRoleTypes: await request.server.methods.enums('transferParticipantRoleTypes'),
        transferStates: await request.server.methods.enums('transferStates'),
        transferStateEnums: await request.server.methods.enums('transferStateEnums')
      }
      if (p.participants) {
        return await Settlements.putById(settlementId, request.payload, Enums)
      } else if (p.state && p.state === Enums.settlementStates.ABORTED) {
        return await Settlements.abortById(settlementId, request.payload, Enums)
      } else {
        const error = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'Invalid request payload input')
        logger.error(error)
        throw error
      }
    } catch (err) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }
}
