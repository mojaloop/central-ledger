import { LedgerSql } from "../../domain/ledger/ledger-sql";
import { ApplicationConfig } from "../../lib/config";
import { ReqRefDefaults, Request, ResponseToolkit } from '@hapi/hapi';
import { CommandResult, CreateDfspCommand, LegacyLimitItem } from "../../domain/ledger/types";
import { assertNestedFields, convertBigIntToNumber } from "../../lib/config/util";
import { FSPIOPError } from "@mojaloop/central-services-error-handling";

const Util = require('@mojaloop/central-services-shared').Util
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const MLNumber = require('@mojaloop/ml-number')

const ParticipantService = require('../../domain/participant')
const SettlementService = require('../../domain/settlement')
const UrlParser = require('../../lib/urlParser')
const Config = require('../../lib/config')
const Enums = require('../../lib/enumCached')
const rethrow = require('../../shared/rethrow')
const fspiopErrorFactory = require('../../shared/fspiopErrorFactory')
const assert = require('node:assert')
const logger = require('../../shared/logger').logger

interface Dependencies {
  config: ApplicationConfig,
  ledger: LedgerSql,
}

type EntityItem = {
  name: string,
  createdDate: string,
  isActive: number
  currencyList: Array<{
    createdDate: string,
    participantCurrencyId: any
    ledgerAccountTypeId: any
    currencyId: string,
    isActive: number,
    createdBy: string
  }>,
  isProxy: number
}

export type RequestCreate = Request<ReqRefDefaults & {
  Payload: { name: string; currency: string; isProxy?: boolean }
}>

export type RequestCreateHubAccount = Request<ReqRefDefaults & {
  Payload: { currency: string; type: string },
  Params: { name: string }
}>

export type RequestGetAll = Request<ReqRefDefaults & {
  Query: { isProxy: boolean }
}>

export type RequestGetByName = Request<ReqRefDefaults & {
  Params: { name: string }
}>

export type RequestUpdate = Request<ReqRefDefaults & {
  Params: { name: string }
  Payload: { isActive: boolean }
}>

export type RequestAddEndpoint = Request<ReqRefDefaults & {
  Params: { name: string }
  Payload: { type: string; value: string }
}>

export type RequestGetEndpoint = Request<ReqRefDefaults & {
  Params: { name: string }
  Query: { type?: string }
}>

export type RequestAddLimitAndInitialPosition = Request<ReqRefDefaults & {
  Params: { name: string }
  Payload: {
    currency: string;
    limit: {
      type: string;
      value: number;
      alarmPercentage: number,
    };
    initialPosition?: number
  }
}>

export type RequestGetLimits = Request<ReqRefDefaults & {
  Params: { name: string }
  Query: { currency?: string; type?: string }
}>

export type RequestGetLimitsForAllParticipants = Request<ReqRefDefaults & {
  Query: { currency?: string; type?: string }
}>

export type RequestAdjustLimits = Request<ReqRefDefaults & {
  Params: { name: string }
  Payload: { currency: string; limit: { type: string; value: number; alarmPercentage: number } }
}>

export type RequestGetPositions = Request<ReqRefDefaults & {
  Params: { name: string }
  Query: { currency?: string }
}>

export type RequestGetAccounts = Request<ReqRefDefaults & {
  Params: { name: string }
  Query: { currency?: string }
}>

export type RequestUpdateAccount = Request<ReqRefDefaults & {
  Params: { name: string; id: number }
  Payload: { isActive: boolean }
}>

export type RequestRecordFunds = Request<ReqRefDefaults & {
  Params: { name: string; id: number; transferId?: string }
  Payload: {
    transferId?: string
    externalReference?: string
    action:
    'recordFundsIn' |
    'recordFundsOutPrepareReserve' |
    'recordFundsOutCommit' |
    'recordFundsOutAbort'
    reason: string
    amount?: { amount: number; currency: string }
    extensionList?: { extension: Array<{ key: string; value: string }> }
  }
}>

interface ResponseParticipant {
  name: string
  id: string
  created: Date
  isActive: number
  isProxy: number
  links: {
    self: string
  }
  accounts: ParticipantAccount[]
}

interface ParticipantAccount {
  createdBy: string
  createdDate: Date
  currency: string
  id: number
  isActive: number
  ledgerAccountType: string
}

export default class HandlerV2 {
  constructor(private deps: Dependencies) { 
    logger.warn(`participants HandlerV2.constructor() - API_MODE_ADMIN=${this.deps.config.API_MODE_ADMIN}`)
  }

  public async create(request: RequestCreate, h: ResponseToolkit): Promise<unknown> {
    if (this.deps.config.API_MODE_ADMIN === 'LEDGER') {
      return this.ledger_create(request, h)
    }

    try {
      const ledgerAccountTypes = await Enums.getEnums('ledgerAccountType')
      await ParticipantService.validateHubAccounts(request.payload.currency)
      let participant = await ParticipantService.getByName(request.payload.name)
      if (participant) {
        const currencyExists = participant.currencyList.find((currency: any) => {
          return currency.currencyId === request.payload.currency
        })
        if (currencyExists) {
          throw ErrorHandler.Factory.createFSPIOPError(
            ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR,
            'Participant currency has already been registered'
          )
        }
      } else {
        const participantId = await ParticipantService.create(request.payload)
        participant = await ParticipantService.getById(participantId)
      }
      const ledgerAccountIds = Util.transpose(ledgerAccountTypes)
      const allSettlementModels = await SettlementService.getAll()
      let settlementModels = allSettlementModels
        .filter((model: any) => model.currencyId === request.payload.currency)
      if (settlementModels.length === 0) {
        settlementModels = allSettlementModels
          .filter((model: any) => model.currencyId === null) // Default settlement model
        if (settlementModels.length === 0) {
          throw ErrorHandler.Factory.createFSPIOPError(
            ErrorHandler.Enums.FSPIOPErrorCodes.GENERIC_SETTLEMENT_ERROR,
            'Unable to find a matching or default, Settlement Model'
          )
        }
      }
      for (const settlementModel of settlementModels) {
        const participantCurrencyId1 = await ParticipantService.createParticipantCurrency(
          participant.participantId,
          request.payload.currency,
          settlementModel.ledgerAccountTypeId,
          false
        )
        const participantCurrencyId2 = await ParticipantService.createParticipantCurrency(
          participant.participantId,
          request.payload.currency,
          settlementModel.settlementAccountTypeId,
          false
        )
        assert(Array.isArray(participant.currencyList))
        participant.currencyList = participant.currencyList.concat([
          await ParticipantService.getParticipantCurrencyById(participantCurrencyId1),
          await ParticipantService.getParticipantCurrencyById(participantCurrencyId2)]
        )
      }
      return h.response(this.entityItem(participant, ledgerAccountIds)).code(201)
    } catch (err) {
      this.rethrowAndCountFspiopError(err, 'participantCreate')
    }
  }

  public async ledger_create(request: RequestCreate, h: ResponseToolkit): Promise<unknown> {
    const cmd: CreateDfspCommand = {
      dfspId: request.payload.name,
      isProxy: request.payload.isProxy ? true : false,
      currencies: [request.payload.currency]
    }
    const res = await this.deps.ledger.createDfsp(cmd)
    if (res.type === 'FAILURE') {
      this.rethrowAndCountFspiopError(res.error, 'participantCreate')
    }

    if (res.type === 'ALREADY_EXISTS') {
      throw ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR,
        'Participant currency has already been registered'
      )
    }
    const getByNameReply = await this.getByNameInner(request.payload.name)
    return h.response(getByNameReply).code(201)
  }

  private async getByNameInner(dfspName: string): Promise<ResponseParticipant> {
    assert(dfspName)

    const resultGetDfsp = await this.deps.ledger.getDfsp({ dfspId: dfspName })
    if (resultGetDfsp.type === 'NOT_FOUND') {
      throw fspiopErrorFactory.resourceNotFound()
    }
    if (resultGetDfsp.type === 'FAILURE') {
      throw resultGetDfsp.error
    }

    // Map from Ledger format Dfsp to Existing API
    const ledgerDfsp = resultGetDfsp.result
    const apiMappedAccounts = ledgerDfsp.accounts.map(acc => ({
      id: convertBigIntToNumber(acc.id),
      ledgerAccountType: acc.ledgerAccountType,
      currency: acc.currency,
      isActive: acc.isActive ? 1 : 0,
      createdDate: acc.createdDate,
      createdBy: 'unknown',
    }))

    const url = `${Config.HOSTNAME}/participants/${ledgerDfsp.name}`
    return {
      name: ledgerDfsp.name,
      id: url,
      created: ledgerDfsp.created,
      isActive: ledgerDfsp.isActive ? 1 : 0,
      links: {
        self: url
      },
      accounts: apiMappedAccounts,
      isProxy: ledgerDfsp.isProxy ? 1 : 0,
    }
  }

  public async createHubAccount(request: RequestCreateHubAccount, h: ResponseToolkit) {
    if (this.deps.config.API_MODE_ADMIN === 'LEDGER') {
      return this.ledger_createHubAccount(request, h)
    }
    try {
      // start - To Do move to domain
      const participant = await ParticipantService.getByName(request.params.name)
      if (participant) {
        const ledgerAccountType = await ParticipantService.getLedgerAccountTypeName(request.payload.type)
        if (!ledgerAccountType) {
          throw ErrorHandler.Factory.createFSPIOPError(
            ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR,
            'Ledger account type was not found.'
          )
        }
        const accountParams = {
          participantId: participant.participantId,
          currencyId: request.payload.currency,
          ledgerAccountTypeId: ledgerAccountType.ledgerAccountTypeId,
          isActive: 1
        }
        const participantAccount = await ParticipantService.getParticipantAccount(accountParams)
        if (participantAccount) {
          throw ErrorHandler.Factory.createFSPIOPError(
            ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR,
            'Hub account has already been registered.'
          )
        }

        if (participant.participantId !== Config.HUB_ID) {
          throw ErrorHandler.Factory.createFSPIOPError(
            ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR,
            'Endpoint is reserved for creation of Hub account types only.'
          )
        }
        const isPermittedHubAccountType = Config.HUB_ACCOUNTS.indexOf(request.payload.type) >= 0
        if (!isPermittedHubAccountType) {
          throw ErrorHandler.Factory.createFSPIOPError(
            ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR,
            'The requested hub operator account type is not allowed.'
          )
        }
        const newCurrencyAccount = await ParticipantService.createHubAccount(
          participant.participantId,
          request.payload.currency,
          ledgerAccountType.ledgerAccountTypeId
        )
        participant.currencyList.push(newCurrencyAccount.participantCurrency)
      } else {
        throw ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR,
          'Participant was not found.'
        )
      }
      // end here : move to domain
      const ledgerAccountTypes = await Enums.getEnums('ledgerAccountType')
      const ledgerAccountIds = Util.transpose(ledgerAccountTypes)
      return h.response(this.entityItem(participant, ledgerAccountIds)).code(201)
    } catch (err) {
      this.rethrowAndCountFspiopError(err, 'participantCreateHubAccount')
    }
  }

  public async ledger_createHubAccount(request: RequestCreateHubAccount, h: ResponseToolkit) {
    try {
      const currency = request.payload.currency
      const type = request.payload.type

      const participant = await ParticipantService.getByName(request.params.name)
      if (!participant) {
        throw ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR,
          'Participant was not found.'
        )
      }

      // Create a default settlement model for the currency
      const settlementModel = {
        name: `DEFERRED_MULTILATERAL_NET_${currency}`,
        settlementGranularity: "NET",
        settlementInterchange: "MULTILATERAL",
        settlementDelay: "DEFERRED",
        currency,
        requireLiquidityCheck: true,
        ledgerAccountType: "POSITION",
        settlementAccountType: "SETTLEMENT",
        autoPositionReset: true
      }

      const result = await this.deps.ledger.createHubAccount({
        currency,
        accountType: type,
        settlementModel
      })

      if (result.type === 'FAILURE') {
        throw result.error
      }

      if (result.type === 'ALREADY_EXISTS_HUB_ACCOUNT') {
        throw ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR,
          'Hub account has already been registered.'
        )
      }

      if (result.type === 'ALREADY_EXISTS_SETTLEMENT_MODEL') {
        logger.warn('Settlement accout already existed.')
        // Backwards compatibility - we can just ignore this.
        // throw ErrorHandler.Factory.createFSPIOPError(
        //   ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR,
        //   `Settlement model: ${settlementModel.name} has already been registered.`
        // )
      }

      // Return the Hub participant with all its accounts.
      const hubParticipant = await this.getAll(
        { query: {}, payload: {}, server: request.server } as RequestGetAll,
        h
      )
      const hub = hubParticipant.find((participant: any) => participant.name === 'Hub')

      return h.response(hub).code(201)
    } catch (err) {
      rethrow.rethrowAndCountFspiopError(err, { operation: 'participantCreateHubAccount' })
    }
  }

  public async getAll(request: RequestGetAll, h: ResponseToolkit) {
    if (this.deps.config.API_MODE_ADMIN === 'LEDGER') {
      return this.ledger_getAll(request, h)
    }
    try {
      const results = await ParticipantService.getAll()
      const ledgerAccountTypes = await Enums.getEnums('ledgerAccountType')
      const ledgerAccountIds = Util.transpose(ledgerAccountTypes)
      if (request.query.isProxy) {
        return results.map((record: any) => this.entityItem(record, ledgerAccountIds))
          .filter((record: any) => record.isProxy)
      }
      return results.map((record: any) => this.entityItem(record, ledgerAccountIds))
    } catch (err) {
      this.rethrowAndCountFspiopError(err, 'participantGetAll')
    }
  }

  public async ledger_getAll(request: RequestGetAll, h: ResponseToolkit) {
    const resultDfsps = await this.deps.ledger.getAllDfsps({})
    if (resultDfsps.type === 'FAILURE') {
      throw resultDfsps.error
    }

    const resultHub = await this.deps.ledger.getHubAccounts({})
    if (resultHub.type === 'FAILURE') {
      throw resultHub.error
    }
    const hubLedgerAccounts = resultHub.accounts

    const reply: Array<any> = []

    // Map from Ledger format Dfsp to Existing API
    resultDfsps.result.dfsps.forEach(ledgerDfsp => {
      // Apply query filter
      if (request.query.isProxy) {
        if (!ledgerDfsp.isProxy) return
      }

      const apiMappedAccounts = ledgerDfsp.accounts.map(acc => ({
        id: convertBigIntToNumber(acc.id),
        ledgerAccountType: acc.ledgerAccountType,
        currency: acc.currency,
        isActive: acc.isActive ? 1 : 0,
        createdDate: acc.createdDate,
        createdBy: 'unknown',
      }))

      const url = `${Config.HOSTNAME}/participants/${ledgerDfsp.name}`
      reply.push({
        name: ledgerDfsp.name,
        id: url,
        created: ledgerDfsp.created,
        isActive: ledgerDfsp.isActive ? 1 : 0,
        links: {
          self: url
        },
        accounts: apiMappedAccounts,
        isProxy: ledgerDfsp.isProxy ? 1 : 0,
      })
    })

    // If filtering for isProxy, don't return the Hub accounts.
    if (request.query.isProxy) {
      return reply
    }

    // Now do the same for the Hub accounts
    const hubUrl = `${Config.HOSTNAME}/participants/Hub`
    const hubAccounts = hubLedgerAccounts.map(acc => ({
      id: convertBigIntToNumber(acc.id),
      ledgerAccountType: acc.ledgerAccountType,
      currency: acc.currency,
      isActive: acc.isActive ? 1 : 0,
      createdDate: acc.createdDate,
      createdBy: 'unknown',
    }))
    reply.push({
      name: 'Hub',
      id: hubUrl,
      created: resultHub.createdDate,
      // Hub can never be deactivated
      isActive: 1,
      links: {
        self: hubUrl
      },
      accounts: hubAccounts,
      isProxy: 0,
    })

    return reply
  }

  public async getByName(request: RequestGetByName, h: ResponseToolkit) {
    if (this.deps.config.API_MODE_ADMIN === 'LEDGER') {
      return this.ledger_getByName(request, h)
    }
    try {
      const entity = await ParticipantService.getByName(request.params.name)
      this.handleMissingRecord(entity)
      const ledgerAccountTypes = await Enums.getEnums('ledgerAccountType')
      const ledgerAccountIds = Util.transpose(ledgerAccountTypes)
      return this.entityItem(entity, ledgerAccountIds)
    } catch (err) {
      // Don't log the ID_NOT_FOUND error - it's very noisy!
      const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
      if (fspiopError.apiErrorCode?.code === ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND.code) {
        throw fspiopError
      }
      this.rethrowAndCountFspiopError(err, 'participantGetByName')
    }
  }

  public async ledger_getByName(request: RequestGetByName, h: ResponseToolkit) {
    const name = request.params.name
    return this.getByNameInner(name)
  }

  public async update(request: RequestUpdate, h: ResponseToolkit) {
    if (this.deps.config.API_MODE_ADMIN === 'LEDGER') {
      return this.ledger_update(request, h)
    }
    try {
      const updatedEntity = await ParticipantService.update(request.params.name, request.payload)
      if (request.payload.isActive !== undefined) {
        const isActiveText = request.payload.isActive ? 'activated' : 'disabled'
        const changeLog = JSON.stringify(Object.assign(
          {},
          request.params,
          { isActive: request.payload.isActive }
        ))
        logger.info(`Participant has been ${isActiveText} :: ${changeLog}`)
      }
      const ledgerAccountTypes = await Enums.getEnums('ledgerAccountType')
      const ledgerAccountIds = Util.transpose(ledgerAccountTypes)
      return this.entityItem(updatedEntity, ledgerAccountIds)
    } catch (err) {
      this.rethrowAndCountFspiopError(err, 'participantUpdate')
    }
  }

  public async ledger_update(request: RequestUpdate, h: ResponseToolkit) {
    try {
      assert(request)
      assert(request.params)
      assert(request.params.name)
      assert(request.params.name !== 'Hub', 'Cannot update the Hub account.')
      assert(request.payload)
      assert(request.payload.isActive !== undefined)

      const { isActive } = request.payload
      assert.equal(typeof isActive, 'boolean')

      let response: CommandResult<void>
      if (isActive === false) {
        response = await this.deps.ledger.disableDfsp({ dfspId: request.params.name })
      } else {
        response = await this.deps.ledger.enableDfsp({ dfspId: request.params.name })
      }

      if (response.type === 'FAILURE') {
        throw response.error
      }

      // Now look up the participant.
      const getByNameReply = await this.getByNameInner(request.params.name)
      return getByNameReply
    } catch (err) {
      rethrow.rethrowAndCountFspiopError(err, { operation: 'participantCreate' })
    }
  }

  public async addEndpoint(request: RequestAddEndpoint, h: ResponseToolkit) {
    try {
      await ParticipantService.addEndpoint(request.params.name, request.payload)
      return h.response().code(201)
    } catch (err) {
      this.rethrowAndCountFspiopError(err, 'participantAddEndpoint')
    }
  }

  public async getEndpoint(request: RequestGetEndpoint, h: ResponseToolkit) {
    try {
      if (request.query.type) {
        const result = await ParticipantService.getEndpoint(request.params.name, request.query.type)
        let endpoint = {}
        if (Array.isArray(result) && result.length > 0) {
          endpoint = {
            type: result[0].name,
            value: result[0].value
          }
        }
        return endpoint
      } else {
        const result = await ParticipantService.getAllEndpoints(request.params.name)
        const endpoints: Array<{ type: string, value: string }> = []
        if (Array.isArray(result) && result.length > 0) {
          result.forEach(item => {
            endpoints.push({
              type: item.name,
              value: item.value
            })
          })
        }
        return endpoints
      }
    } catch (err) {
      this.rethrowAndCountFspiopError(err, 'participantGetEndpoint')
    }
  }

  public async addLimitAndInitialPosition(
    request: RequestAddLimitAndInitialPosition, h: ResponseToolkit
  ) {
    if (this.deps.config.API_MODE_ADMIN === 'LEDGER') {
      return this.ledger_addLimitAndInitialPosition(request, h)
    }
    try {
      await ParticipantService.addLimitAndInitialPosition(request.params.name, request.payload)
      return h.response().code(201)
    } catch (err) {
      this.rethrowAndCountFspiopError(err, 'participantAddLimitAndInitialPosition')
    }
  }

  public async ledger_addLimitAndInitialPosition(
    request: RequestAddLimitAndInitialPosition, h: ResponseToolkit
  ) {
    try {
      assert(request)
      assert(request.params)
      assert(request.params.name)
      assert(request.payload)
      assert(request.payload.currency)
      assert(request.payload.limit)
      assert(request.payload.limit.type)
      assert(request.payload.limit.value !== undefined)
      assert(request.payload.limit.value >= 0)
      if (request.payload.limit.alarmPercentage === undefined) {
        throw new Error(`limit.alarmPercentage is required.`)
      }

      const depositCmd = {
        // Derived id: dfspId + currency + deposit_opening
        transferId: `${request.params.name}_${request.payload.currency}_deposit_opening`,
        dfspId: request.params.name,
        currency: request.payload.currency,
        // Implicitly deposit funds here. In the new Ledger, you cannot have a limit without a
        // position
        amount: request.payload.limit.value,
        reason: 'Initial position with limit',
        initialDeposit: true
      }
      const depositResult = await this.deps.ledger.deposit(depositCmd)
      if (depositResult.type === 'NOT_FOUND') {
        throw fspiopErrorFactory.participantNotFound()
      }
      if (depositResult.type === 'ALREADY_EXISTS') {
        const errorMessage = `Participant Limit or Initial Position already set for participant: ${request.params.name}.`
        throw ErrorHandler.Factory.createInternalServerFSPIOPError(errorMessage)
      }
      if (depositResult.type === 'FAILURE') {
        throw depositResult.error
      }

      const setNetDebitCapResult = await this.deps.ledger.setNetDebitCap({
        netDebitCapType: 'LIMITED',
        dfspId: request.params.name,
        currency: request.payload.currency,
        amount: request.payload.limit.value,
        alarmPercentage: request.payload.limit.alarmPercentage,
      })
      if (setNetDebitCapResult.type === 'FAILURE') {
        throw setNetDebitCapResult.error
      }

      return h.response().code(201)
    } catch (err) {
      rethrow.rethrowAndCountFspiopError(err, { operation: 'participantAddLimitAndInitialPosition' })
    }
  }

  public async getLimits(request: RequestGetLimits, h: ResponseToolkit) {
    if (this.deps.config.API_MODE_ADMIN === 'LEDGER') {
      return this.ledger_getLimits(request, h)
    }

    try {
      const result = await ParticipantService.getLimits(request.params.name, request.query)
      const limits: Array<{}> = []
      if (Array.isArray(result) && result.length > 0) {
        result.forEach(item => {
          assert(item.thresholdAlarmPercentage !== undefined)
          limits.push({
            currency: (item.currencyId || request.query.currency),
            limit: {
              type: item.name,
              value: new MLNumber(item.value).toNumber(),
              alarmPercentage: new MLNumber(item.thresholdAlarmPercentage).toNumber()
            }
          })
        })
      }
      return limits
    } catch (err) {
      this.rethrowAndCountFspiopError(err, 'participantGetLimits')
    }
  }

  public async ledger_getLimits(request: RequestGetLimits, h: ResponseToolkit) {
    try {
      assert(request)
      assert(request.params)
      assert(request.params.name)
      assert(request.query)

      // Backwards compatibility - first check the dfsp exists before validation.
      const dfspResult = await this.deps.ledger.getDfsp({dfspId: request.params.name})
      if (dfspResult.type === 'NOT_FOUND') {
        throw fspiopErrorFactory.participantNotFound()
      }

      if (dfspResult.type === 'FAILURE') {
        throw dfspResult.error
      }

      // Default to NET_DEBIT_CAP.
      if (!request.query.type) {
        request.query.type = 'NET_DEBIT_CAP'
      }

      // Special case to match legacy implementation. If type !== NET_DEBIT_CAP, simply return [].
      // if (request.query.type !== 'NET_DEBIT_CAP') {
      //   // throw new Error(`Invalid type: ${request.query.type} expected 'NET_DEBIT_CAP'.`)
      //   return []
      // }

      // Only limits of type NET_DEBIT_CAP are supported
      // assert.equal(request.query.type, 'NET_DEBIT_CAP')

      if (!request.query.currency) {
        // Get net debit caps across currencies.
        const limitResponse = await this.deps.ledger.getNetDebitCaps({
          dfspId: request.params.name,
        })

        if (limitResponse.type === 'NOT_FOUND') {
          throw limitResponse.error
        }

        if (limitResponse.type !== 'SUCCESS') {
          throw limitResponse.error
        }

        // Special case to match legacy implementation. If type !== NET_DEBIT_CAP, simply return [].
        if (request.query.type !== 'NET_DEBIT_CAP') {
          return []
        }

        return limitResponse.result
      }

      const limitResponse = await this.deps.ledger.getNetDebitCap({
        dfspId: request.params.name,
        currency: request.query.currency!
      })

      if (limitResponse.type === 'NOT_FOUND') {
        throw limitResponse.error
      }

      // Special case to match legacy implementation. If type !== NET_DEBIT_CAP, simply return [].
      if (request.query.type !== 'NET_DEBIT_CAP') {
        // throw new Error(`Invalid type: ${request.query.type} expected 'NET_DEBIT_CAP'.`)
        return []
      }

      if (limitResponse.type !== 'SUCCESS') {
        // check for fspiop error
        let maybeFspiopError = limitResponse.error as FSPIOPError
        // special case
        if (maybeFspiopError && maybeFspiopError.apiErrorCode &&
          maybeFspiopError.apiErrorCode.code &&
          maybeFspiopError.apiErrorCode.code === '3200'
        ) {
          return []
        }

        throw limitResponse.error
      }

      return [
        {
          currency: request.query.currency,
          limit: limitResponse.result
        }
      ]
    } catch (err) {
      rethrow.rethrowAndCountFspiopError(err, { operation: 'participantGetLimits' })
    }
  }

  public async getLimitsForAllParticipants(
    request: RequestGetLimitsForAllParticipants, h: ResponseToolkit
  ) {
    if (this.deps.config.API_MODE_ADMIN === 'LEDGER') {
      return this.ledger_getLimitsForAllParticipants(request, h)
    }
    try {
      const result = await ParticipantService.getLimitsForAllParticipants(request.query)
      const limits: Array<{}> = []
      if (Array.isArray(result) && result.length > 0) {
        result.forEach(item => {
          assert(item.thresholdAlarmPercentage !== undefined)
          limits.push({
            name: item.name,
            currency: item.currencyId,
            limit: {
              type: item.limitType,
              value: new MLNumber(item.value).toNumber(),
              alarmPercentage: new MLNumber(item.thresholdAlarmPercentage).toNumber()
            }
          })
        })
      }
      return limits
    } catch (err) {
      this.rethrowAndCountFspiopError(err, 'participantGetLimitsForAllParticipants')
    }
  }

  public async ledger_getLimitsForAllParticipants(
    request: RequestGetLimitsForAllParticipants, h: ResponseToolkit
  ) {
    try {
      assert(request)
      assert(request.query)

      // Default to NET_DEBIT_CAP.
      if (!request.query.type) {
        request.query.type = 'NET_DEBIT_CAP'
      }

      // Special case to match legacy implementation. If type !== NET_DEBIT_CAP, simply return [].
      if (request.query.type !== 'NET_DEBIT_CAP') {
        return []
      }

      // Only limits of type NET_DEBIT_CAP are supported
      assert.equal(request.query.type, 'NET_DEBIT_CAP')

      // Note: Ideally we would implement this in the getAllDfsps() method itself
      // but for now we can stitch this together from a few other methods. The main goal here
      // is to maintain backwards compatibility while not making the surface area of the
      // Ledger interface unnessesarily large.
      const resultDfsps = await this.deps.ledger.getAllDfsps({})
      if (resultDfsps.type === 'FAILURE') {
        throw resultDfsps.error
      }

      const limitResponses = await Promise.all(
        resultDfsps.result.dfsps.map(async (dfsp) => {
          const limitResponse = await this.deps.ledger.getNetDebitCaps({
            dfspId: dfsp.name,
          })
          return { dfsp, limitResponse }
        })
      )

      const limitWithCurrencies: Array<{ name: string } & LegacyLimitItem> = []
      for (const { dfsp, limitResponse } of limitResponses) {
        if (limitResponse.type === 'SUCCESS') {
          for (const limit of limitResponse.result) {
            limitWithCurrencies.push({
              name: dfsp.name,
              ...limit
            })
          }
        }
      }

      // Filter after the fact for the specified currency.
      if (request.query.currency) {
        return limitWithCurrencies.filter(limit => limit.currency === request.query.currency)
      }

      return limitWithCurrencies
    } catch (err) {
      rethrow.rethrowAndCountFspiopError(err, { operation: 'participantGetLimitsForAllParticipants' })
    }
  }

  public async adjustLimits(request: RequestAdjustLimits, h: ResponseToolkit) {
    if (this.deps.config.API_MODE_ADMIN === 'LEDGER') {
      return this.ledger_adjustLimits(request, h)
    }
    try {
      if (request.payload.limit.type !== 'NET_DEBIT_CAP') {
        throw new Error(`Unknown limit type: ${request.payload.limit.type}, expected: 'NET_DEBIT_CAP'.`)
      }
      const result = await ParticipantService.adjustLimitsV2(request.params.name, request.payload)
      const { participantLimit } = result
      assert(participantLimit.thresholdAlarmPercentage !== undefined)
      const updatedLimit = {
        currency: request.payload.currency,
        limit: {
          type: request.payload.limit.type,
          value: new MLNumber(participantLimit.value).toNumber(),
          alarmPercentage: new MLNumber(participantLimit.thresholdAlarmPercentage).toNumber()
        }

      }
      return h.response(updatedLimit).code(200)
    } catch (err) {
      this.rethrowAndCountFspiopError(err, 'participantAdjustLimits')
    }
  }

  public async ledger_adjustLimits(request: RequestAdjustLimits, h: ResponseToolkit) {
    try {
      assertNestedFields(request, 'params.name')
      assertNestedFields(request, 'payload.currency')
      assertNestedFields(request, 'payload.limit')
      assert(request.payload.limit.type)
      assert(request.payload.limit.value !== undefined)
      assert(request.payload.limit.value >= 0)
      // Only limits of type NET_DEBIT_CAP are supported
      if (request.payload.limit.type !== 'NET_DEBIT_CAP') {
        throw new Error(`Unknown limit type: ${request.payload.limit.type}, expected: 'NET_DEBIT_CAP'.`)
      }

      const result = await this.deps.ledger.setNetDebitCap({
        netDebitCapType: 'LIMITED',
        dfspId: request.params.name,
        currency: request.payload.currency,
        amount: request.payload.limit.value,
        alarmPercentage: request.payload.limit.alarmPercentage,
      })

      if (result.type === 'FAILURE') {
        throw result.error
      }

      // The Ledger doesn't return anything, but the API Expects a response body.
      const updatedLimit = {
        currency: request.payload.currency,
        limit: {
          type: request.payload.limit.type,
          value: request.payload.limit.value,
          alarmPercentage: request.payload.limit.alarmPercentage,
        }
      }
      return h.response(updatedLimit).code(200)
    } catch (err) {
      rethrow.rethrowAndCountFspiopError(err, { operation: 'adjustLimits' })
    }
  }

  public async getPositions(request: RequestGetPositions, h: ResponseToolkit) {
    if (this.deps.config.API_MODE_ADMIN === 'LEDGER') {
      return this.ledger_getPositions(request, h)
    }
    try {
      const result = await ParticipantService.getPositions(request.params.name, request.query)

      // Convert value from string to number
      if (Array.isArray(result)) {
        // Multiple positions (no currency specified)
        return result.map(position => {
          assert(position.value !== undefined)
          return {
            ...position,
            value: new MLNumber(position.value).toNumber()
          }
        })
      } else if (result && typeof result === 'object' && result.value !== undefined) {
        // Single position (currency specified)
        return {
          ...result,
          value: new MLNumber(result.value).toNumber()
        }
      }
      return result
    } catch (err) {
      this.rethrowAndCountFspiopError(err, 'participantGetPositions')
    }
  }

  public async ledger_getPositions(request: RequestGetPositions, h: ResponseToolkit) {
    try {
      assert(request)
      assert(request.params)
      assert(request.params.name)

      const name = request.params.name
      const currency = request.query?.currency

      let ledgerAccountsResponse
      if (currency) {
        // Get accounts for specific currency
        ledgerAccountsResponse = await this.deps.ledger.getDfspAccounts({ dfspId: name, currency })
        // Need to disambiguate between currency that is registered or not?
      } else {
        // Get accounts for all currencies
        ledgerAccountsResponse = await this.deps.ledger.getAllDfspAccounts({ dfspId: name })
      }

      if (ledgerAccountsResponse.type === 'NOT_FOUND') {
        throw fspiopErrorFactory.participantNotFound()
      }

      if (ledgerAccountsResponse.type === 'FAILURE') {
        throw ledgerAccountsResponse.error
      }

      // We only want POSITION accounts.
      const positionAccounts = ledgerAccountsResponse.accounts.filter(
        acc => acc.ledgerAccountType === 'POSITION'
      )

      // Map to the expected position format.
      // Sort based on currency to match legacy response.
      const positions = positionAccounts.map(acc => ({
        currency: acc.currency,
        value: acc.value,
        changedDate: acc.changedDate
      })).sort((a, b) => {
        if (a.currency > b.currency) return 1
        if (b.currency > a.currency) return -1
        return 0
      })

      // If currency was specified, return single position, or return array of positions.
      if (currency) {
        // Backwards compatibility. 
        if (positions.length === 0) {
          // Need to figure out the difference between the cases...
          // throw fspiopErrorFactory.participantNotFound()
          return {}
        }
        return positions[0]
      }

      return positions
    } catch (err) {
      rethrow.rethrowAndCountFspiopError(err, { operation: 'participantGetPositions' })
    }
  }

  public async getAccounts(request: RequestGetAccounts, h: ResponseToolkit) {
    if (this.deps.config.API_MODE_ADMIN === 'LEDGER') {
      return this.ledger_getAccounts(request, h)
    }

    try {
      const result = await ParticipantService.getAccounts(request.params.name, request.query)
      assert(Array.isArray(result))

      // Convert value and reservedValue from string to number
      return result.map((account: any) => {
        assert(account.value !== undefined)
        assert(account.reservedValue !== undefined)
        return {
          ...account,
          value: new MLNumber(account.value).toNumber(),
          reservedValue: new MLNumber(account.reservedValue).toNumber(),
        }
      })
    } catch (err) {
      this.rethrowAndCountFspiopError(err, 'participantGetAccounts')
    }
  }

  public async ledger_getAccounts(request: RequestGetAccounts, h: ResponseToolkit) {
    try {
      assert(request)
      assert(request.params)
      assert(request.params.name)
      assert(request.query)
      const name = request.params.name
      const currency = request.query.currency
      let ledgerAccountsResponse
      if (currency) {
        ledgerAccountsResponse = await this.deps.ledger.getDfspAccounts({ dfspId: name, currency })
      } else {
        ledgerAccountsResponse = await this.deps.ledger.getAllDfspAccounts({ dfspId: name })
      }
      if (ledgerAccountsResponse.type === 'FAILURE' || ledgerAccountsResponse.type === 'NOT_FOUND') {
        logger.error(`getAccounts() - failed with error: ${ledgerAccountsResponse.error.message}`)
        throw ledgerAccountsResponse.error
      }

      // Map to legacy compatible API response
      return ledgerAccountsResponse.accounts.map(acc => {
        return {
          ...acc,
          id: convertBigIntToNumber(acc.id),
          isActive: acc.isActive ? 1 : 0,
        }
      })
    } catch (err) {
      rethrow.rethrowAndCountFspiopError(err, { operation: 'getAccounts' })
    }
  }

  public async updateAccount(request: RequestUpdateAccount, h: ResponseToolkit) {
    if (this.deps.config.API_MODE_ADMIN === 'LEDGER') {
      return this.ledger_updateAccount(request, h)
    }
    try {
      const enums = {
        ledgerAccountType: await Enums.getEnums('ledgerAccountType')
      }
      await ParticipantService.updateAccount(request.payload, request.params, enums)
      if (request.payload.isActive !== undefined) {
        const isActiveText = request.payload.isActive ? 'activated' : 'disabled'
        const changeLog = JSON.stringify(Object.assign(
          {}, request.params, { isActive: request.payload.isActive })
        )
        logger.info(`Participant account has been ${isActiveText} :: ${changeLog}`)
      }
      return h.response().code(200)
    } catch (err) {
      this.rethrowAndCountFspiopError(err, 'participantUpdateAccount')
    }
  }

  public async ledger_updateAccount(request: RequestUpdateAccount, h: ResponseToolkit) {
    try {
      assert(request)
      assert(request.params)
      assert(request.params.name)

      // Backwards compatibility, we never previously validated the params.
      if (!request.params.id) {
        throw ErrorHandler.Factory.createInternalServerFSPIOPError('Account not found')
      }

      assert(request.payload)
      assert(request.payload.isActive !== undefined)

      const { name, id } = request.params
      const { isActive } = request.payload

      let result
      if (isActive) {
        result = await this.deps.ledger.enableDfspAccount({ dfspId: name, accountId: id })
      } else {
        result = await this.deps.ledger.disableDfspAccount({ dfspId: name, accountId: id })
      }

      if (result.type === 'FAILURE') {
        throw result.error
      }

      return h.response().code(200)
    } catch (err) {
      rethrow.rethrowAndCountFspiopError(err, { operation: 'participantUpdateAccount' })
    }
  }

  public async recordFunds(request: RequestRecordFunds, h: ResponseToolkit) {
    if (this.deps.config.API_MODE_ADMIN === 'LEDGER') {
      return this.ledger_recordFunds(request, h)
    }

    try {
      const enums = await Enums.getEnums('all')
      await ParticipantService.recordFundsInOutV2(request.payload, request.params, enums)
      return h.response().code(202)
    } catch (err) {
      this.rethrowAndCountFspiopError(err, 'participantRecordFunds')
    }
  }

  public async ledger_recordFunds(request: RequestRecordFunds, h: ResponseToolkit) {
    try {
      assert(request)
      assert(request.params)
      assert(request.params.name)
      assert(request.params.id)
      assert(request.payload)
      assert(request.payload.action)

      const { name, id } = request.params
      const { action, amount } = request.payload

      // Backwards compatibility. V1 requires account id, but V2 doesn't. We need to check
      // the account type === SETTLEMENT.
      const responseAccounts = await this.deps.ledger.getAllDfspAccounts({ dfspId: name })
      if (responseAccounts.type === 'FAILURE' || responseAccounts.type === 'NOT_FOUND') {
        throw responseAccounts.error
      }

      const foundAccount = responseAccounts.accounts
        .find(acc => convertBigIntToNumber(acc.id) === id)
      if (!foundAccount) {
        throw new Error(`recordFunds - no account for dfsp: ${name} id: ${id}`)
      }

      // Check for currency match if we have the currency.
      if (amount && amount.currency && amount.currency !== foundAccount.currency) {
        throw ErrorHandler.Factory.createInternalServerFSPIOPError(
          'The account does not match participant or currency specified'
        ) 
      }

      if (foundAccount.isActive === false) {
        // I didn't think this was possible, since the SETTLEMENT account can't be disabled.
        throw ErrorHandler.Factory.createInternalServerFSPIOPError(
          'Account is currently set inactive'
        )
      }
      if (foundAccount.ledgerAccountType !== 'SETTLEMENT') {
        throw ErrorHandler.Factory.createInternalServerFSPIOPError('Account is not SETTLEMENT type')
      }

      switch (action) {
        case 'recordFundsIn': {
          assert(request.payload.transferId)
          assert(amount, 'amount is required')
          assert(amount!.amount, 'amount.amount is required')
          assert(amount!.currency, 'amount.currency is required')
          assert(request.payload.reason, 'reason is required')
          const transferId = request.payload.transferId
          if (!transferId) {
            throw new Error('transferId is required')
          }

          const depositCmd = {
            transferId,
            dfspId: name,
            currency: amount!.currency,
            amount: new MLNumber(amount!.amount).toNumber(),
            reason: request.payload.reason
          }

          const result = await this.deps.ledger.deposit(depositCmd)

          if (result.type === 'FAILURE') {
            // Special case - deactivated participant
            if (result.error.message === 'Participant is currently set inactive') {
              return h.response(result.error).code(400)
            }
            throw result.error
          }

          if (result.type === 'ALREADY_EXISTS') {
            throw new Error('recordFundsInOut transfer already created.')
          }
          return h.response().code(202)
        }
        case 'recordFundsOutPrepareReserve': {
          assert(request.payload.transferId)
          assert(amount, 'amount is required')
          assert(amount!.amount, 'amount.amount is required')
          assert(amount!.currency, 'amount.currency is required')
          assert(request.payload.reason, 'reason is required')
          const transferId = request.payload.transferId
          if (!transferId) {
            throw new Error('transferId is required')
          }

          const withdrawPrepareCmd = {
            transferId,
            dfspId: name,
            currency: amount!.currency,
            amount: new MLNumber(amount!.amount).toNumber(),
            reason: request.payload.reason
          }

          const result = await this.deps.ledger.withdrawPrepare(withdrawPrepareCmd)

          if (result.type === 'FAILURE') {
            throw result.error
          }

          if (result.type === 'INSUFFICIENT_FUNDS') {
            // Just log the warning, the previous implementation did this check async, so we never
            // returned an error
            logger.warn('recordFunds() failed silently with INSUFFICENT_FUNDS error')
          }

          return h.response().code(202)
        }
        case 'recordFundsOutCommit': {
          const transferId = request.params.transferId
          if (!transferId) {
            throw new Error('transferId is required')
          }
          const withdrawCommitCmd = {
            transferId
          }
          const result = await this.deps.ledger.withdrawCommit(withdrawCommitCmd)

          if (result.type === 'FAILURE') {
            throw result.error
          }
          return h.response().code(202)
        }
        case 'recordFundsOutAbort': {
          const transferId = request.params.transferId
          if (!transferId) {
            throw new Error('transferId is required')
          }
          const withdrawAbortCmd = {
            transferId
          }
          const result = await this.deps.ledger.withdrawAbort(withdrawAbortCmd)

          if (result.type === 'FAILURE') {
            throw result.error
          }
          return h.response().code(202)
        }
        default: {
          throw new Error(`recordFundsInOutV2 unknown payload.action: ${action}`)
        }
      }
    } catch (err) {
      rethrow.rethrowAndCountFspiopError(err, { operation: 'participantRecordFunds' })
    }
  }

  private rethrowAndCountFspiopError(err: any, operation: any) {
    logger.error(`error in handle ${operation}: `, err)
    rethrow.rethrowAndCountFspiopError(err, { operation })
  }

  private entityItem(item: EntityItem, ledgerAccountIds: Record<number, any>) {
    const { name, createdDate, isActive, currencyList, isProxy } = item
    const link = UrlParser.toParticipantUri(name)
    const accounts = currencyList.map((currentValue) => {
      if (typeof currentValue.createdDate !== 'string') {
        console.log('warning Expected `currentValue.createdDate` to be a string.')
        // throw new Error('Expected `currentValue.createdDate` to be a string.')
      }

      return {
        id: currentValue.participantCurrencyId,
        ledgerAccountType: ledgerAccountIds[currentValue.ledgerAccountTypeId],
        currency: currentValue.currencyId,
        isActive: currentValue.isActive,
        createdDate: new Date(currentValue.createdDate),
        createdBy: currentValue.createdBy
      }
    })
    return {
      name,
      id: link,
      created: new Date(createdDate),
      isActive,
      links: {
        self: link
      },
      accounts,
      isProxy
    }
  }

  private handleMissingRecord = (entity: any) => {
    if (!entity) {
      throw fspiopErrorFactory.resourceNotFound()
    }
    return entity
  }
}