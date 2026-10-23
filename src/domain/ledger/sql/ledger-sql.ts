import { Enum, Util } from '@mojaloop/central-services-shared';
const { TransferState } = Enum.Transfers
import assert from "node:assert"
import Transaction from '../../../domain/transactions'
import {
  CommitPaymentDtoAborted,
  FulfilHandlerInput,
  PaymentFulfilResult,
  PaymentFulfilResultType
} from '../../../handlers/payment-fulfil';
import {
  CreatePaymentDto,
  PaymentPrepareResult,
  PaymentPrepareResultType,
  PrepareHandlerInput
} from "../../../handlers/payment-prepare";
import { PositionHandlerV2, PositionResultType } from "../../../handlers/position-v2";
import {
  CreateRemittanceEntityPayment,
  ProxyCache,
  TransferDeterminingCheckResult,
  TransferProxyObligation
} from "../../../handlers/transfer-types";
import { ApplicationConfig } from "../../../lib/config";
import { Effect, MessageBus } from "../../../messaging/message-bus";
import ParticipantFacade from '../../../models/participant/facade';
import { getTransferErrorDuplicateCheck } from '../../../models/transfer/transferErrorDuplicateCheck';
import { logger } from "../../../shared/logger";
import TransferService, {
  getTransferFulfilmentDuplicateCheck,
  saveTransferErrorDuplicateCheck,
  saveTransferFulfilmentDuplicateCheck,
  getTransferDuplicateCheck,
  saveTransferDuplicateCheck
} from "../../transfer";
import {
  AnyQuery,
  CloseSettlementWindowResult,
  CommandResult,
  CreateDfspCommand,
  CreateDfspResponse,
  CreateHubAccountCommand,
  CreateHubAccountResponse,
  DepositCommand,
  DepositResponse,
  DfspAccountResponse,
  Enums,
  GetAllDfspAccountsQuery,
  GetAllDfspsResponse,
  GetDfspAccountsQuery,
  GetHubAccountsQuery,
  GetNetDebitCapQuery,
  GetNetDebitCapsQuery,
  GetSettlementQuery,
  GetSettlementQueryResponse,
  GetSettlementsQuery,
  GetSettlementsQueryResponse,
  GetSettlementWindowQuery,
  GetSettlementWindowsQuery,
  GetSettlementWindowsQueryResponse,
  HubAccountResponse,
  Ledger,
  LegacyLedgerAccount,
  LegacyLedgerAccountNoValue,
  LegacyLedgerDfsp,
  LegacyLimit,
  LegacyLimitItem,
  LookupTransferQuery,
  LookupTransferQueryResponse,
  LookupTransferResultType,
  QueryResult,
  QueryResultWithNotFound,
  SetNetDebitCapCommand,
  Settlement,
  SettlementAbortCommand,
  SettlementCloseWindowCommand,
  SettlementCommitCommand,
  SettlementPrepareCommand,
  SettlementUpdateCommand,
  SettlementUpdateResult,
  SettlementWindow,
  SettlementWindowState,
  SweepResult,
  WithdrawAbortCommand,
  WithdrawAbortResponse,
  WithdrawCommitCommand,
  WithdrawCommitResponse,
  WithdrawPrepareCommand,
  WithdrawPrepareResponse
} from "../shared/types";
const fxService = require('../../fx')
const FxTransferStateChangeModel = require('../../../models/fxTransfer/stateChange')

import { Knex } from 'knex';
import { TimeoutResultPayment, TimeoutResultPaymentForward } from '../../../handlers/timeout-v2';
import { TransferHelper } from '../../../handlers/transfer-helper'
import { assertBoolean, safeStringToNumber } from '../../../lib/config/util'
import db from "../../../lib/db";
import {
  ForwardedFxTransfer,
  ForwardedTransfer,
  TimedOutFxTransfer,
  TimedOutTransfer
} from '../../../models/transfer/facade';
import * as Participant from '../../participant';
import TimeoutService from '../../timeout';
import TransferObjectTransform from '../../transfer/transform'
import { deserializeIlpPacket } from 'ilp-packet';
import base64url from 'base64url';
import SettlementDomain from '../../../domain/settlement'
import SettlementWindowDomain from '../../../domain/settlementWindow'
import SettlementModel from '../../../models/settlement/settlement'
import * as Result from '../shared/results'
import Helper from './helper';

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { FSPIOPError } = ErrorHandler
const { Comparators, resourceVersions } = Util
const { Type, Action } = Enum.Events.Event


interface Dependencies {
  config: ApplicationConfig,
  enums: Enums,
  proxyCache: ProxyCache,
  positionHandler: PositionHandlerV2
  createRemittanceEntity: CreateRemittanceEntityPayment,
  definePositionParticipant: (options: {
    isFx: boolean,
    payload: CreatePaymentDto,
    determiningTransferCheckResult: TransferDeterminingCheckResult,
    proxyObligation: TransferProxyObligation
  }) => Promise<{ messageKey: string, cyrilResult: any }>
  effectToKafkaMessage: (effect: Effect) => any
  db: Knex,
  helper: Helper
}

export class LedgerSql implements Ledger {
  private readonly db: Knex
  private readonly helper: Helper

  constructor(private deps: Dependencies) {
    assert(deps)
    assert(deps.config)
    assert(deps.enums)
    assert(deps.proxyCache)
    assert(deps.positionHandler)
    assert(deps.createRemittanceEntity)
    assert(deps.definePositionParticipant)
    assert(deps.effectToKafkaMessage)
    assert(deps.db)
    assert(deps.helper)

    this.db = deps.db
    this.helper = deps.helper
  }

  public async createHubAccount(cmd: CreateHubAccountCommand): Promise<CreateHubAccountResponse> {
    assert(cmd.currency)
    assert(cmd.settlementModel)
    assert(cmd.settlementModel.name)
    assert(cmd.settlementModel.settlementGranularity)
    assert(cmd.settlementModel.settlementInterchange)
    assert(cmd.settlementModel.settlementDelay)
    assert.equal(cmd.settlementModel.currency, cmd.currency)
    assert(
      cmd.settlementModel.requireLiquidityCheck === true,
      'createHubAccount - currently only allows settlements with liquidity checks enabled'
    )
    assert(cmd.settlementModel.ledgerAccountType)
    assert(cmd.settlementModel.settlementAccountType)
    assertBoolean(cmd.settlementModel.autoPositionReset)

    if (!cmd.ids) {
      cmd.ids = [
        Number(this.deps.helper.idSmall()),
        Number(this.deps.helper.idSmall()),
      ]
    }

    try {
      // Validate the currency is valid.
      await this.validateCurrency(cmd.currency)

      try {
        // Backwards compatibility. Register only the requested account type.
        if (cmd.accountType) {
          await this._createHubAccount(cmd.accountType, cmd.currency, cmd.ids[0])
        } else {
          await this._createHubAccount('HUB_MULTILATERAL_SETTLEMENT', cmd.currency, cmd.ids[0])
          await this._createHubAccount('HUB_RECONCILIATION', cmd.currency, cmd.ids[1])
        }
      } catch (err) {
        // Catch this early, we can't know if the settlementModel has also already been created.
        if ((err as typeof FSPIOPError).message === 'Hub account has already been registered.') {
          logger.warn('createHubAccount', { error: err })
          return {
            type: 'ALREADY_EXISTS_HUB_ACCOUNT'
          }
        } else {
          throw err
        }
      }

      await SettlementDomain.createSettlementModel(cmd.settlementModel)
      return Result.emptyCommandResultSuccess()
    } catch (err: any) {
      if (err.message === 'Settlement Model already exists') {
        return {
          type: 'ALREADY_EXISTS_SETTLEMENT_MODEL'
        }
      }

      return Result.commandResultFailure(err)
    }
  }

  private async _createHubAccount(
    accountType: string,
    currency: string,
    participantCurrencyId: number
  ): Promise<void> {
    const participant = await Participant.getByName('Hub')
    if (!participant) {
      throw ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR,
        'Participant was not found.'
      )
    }

    const ledgerAccountTypes = this.deps.enums.ledgerAccountType
    const ledgerAccountTypeId = ledgerAccountTypes[accountType]
    if (!ledgerAccountTypeId) {
      throw ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR,
        'Ledger account type was not found.'
      )
    }

    // Check if account already exists by looking through participant's currency list
    const accountExists = participant.currencyList.some(
      curr => curr.currencyId === currency && curr.ledgerAccountTypeId === ledgerAccountTypeId
    )
    if (accountExists) {
      throw ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR,
        'Hub account has already been registered.'
      )
    }

    if (participant.participantId !== this.deps.config.HUB_ID) {
      throw ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR,
        'Endpoint is reserved for creation of Hub account types only.'
      )
    }

    const isPermittedHubAccountType = this.deps.config.HUB_ACCOUNTS.indexOf(accountType) >= 0
    if (!isPermittedHubAccountType) {
      throw ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR,
        'The requested hub operator account type is not allowed.'
      )
    }

    const newCurrencyAccount = await Participant.createHubAccount(
      participant.participantId,
      currency,
      ledgerAccountTypeId,
      participantCurrencyId,
    )
    if (!newCurrencyAccount) {
      throw ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR,
        'Participant account and Position create have failed.'
      )
    }
  }

  public async createDfsp(cmd: CreateDfspCommand): Promise<CreateDfspResponse> {
    assert(cmd.dfspId)
    assert(cmd.currencies)
    assert(cmd.currencies.length > 0)
    assert(cmd.currencies.length < 16, 'Cannot register more than 16 currencies for a DFSP')

    if (!cmd.ids) {
      const idsToCreate = cmd.currencies.length * 2
      cmd.ids = Array.from({ length: idsToCreate }, (_) => Number(this.deps.helper.idSmall()))
    }

    try {
      const participant = await Participant.getByName(cmd.dfspId);

      if (participant) {
        // If any of the new currencies to be registered are already created, then return 'ALREADY_EXISTS'
        const existingCurrencies = participant.currencyList.map(c => c.currencyId)
        const currencyAlreadyRegistered = existingCurrencies.some(curr => cmd.currencies.includes(curr))

        if (currencyAlreadyRegistered) {
          return {
            type: 'ALREADY_EXISTS'
          }
        }
      }

      // Create participant and currency accounts directly.
      for (let idx = 0; idx < cmd.currencies.length; idx++) {
        const currency = cmd.currencies[idx]
        const ids = cmd.ids.slice(idx * 2, idx * 2 + 2)
        await this.createParticipantWithCurrency(cmd.dfspId, cmd.isProxy, currency, ids);
      }

      for (let i = 0; i < cmd.currencies.length; i++) {
        const currency = cmd.currencies[i];
        assert(currency)

        // Get participant accounts to get the participantCurrencyIds needed by the facade
        const positionAccount = await Participant.getAccountByNameAndCurrency(
          cmd.dfspId,
          currency,
          Enum.Accounts.LedgerAccountType.POSITION
        );
        assert(positionAccount)
        const settlementAccount = await Participant.getAccountByNameAndCurrency(
          cmd.dfspId,
          currency,
          Enum.Accounts.LedgerAccountType.SETTLEMENT
        );
        assert(settlementAccount)

        // // If we don't set a net debit cap, clearing doesn't seem to work.
        // await this.setNetDebitCap({
        //   dfspId: cmd.dfspId, 
        //   currency: currency, 
        //   amount: 10000, 
        //   netDebitCapType: 'LIMITED', 
        //   alarmPercentage: 10
        // })
      }

      return Result.emptyCommandResultSuccess()
    } catch (err: any) {
      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  /**
   * Create participant and currency accounts directly (bypassing handler to avoid circular dependency)
   * This extracts the core logic from the participants handler create method
   */
  private async createParticipantWithCurrency(
    dfspId: string,
    isProxy: boolean,
    currency: string,
    ids: Array<number>
  ): Promise<void> {
    await Participant.validateHubAccounts(currency)

    let participant = await Participant.getByName(dfspId)
    if (participant) {
      const currencyExists = participant.currencyList.find((curr) => {
        return curr.currencyId === currency
      })
      if (currencyExists) {
        throw ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR,
          'Participant currency has already been registered'
        )
      }
    } else {
      const participantId = await Participant.create({
        name: dfspId, isProxy
      })
      participant = await Participant.getById(participantId)
    }

    assert(participant)

    const allSettlementModels = await SettlementDomain.getAll()
    let settlementModels = allSettlementModels.filter(model => model.currencyId === currency)
    if (settlementModels.length === 0) {
      settlementModels = allSettlementModels.filter(model => model.currencyId === null) // Default settlement model
      if (settlementModels.length === 0) {
        throw ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.GENERIC_SETTLEMENT_ERROR,
          'Unable to find a matching or default, Settlement Model'
        )
      }
    }

    // We need a 2x participantCurrencyId per Settlement Model.
    assert(ids.length >= settlementModels.length * 2, 'Not enough ids provided')
    for (let idx = 0; idx < settlementModels.length; idx++) {
      const settlementModel = settlementModels[idx]
      const [idA, idB] = ids.slice(idx * 2, idx * 2 + 2)
      assert(idA)
      assert(idB)

      // TODO(LD): Ideally these would be created in a transaction - as it stands right now, these are non
      // atomically created.

      // TODO: How do we pass in our idSmall() here?
      const participantCurrencyPosition = await Participant.createParticipantCurrency(
        participant.participantId, currency, settlementModel.ledgerAccountTypeId, true, idA
      )
      const participantCurrencySettlement = await Participant.createParticipantCurrency(
        participant.participantId, currency, settlementModel.settlementAccountTypeId, true, idB
      )

      // Also create positions here as well. This deviates from the old implementation, which
      // lazily created the positions on deposit.
      const knex = db.getKnex()
      const now = new Date()
      await knex('participantPosition').insert([
        {
          participantCurrencyId: idA,
          value: 0,
          reservedValue: 0,
          changedDate: now,
        },
        {
          participantCurrencyId: idB,
          value: 0,
          reservedValue: 0,
          changedDate: now,
        }
      ])

      assert(Array.isArray(participant.currencyList))
      participant.currencyList = participant.currencyList.concat([
        await Participant.getParticipantCurrencyById(participantCurrencyPosition),
        await Participant.getParticipantCurrencyById(participantCurrencySettlement)
      ])
    }
  }

  public async setNetDebitCap(cmd: SetNetDebitCapCommand): Promise<CommandResult<void>> {
    assert(cmd.netDebitCapType === 'LIMITED',
      'LedgerSql does not support unlimited net debit cap. Set to a very large number instead.'
    )
    assert(cmd.dfspId)
    assert(cmd.currency)
    assert(cmd.amount)
    assert(typeof cmd.alarmPercentage === 'number')

    try {
      // Check if position account is active.
      const positionAccount = await ParticipantFacade.getByNameAndCurrency(
        cmd.dfspId,
        cmd.currency,
        Enum.Accounts.LedgerAccountType.POSITION,
      )
      if (!positionAccount) {
        return Result.commandResultFailure(new Error(`Position account not found for ${cmd.dfspId} ${cmd.currency}`))
      }
      if (!positionAccount.currencyIsActive) {
        return Result.commandResultFailure(new Error('Position account is inactive'))
      }

      const payload = {
        currency: cmd.currency,
        limit: {
          type: 'NET_DEBIT_CAP',
          value: cmd.amount,
          alarmPercentage: cmd.alarmPercentage
        }
      }
      await Participant.adjustLimitsV2(cmd.dfspId, payload)
      return Result.emptyCommandResultSuccess()
    } catch (err) {
      return Result.commandResultFailure(err)
    }
  }

  public async getDfsp(query: { dfspId: string; }): Promise<QueryResultWithNotFound<LegacyLedgerDfsp>> {
    try {
      const participant = await Participant.getByName(query.dfspId)
      if (!participant) {
        return {
          type: 'NOT_FOUND',
          error: new Error(`Participant for id: ${query.dfspId} not found.`)
        }
      }
      assert(participant, 'expected participant to be defined')
      const ledgerAccountTypes: Record<string, number> = this.deps.enums.ledgerAccountType
      const ledgerAccountIdMap = Object.keys(ledgerAccountTypes).reduce((acc, ledgerAccountType) => {
        const ledgerAccountId = ledgerAccountTypes[ledgerAccountType]
        acc[ledgerAccountId] = ledgerAccountType
        return acc
      }, {} as Record<number, string>)

      const formattedAccounts: Array<LegacyLedgerAccountNoValue> = []
      participant.currencyList.forEach(currency => {
        const ledgerAccountType = ledgerAccountIdMap[currency.ledgerAccountTypeId]
        assert(ledgerAccountType)
        const formattedAccount: LegacyLedgerAccountNoValue = {
          id: BigInt(currency.participantCurrencyId),
          ledgerAccountType,
          currency: currency.currencyId,
          isActive: Boolean(currency.isActive),
          createdDate: new Date(currency.createdDate),
        }
        formattedAccounts.push(formattedAccount)
      })

      // Backwards compatibility, sort by createdDate, then Currency, then ledgerAccountType.
      formattedAccounts.sort((a, b) => {
        if (a.createdDate.getTime() === b.createdDate.getTime()) {
          return `${a.currency}_${a.ledgerAccountType}`.localeCompare(`${b.currency}_${b.ledgerAccountType}`)
        }

        return a.createdDate.getTime() - b.createdDate.getTime()
      })

      const dfsp: LegacyLedgerDfsp = {
        name: participant.name,
        isActive: participant.isActive === 1,
        created: new Date(participant.createdDate),
        accounts: formattedAccounts,
        isProxy: participant.isProxy === 1,
      }

      return Result.queryResultSuccess(dfsp)
    } catch (err) {
      return Result.queryResultFailure(err)
    }
  }

  public async getHubAccounts(query: GetHubAccountsQuery): Promise<HubAccountResponse> {
    try {
      const participants = await Participant.getByName('Hub')
      assert(participants, `Participant.getByName('Hub') returned undefined.`)
      const ledgerAccountTypes: Record<string, number> = this.deps.enums.ledgerAccountType
      const ledgerAccountIdMap = Object.keys(ledgerAccountTypes).reduce((acc, ledgerAccountType) => {
        const ledgerAccountId = ledgerAccountTypes[ledgerAccountType]
        acc[ledgerAccountId] = ledgerAccountType
        return acc
      }, {} as Record<number, string>)

      const formattedAccounts: Array<LegacyLedgerAccount> = []
      participants.currencyList.forEach(currency => {
        const ledgerAccountType = ledgerAccountIdMap[currency.ledgerAccountTypeId]
        assert(ledgerAccountType)
        const formattedAccount: LegacyLedgerAccount = {
          id: BigInt(currency.participantCurrencyId),
          // TODO: disabled this for now, the LedgerSql implementation is quite hard to 
          // match with LedgerTigerBeetle since the database autoincrements the id on failure.
          // id: BigInt(0),
          ledgerAccountType,
          currency: currency.currencyId,
          isActive: Boolean(currency.isActive),
          changedDate: new Date(currency.createdDate),
          createdDate: new Date(currency.createdDate),
          // These feel wrong to me - we should just return the value anyway
          // but the getByName query doesn't look up account values.
          value: 0,
          reservedValue: 0,
        }
        formattedAccounts.push(formattedAccount)
      })

      return {
        type: 'SUCCESS',
        createdDate: new Date(participants.createdDate),
        accounts: formattedAccounts,
      }

    } catch (err: any) {
      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  public async getAllDfsps(_: AnyQuery): Promise<QueryResult<GetAllDfspsResponse>> {
    try {
      const participants = await Participant.getAll()
      const ledgerAccountTypes: Record<string, number> = this.deps.enums.ledgerAccountType
      const ledgerAccountIdMap = Object.keys(ledgerAccountTypes).reduce((acc, ledgerAccountType) => {
        const ledgerAccountId = ledgerAccountTypes[ledgerAccountType]
        acc[ledgerAccountId] = ledgerAccountType
        return acc
      }, {} as Record<number, string>)

      const dfsps: Array<LegacyLedgerDfsp> = []
      participants.forEach(participant => {
        // Filter out the Hub accounts
        if (participant.name === 'Hub') {
          return
        }

        const formattedAccounts: Array<LegacyLedgerAccountNoValue> = []
        participant.currencyList.forEach((currency: any) => {
          const ledgerAccountType = ledgerAccountIdMap[currency.ledgerAccountTypeId]
          assert(ledgerAccountType)
          const formattedAccount: LegacyLedgerAccountNoValue = {
            id: BigInt(currency.participantCurrencyId),
            ledgerAccountType,
            currency: currency.currencyId,
            isActive: Boolean(currency.isActive),
            createdDate: new Date(currency.createdDate),
          }
          formattedAccounts.push(formattedAccount)
        })

        // Backwards compatibility, sort by createdDate, then Currency, then ledgerAccountType.
        formattedAccounts.sort((a, b) => {
          if (a.createdDate.getTime() === b.createdDate.getTime()) {
            return `${a.currency}_${a.ledgerAccountType}`.localeCompare(`${b.currency}_${b.ledgerAccountType}`)
          }

          return a.createdDate.getTime() - b.createdDate.getTime()
        })

        dfsps.push({
          name: participant.name,
          isActive: participant.isActive === 1,
          created: new Date(participant.createdDate),
          accounts: formattedAccounts,
          isProxy: participant.isProxy === 1,
        })
      })

      return Result.queryResultSuccess({ dfsps })
    } catch (err) {
      return Result.queryResultFailure(err)
    }
  }

  public async disableDfsp(cmd: { dfspId: string; }): Promise<CommandResult<void>> {
    assert(cmd)
    assert(cmd.dfspId)

    try {
      const dfspId = cmd.dfspId
      await Participant.update(
        dfspId, { isActive: false }
      )

      return Result.emptyCommandResultSuccess()
    } catch (err) {
      return Result.commandResultFailure(err)
    }
  }

  public async enableDfsp(cmd: { dfspId: string; }): Promise<CommandResult<void>> {
    assert(cmd)
    assert(cmd.dfspId)

    try {
      const dfspId = cmd.dfspId
      await Participant.update(
        dfspId, { isActive: true }
      )
      return Result.emptyCommandResultSuccess()
    } catch (err) {
      return Result.commandResultFailure(err)
    }
  }

  public async getNetDebitCap(query: GetNetDebitCapQuery): Promise<QueryResultWithNotFound<LegacyLimit>> {
    const legacyQuery = { currency: query.currency, type: 'NET_DEBIT_CAP' }
    try {
      const result = await Participant.getLimits(query.dfspId, legacyQuery)
      if (result.length === 0) {
        return {
          type: 'NOT_FOUND',
          error: ErrorHandler.Factory.createFSPIOPError(
            ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND,
            `getNetDebitCap() - no limits found for dfspId: ${query.dfspId}, ` +
            `currency: ${query.currency}, type: 'NET_DEBIT_CAP`
          )
        }
      }

      assert(result.length === 1)
      const legacyLimit = result[0] as { value: string, thresholdAlarmPercentage: string }
      assert(legacyLimit.value)
      assert(legacyLimit.thresholdAlarmPercentage)
      return {
        type: 'SUCCESS',
        result: {
          type: 'NET_DEBIT_CAP',
          value: safeStringToNumber(legacyLimit.value),
          alarmPercentage: safeStringToNumber(legacyLimit.thresholdAlarmPercentage)
        }

      }
    } catch (err: any) {
      if (err.message === 'participant not found') {
        return {
          type: 'NOT_FOUND',
          error: err
        }
      }
      return Helper.failure(err)
    }
  }

  public async getNetDebitCaps(query: GetNetDebitCapsQuery):
    Promise<QueryResultWithNotFound<Array<LegacyLimitItem>>> {
    const legacyQuery = { type: 'NET_DEBIT_CAP' }
    try {
      // This filters out the limit if the participantCurrency is inactive.
      const limitsResult = await Participant.getLimits(query.dfspId, legacyQuery)
      assert(Array.isArray(limitsResult))
      const result: Array<LegacyLimitItem> = limitsResult.map(item => {
        assert(item)
        assert(item.currencyId)
        assert(item.value)
        assert(item.thresholdAlarmPercentage)

        return {
          currency: item.currencyId,
          limit: {
            type: 'NET_DEBIT_CAP',
            value: safeStringToNumber(item.value),
            alarmPercentage: safeStringToNumber(item.thresholdAlarmPercentage)
          }
        }
      })

      return {
        type: 'SUCCESS',
        result
      }


    } catch (err: any) {
      if (err.message === 'participant not found') {
        return {
          type: 'NOT_FOUND',
          error: err
        }
      }
      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  public async getDfspAccounts(query: GetDfspAccountsQuery): Promise<DfspAccountResponse> {
    const legacyQuery = { currency: query.currency }
    try {
      // Backwards compatibility, also check for positions, since getAccounts doesn't throw if the
      // currency isn't registered.
      await Participant.getPositions(query.dfspId, legacyQuery)
      let accounts = await Participant.getAccounts(query.dfspId, legacyQuery)
      const formattedAccounts: Array<LegacyLedgerAccount> = []
      accounts.forEach(account => {
        assert(account.createdDate, 'getAccounts to contain account.createdDate')
        // Map from the internal legacy participantService representation to
        // a compatible Ledger Interface
        const formattedAccount: LegacyLedgerAccount = {
          id: BigInt(account.id),
          ledgerAccountType: account.ledgerAccountType,
          currency: account.currency,
          isActive: Boolean(account.isActive),
          changedDate: new Date(account.changedDate),
          createdDate: new Date(account.createdDate),
          value: safeStringToNumber(account.value),
          reservedValue: safeStringToNumber(account.reservedValue),
        }
        formattedAccounts.push(formattedAccount)
      })

      formattedAccounts.sort(Helper.dfspAccountComparator)

      assert(formattedAccounts.length === accounts.length)

      return {
        type: 'SUCCESS',
        accounts: formattedAccounts,
      }
    } catch (err: any) {
      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  public async getAllDfspAccounts(query: GetAllDfspAccountsQuery): Promise<DfspAccountResponse> {
    const legacyQuery = {}
    try {
      let accounts = await Participant.getAccounts(query.dfspId, legacyQuery)
      // ensure they are always ordered by id
      accounts = accounts.toSorted((a, b) => a.id - b.id)

      const formattedAccounts: Array<LegacyLedgerAccount> = []
      accounts.forEach(account => {
        // Map from the internal legacy participantService representation to
        // a compatible Ledger Interface.
        const formattedAccount: LegacyLedgerAccount = {
          id: BigInt(account.id),
          ledgerAccountType: account.ledgerAccountType,
          currency: account.currency,
          isActive: Boolean(account.isActive),
          changedDate: new Date(account.changedDate),
          createdDate: new Date(account.createdDate),
          value: safeStringToNumber(account.value),
          reservedValue: safeStringToNumber(account.reservedValue),
        }
        formattedAccounts.push(formattedAccount)
      })
      formattedAccounts.sort(Helper.dfspAccountComparator)

      assert(formattedAccounts.length === accounts.length)
      return {
        type: 'SUCCESS',
        accounts: formattedAccounts,
      }
    } catch (err: any) {
      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  public async enableDfspAccount(cmd: { dfspId: string; accountId: number; }): Promise<CommandResult<void>> {
    assert(cmd)
    assert(cmd.dfspId)
    assert(typeof cmd.accountId === 'number')

    try {
      await Participant.updateAccount(
        { isActive: true },
        { name: cmd.dfspId, id: cmd.accountId },
        this.deps.enums
      )

      return Result.emptyCommandResultSuccess()
    } catch (err) {
      return Result.commandResultFailure(err)
    }
  }

  public async disableDfspAccount(cmd: { dfspId: string; accountId: number; }): Promise<CommandResult<void>> {
    assert(cmd)
    assert(cmd.dfspId)
    assert(typeof cmd.accountId === 'number')

    try {
      await Participant.updateAccount(
        { isActive: false },
        { name: cmd.dfspId, id: cmd.accountId },
        this.deps.enums
      )

      return Result.emptyCommandResultSuccess()
    } catch (err) {
      return Result.commandResultFailure(err)
    }
  }

  public async withdrawPrepare(cmd: WithdrawPrepareCommand): Promise<WithdrawPrepareResponse> {
    assert(cmd.amount)
    assert(cmd.dfspId)
    assert(cmd.currency)
    assert(cmd.transferId)
    assert(cmd.reason)

    try {
      const responseDfsp = await this.getDfsp({ dfspId: cmd.dfspId })
      if (responseDfsp.type === 'NOT_FOUND') {
        throw new Error(`dfsp not found for id: ${cmd.dfspId}`)
      }

      if (responseDfsp.type === 'FAILURE') {
        throw responseDfsp.error
      }

      if (!responseDfsp.result.isActive) {
        throw new Error('Participant is currently set inactive')
      }

      // Get both settlement and position accounts.
      const settlementAccount = await ParticipantFacade.getByNameAndCurrency(
        cmd.dfspId,
        cmd.currency,
        Enum.Accounts.LedgerAccountType.SETTLEMENT,
      );
      assert(settlementAccount, 'Settlement account not found')
      assert(settlementAccount.currencyIsActive, 'Expected settlement account to be active.')

      const positionAccount = await ParticipantFacade.getByNameAndCurrency(
        cmd.dfspId,
        cmd.currency,
        Enum.Accounts.LedgerAccountType.POSITION,
      );
      assert(positionAccount, 'Position account not found');
      if (!positionAccount.currencyIsActive) {
        return Helper.failure(new Error('position account is inactive.'))
      }

      const payload = {
        transferId: cmd.transferId,
        action: Enum.Events.Event.Action.RECORD_FUNDS_OUT_PREPARE_RESERVE,
        reason: cmd.reason,
        externalReference: `withdrawal-${cmd.dfspId}`,
        amount: {
          amount: cmd.amount.toString(),
          currency: cmd.currency
        },
        participantCurrencyId: settlementAccount.participantCurrencyId,
      };
      const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(
        cmd.transferId,
        payload,
        getTransferDuplicateCheck,
        saveTransferDuplicateCheck
      )
      if (hasDuplicateId) {
        if (hasDuplicateHash) {
          throw new Error('recordFundsInOut transfer already created.')
        } else {
          throw new Error('recordFundsInOut transfer modified created.')
        }
      }
      const result = await Participant.createRecordFundsInOut(payload, new Date(), this.deps.enums)
      if (result.abortedDueToInsufficientFunds) {
        return {
          type: 'FAILURE',
          error: new Error('withdrawPrepare() failed with insufficent funds.')
        }
      }

      return Result.emptyCommandResultSuccess()
    } catch (err) {
      return Result.commandResultFailure(err)
    }
  }

  public async withdrawCommit(cmd: WithdrawCommitCommand): Promise<WithdrawCommitResponse> {
    assert(cmd.transferId)

    try {
      const payload = {
        transferId: cmd.transferId,
        action: Enum.Events.Event.Action.RECORD_FUNDS_OUT_COMMIT
      }

      await Participant.changeStatusOfRecordFundsOut(
        payload,
        cmd.transferId,
        new Date(),
        this.deps.enums
      );
      return Result.emptyCommandResultSuccess()
    } catch (err) {
      return Result.commandResultFailure(err)
    }
  }

  public async withdrawAbort(cmd: WithdrawAbortCommand): Promise<WithdrawAbortResponse> {
    assert(cmd.transferId)

    try {
      const payload = {
        transferId: cmd.transferId,
        action: Enum.Events.Event.Action.RECORD_FUNDS_OUT_ABORT
      }

      await Participant.changeStatusOfRecordFundsOut(
        payload,
        cmd.transferId,
        new Date(),
        this.deps.enums
      );
      return Result.emptyCommandResultSuccess()
    } catch (err) {
      return Result.commandResultFailure(err)
    }
  }

  public async deposit(cmd: DepositCommand): Promise<DepositResponse> {
    const knex = db.getKnex() as Knex
    assert(cmd.amount)
    assert(cmd.amount > 0, 'depositCollateral amount must be greater than 0')
    assert(cmd.dfspId)
    assert(cmd.currency)
    assert(cmd.transferId)
    assert(cmd.reason)

    try {
      const enums = this.deps.enums

      // TODO: also check is the participant is active?
      const participant = await Participant.getByName(cmd.dfspId);
      if (!participant) {
        return {
          type: 'NOT_FOUND'
        }
      }
      // Get both settlement and position accounts
      const settlementAccount = await ParticipantFacade.getByNameAndCurrency(
        cmd.dfspId,
        cmd.currency,
        Enum.Accounts.LedgerAccountType.SETTLEMENT
      );

      const positionAccount = await ParticipantFacade.getByNameAndCurrency(
        cmd.dfspId,
        cmd.currency,
        Enum.Accounts.LedgerAccountType.POSITION
      );
      if (!settlementAccount || !positionAccount) {
        return {
          type: 'NOT_FOUND'
        }
      }

      // Check if accounts are active before proceeding This deviates from the legacy behaviour,
      // which would enable the accounts if they were disabled.
      if (!settlementAccount.currencyIsActive) {
        throw new Error(`Settlement account is disabled for participant: ${cmd.dfspId}`)
      }
      if (!positionAccount.currencyIsActive) {
        throw new Error(`Position account is disabled for participant: ${cmd.dfspId}`)
      }

      const existingSettlementPosition = await knex('participantPosition')
        .where('participantCurrencyId', settlementAccount.participantCurrencyId)
        .first();

      assert(existingSettlementPosition, 'No existingSettlementPosition found.')

      // Create participantPosition if needed.
      const existingPositionPosition = await knex('participantPosition')
        .where('participantCurrencyId', positionAccount.participantCurrencyId)
        .first();

      assert(existingPositionPosition, 'No existingPositionPosition found.')

      const fundsInPayload = {
        transferId: cmd.transferId,
        action: Enum.Events.Event.Action.RECORD_FUNDS_IN,
        reason: cmd.reason,
        externalReference: `deposit-${cmd.dfspId}`,
        participantCurrencyId: settlementAccount.participantCurrencyId,
        amount: {
          amount: cmd.amount.toString(),
          currency: cmd.currency
        },
        payer: this.deps.config.HUB_NAME,
        payee: cmd.dfspId
      };

      const hash = TransferHelper.hashPayload(fundsInPayload)
      await TransferService.saveTransferDuplicateCheck(cmd.transferId, hash);
      await TransferService.recordFundsInV2(fundsInPayload, new Date(), enums);

      return Result.emptyCommandResultSuccess()
    } catch (err: any) {
      // Check for duplicate transferId error.
      if (err.code === 'ER_DUP_ENTRY') {
        return {
          type: 'ALREADY_EXISTS'
        }
      }
      return Result.commandResultFailure(err)
    }
  }

  public async prepare(inputs: Array<PrepareHandlerInput>): Promise<Array<PaymentPrepareResult>> {
    const results = await Promise.allSettled(inputs.map(async input => this.prepareOne(input)))
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.type !== PaymentPrepareResultType.PASS) {
        logger.info(`LedgerSql.prepare() returned non-success: \n\t${JSON.stringify(result.value)}`)
      }
      if (result.status === 'rejected') {
        logger.error(`LedgerSql.prepare() failed with error: \n\t${result.reason}`)
        if (result.reason.stack) logger.error(`stack\n\t${result.reason.stack}`)
      }
    })

    return results.map(result => {
      switch (result.status) {
        case 'rejected': return {
          type: PaymentPrepareResultType.FAIL_OTHER,
          error: result.reason,
          effects: []
        }
        case 'fulfilled': return result.value
      }
    })
  }

  public async fulfil(inputs: Array<FulfilHandlerInput>): Promise<Array<PaymentFulfilResult>> {
    const results = await Promise.allSettled(inputs.map(async input => this.fulfilOne(input)))
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.type !== PaymentFulfilResultType.PASS) {
        logger.info(`LedgerSql.fulfil() returned non-success: \n\t${JSON.stringify(result.value)}`)
      }
      if (result.status === 'rejected') {
        logger.error(`LedgerSql.fulfil() failed with error: \n\t${result.reason}`)
        if (result.reason.stack) logger.error(`stack\n\t${result.reason.stack}`)
      }
    })

    return results.map(result => {
      switch (result.status) {
        case 'rejected': return {
          type: PaymentFulfilResultType.FAIL_OTHER,
          error: result.reason,
          effects: []
        }
        case 'fulfilled': return result.value
      }
    })
  }

  private async prepareOne(input: PrepareHandlerInput): Promise<PaymentPrepareResult> {
    // Check Duplication
    const remittance = this.deps.createRemittanceEntity()
    const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(
      input.payload.transferId,
      input.payload,
      remittance.getDuplicate,
      remittance.saveDuplicateHash
    )

    if (hasDuplicateId && !hasDuplicateHash) {
      // Id was reused for a different request.
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST
      )
      const effect = this.helper.buildEffectNotificationError(input, fspiopError)
      return {
        type: PaymentPrepareResultType.MODIFIED,
        effects: [effect]
      }
      // Original also covers case for BULK_PREPARE, but we don't handle that here.
    }

    // If we found the payment, we can assume it was a duplicate!
    const payment = await remittance.getByIdLight(input.payload.transferId)
    if (payment && payment.transferStateEnumeration) {
      switch (payment.transferStateEnumeration) {
        case TransferState.ABORTED: {
          const effect = this.helper.buildEffectNotificationDuplicate(input, payment)
          return {
            type: PaymentPrepareResultType.DUPLICATE_FINAL,
            effects: [effect],
            finalizedTransfer: {
              completedTimestamp: payment.completedTimestamp,
              transferState: payment.transferStateEnumeration,
            }
          }
        }
        case TransferState.COMMITTED:
        case TransferState.RESERVED: {
          const effect = this.helper.buildEffectNotificationDuplicate(input, payment)
          return {
            type: PaymentPrepareResultType.DUPLICATE_FINAL,
            effects: [effect],
            finalizedTransfer: {
              completedTimestamp: payment.completedTimestamp,
              transferState: payment.transferStateEnumeration,
              fulfilment: payment.fulfilment
            }
          }
        }
      }
    }

    // We should also look up the error we sent last time and if we have one, return that?
    if (hasDuplicateId) {
      return {
        type: PaymentPrepareResultType.DUPLICATE_NON_FINAL,
        effects: []
      }
    }

    const proxyResult = await this.calculateProxyObligation(input.payload)
    const allErrors = [...proxyResult.errors]

    // Ensure the Net Debit Caps are defined, otherwise position handler fails
    // silently.
    const ndcErrors = await this.validateNetDebitCaps(input.payload)
    allErrors.push(...ndcErrors)

    // If proxy resolution failed, we can't continue - return accumulated errors.
    if (proxyResult.proxyObligation === null) {
      allErrors.sort()
      await remittance.savePreparedRequest(
        input.payload,
        allErrors.toString(),
        false,
        Helper.dummyDeterminingTransferCheckResult(),
        Helper.dummyProxyObligation(input.payload)
      )

      const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        allErrors.toString()
      )
      const effect = this.helper.buildEffectNotificationError(input, errorFspiop)
      return {
        type: PaymentPrepareResultType.FAIL_VALIDATION,
        effects: [effect],
        failureReasons: allErrors
      }
    }

    const proxyObligation = proxyResult.proxyObligation
    const determiningTransferCheckResult = await remittance.checkIfDeterminingTransferExists(
      proxyObligation.payloadClone,
      proxyObligation
    )

    let validationResult: Awaited<ReturnType<typeof this.validatePayloadLinkedPayment>>
    if (determiningTransferCheckResult.determiningTransferExistsInWatchList) {
      validationResult = await this.validatePayloadLinkedPayment(
        proxyObligation.payloadClone, determiningTransferCheckResult
      )
    } else {
      validationResult = await this.validatePayloadUnlinkedPayment(proxyObligation.payloadClone)
    }
    allErrors.push(...validationResult.reasons)

    if (allErrors.length > 0) {
      allErrors.sort()
      await remittance.savePreparedRequest(
        input.payload,
        allErrors.toString(),
        false,
        determiningTransferCheckResult,
        proxyObligation,
      )
      const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        allErrors.toString()
      )

      const effect = this.helper.buildEffectNotificationError(input, errorFspiop)
      return {
        type: PaymentPrepareResultType.FAIL_VALIDATION,
        effects: [effect],
        failureReasons: allErrors
      }
    }

    // Save the payment as successfully prepared.
    await remittance.savePreparedRequest(
      input.payload,
      null,
      true,
      determiningTransferCheckResult,
      proxyObligation,
    )

    const { messageKey, cyrilResult } = await this.deps.definePositionParticipant({
      payload: proxyObligation.payloadClone,
      isFx: false,
      determiningTransferCheckResult,
      proxyObligation
    })
    const effectPosition = this.helper.buildEffectPosition(
      input, messageKey, cyrilResult
    )

    return this.prepareNext({
      type: PaymentPrepareResultType.PASS,
      effects: [
        effectPosition
      ]
    })
  }

  private async prepareNext(result: PaymentPrepareResult): Promise<PaymentPrepareResult> {
    if (this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'UNFUSE') {
      return result
    }

    assert(this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'FUSE')
    const notifications = result.effects.filter(effect => effect.functionality === 'notification')
    const positions = result.effects
      .filter(effect => effect.functionality === 'position')
      .map(this.deps.effectToKafkaMessage)
    const resultsPosition = await this.deps.positionHandler.handle(null, positions)
    assert(resultsPosition.length > 0, 'Expected at least one result from positionHandler.')
    // Look just at the first one to map the result type.
    const resultPosition = resultsPosition[0]
    const positionEffects = resultsPosition
      .reduce((acc: Array<Effect>, curr) => acc.concat(...curr.effects), [])

    let type: PaymentPrepareResultType
    let error
    switch (resultPosition.type) {
      case PositionResultType.PASS:
        type = PaymentPrepareResultType.PASS
        break
      case PositionResultType.FAIL_LIQUIDITY:
        type = PaymentPrepareResultType.FAIL_LIQUIDITY
        error = resultPosition.error
        break
      case PositionResultType.FAIL_OTHER:
        type = PaymentPrepareResultType.FAIL_OTHER
        error = resultPosition.error
        break
    }

    return {
      type,
      effects: [...notifications, ...positionEffects],
      error,
    }
  }

  private async fulfilOne(input: FulfilHandlerInput): Promise<PaymentFulfilResult> {
    // Shortcut.
    const { transferId, payload } = input
    const transfer = await TransferService.getById(transferId)
    if (!transfer) {
      return {
        type: PaymentFulfilResultType.FAIL_OTHER,
        effects: [],
        error: ErrorHandler.Factory.createInternalServerFSPIOPError(
          `transfer not found for id: ${transferId}.`
        )
      }
    }

    // Dimensions:
    // payeeIsProxy true/false
    // - if true, need to check externalPayeeName
    // - if false, need to check payeeFsp
    // payerIsProxy true/false
    // - if true, need to check externalPayerName
    // - if false, need to check payerFsp
    let payerFieldName = 'payerFsp' // Keep track of for better error messages.
    let payer = transfer.payerFsp
    if (transfer.payerIsProxy) {
      payerFieldName = 'externalPayerName'
      payer = transfer.externalPayerName
    }

    let payeeFieldName = 'payeeFsp' // Keep track of for better error messages.
    let payee = transfer.payeeFsp
    if (transfer.payeeIsProxy) {
      payeeFieldName = 'externalPayeeName'
      payee = transfer.externalPayeeName
    }
    assert(payer, 'Error resolving payer.')
    assert(payee, 'Error resolving payee.')

    // Ensure that the FSPIOP-Source matches the payee/externalPayeeName.
    let error: any
    if (input.callerDfspId !== payee) {
      const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `caller fsp does not match payment.${payeeFieldName}.`
      )
      error = errorFspiop.toApiErrorObject(this.deps.config.ERROR_HANDLING)
      // Transfer aborted.
      await TransferService.handlePayeeResponse(
        transferId,
        payload,
        'abort-validation',
        error
      )
    }

    // Ensure that the FSPIOP-Destination matches the payer/externalPayerName.
    // Only call this if we haven't failed the validation on the first step, to match the legacy 
    // error handling behavior.
    if (!error && input.destinationDfspId !== payer) {
      const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `caller fsp does not match payment.${payerFieldName}.`
      )
      error = errorFspiop.toApiErrorObject(this.deps.config.ERROR_HANDLING)
      // Transfer aborted.
      await TransferService.handlePayeeResponse(
        transferId,
        payload,
        'abort-validation',
        error
      )
    }

    if (error) {
      const effects = [
        await this.helper.buildEffectPositionRollback(input, transfer, error),
      ]
      if (input.action === Action.RESERVE) {
        effects.push(this.helper.buildEffectReservedAbortedNotification(input, transfer))
      }
      return this.fulfilNext({
        type: PaymentFulfilResultType.FAIL_VALIDATION,
        effects,
        error
      })
    }

    const payloadHash = Util.Hash.generateSha256(payload)
    if (transfer.transferStateEnumeration === 'COMMITTED') {
      // Payment is finalized. Check to see if this is an exact duplicate Fulfil message, or if the
      // fulfil message was modified in some way.
      let savedFulfilHash
      try {
        savedFulfilHash = (await getTransferFulfilmentDuplicateCheck(transferId)).hash
        if (savedFulfilHash === payloadHash) {
          const effect = this.helper.buildEffectFulfilDuplicateNotification(input, transfer, false)
          return {
            type: PaymentFulfilResultType.DUPLICATE_FINAL,
            effects: [effect],
          }
        }
        // Modified message.
        const errorModified = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST
        )
        const effect = this.helper.buildEffectFulfilDuplicateError(input, errorModified, false)
        return {
          type: PaymentFulfilResultType.FAIL_VALIDATION,
          effects: [effect],
          error: errorModified
        }
      } catch (err) {
        const error = ErrorHandler.Factory.createInternalServerFSPIOPError(
          'found finalized transfer, but no `getTransferFulfilmentDuplicateCheck`'
        )
        logger.error(error.message)
        return {
          type: PaymentFulfilResultType.FAIL_OTHER,
          effects: [],
          error,
        }
      }
    }

    if (transfer.transferStateEnumeration === 'ABORTED') {
      // Payment is finalized. Check to see if this is an exact duplicate Fulfil message, or if the
      // fulfil message was modified in some way.
      let savedHash
      try {
        savedHash = (await getTransferErrorDuplicateCheck(transferId)).hash
        if (savedHash === payloadHash) {
          const effect = this.helper.buildEffectFulfilDuplicateNotification(input, transfer, true)
          return {
            type: PaymentFulfilResultType.DUPLICATE_FINAL,
            effects: [effect],
          }
        }
        // Modified message.
        const errorModified = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST
        )
        const effect = this.helper.buildEffectFulfilDuplicateError(input, errorModified, true)
        return {
          type: PaymentFulfilResultType.FAIL_VALIDATION,
          effects: [effect],
          error: errorModified
        }
      } catch (err) {
        const error = ErrorHandler.Factory.createInternalServerFSPIOPError(
          'found finalized transfer, but no `getTransferFulfilmentDuplicateCheck`'
        )
        logger.error(error.message)
        return {
          type: PaymentFulfilResultType.FAIL_OTHER,
          effects: [],
          error,
        }
      }
    }

    // According to:
    // https://docs.mojaloop.io/api/fspiop/v1.1/api-definition.html#put-transfers-id
    // "For PUT /transfers/{ID} callbacks, the state ABORTED is not a valid enumeration option as 
    // transferState in Table 32. If a transfer is to be rejected, then the FSP making the callback
    // should use an error callback, i.e., a callback on the /error endpoint.
    if (input.action === 'abort') {
      const errorPayload = payload as CommitPaymentDtoAborted
      const errorFspiop = ErrorHandler.Factory.createFSPIOPErrorFromErrorInformation(
        errorPayload.errorInformation
      )
      const errorApi = errorFspiop.toApiErrorObject(this.deps.config.ERROR_HANDLING)

      // Payee aborted the transfer, save to DB.
      const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(
        transferId, payload, getTransferErrorDuplicateCheck, saveTransferErrorDuplicateCheck
      )

      if (hasDuplicateId && hasDuplicateHash) {
        const effect = this.helper.buildEffectFulfilDuplicateNotification(input, transfer, true)
        return {
          type: PaymentFulfilResultType.DUPLICATE_FINAL,
          effects: [effect]
        }
      }

      if (hasDuplicateId && !hasDuplicateHash) {
        const modifiedError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST
        )
        const effect = this.helper.buildEffectFulfilDuplicateError(input, modifiedError, true)
        return {
          type: PaymentFulfilResultType.FAIL_VALIDATION,
          effects: [effect],
          error: modifiedError
        }
      }

      await TransferService.handlePayeeResponse(
        transferId,
        errorPayload,
        input.action,
        errorApi
      )

      const effects = [await this.helper.buildEffectPositionRollback(input, transfer, errorApi, false)]
      return this.fulfilNext({
        type: PaymentFulfilResultType.PASS,
        effects,
      })
    }

    assert(
      payload.transferState === 'COMMITTED' ||
      payload.transferState === 'RESERVED' ||
      payload.transferState === 'RESERVED_FORWARDED'
    )
    if (transfer.expirationDate <= new Date(Util.Time.getUTCString(new Date()))) {
      return {
        type: PaymentFulfilResultType.FAIL_VALIDATION,
        effects: [],
        error: ErrorHandler.Factory.createInternalServerFSPIOPError(
          `transfer timed out.`
        )
      }
    }

    const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(
      transferId, payload, getTransferFulfilmentDuplicateCheck, saveTransferFulfilmentDuplicateCheck
    )

    if (hasDuplicateId && hasDuplicateHash) {
      const effect = this.helper.buildEffectFulfilDuplicateNotification(input, transfer, false)
      return {
        type: PaymentFulfilResultType.DUPLICATE_FINAL,
        effects: [effect]
      }
    }

    if (hasDuplicateId && !hasDuplicateHash) {
      const modifiedError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST
      )
      const effect = this.helper.buildEffectFulfilDuplicateError(input, modifiedError, false)
      return {
        type: PaymentFulfilResultType.FAIL_VALIDATION,
        effects: [effect],
        error: modifiedError
      }
    }

    if (!TransferHelper.fulfilmentMatchesCondition(payload.fulfilment, transfer.condition)) {
      // Payee sent an fulfilment. Need to abort the payment.
      const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        'invalid fulfilment'
      )
      const error = errorFspiop.toApiErrorObject(this.deps.config.ERROR_HANDLING)
      // Transfer aborted.
      await TransferService.handlePayeeResponse(
        transferId,
        payload,
        'abort-validation',
        error
      )

      const effects = [await this.helper.buildEffectPositionRollback(input, transfer, error)]
      if (input.action === Action.RESERVE) {
        effects.push(this.helper.buildEffectReservedAbortedNotification(input, transfer))
      }
      return this.fulfilNext({ type: PaymentFulfilResultType.FAIL_VALIDATION, effects, error })
    }

    // Happy path - validation passed.
    await TransferService.handlePayeeResponse(transferId, payload, input.action)

    // Build the position change effect.
    const messageEffect = input.message
    const cyrilResult = await fxService.Cyril.processFulfilMessage(
      input.transferId,
      input.payload,
      transfer
    )
    let messageKey: string
    if (cyrilResult.isFx && cyrilResult.positionChanges.length > 0) {
      // Forex + Payment.
      // @ts-ignore
      messageKey = cyrilResult.positionChanges[0].participantCurrencyId.toString()
      messageEffect.value.content.context = {
        ...messageEffect.value.content.context,
        cyrilResult
      }
    } else {
      // Standalone Payment.
      const payeeAccount = await Participant.getAccountByNameAndCurrency(
        transfer.payeeFsp, transfer.currency, Enum.Accounts.LedgerAccountType.POSITION,
      )
      messageKey = payeeAccount.participantCurrencyId.toString()
    }

    assert(messageKey)

    const effectPosition: Effect = {
      functionality: Type.POSITION,
      action: input.action,
      message: messageEffect.value,
      messageKey,
      topicName: 'topic-transfer-position-batch',
      status: 'SUCCESS'
    }

    return this.fulfilNext({
      type: PaymentFulfilResultType.PASS,
      effects: [effectPosition],
    })
  }

  /**
   * In UNFUSE mode, returns the result.
   * In FUSE   mode, applies the position change then returns that result.
   */
  private async fulfilNext(result: PaymentFulfilResult): Promise<PaymentFulfilResult> {
    if (this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'UNFUSE') {
      return result
    }

    assert(this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'FUSE')
    const notifications = result.effects
      .filter(effect => effect.functionality === 'notification')
    const positions = result.effects
      .filter(effect => effect.functionality === 'position')
      .map(this.deps.effectToKafkaMessage)
    const resultsPosition = await this.deps.positionHandler.handle(null, positions)
    assert(resultsPosition.length > 0, 'Expected at least one result from positionHandler.')
    // Look just at the first one to map the result type.
    const resultPosition = resultsPosition[0]
    const positionEffects = resultsPosition
      .reduce((acc: Array<Effect>, curr) => acc.concat(...curr.effects), [])

    let type: PaymentFulfilResultType
    let error
    switch (resultPosition.type) {
      case PositionResultType.PASS:
        type = PaymentFulfilResultType.PASS
        break
      case PositionResultType.FAIL_OTHER:
        type = PaymentFulfilResultType.FAIL_OTHER
        error = resultPosition.error
        break
      default: throw new Error(`fulfilNext() unhandled resultPosition.type: ${resultPosition.type}.`)
    }

    return {
      type,
      effects: [...notifications, ...positionEffects],
      error,
    }
  }

  /**
   * This mimicks the old implementation which is actually looking up the ILP Packet for a
   * transferId. I'm not sure if/how we will want to carry this into TigerBeetle.
   */
  public async lookupTransfer(query: LookupTransferQuery): Promise<LookupTransferQueryResponse> {
    assert(query.transferId)
    try {
      const transactions = await Transaction.getById(query.transferId)
      if (!transactions || transactions.length === 0) {
        return {
          // Backwards compatibility - return FAILED instead of NOT_FOUND to match
          // legacy Admin API.
          type: LookupTransferResultType.FAILED,
          error: new Error(`Failed to find transaction for transferId: ${query.transferId}.`),
        }
      }
      const transfer = transactions[0]
      assert(transfer)

      const binaryPacket = Buffer.from(transfer.value, 'base64')
      const deserialized = deserializeIlpPacket(binaryPacket) as any
      assert(deserialized, 'Malformed deserialization of ilpPacket.')
      assert(deserialized.data)
      assert(deserialized.data.data)
      const decodedData = base64url.decode(deserialized.data.data.toString())
      const parsedDecodedData = JSON.parse(decodedData)

      return {
        type: LookupTransferResultType.FOUND,
        transfer: parsedDecodedData
      }
    } catch (err: any) {
      return {
        type: LookupTransferResultType.FAILED,
        error: err
      }
    }
  }

  public async sweepTimedOut(now: Date): Promise<SweepResult> {
    const knex = db.getKnex() as Knex

    // Naïve approach - use MySQL named locks to prevent concurrent timeout handlers.
    // If run is called from multiple threads or processes simultaneously, subsequent runs
    // will wait until this lock expires before running.
    // We should tune the sleep time (currently 600 seconds = 10 minutes) based on what's realistic.
    await knex.raw(`SELECT GET_LOCK("timeout_handler", 600)`)

    try {
      const segmentPayment = await TimeoutService.getTimeoutSegmentV2()
      const intervalPaymentMin = segmentPayment.value
      await TimeoutService.cleanupTransferTimeout()
      const intervalPaymentMax = await TimeoutService.getLatestTransferStateChangeV2()
      const segmentForex = await TimeoutService.getFxTimeoutSegmentV2()
      const intervalForexMin = segmentForex.value
      await TimeoutService.cleanupFxTransferTimeout()
      const intervalForexMax = await TimeoutService.getLatestFxTransferStateChangeV2()

      const {
        transferTimeoutList,
        fxTransferTimeoutList
      } = await TimeoutService.timeoutExpireReserved(
        segmentPayment.segmentId, intervalPaymentMin, intervalPaymentMax,
        segmentForex.segmentId, intervalForexMin, intervalForexMax,
        now
      )
      const {
        transferForwardedList,
        fxTransferForwardedList
      } = await TimeoutService.reservedForwardedTransfers(
        intervalPaymentMin, intervalPaymentMax,
        intervalForexMin, intervalForexMax,
        // This was 'config.HANDLERS_TIMEOUT_FORWARDED_MAX_ATTEMPTS' but that doesn't exist.
        // Keeping behavior the same by passing through null.
        null,
        now
      )

      const paymentsResults = this.helper.paymentEffects(transferTimeoutList)
      const forexResults = this.helper.forexEffects(fxTransferTimeoutList)
      const forwardedPaymentsResults = this.helper.forwardedPaymentEffects(transferForwardedList)
      const forwardedForexesResults = this.helper.forwardedForexEffects(fxTransferForwardedList)
      return Result.commandResultSuccess({
        intervalPayment: [intervalPaymentMin, intervalPaymentMax],
        intervalForex: [intervalForexMin, intervalForexMax],
        results: [
          ...paymentsResults,
          ...forexResults,
          ...forwardedPaymentsResults,
          ...forwardedForexesResults
        ]
      })
    } catch (err) {
      return Result.commandResultFailure(err)
    } finally {
      await knex.raw(`SELECT RELEASE_LOCK("timeout_handler")`)
    }
  }

  private async validateNetDebitCaps(payload: CreatePaymentDto): Promise<Array<string>> {
    const errors: Array<string> = []

    try {
      const payerLimit = await Participant.getLimits(payload.payerFsp, {
        currency: payload.amount.currency,
        type: 'NET_DEBIT_CAP'
      })
      if (!payerLimit || payerLimit.length === 0) {
        errors.push(`Payer net debit cap not defined.`)
      }
    } catch {
      errors.push(`Payer net debit cap not defined.`)
    }

    try {
      const payeeLimit = await Participant.getLimits(payload.payeeFsp, {
        currency: payload.amount.currency,
        type: 'NET_DEBIT_CAP'
      })
      if (!payeeLimit || payeeLimit.length === 0) {
        errors.push(`Payee net debit cap not defined.`)
      }
    } catch {
      errors.push(`Payee net debit cap not defined.`)
    }

    return errors
  }

  private async validatePayloadUnlinkedPayment(payload: CreatePaymentDto): Promise<{
    reasons: Array<string>,
    result: 'PASS' | 'FAIL'
  }> {
    const reasons: Array<string> = []
    const [leftStr, rightStr = ''] = payload.amount.amount.split('.')
    assert(leftStr !== undefined)
    assert(rightStr !== undefined)
    if (rightStr.length > this.deps.config.AMOUNT.SCALE) {
      reasons.push(
        `Amount ${payload.amount.amount} exceeds allowed scale of ${this.deps.config.AMOUNT.SCALE}`
      )
    }
    const precision = leftStr.length + rightStr.length
    if (precision > this.deps.config.AMOUNT.PRECISION) {
      reasons.push(
        `Amount ${precision} exceeds allowed precision of ${this.deps.config.AMOUNT.PRECISION}`
      )
    }

    const participantPayer = await Participant.getByName(payload.payerFsp)
    if (!participantPayer) {
      reasons.push(`Participant ${payload.payerFsp} not found`)
    }
    if (participantPayer && !participantPayer.isActive) {
      reasons.push(`Participant ${payload.payerFsp} is inactive`)
    }
    const participantPayee = await Participant.getByName(payload.payeeFsp)
    if (!participantPayee) {
      reasons.push(`Participant ${payload.payerFsp} not found`)
    }
    if (participantPayee && !participantPayee.isActive) {
      reasons.push(`Participant ${payload.payerFsp} is inactive`)
    }

    const accountPayer = await Participant.getAccountByNameAndCurrency(
      payload.payerFsp, payload.amount.currency, Enum.Accounts.LedgerAccountType.POSITION
    )
    if (!accountPayer) {
      reasons.push(`Participant ${payload.payerFsp} ${payload.amount.currency} account not found`)
    } else if (!accountPayer.currencyIsActive) {
      reasons.push(`Participant ${payload.payerFsp} ${payload.amount.currency} account is inactive`)
    }

    const accountPayee = await Participant.getAccountByNameAndCurrency(
      payload.payeeFsp, payload.amount.currency, Enum.Accounts.LedgerAccountType.POSITION
    )
    if (!accountPayee) {
      reasons.push(`Participant ${payload.payeeFsp} ${payload.amount.currency} account not found`)
    } else if (!accountPayee.currencyIsActive) {
      reasons.push(`Participant ${payload.payeeFsp} ${payload.amount.currency} account is inactive`)
    }

    if (!this.deps.config.ENABLE_ON_US_TRANSFERS) {
      if (payload.payerFsp === payload.payeeFsp) {
        reasons.push(
          'Payer FSP and Payee FSP should be different, unless on-us tranfers are allowed by the Scheme'
        )
      }
    }
    if (!payload.condition) {
      reasons.push('Condition is required for a conditional transfer')
    } else {
      const buffer = Buffer.from(payload.condition, 'base64')
      if (buffer.length !== 32) {
        logger.info(`validateInput() condition validation failed.`)
        reasons.push('Condition validation failed')
      }
    }

    if (!payload.expiration) {
      reasons.push('Expiration is required for conditional transfer')
    } else {
      if (Date.parse(payload.expiration) < Date.parse(new Date().toISOString())) {
        reasons.push(`Expiration date ${new Date(payload.expiration).toISOString()} is already in the past`)
      }
    }

    return {
      reasons,
      result: reasons.length === 0 ? 'PASS' : 'FAIL'
    }
  }

  /**
   * Validate the linked-payment-specific checks (FX transfer state).
   * Common validation (participant, account, NDC, amount, condition, expiration) is already
   * done by validatePayloadUnlinkedPayment which runs first.
   */
  private async validatePayloadLinkedPayment(
    payload: CreatePaymentDto,
    determiningTransferCheckResult: TransferDeterminingCheckResult,
  ): Promise<{
    reasons: Array<string>,
    result: 'PASS' | 'FAIL'
  }> {
    const reasons: Array<string> = []

    // Check the status of the linked transfers.
    if (determiningTransferCheckResult.watchListRecords) {
      for (const watchListRecord of determiningTransferCheckResult.watchListRecords) {
        const record = watchListRecord as { commitRequestId: string }
        // Check the transfer state of commitRequestId.
        const lastStateChange = await FxTransferStateChangeModel.getByCommitRequestId(
          record.commitRequestId
        )
        if (lastStateChange.transferStateId !== 'RECEIVED_FULFIL_DEPENDENT') {
          reasons.push('Related FX Transfer is not fulfilled')
        }
      }
    }

    return {
      reasons,
      result: reasons.length === 0 ? 'PASS' : 'FAIL'
    }
  }

  /**
   * @description Figure out if the participants in the Payment message are native to the scheme
   * or are proxies.
   */
  private async calculateProxyObligation(payload: CreatePaymentDto): Promise<{
    proxyObligation: TransferProxyObligation | null,
    errors: Array<string>
  }> {
    const errors: Array<string> = []

    // If the proxy isn't enabled, just return the default.
    if (!this.deps.config.PROXY_CACHE_CONFIG.enabled) {
      return {
        proxyObligation: {
          isFx: false,
          payloadClone: { ...payload },  // just a copy of the original payload
          isInitiatingFspProxy: false,
          isCounterPartyFspProxy: false,
          initiatingFspProxyOrParticipantId: {
            inScheme: true, proxyId: null, name: payload.payerFsp
          },
          counterPartyFspProxyOrParticipantId: {
            inScheme: true, proxyId: null, name: payload.payeeFsp
          }
        },
        errors: []
      }
    }

    // We need to double check the following validation logic incase of payee side currency
    // conversion.
    const payerResult = await this.deps.proxyCache.getFSPProxy(payload.payerFsp, {
      validateCurrencyAccounts: true,
      accounts: [
        {
          currency: payload.amount.currency,
          accountType: Enum.Accounts.LedgerAccountType.POSITION
        }
      ]
    })
    const payeeResult = await this.deps.proxyCache.getFSPProxy(payload.payeeFsp, {
      validateCurrencyAccounts: true,
      accounts: [
        {
          currency: payload.amount.currency,
          accountType: Enum.Accounts.LedgerAccountType.POSITION
        }
      ]
    })
    assert(payerResult)
    assert(payeeResult)

    if (payerResult.inScheme === false && payerResult.proxyId === null) {
      errors.push(`Payer proxy or participant not found: payer: ${payload.payerFsp}.`)
    }
    if (payeeResult.inScheme === false && payeeResult.proxyId === null) {
      errors.push(`Payee proxy or participant not found: payee: ${payload.payeeFsp}.`)
    }
    if ((!payerResult.inScheme && !payeeResult.inScheme) && payload.payerFsp === payload.payeeFsp) {
      errors.push(`Payer FSP and Payee FSP should be different, unless on-us tranfers are allowed by the Scheme`)
    }

    if (errors.length > 0) {
      return {
        proxyObligation: null,
        errors
      }
    }

    const isInitiatingFspProxy = !payerResult.inScheme && payerResult.proxyId !== null
    const isCounterPartyFspProxy = !payeeResult.inScheme && payeeResult.proxyId !== null

    return {
      proxyObligation: {
        isFx: false,
        payloadClone: {
          ...payload,
          // Reroute the proxies.
          payerFsp: isInitiatingFspProxy ? payerResult.proxyId! : payload.payerFsp,
          payeeFsp: isCounterPartyFspProxy ? payeeResult.proxyId! : payload.payeeFsp
        },
        isInitiatingFspProxy,
        isCounterPartyFspProxy,
        initiatingFspProxyOrParticipantId: payerResult,
        counterPartyFspProxyOrParticipantId: payeeResult
      },
      errors: []
    }
  }

  public async closeSettlementWindow(cmd: SettlementCloseWindowCommand):
    Promise<CommandResult<CloseSettlementWindowResult>> {
    assert(typeof cmd.id === 'number')
    assert(typeof cmd.reason === 'string')

    try {
      const result = await SettlementWindowDomain.process(
        { settlementWindowId: cmd.id, reason: cmd.reason },
        this.deps.enums.settlementWindowState
      ) as CloseSettlementWindowResult
      return {
        type: 'SUCCESS',
        result,
      }
    } catch (err: any) {
      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  public async settlementPrepare(cmd: SettlementPrepareCommand): Promise<CommandResult<Settlement>> {
    assert(cmd.model)
    assert(typeof cmd.reason === 'string')
    assert(cmd.windowIds)

    try {
      const triggerResult = await SettlementDomain.settlementEventTrigger(
        {
          settlementModel: cmd.model,
          reason: cmd.reason,
          // rewrap in a format the function expects
          settlementWindows: cmd.windowIds.map(id => {
            return { id }
          })
        },
        this.deps.enums
      )
      assert(triggerResult.id, 'expected settlementEventTrigger() to return an id')

      return {
        type: 'SUCCESS',
        result: triggerResult as unknown as Settlement
      }
    }
    catch (err: any) {
      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  public async settlementAbort(cmd: SettlementAbortCommand): Promise<CommandResult<SettlementUpdateResult>> {
    assert(cmd)
    assert(typeof cmd.id === 'number')

    logger.info(`settlementAbort() with cmd: ${JSON.stringify(cmd)}`)

    try {
      const payload = {
        state: 'ABORTED',
        reason: 'Settlement aborted',
        externalReference: ''
      }

      // TODO: I think this always fails.
      const result = await SettlementDomain.abortById(
        cmd.id,
        payload,
        this.deps.enums
      )

      return {
        type: 'SUCCESS',
        result: result as unknown as SettlementUpdateResult
      }
    } catch (err: any) {
      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  /**
   * Noop for LegacyLedger - the Settlement is considered committed when each participant has been
   * updated
   */
  public async settlementCommit(cmd: SettlementCommitCommand): Promise<CommandResult<void>> {
    return { type: 'SUCCESS' }
  }

  public async settlementUpdate(cmd: SettlementUpdateCommand): Promise<CommandResult<SettlementUpdateResult>> {
    assert(cmd)
    assert(typeof cmd.id === 'number')
    assert(cmd.updates)
    assert(Array.isArray(cmd.updates))
    assert(cmd.updates.length > 0, 'settlementUpdate requires at least one update')

    try {
      // Group updates by participantId to batch accounts per participant
      // TODO: maybe don't use a map?
      const participantMap = new Map<number, Array<{ id: number, state: string, reason: string, externalReference: string }>>()
      for (const update of cmd.updates) {
        assert(update.participantId)
        assert(update.accountId)
        assert(update.participantState)
        assert(typeof update.reason === 'string')
        assert(typeof update.externalReference === 'string')

        if (!participantMap.has(update.participantId)) {
          participantMap.set(update.participantId, [])
        }

        participantMap.get(update.participantId)!.push({
          id: update.accountId,
          state: update.participantState,
          reason: update.reason,
          externalReference: update.externalReference
        })
      }

      // Build participants array from grouped updates
      const participants = Array
        .from(participantMap.entries())
        .map(([participantId, accounts]) => ({
          id: participantId,
          accounts
        }))

      const payload = { participants }
      const result = await SettlementModel.putById(cmd.id, payload, this.deps.enums)

      return {
        type: 'SUCCESS',
        result: result as unknown as SettlementUpdateResult
      }
    } catch (err: any) {
      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  public async getSettlementWindows(query: GetSettlementWindowsQuery): Promise<QueryResult<GetSettlementWindowsQueryResponse>> {
    assert(query)

    logger.info(`getSettlementWindows() with query: ${JSON.stringify(query)}`)

    try {
      // Transform query to legacy format
      const legacyQuery: {
        participantId?: number
        state?: string
        fromDateTime?: string
        toDateTime?: string
        currency?: string
      } = {}

      if (query.participantId !== undefined) {
        legacyQuery.participantId = query.participantId
      }
      if (query.state) {
        legacyQuery.state = query.state
      }
      if (query.fromDateTime) {
        // Match string parsing of previous implementation.
        legacyQuery.fromDateTime = query.fromDateTime.toISOString().replace('.000Z', 'Z')
      }
      if (query.toDateTime) {
        // Match string parsing of previous implementation.
        legacyQuery.toDateTime = query.toDateTime.toISOString().replace('.000Z', 'Z')
      }
      if (query.currency) {
        legacyQuery.currency = query.currency
      }

      const legacyWindows = await SettlementWindowDomain.getByParams(
        { query: legacyQuery },
        this.deps.enums
      )

      // Map legacy format to SettlementWindow format
      const settlementWindows: SettlementWindow[] = legacyWindows.map(mapLegacySettlementWindowToLedger)

      return {
        type: 'SUCCESS',
        result: settlementWindows
      }
    } catch (err: any) {
      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  public async getSettlementWindow(query: GetSettlementWindowQuery):
    Promise<QueryResultWithNotFound<SettlementWindow>> {
    assert(query)
    logger.info(`getSettlementWindow() with query: ${JSON.stringify(query)}`)

    try {
      const legacyWindow = await SettlementWindowDomain.getById(
        { settlementWindowId: query.id }, this.deps.enums
      )
      const result = mapLegacySettlementWindowToLedger(legacyWindow)
      return {
        type: 'SUCCESS',
        result
      }
    } catch (err: any) {
      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  public async getSettlement(query: GetSettlementQuery):
    Promise<QueryResultWithNotFound<Settlement>> {
    assert(query)
    assert(typeof query.id === 'number')

    try {
      const settlement = await SettlementDomain.getById({ settlementId: query.id }, this.deps.enums)
      assert(settlement, 'getById should throw on not found.')
      return {
        type: 'SUCCESS',
        result: settlement as unknown as Settlement
      }
    } catch (err: any) {
      if (err && err.apiErrorCode && err.apiErrorCode.httpStatusCode === 400) {
        return {
          type: 'NOT_FOUND',
          error: err
        }
      }

      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  public async getSettlements(query: GetSettlementsQuery): Promise<GetSettlementsQueryResponse> {
    try {
      const legacyQuery = {
        accountId: query.accountId,
        currency: query.currency,
        participantId: query.participantId,
        settlementWindowId: query.settlementWindowId,
        state: query.state,
        fromDateTime: query.fromDateTime?.toISOString().replace('.000Z', 'Z'),
        toDateTime: query.toDateTime?.toISOString().replace('.000Z', 'Z'),
        fromSettlementWindowDateTime: query.fromSettlementWindowDateTime?.toISOString().replace('.000Z', 'Z'),
        toSettlementWindowDateTime: query.toSettlementWindowDateTime?.toISOString().replace('.000Z', 'Z'),
      }

      const result = await SettlementDomain.getSettlementsByParams(
        { query: legacyQuery },
        this.deps.enums
      )

      const settlements: Settlement[] = result.map(settlement => ({
        id: settlement.id,
        state: settlement.state,
        reason: settlement.reason ?? '',
        createdDate: settlement.createdDate,
        changedDate: settlement.changedDate,
        settlementWindows: settlement.settlementWindows ?? [],
        participants: settlement.participants ?? []
      }))

      return { type: 'SUCCESS', result: settlements }
    } catch (err: any) {
      return { type: 'FAILURE', error: err }
    }
  }

  private async validateCurrency(currency: string): Promise<void> {
    assert(currency)
    const result = await this.db('currency').where('currencyId', currency).first()
    if (!result) {
      throw new Error(`Currency: ${currency} not defined.`)
    }
  }
}

const mapLegacySettlementWindowToLedger = (window: any) => {
  let state: SettlementWindowState
  switch (window.state) {
    case 'OPEN':
    case 'CLOSED':
    case 'PENDING_SETTLEMENT':
    case 'SETTLED':
    case 'ABORTED':
    case 'PROCESSING':
    case 'FAILED':
      state = window.state
      break
    default:
      throw new Error(`mapLegacySettlementWindowToLedger() settlement window state: ${window.state}`)
  }

  return {
    settlementWindowId: window.settlementWindowId,
    state,
    reason: window.reason ?? '',
    createdDate: window.createdDate,
    changedDate: window.changedDate,
    content: window.content || []
  }
}
