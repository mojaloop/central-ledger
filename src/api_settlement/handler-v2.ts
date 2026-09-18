import { LedgerSql } from "../domain/ledger/ledger-sql"
import { ApplicationConfig } from "../lib/config"
import { ResponseToolkit } from '@hapi/hapi';
import { 
  RequestCloseSettlementWindow, 
  RequestCreateSettlementEvent, 
  RequestGetSettlementById, 
  RequestGetSettlementByParticipant, 
  RequestGetSettlementByParticipantAccount, 
  RequestGetSettlementsByParams, 
  RequestGetSettlementWindowById, 
  RequestGetSettlementWindowsByParams, 
  RequestUpdateSettlementById, 
  RequestUpdateSettlementByParticipant, 
  RequestUpdateSettlementByParticipantAccount 
} from "./types";
import Settlements from '../domain/settlement/index';
import settlementWindows from '../domain/settlementWindow/index';

import { logger } from "../shared/logger";

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Utility = require('@mojaloop/central-services-shared').Util
const Enum = require('@mojaloop/central-services-shared').Enum
const EventSdk = require('@mojaloop/event-sdk')


interface Dependencies {
  config: ApplicationConfig,
  ledger: LedgerSql,
}

/**
 * Refactored version of the Settlement API handlers. These were previously split across different
 * files, but it's much simpler to combine them into one ~500 line file.
 */
export default class HandlerSettlementV2 {
  constructor(private deps: Dependencies) {
    logger.warn(`HandlerSettlementV2.constructor() - API_MODE_SETTLEMENT=TODO`)
  }

  /**
   * summary: Returns Settlement(s) as per parameter(s).
   * description:
   * parameters: currency, participantId, settlementWindowId, accountId, state, fromDateTime, toDateTime
   * produces: application/json
   * responses: 200, 400, 401, 404, 415, default
   */
  public async getSettlementByParams(
    request: RequestGetSettlementsByParams,
    h: ResponseToolkit
  ): Promise<any> {
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

      const Enums = await request.server.methods.enums('settlementState')
      const settlementResult = await Settlements.getSettlementsByParams({ query: request.query }, Enums)
      return h.response(settlementResult)
    } catch (err: any) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }


  /**
   * summary: Trigger the creation of a settlement event, that does the calculation of the net
   *          settlement position per participant and marks all transfers in the affected windows 
   *          as Pending settlement. Returned dataset is the net settlement report for the
   *          settlement window
   * description:
   * parameters: settlementEventPayload
   * produces: application/json
   * responses: 200, 400, 401, 404, 415, default
   */
  public async createSettlementEvent(
    request: RequestCreateSettlementEvent,
    h: ResponseToolkit
  ): Promise<any> {
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
        ledgerEntryType: await request.server.methods.enums('ledgerEntryType'),
        settlementDelay: await request.server.methods.enums('settlementDelay'),
        settlementGranularity: await request.server.methods.enums('settlementGranularity'),
        settlementInterchange: await request.server.methods.enums('settlementInterchange'),
        settlementState: await request.server.methods.enums('settlementState'),
        settlementWindowState: await request.server.methods.enums('settlementWindowState'),
        transferParticipantRoleType: await request.server.methods.enums(
          'transferParticipantRoleType'
        ),
        transferState: await request.server.methods.enums('transferState')
      }
      const settlementResult = await Settlements.settlementEventTrigger(request.payload, Enums)
      return settlementResult
    } catch (err: any) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
   * summary: Returns a Settlement Window(s) as per parameter(s).
   * description:
   * parameters: participantId, state, fromDateTime, toDateTime
   * produces: application/json
   * responses: 200, 400, 401, 404, 415, default
   */
  public async getSettlementWindowsByParams(
    request: RequestGetSettlementWindowsByParams,
    h: ResponseToolkit
  ): Promise<any> {
    try {
      const { span, headers } = request
      const spanTags = Utility.EventFramework.getSpanTags(
        Enum.Events.Event.Type.SETTLEMENT_WINDOW,
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

      const Enums = await request.server.methods.enums('settlementWindowState')
      const settlementWindowResult = await settlementWindows.getByParams(
        { query: request.query }, Enums
      )
      return settlementWindowResult
    } catch (err: any) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
   * summary: Returns a Settlement Window as per id.
   * description:
   * parameters: id
   * produces: application/json
   * responses: 200, 400, 401, 404, 415, default
   */
  public async getSettlementWindowById(
    request: RequestGetSettlementWindowById,
    h: ResponseToolkit
  ): Promise<void> {
    const settlementWindowId = request.params.id
    try {
      const { span, headers } = request
      const spanTags = Utility.EventFramework.getSpanTags(
        Enum.Events.Event.Type.SETTLEMENT_WINDOW,
        Enum.Events.Event.Action.GET,
        `settlementWindowId=${settlementWindowId}`,
        headers[Enum.Http.Headers.FSPIOP.SOURCE],
        headers[Enum.Http.Headers.FSPIOP.DESTINATION]
      )
      span.setTags(spanTags)
      await span.audit({
        headers: request.headers,
        params: request.params
      }, EventSdk.AuditEventAction.start)
      const Enums = await request.server.methods.enums('settlementWindowState')
      return await settlementWindows.getById({ settlementWindowId }, Enums, request.server.log)
    } catch (err: any) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
   * summary: If the settlementWindow is open, it can be closed and a new window created. 
   * If it is already closed, return an error message. Returns the new settlement window.
   * description:
   * parameters: id, settlementWindowClosurePayload
   * produces: application/json
   * responses: 200, 400, 401, 404, 415, default
   */
  public async closeSettlementWindow(
    request: RequestCloseSettlementWindow,
    h: ResponseToolkit
  ) {
    const { reason } = request.payload
    const settlementWindowId = request.params.id
    try {
      const { span, headers } = request
      const spanTags = Utility.EventFramework.getSpanTags(
        Enum.Events.Event.Type.SETTLEMENT_WINDOW,
        Enum.Events.Event.Action.POST,
        `settlementWindowId=${settlementWindowId}`,
        headers[Enum.Http.Headers.FSPIOP.SOURCE],
        headers[Enum.Http.Headers.FSPIOP.DESTINATION]
      )
      span.setTags(spanTags)
      await span.audit(request.payload, EventSdk.AuditEventAction.start)
      const Enums = await request.server.methods.enums('settlementWindowState')
      return await settlementWindows.process({
        settlementWindowId,
        reason,
      }, Enums)
    } catch (err: any) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
   * summary: Returns Settlement(s) as per parameters/filter criteria.
   * description:
   * parameters: id
   * produces: application/json
   * responses: 200, 400, 401, 404, 415, default
   */
  public async getSettlementById(request: RequestGetSettlementById, h: ResponseToolkit) {
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

      const Enums = await request.server.methods.enums('settlementState')
      request.server.log('info', `get settlement by Id requested with id ${settlementId}`)
      const settlementResult = await Settlements.getById({ settlementId }, Enums)
      return settlementResult
    } catch (err: any) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
   * summary: Acknowledgement of settlement by updating with Settlements Id.
   * description:
   * parameters: id, settlementUpdatePayload
   * produces: application/json
   * responses: 200, 400, 401, 404, 415, default
   */
  public async updateSettlementById(request: RequestUpdateSettlementById, h: ResponseToolkit) {
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
        throw ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          'No other properties are allowed when participants is provided'
        )
      } else if ((p.state && !p.reason) || (!p.state && p.reason)) {
        const error = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.MISSING_ELEMENT,
          'State and reason are mandatory'
        )
        logger.error(error)
        throw error
      }
      const Enums = {
        ledgerAccountType: await request.server.methods.enums('ledgerAccountType'),
        ledgerEntryType: await request.server.methods.enums('ledgerEntryType'),
        participantLimitType: await request.server.methods.enums('participantLimitType'),
        settlementState: await request.server.methods.enums('settlementState'),
        settlementWindowState: await request.server.methods.enums('settlementWindowState'),
        transferParticipantRoleType: await request.server.methods.enums(
          'transferParticipantRoleType'
        ),
        transferState: await request.server.methods.enums('transferState'),
        transferStateEnum: await request.server.methods.enums('transferStateEnum')
      }
      if (p.participants) {
        return await Settlements.putById(settlementId, request.payload, Enums)
      } else if (p.state && p.state === Enums.settlementState.ABORTED) {
        return await Settlements.abortById(settlementId, request.payload, Enums)
      }
      const error = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        'Invalid request payload input'
      )
      logger.error(error)
      logger.error(error.stack)
      throw error
    } catch (err: any) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
   * summary: Acknowledgement of settlement by updating with Settlements Id and Participant Id.
   * description:
   * parameters: settlementId, participantId, settlementParticipantUpdatePayload
   * produces: application/json
   * responses: 200, 400, 401, 404, 415, default
   */

  public async getSettlementBySettlementParticipant(
    request: RequestGetSettlementByParticipant,
    h: ResponseToolkit,
  ): Promise<any> {
    try {
      const settlementId = request.params.sid
      const participantId = request.params.pid
      const { span, headers } = request
      const spanTags = Utility.EventFramework.getSpanTags(
        Enum.Events.Event.Type.SETTLEMENT,
        Enum.Events.Event.Action.GET,
        `sid=${settlementId};pid=${participantId}`,
        headers[Enum.Http.Headers.FSPIOP.SOURCE],
        headers[Enum.Http.Headers.FSPIOP.DESTINATION]
      )
      span.setTags(spanTags)
      await span.audit({
        headers: request.headers,
        params: request.params
      }, EventSdk.AuditEventAction.start)
      const Enums = {
        settlementWindowState: await request.server.methods.enums('settlementWindowState'),
        ledgerAccountType: await request.server.methods.enums('ledgerAccountType')
      }
      return await Settlements.getByIdParticipantAccount({ settlementId, participantId }, Enums)
    } catch (err: any) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
   * summary: Acknowledgement of settlement by updating with Settlements Id.
   * description:
   * parameters: id, participantId, settlementUpdatePayload
   * produces: application/json
   * responses: 200, 400, 401, 404, 415, default
   */
  public async updateSettlementByParticipant(
    request: RequestUpdateSettlementByParticipant,
    h: ResponseToolkit
  ) {
    const settlementId = request.params.sid
    const participantId = request.params.pid
    try {
      const { span, headers } = request
      const spanTags = Utility.EventFramework.getSpanTags(
        Enum.Events.Event.Type.SETTLEMENT,
        Enum.Events.Event.Action.PUT,
        `sid=${settlementId};pid=${participantId}`,
        headers[Enum.Http.Headers.FSPIOP.SOURCE],
        headers[Enum.Http.Headers.FSPIOP.DESTINATION]
      )
      span.setTags(spanTags)
      await span.audit(request.payload, EventSdk.AuditEventAction.start)
      const p = request.payload
      const universalPayload = {
        participants: [
          {
            id: participantId,
            accounts: p.accounts
          }
        ]
      }
      const Enums = {
        ledgerAccountType: await request.server.methods.enums('ledgerAccountType'),
        ledgerEntryType: await request.server.methods.enums('ledgerEntryType'),
        participantLimitType: await request.server.methods.enums('participantLimitType'),
        settlementState: await request.server.methods.enums('settlementState'),
        settlementWindowState: await request.server.methods.enums('settlementWindowState'),
        transferParticipantRoleType: await request.server.methods.enums(
          'transferParticipantRoleType'
        ),
        transferState: await request.server.methods.enums('transferState')
      }
      return await Settlements.putById(settlementId, universalPayload, Enums)
    } catch (err: any) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
     * summary: Returns Settlement(s) as per filter criteria.
     * description:
     * parameters: settlementId, participantId, accountId
     * produces: application/json
     * responses: 200, 400, 401, 404, 415, default
     */

  public async getSettlementBySettlementParticipantAccount(
    request: RequestGetSettlementByParticipantAccount,
    h: ResponseToolkit
  ) {
    try {
      const settlementId = request.params.sid
      const participantId = request.params.pid
      const accountId = request.params.aid
      const { span, headers } = request
      const spanTags = Utility.EventFramework.getSpanTags(
        Enum.Events.Event.Type.SETTLEMENT,
        Enum.Events.Event.Action.GET,
        `sid=${settlementId};pid=${participantId};aid=${accountId}`,
        headers[Enum.Http.Headers.FSPIOP.SOURCE],
        headers[Enum.Http.Headers.FSPIOP.DESTINATION]
      )
      span.setTags(spanTags)
      await span.audit({
        headers: request.headers,
        params: request.params
      }, EventSdk.AuditEventAction.start)
      const Enums = {
        settlementWindowState: await request.server.methods.enums('settlementWindowState'),
        ledgerAccountType: await request.server.methods.enums('ledgerAccountType')
      }
      return await Settlements.getByIdParticipantAccount({ settlementId, participantId, accountId }, Enums)
    } catch (err: any) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
   * summary: Acknowledgement of settlement by updating with Settlements Id.
   * description:
   * parameters: id, participantId, settlementUpdatePayload
   * produces: application/json
   * responses: 200, 400, 401, 404, 415, default
   */
  public async updateSettlementByIdParticipantAccount(
    request: RequestUpdateSettlementByParticipantAccount,
    h: ResponseToolkit
  ) {
    const settlementId = request.params.sid
    const participantId = request.params.pid
    const accountId = request.params.aid
    try {
      const { span, headers } = request
      const spanTags = Utility.EventFramework.getSpanTags(
        Enum.Events.Event.Type.SETTLEMENT,
        Enum.Events.Event.Action.PUT,
        `sid=${settlementId};pid=${participantId};aid=${accountId}`,
        headers[Enum.Http.Headers.FSPIOP.SOURCE],
        headers[Enum.Http.Headers.FSPIOP.DESTINATION]
      )
      span.setTags(spanTags)
      await span.audit(request.payload, EventSdk.AuditEventAction.start)
      const accounts = [Object.assign({}, request.payload, { id: accountId })]
      const universalPayload = {
        participants: [
          {
            id: participantId,
            accounts
          }
        ]
      }
      const Enums = {
        ledgerAccountType: await request.server.methods.enums('ledgerAccountType'),
        ledgerEntryType: await request.server.methods.enums('ledgerEntryType'),
        participantLimitType: await request.server.methods.enums('participantLimitType'),
        settlementState: await request.server.methods.enums('settlementState'),
        settlementWindowState: await request.server.methods.enums('settlementWindowState'),
        transferParticipantRoleType: await request.server.methods.enums('transferParticipantRoleType'),
        transferState: await request.server.methods.enums('transferState')
      }
      return await Settlements.putById(settlementId, universalPayload, Enums)
    } catch (err: any) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }
}