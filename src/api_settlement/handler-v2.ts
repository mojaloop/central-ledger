import { ApplicationConfig } from "../lib/config"
import { ResponseToolkit } from '@hapi/hapi'
import assert from "node:assert"
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
import Settlements from '../domain/settlement/index'
import settlementWindows from '../domain/settlementWindow/index'

import { logger } from "../shared/logger"
import {
  GetSettlementQuery,
  GetSettlementsQuery,
  GetSettlementWindowQuery,
  GetSettlementWindowsQuery,
  InternalSettlementState,
  Ledger,
  SettlementAbortCommand,
  SettlementCloseWindowCommand,
  SettlementPrepareCommand,
  SettlementUpdate,
  SettlementUpdateCommand
} from "../domain/ledger/shared/types";

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Utility = require('@mojaloop/central-services-shared').Util
const Enum = require('@mojaloop/central-services-shared').Enum
const EventSdk = require('@mojaloop/event-sdk')


interface Dependencies {
  config: ApplicationConfig,
  ledger: Ledger,
}

// Parsing helpers
const parseIfSet = <T>(
  input: string | undefined,
  fun: (input: string) => T
): T | undefined => {
  if (input === undefined) {
    return undefined
  }

  return fun(input)
}

const parseInternalSettlementState = (input: string): InternalSettlementState => {
  switch (input) {
    case 'PENDING_SETTLEMENT':
    case 'PS_TRANSFERS_RECORDED':
    case 'PS_TRANSFERS_RESERVED':
    case 'PS_TRANSFERS_COMMITTED':
    case 'SETTLING':
    case 'SETTLED':
    case 'ABORTED':
      return input
    default:
      throw new Error(`parseInternalSettlementState() unknown state: ${input}.`
        + `Expected one of PENDING_SETTLEMENT, PS_TRANSFERS_RECORDED, PS_TRANSFERS_RESERVED, `
        + `PS_TRANSFERS_COMMITTED, SETTLING, SETTLED, ABORTED.`
      )
  }
}

const parseDate = (input: string): Date => {
  return new Date(input)
}

const trimUndefined = (input: Record<string, any>) => Object.entries(input)
  .reduce((acc, [key, value]) => {
    if (value !== undefined) acc[key] = value
    return acc
  }, {} as Record<string, any>)

/**
 * @function mapUpdates
 * @description Map from a updateSettlementById DTO representation to a Ledger representation.
 */
const mapUpdates = (items: Array<any>): Array<SettlementUpdate> => {
  return items.map(item => {
    assert(item.id)

    if (item.accounts.length === 0) {
      throw new Error(`mapUpdates() found no accounts for participant`
        + `${item.id}. Expected only 1.`)
    }
    if (item.accounts.length > 1) {
      throw new Error(`mapUpdates() found more than 1 account for participant`
        + `${item.id}. Expected only 1.`)
    }
    assert(item.accounts[0])
    const account = item.accounts[0]
    assert(account.state)
    assert(typeof account.reason === 'string')
    assert(typeof account.externalReference === 'string')

    return {
      participantId: item.id,
      accountId: account.id,
      participantState: account.state,
      reason: account.reason,
      externalReference: account.externalReference
    }
  })
}

/**
 * Refactored version of the Settlement API handlers. These were previously split across different
 * files, but it's much simpler to combine them into one ~500 line file.
 */
export default class HandlerSettlementV2 {
  constructor(private deps: Dependencies) {
    logger.warn(`HandlerSettlementV2.constructor() - `
      + `API_MODE_SETTLEMENT=${this.deps.config.API_MODE_SETTLEMENT}`)
  }

  /**
   * summary: Returns Settlement(s) as per parameter(s).
   * description:
   * parameters: currency, participantId, settlementWindowId, accountId, state, fromDateTime, toDateTime
   * produces: application/json
   * responses: 200, 400, 401, 404, 415, default
   */
  public async getSettlementByParams(
    context: any,
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
      if (this.deps.config.API_MODE_SETTLEMENT === 'LEDGER') {
        const query: GetSettlementsQuery = trimUndefined({
          currency: request.query.currency,
          participantId: request.query.participantId,
          settlementWindowId: request.query.settlementWindowId,
          accountId: request.query.accountId,
          state: parseIfSet(request.query.state, parseInternalSettlementState),
          fromDateTime: parseIfSet(request.query.fromDateTime, parseDate),
          toDateTime: parseIfSet(request.query.toDateTime, parseDate),
          fromSettlementWindowDateTime: parseIfSet(request.query.fromSettlementWindowDateTime, parseDate),
          toSettlementWindowDateTime: parseIfSet(request.query.toSettlementWindowDateTime, parseDate)
        })

        const result = await this.deps.ledger.getSettlements(query)
        if (result.type === 'FAILURE') {
          throw result.error
        }

        return result.result
      }
      return await Settlements.getSettlementsByParams({ query: request.query }, Enums)
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
    context: any,
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
      if (this.deps.config.API_MODE_SETTLEMENT === 'LEDGER') {
        const cmd: SettlementPrepareCommand = {
          windowIds: request.payload.settlementWindows.map(window => window.id),
          model: request.payload.settlementModel,
          reason: request.payload.reason,
          now: new Date(),
        }
        const result = await this.deps.ledger.settlementPrepare(cmd)
        if (result.type === 'FAILURE') {
          throw result.error
        }
        return result.result
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
    context: any,
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

      if (this.deps.config.API_MODE_SETTLEMENT === 'LEDGER') {
        const query: GetSettlementWindowsQuery = trimUndefined({
          participantId: request.query.participantId,
          state: request.query.state,
          fromDateTime: parseIfSet(request.query.fromDateTime, parseDate),
          toDateTime: parseIfSet(request.query.toDateTime, parseDate),
          currency: request.query.currency,

        })
        const result = await this.deps.ledger.getSettlementWindows(query)
        if (result.type === 'FAILURE') {
          throw result.error
        }

        return result.result
      }

      return await settlementWindows.getByParams(
        { query: request.query }, Enums
      )
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
    context: any,
    request: RequestGetSettlementWindowById,
    h: ResponseToolkit
  ): Promise<any> {
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
      if (this.deps.config.API_MODE_SETTLEMENT === 'LEDGER') {
        const query: GetSettlementWindowQuery = { id: settlementWindowId }
        const result = await this.deps.ledger.getSettlementWindow(query)
        if (result.type === 'FAILURE' || result.type === 'NOT_FOUND') {
          throw result.error
        }

        return result.result
      }
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
    context: any,
    request: RequestCloseSettlementWindow,
    h: ResponseToolkit
  ) {
    const { reason } = request.payload
    let settlementWindowId = request.params.id
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
      if (this.deps.config.API_MODE_SETTLEMENT === 'LEDGER') {
        const cmd: SettlementCloseWindowCommand = {
          id: settlementWindowId,
          reason,
          now: new Date()
        }
        const result = await this.deps.ledger.closeSettlementWindow(cmd)
        if (result.type === 'FAILURE') {
          throw result.error
        }

        // @ts-ignore
        return result.result
      }
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
  public async getSettlementById(
    context: any, 
    request: RequestGetSettlementById, 
    h: ResponseToolkit
  ) {
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
      if (this.deps.config.API_MODE_SETTLEMENT === 'LEDGER') {
        const query: GetSettlementQuery = {
          id: settlementId
        }
        const result = await this.deps.ledger.getSettlement(query)
        if (result.type === 'FAILURE' || result.type === 'NOT_FOUND') {
          throw result.error
        }

        return result.result
      }
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
  public async updateSettlementById(
    context: any, 
    request: RequestUpdateSettlementById, 
    h: ResponseToolkit
  ) {
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

      // Default participants.account.externalReference to an empty string if not defined.
      if (p.participants) {
        for (let participant of p.participants) {
          for (let account of participant.accounts) {
            if (!account.externalReference) {
              account.externalReference = ''
            }
          }
        }
      }

      if (this.deps.config.API_MODE_SETTLEMENT === 'LEDGER') {
        if (p.participants) {

          // Update.
          const cmd: SettlementUpdateCommand = {
            id: settlementId,
            updates: mapUpdates(p.participants)
          }
          const result = await this.deps.ledger.settlementUpdate(cmd)
          if (result.type === 'FAILURE') {
            throw result.error
          }

          return result.result
        } else if (p.state && p.state === Enums.settlementState.ABORTED) {
          // Abort.
          const reason = request.payload.reason
          assert(reason,)
          const cmd: SettlementAbortCommand = {
            id: settlementId,
            reason,
          }
          const result = await this.deps.ledger.settlementAbort(cmd)
          if (result.type === 'FAILURE') {
            throw result.error
          }

          return result.result
        }
        const error = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          'Invalid request payload input'
        )
        throw error
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
      request.server.log('error', err.stack)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
   * summary: 
   * description:
   * parameters: 
   * produces: application/json
   * responses: 200, 400, 401, 404, 415, default
   */
  public async getSettlementBySettlementParticipant(
    context: any,
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
      if (this.deps.config.API_MODE_SETTLEMENT === 'LEDGER') {
        const query: GetSettlementQuery = {
          id: settlementId
        }
        const resultSettlement = await this.deps.ledger.getSettlement(query)
        if (resultSettlement.type === 'FAILURE' || resultSettlement.type === 'NOT_FOUND') {
          throw resultSettlement.error
        }

        // Now filter for the participant. Ledger doesn't support lookup by participant.
        const participants = resultSettlement.result.participants
          .filter(participant => participant.id === participantId)
        if (participants.length === 0) {
          throw new Error(`Participant not found for settlement: ${settlementId} `
            + `and participantId: ${participantId}`)
        }

        const formatted = {
          id: resultSettlement.result.id,
          state: resultSettlement.result.state,
          settlementWindows: [], // Backwards compatibility.
          participants
        }

        return formatted
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
    context: any,
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
      const accounts = structuredClone(request.payload.accounts)
      
      // Default account.externalReference to empty string if not defined.
      for (let account of accounts) {
        if (!account.externalReference) {
          account.externalReference = ''
        }
      }
      const universalPayload = {
        participants: [
          {
            id: participantId,
            accounts,
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
      if (this.deps.config.API_MODE_SETTLEMENT === 'LEDGER') {
        const cmd: SettlementUpdateCommand = {
          id: settlementId,
          updates: mapUpdates([{
            id: participantId,
            accounts,
          }])
        }
        const result = await this.deps.ledger.settlementUpdate(cmd)
        if (result.type === 'FAILURE') {
          throw result.error
        }

        return result.result
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
    context: any,
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
      if (this.deps.config.API_MODE_SETTLEMENT === 'LEDGER') {
        const query: GetSettlementQuery = {
          id: settlementId
        }
        const resultSettlement = await this.deps.ledger.getSettlement(query)
        if (resultSettlement.type === 'FAILURE' || resultSettlement.type === 'NOT_FOUND') {
          throw resultSettlement.error
        }

        // Now filter for the participant + account. Ledger doesn't support lookup by participant.
        const participant = resultSettlement.result.participants
          .find(participant => participant.id === participantId)
        if (!participant) {
          throw new Error(`Participant not found for settlement: ${settlementId} `
            + `and participantId: ${participantId}`)
        }
        const account = participant.accounts.find(account => account.id === accountId)
        if (!account) {
          throw new Error(`Account not found for settlement: ${settlementId} `
            + `and participantId: ${participantId}`
            + `and accountId: ${accountId}`
          )
        }

        const formatted = {
          id: resultSettlement.result.id,
          state: resultSettlement.result.state,
          settlementWindows: [], // Backwards compatibility.
          participants: [{
            id: participant.id,
            accounts: [
              account
            ]
          }]
        }

        return formatted
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
    context: any,
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
      // Set a default, makes API more consistent.
      if (!request.payload.externalReference) {
        request.payload.externalReference = ''
      }
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
      if (this.deps.config.API_MODE_SETTLEMENT === 'LEDGER') {
        const cmd: SettlementUpdateCommand = {
          id: settlementId,
          updates: mapUpdates([{
            id: participantId,
            accounts: [{
              id: accountId,
              state: request.payload.state,
              reason: request.payload.reason,
              externalReference: request.payload.externalReference || '',
            }]
          }])
        }
        const result = await this.deps.ledger.settlementUpdate(cmd)
        if (result.type === 'FAILURE') {
          throw result.error
        }

        return result.result
      }
      return await Settlements.putById(settlementId, universalPayload, Enums)
    } catch (err: any) {
      request.server.log('error', err)
      return ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }
}
