import { Enum, Util } from '@mojaloop/central-services-shared';
const { TransferState } = Enum.Transfers
import assert from "node:assert"
import Transaction from '../../domain/transactions'
import {
  CommitPaymentDtoAborted,
  FulfilHandlerInput,
  PaymentFulfilResult,
  PaymentFulfilResultType
} from '../../handlers/payment-fulfil';
import {
  CreatePaymentDto,
  PaymentPrepareResult,
  PaymentPrepareResultType,
  PrepareHandlerInput
} from "../../handlers/payment-prepare";
import { PositionHandlerV2, PositionResultType } from "../../handlers/position-v2";
import {
  CreateRemittanceEntityPayment,
  ProxyCache,
  TransferDeterminingCheckResult,
  TransferProxyObligation
} from "../../handlers/transfer-types";
import { ApplicationConfig } from "../../lib/config";
import { Effect, MessageBus } from "../../messaging/message-bus";
import ParticipantFacade from '../../models/participant/facade';
import { getTransferErrorDuplicateCheck } from '../../models/transfer/transferErrorDuplicateCheck';
import { logger } from "../../shared/logger";
import TransferService, {
  getTransferFulfilmentDuplicateCheck,
  saveTransferErrorDuplicateCheck,
  saveTransferFulfilmentDuplicateCheck,
  getTransferDuplicateCheck,
  saveTransferDuplicateCheck
} from "../transfer";
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
} from "./types";
const fxService = require('../fx')
const FxTransferStateChangeModel = require('../../models/fxTransfer/stateChange')

import { Knex } from 'knex';
import { TimeoutResultPayment, TimeoutResultPaymentForward } from '../../handlers/timeout-v2';
import { TransferHelper } from '../../handlers/transfer-helper'
import { assertBoolean, safeStringToNumber } from '../../lib/config/util'
import db from "../../lib/db";
import {
  ForwardedFxTransfer,
  ForwardedTransfer,
  TimedOutFxTransfer,
  TimedOutTransfer
} from '../../models/transfer/facade';
import * as Participant from '../participant';
import TimeoutService from '../timeout';
import Helper from './helper';
import TransferObjectTransform from '../transfer/transform'
import { deserializeIlpPacket } from 'ilp-packet';
import base64url from 'base64url';
import SettlementDomain from '../../domain/settlement'
import SettlementWindowDomain from '../../domain/settlementWindow'
import SettlementWindowModel from '../../models/settlementWindow'
import SettlementModel from '../../models/settlement/settlement'

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { FSPIOPError } = ErrorHandler
const { Comparators, resourceVersions } = Util
const { Type, Action } = Enum.Events.Event

interface Enums {
  ledgerAccountType: Record<string, number>
  ledgerEntryType: Record<string, number>
  transferParticipantRoleType: Record<string, number>
  transferState: Record<string, number>
  participantLimitType: Record<string, number>
  settlementWindowState: Record<string, number>
  settlementDelay: Record<string, number>
  settlementDelayEnums: Record<string, number>
  settlementGranularity: Record<string, number>
  settlementGranularityEnums: Record<string, number>
  settlementInterchangeEnums: Record<string, number>
  settlementStates: Record<string, number>
  transferParticipantRoleTypes: Record<string, number>
  transferStateEnums: Record<string, number>
  transferStates: Record<string, number>
  settlementInterchange: Record<string, number>
}

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
}

export class LedgerSql implements Ledger {
  private readonly timeoutError = ErrorHandler.Factory
    .createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED)
    .toApiErrorObject(this.deps.config.ERROR_HANDLING)

  constructor(private deps: Dependencies) { }

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

    try {
      try {
        // Backwards compatibility. Register only the requested account type.
        if (cmd.accountType) {
          await this._createHubAccount(cmd.accountType, cmd.currency)
        } else {
          await this._createHubAccount('HUB_MULTILATERAL_SETTLEMENT', cmd.currency)
          await this._createHubAccount('HUB_RECONCILIATION', cmd.currency)
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
      return Helper.emptyCommandResultSuccess()
    } catch (err: any) {
      if (err.message === 'Settlement Model already exists') {
        return {
          type: 'ALREADY_EXISTS_SETTLEMENT_MODEL'
        }
      }

      return Helper.commandResultFailure(err)
    }
  }

  private async _createHubAccount(accountType: string, currency: string): Promise<void> {
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
      ledgerAccountTypeId
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
      for (const currency of cmd.currencies) {
        await this.createParticipantWithCurrency(cmd.dfspId, cmd.isProxy, currency);
      }

      // Set the initial limits
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
      }

      return {
        type: 'SUCCESS'
      }


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
  private async createParticipantWithCurrency(dfspId: string, isProxy: boolean, currency: string): Promise<void> {
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

    for (const settlementModel of settlementModels) {
      // TODO(LD): Ideally these would be created in a transaction - as it stands right now, these are non
      // atomically created.
      const participantCurrencyPosition = await Participant.createParticipantCurrency(
        participant.participantId, currency, settlementModel.ledgerAccountTypeId, false
      )
      const participantCurrencySettlement = await Participant.createParticipantCurrency(
        participant.participantId, currency, settlementModel.settlementAccountTypeId, false
      )

      if (Array.isArray(participant.currencyList)) {
        participant.currencyList = participant.currencyList.concat([
          await Participant.getParticipantCurrencyById(participantCurrencyPosition),
          await Participant.getParticipantCurrencyById(participantCurrencySettlement)
        ])
      } else {
        participant.currencyList = await Promise.all([
          Participant.getParticipantCurrencyById(participantCurrencyPosition),
          Participant.getParticipantCurrencyById(participantCurrencySettlement)
        ])
      }
    }
  }

  public async setNetDebitCap(cmd: SetNetDebitCapCommand): Promise<CommandResult<void>> {
    assert(cmd.netDebitCapType === 'LIMITED',
      'LedgerSql does not support unlimited net debit cap. Set to a very large number instead.'
    )
    assert(cmd.dfspId)
    assert(cmd.currency)
    assert(cmd.amount)
    assert(cmd.alarmPercentage)

    try {
      const payload = {
        currency: cmd.currency,
        limit: {
          type: 'NET_DEBIT_CAP',
          value: cmd.amount,
          thresholdAlarmPercentage: cmd.alarmPercentage
        }
      }
      await Participant.adjustLimitsV2(cmd.dfspId, payload)
      return Helper.emptyCommandResultSuccess()
    } catch (err) {
      return Helper.commandResultFailure(err)
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

      const formattedAccounts: Array<LegacyLedgerAccount> = []
      participant.currencyList.forEach(currency => {
        const ledgerAccountType = ledgerAccountIdMap[currency.ledgerAccountTypeId]
        assert(ledgerAccountType)
        const formattedAccount: LegacyLedgerAccount = {
          id: BigInt(currency.participantCurrencyId),
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

      const dfsp: LegacyLedgerDfsp = {
        name: participant.name,
        isActive: participant.isActive === 1,
        created: new Date(participant.createdDate),
        accounts: formattedAccounts,
        isProxy: participant.isProxy === 1,
      }

      return Helper.queryResultSuccess(dfsp)
    } catch (err) {
      return Helper.queryResultFailure(err)
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

        const formattedAccounts: Array<LegacyLedgerAccount> = []
        participant.currencyList.forEach((currency: any) => {
          const ledgerAccountType = ledgerAccountIdMap[currency.ledgerAccountTypeId]
          assert(ledgerAccountType)
          const formattedAccount: LegacyLedgerAccount = {
            id: BigInt(currency.participantCurrencyId),
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

        dfsps.push({
          name: participant.name,
          isActive: participant.isActive === 1,
          created: new Date(participant.createdDate),
          accounts: formattedAccounts,
          isProxy: participant.isProxy === 1,
        })
      })

      return Helper.queryResultSuccess({ dfsps })
    } catch (err) {
      return Helper.queryResultFailure(err)
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

      return Helper.emptyCommandResultSuccess()
    } catch (err) {
      return Helper.commandResultFailure(err)
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
      return Helper.emptyCommandResultSuccess()
    } catch (err) {
      return Helper.commandResultFailure(err)
    }
  }

  public async getNetDebitCap(query: GetNetDebitCapQuery): Promise<QueryResultWithNotFound<LegacyLimit>> {
    const legacyQuery = { currency: query.currency, type: 'NET_DEBIT_CAP' }
    try {
      const result = await Participant.getLimits(query.dfspId, legacyQuery)
      if (result.length === 0) {
        return {
          type: 'FAILURE',
          error: ErrorHandler.Factory.createFSPIOPError(
            ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND,
            `getNetDebitCap() - no limits found for dfspId: ${query.dfspId}, currency: ${query.currency}, type: 'NET_DEBIT_CAP`
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
      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  public async getNetDebitCaps(query: GetNetDebitCapsQuery): Promise<QueryResultWithNotFound<Array<LegacyLimitItem>>> {
    const legacyQuery = { type: 'NET_DEBIT_CAP' }
    try {
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
      let positions = await Participant.getPositions(query.dfspId, legacyQuery)

      let accounts = await Participant.getAccounts(query.dfspId, legacyQuery)
      // ensure they are always ordered by id
      accounts = accounts.toSorted((a, b) => a.id - b.id)

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
          value: safeStringToNumber(account.value),
          reservedValue: safeStringToNumber(account.reservedValue),
          changedDate: new Date(account.changedDate),
          createdDate: new Date(account.createdDate),
        }
        formattedAccounts.push(formattedAccount)
      })

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
          value: safeStringToNumber(account.value),
          reservedValue: safeStringToNumber(account.reservedValue),
          changedDate: new Date(account.changedDate),
          createdDate: new Date(account.createdDate),
        }
        formattedAccounts.push(formattedAccount)
      })

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
    assert(cmd.accountId)

    try {
      await Participant.updateAccount(
        { isActive: true },
        { name: cmd.dfspId, id: cmd.accountId },
        this.deps.enums
      )

      return Helper.emptyCommandResultSuccess()
    } catch (err) {
      return Helper.commandResultFailure(err)
    }
  }

  public async disableDfspAccount(cmd: { dfspId: string; accountId: number; }): Promise<CommandResult<void>> {
    assert(cmd)
    assert(cmd.dfspId)
    assert(cmd.accountId)

    try {
      await Participant.updateAccount(
        { isActive: false },
        { name: cmd.dfspId, id: cmd.accountId },
        this.deps.enums
      )

      return Helper.emptyCommandResultSuccess()
    } catch (err) {
      return Helper.commandResultFailure(err)
    }
  }

  public async withdrawPrepare(cmd: WithdrawPrepareCommand): Promise<WithdrawPrepareResponse> {
    const knex = db.getKnex() as Knex

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
        Enum.Accounts.LedgerAccountType.SETTLEMENT
      );
      assert(settlementAccount, 'Settlement account not found');

      const positionAccount = await ParticipantFacade.getByNameAndCurrency(
        cmd.dfspId,
        cmd.currency,
        Enum.Accounts.LedgerAccountType.POSITION
      );
      assert(positionAccount, 'Position account not found');

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
      await Participant.createRecordFundsInOut(payload, new Date(), this.deps.enums)

      return Helper.emptyCommandResultSuccess()
    } catch (err) {
      return Helper.commandResultFailure(err)
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
      return Helper.emptyCommandResultSuccess()
    } catch (err) {
      return Helper.commandResultFailure(err)
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
      return Helper.emptyCommandResultSuccess()
    } catch (err) {
      return Helper.commandResultFailure(err)
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
      assert(settlementAccount, 'Settlement account not found');

      const positionAccount = await ParticipantFacade.getByNameAndCurrency(
        cmd.dfspId,
        cmd.currency,
        Enum.Accounts.LedgerAccountType.POSITION
      );
      assert(positionAccount, 'Position account not found');

      // Create participantPosition and activate SETTLEMENT account if needed (BEFORE validation)
      const existingSettlementPosition = await knex('participantPosition')
        .where('participantCurrencyId', settlementAccount.participantCurrencyId)
        .first();

      if (!existingSettlementPosition) {
        await knex('participantPosition').insert({
          participantCurrencyId: settlementAccount.participantCurrencyId,
          value: 0,
          reservedValue: 0,
          changedDate: new Date(),
        });

        // Activate the settlement account so validation passes
        await knex('participantCurrency')
          .update({ isActive: 1 })
          .where('participantCurrencyId', settlementAccount.participantCurrencyId);
      }

      // Create participantPosition and activate POSITION account if needed.
      const existingPositionPosition = await knex('participantPosition')
        .where('participantCurrencyId', positionAccount.participantCurrencyId)
        .first();

      if (!existingPositionPosition) {
        await knex('participantPosition').insert({
          participantCurrencyId: positionAccount.participantCurrencyId,
          value: 0,
          reservedValue: 0,
          changedDate: new Date(),
        });

        // Activate the position account.
        await knex('participantCurrency')
          .update({ isActive: 1 })
          .where('participantCurrencyId', positionAccount.participantCurrencyId);
      }

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

      return Helper.emptyCommandResultSuccess()
    } catch (err: any) {
      // Check for duplicate transferId error.
      if (err.code === 'ER_DUP_ENTRY') {
        return {
          type: 'ALREADY_EXISTS'
        }
      }
      return Helper.commandResultFailure(err)
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
      const effect = this.buildEffectNotificationError(input, fspiopError)
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
          const effect = this.buildEffectNotificationDuplicate(input, payment)
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
          const effect = this.buildEffectNotificationDuplicate(input, payment)
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

    if (hasDuplicateId) {
      return {
        type: PaymentPrepareResultType.DUPLICATE_NON_FINAL,
        effects: []
      }
    }

    let proxyObligation: TransferProxyObligation
    try {
      proxyObligation = await this.calculateProxyObligation(input.payload)
    } catch (err: any) {
      const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        'Validation error'
      )
      const effect = this.buildEffectNotificationError(input, errorFspiop)
      return {
        type: PaymentPrepareResultType.FAIL_VALIDATION,
        effects: [effect],
        failureReasons: err.message
      }
    }

    assert(proxyObligation)
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

    // In case the payee/payer are not 'in scheme', the proxyObligation payload clone has rewritten
    // the payer/payee to be the proxy payee/payer, so we check _this_ payload.
    // We might want to rewrite this validation, to be aware of native vs non-native payment.
    assert(validationResult)
    if (validationResult.result === 'FAIL') {
      assert(validationResult.reasons.length > 0)
      // Save the request even if it failed validation.
      // This call fails when the participants don't exist.
      await remittance.savePreparedRequest(
        input.payload,
        validationResult.reasons.toString(),
        false,
        determiningTransferCheckResult,
        proxyObligation,
      )
      const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        validationResult.reasons.toString(),
      )

      const effect = this.buildEffectNotificationError(input, errorFspiop)
      return {
        type: PaymentPrepareResultType.FAIL_VALIDATION,
        effects: [effect],
        failureReasons: validationResult.reasons
      }
    }
    assert(validationResult.result === 'PASS')
    assert(validationResult.reasons.length === 0)

    // Save the payment as successfully prepared.
    await remittance.savePreparedRequest(
      input.payload,
      null,
      true,
      determiningTransferCheckResult,
      proxyObligation,
    )

    const effectPosition = await this.buildEffectPosition(
      input, determiningTransferCheckResult, proxyObligation
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
      .map(MessageBus.effectToKafkaMessage)
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
        await this.buildEffectPositionRollback(input, transfer, error),
      ]
      if (input.action === Action.RESERVE) {
        effects.push(this.buildEffectReservedAbortedNotification(input, transfer))
      }
      return this.fulfilNext({
        type: PaymentFulfilResultType.FAIL_VALIDATION,
        effects,
        error
      })
    }

    const payloadHash = Util.Hash.generateSha256(payload)
    if (transfer.transferState === 'COMMITTED') {
      // Payment is finalized. Check to see if this is an exact duplicate Fulfil message, or if the
      // fulfil message was modified in some way.
      let savedFulfilHash
      try {
        savedFulfilHash = (await getTransferFulfilmentDuplicateCheck(transferId)).hash
        if (savedFulfilHash === payloadHash) {
          const effect = this.buildEffectFulfilDuplicateNotification(input, transfer, false)
          return {
            type: PaymentFulfilResultType.DUPLICATE_FINAL,
            effects: [effect],
          }
        }
        // Modified message.
        const errorModified = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST
        )
        const effect = this.buildEffectFulfilDuplicateError(input, errorModified, false)
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

    if (transfer.transferState === 'ABORTED') {
      // Payment is finalized. Check to see if this is an exact duplicate Fulfil message, or if the
      // fulfil message was modified in some way.
      let savedHash
      try {
        savedHash = (await getTransferErrorDuplicateCheck(transferId)).hash
        if (savedHash === payloadHash) {
          const effect = this.buildEffectFulfilDuplicateNotification(input, transfer, true)
          return {
            type: PaymentFulfilResultType.DUPLICATE_FINAL,
            effects: [effect],
          }
        }
        // Modified message.
        const errorModified = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST
        )
        const effect = this.buildEffectFulfilDuplicateError(input, errorModified, true)
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
        const effect = this.buildEffectFulfilDuplicateNotification(input, transfer, true)
        return {
          type: PaymentFulfilResultType.DUPLICATE_FINAL,
          effects: [effect]
        }
      }

      if (hasDuplicateId && !hasDuplicateHash) {
        const modifiedError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST
        )
        const effect = this.buildEffectFulfilDuplicateError(input, modifiedError, true)
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

      const effects = [await this.buildEffectPositionRollback(input, transfer, errorApi, false)]
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
      const effect = this.buildEffectFulfilDuplicateNotification(input, transfer, false)
      return {
        type: PaymentFulfilResultType.DUPLICATE_FINAL,
        effects: [effect]
      }
    }

    if (hasDuplicateId && !hasDuplicateHash) {
      const modifiedError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST
      )
      const effect = this.buildEffectFulfilDuplicateError(input, modifiedError, false)
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

      const effects = [await this.buildEffectPositionRollback(input, transfer, error)]
      if (input.action === Action.RESERVE) {
        effects.push(this.buildEffectReservedAbortedNotification(input, transfer))
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
      .map(MessageBus.effectToKafkaMessage)
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
      case PositionResultType.FAIL_LIQUIDITY:
        type = PaymentFulfilResultType.FAIL_OTHER
        error = resultPosition.error
        break
      case PositionResultType.FAIL_OTHER:
        type = PaymentFulfilResultType.FAIL_OTHER
        error = resultPosition.error
        break
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

      const paymentsResults = await this.paymentEffects(transferTimeoutList)
      const forexResults = await this.forexEffects(fxTransferTimeoutList)
      const forwardedPaymentsResults = await this.forwardedPaymentEffects(transferForwardedList)
      const forwardedForexesResults = await this.forwardedForexEffects(fxTransferForwardedList)
      return Helper.commandResultSuccess({
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
      return Helper.commandResultFailure(err)
    } finally {
      await knex.raw(`SELECT RELEASE_LOCK("timeout_handler")`)
    }
  }

  private async buildEffectPosition(
    input: PrepareHandlerInput,
    determiningTransferCheckResult: TransferDeterminingCheckResult,
    proxyObligation: TransferProxyObligation,
  ): Promise<Effect> {
    const { messageKey, cyrilResult } = await this.deps.definePositionParticipant({
      payload: proxyObligation.payloadClone,
      isFx: false,
      determiningTransferCheckResult,
      proxyObligation
    })
    const messageEffect = input.message
    messageEffect.value.content.context = {
      ...messageEffect.value.content.context,
      cyrilResult
    }
    const effectPosition: Effect = {
      functionality: Type.POSITION,
      action: Action.PREPARE,
      message: messageEffect.value,
      messageKey,
      topicName: 'topic-transfer-position-batch',
      status: 'SUCCESS',
    }
    return effectPosition
  }

  private buildEffectNotificationError(
    input: PrepareHandlerInput,
    fspiopError: any
  ): Effect {
    const message = structuredClone(input.message.value)
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)

    message.content.payload = apiFSPIOPError
    message.content.uriParams = { id: input.payload.transferId }
    message.to = message.from
    message.from = this.deps.config.HUB_NAME
    if (message.content.headers) {
      message.content.headers['fspiop-source'] = message.from
      message.content.headers['fspiop-destination'] = message.to
    }

    const effect: Effect = {
      functionality: Type.NOTIFICATION,
      action: Action.PREPARE,
      message,
      topicName: 'topic-notification-event',
      status: 'FAILURE',
      fspiopError: apiFSPIOPError
    }
    return effect
  }

  private buildEffectNotificationDuplicate(
    input: PrepareHandlerInput,
    transfer: any
  ): Effect {
    const message = structuredClone(input.message.value)
    message.content.payload = TransferObjectTransform.toFulfil(transfer, false)
    message.content.uriParams = { id: input.payload.transferId }

    message.to = message.from
    message.from = this.deps.config.HUB_NAME
    if (message.content.headers) {
      message.content.headers['fspiop-source'] = message.from
      message.content.headers['fspiop-destination'] = message.to
    }

    return {
      functionality: Type.NOTIFICATION,
      action: Action.PREPARE_DUPLICATE,
      message,
      topicName: 'topic-notification-event',
      status: 'SUCCESS',
    }
  }

  private buildEffectFulfilDuplicateNotification(
    input: FulfilHandlerInput,
    transfer: any,
    isTransferError: boolean
  ): Effect {
    const message = structuredClone(input.message.value)
    message.content.payload = TransferObjectTransform.toFulfil(transfer, false)
    message.content.uriParams = { id: input.transferId }

    message.to = message.from
    message.from = this.deps.config.HUB_NAME
    if (message.content.headers) {
      message.content.headers['fspiop-source'] = message.from
      message.content.headers['fspiop-destination'] = message.to
    }

    return {
      functionality: Type.NOTIFICATION,
      action: isTransferError ? Action.ABORT_DUPLICATE : Action.FULFIL_DUPLICATE,
      message,
      topicName: 'topic-notification-event',
      status: 'SUCCESS',
    }
  }

  private buildEffectFulfilDuplicateError(
    input: FulfilHandlerInput,
    fspiopError: any,
    isTransferError: boolean
  ): Effect {
    const message = structuredClone(input.message.value)
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)
    message.content.payload = apiFSPIOPError
    message.content.uriParams = { id: input.transferId }

    message.to = message.from
    message.from = this.deps.config.HUB_NAME
    if (message.content.headers) {
      message.content.headers['fspiop-source'] = message.from
      message.content.headers['fspiop-destination'] = message.to
    }

    return {
      functionality: Type.NOTIFICATION,
      action: isTransferError ? Action.ABORT_DUPLICATE : Action.FULFIL_DUPLICATE,
      message,
      topicName: 'topic-notification-event',
      status: 'FAILURE',
      fspiopError: apiFSPIOPError
    }
  }

  private async buildEffectPositionRollback(
    input: FulfilHandlerInput,
    transfer: any,
    error: {
      errorInformation: {
        errorCode: string,
        errorDescription: string,
      }
    },
    /**
     * If true, will use action=ABORT_VALIDATION, otherwise ABORT.
     */
    isValidationFailure: boolean = true
  ): Promise<Effect> {
    const cyrilResult = await fxService.Cyril.processAbortMessage(input.transferId)
    // If a payment has a linked forex, we first set its state to RECEIVED_ERROR otherwise the
    // position handler ignores the position reset.
    for (const positionChange of cyrilResult.positionChanges) {
      if (positionChange.isFxTransferStateChange) {
        await fxService.handleFulfilResponse(
          positionChange.commitRequestId,
          error,
          Action.FX_ABORT,
          error
        )
      }
    }

    const message = structuredClone(input.message.value)
    message.content.payload = error
    message.content.context = {
      ...message.content.context,
      cyrilResult
    }

    let messageKey: string
    if (cyrilResult.positionChanges.length > 0) {
      messageKey = cyrilResult.positionChanges[0].participantCurrencyId.toString()
    } else {
      // Fallback to payer account
      const payerAccount = await Participant.getAccountByNameAndCurrency(
        transfer.payerFsp,
        transfer.currency,
        Enum.Accounts.LedgerAccountType.POSITION
      )
      messageKey = payerAccount.participantCurrencyId.toString()
    }
    assert(messageKey)
    const action = isValidationFailure ? Action.ABORT_VALIDATION : Action.ABORT
    return {
      functionality: Type.POSITION,
      action,
      message,
      messageKey,
      topicName: 'topic-transfer-position-batch',
      status: 'FAILURE',
      fspiopError: error
    }
  }

  private buildEffectReservedAbortedNotification(
    input: FulfilHandlerInput,
    transfer: any
  ): Effect {
    const message = structuredClone(input.message.value)
    message.content.payload = {
      transferId: transfer.transferId,
      completedTimestamp: new Date().toISOString(),
      transferState: TransferState.ABORTED
    }
    message.content.uriParams = { id: input.transferId }

    message.to = transfer.payeeFsp
    message.from = this.deps.config.HUB_NAME
    if (message.content.headers) {
      message.content.headers['fspiop-source'] = message.from
      message.content.headers['fspiop-destination'] = message.to
    }

    return {
      functionality: Type.NOTIFICATION,
      action: Action.RESERVED_ABORTED,
      message,
      topicName: 'topic-notification-event',
      status: 'SUCCESS',
    }
  }

  /**
     * Iterate through all of the timed out payments, and emit notification and position effects.
     */
  private async paymentEffects(payments: Array<TimedOutTransfer>):
    Promise<Array<TimeoutResultPayment>> {
    return payments.map(payment => {
      if (payment.bulkTransferId) {
        throw new Error('TimeoutHandlerV2 - timeouts for bulk transfers not yet supported.')
      }

      switch (payment.transferStateId) {
        // Payment expired _before_ the position was reserved.
        case 'EXPIRED_PREPARED': {
          return {
            context: payment,
            effect: this.buildEffectPaymentTimeoutNotification(payment)
          }
        }
        // Payment expired _after_ the position was reserved.
        case 'RESERVED_TIMEOUT':
          return {
            context: payment,
            effect: this.buildEffectPaymentPositionTimeout(payment)
          }
        default: {
          throw new Error(`timeoutPaymentEffects - unhandled transferStateId: ${payment.transferStateId}`)
        }
      }
    })
  }

  private async forexEffects(forexes: Array<TimedOutFxTransfer>):
    Promise<Array<TimeoutResultPayment>> {
    return forexes.map(forex => {
      switch (forex.transferStateId) {
        // Payment expired _before_ the position was reserved.
        case 'EXPIRED_PREPARED': {
          return {
            context: forex,
            effect: this.buildEffectForexTimeoutNotification(forex)
          }
        }
        // Payment expired _after_ the position was reserved.
        case 'RESERVED_TIMEOUT':
          return {
            context: forex,
            effect: this.buildEffectForexPositionTimeout(forex)
          }
        default: {
          throw new Error(`timeoutForexEffects - unhandled transferStateId: ${forex.transferStateId}`)
        }
      }
    })
  }

  private async forwardedPaymentEffects(payments: Array<ForwardedTransfer>):
    Promise<Array<TimeoutResultPaymentForward>> {
    return payments.map(payment => {
      const effect: Effect = {
        functionality: Type.NOTIFICATION,
        action: Action.GET,
        message: this.buildForwardedPaymentMessage(payment),
        topicName: 'topic-notification-event',
        status: 'FAILURE',
        fspiopError: this.timeoutError
      }

      return {
        context: payment,
        effect,
      }
    })
  }

  private async forwardedForexEffects(forexes: Array<ForwardedFxTransfer>):
    Promise<Array<TimeoutResultPaymentForward>> {
    return forexes.map(forex => {
      const effect: Effect = {
        functionality: Type.NOTIFICATION,
        action: Action.GET,
        message: this.buildForwardedForexMessage(forex),
        topicName: 'topic-notification-event',
        status: 'FAILURE',
        fspiopError: this.timeoutError
      }

      return {
        context: forex,
        effect,
      }
    })
  }

  private buildEffectPaymentTimeoutNotification(payment: TimedOutTransfer): Effect {
    const effect: Effect = {
      functionality: Type.NOTIFICATION,
      action: Action.TIMEOUT_RECEIVED,
      message: this.buildTimeoutMessagePayment(payment),
      topicName: 'topic-notification-event',
      status: 'FAILURE',
      fspiopError: this.timeoutError
    }

    return effect
  }

  private buildEffectPaymentPositionTimeout(payment: TimedOutTransfer): Effect {
    return {
      functionality: Type.POSITION,
      action: Action.TIMEOUT_RESERVED,
      message: this.buildTimeoutMessagePayment(payment),
      messageKey: payment.effectedParticipantCurrencyId.toString(),
      topicName: 'topic-transfer-position-batch',
      status: 'FAILURE',
      fspiopError: this.timeoutError
    }
  }

  private buildEffectForexTimeoutNotification(forex: TimedOutFxTransfer): Effect {
    const effect: Effect = {
      functionality: Type.NOTIFICATION,
      action: Action.FX_TIMEOUT_RECEIVED,
      message: this.buildForexTimeoutMessage(forex),
      topicName: 'topic-notification-event',
      status: 'FAILURE',
      fspiopError: this.timeoutError
    }

    return effect
  }

  private buildEffectForexPositionTimeout(forex: TimedOutFxTransfer): Effect {
    return {
      functionality: Type.POSITION,
      action: Action.FX_TIMEOUT_RESERVED,
      message: this.buildForexTimeoutMessage(forex),
      messageKey: forex.effectedParticipantCurrencyId.toString(),
      topicName: 'topic-transfer-position-batch',
      status: 'FAILURE',
      fspiopError: this.timeoutError
    }
  }

  private buildTimeoutMessagePayment(payment: TimedOutTransfer) {
    const destination = payment.externalPayerName || payment.payerFsp
    const source = payment.externalPayeeName || payment.payeeFsp
    const transfersResource = Enum.Http.HeaderResources.TRANSFERS
    const contentVersion = resourceVersions[transfersResource].contentVersion

    const state = Util.StreamingProtocol.createEventState(
      Enum.Events.EventStatus.FAILURE.status,
      this.timeoutError.errorInformation.errorCode,
      this.timeoutError.errorInformation.errorDescription
    )
    const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(
      payment.transferId,
      Enum.Kafka.Topics.NOTIFICATION,
      Action.TIMEOUT_RECEIVED,
      state
    )
    const headers = Util.Http.SwitchDefaultHeaders(
      destination, transfersResource, this.deps.config.HUB_NAME, contentVersion
    )
    const message = Util.StreamingProtocol.createMessage(
      payment.transferId,
      destination,
      source,
      metadata,
      headers,
      this.timeoutError,
      { id: payment.transferId },
      `application/vnd.interoperability.${transfersResource}+json;version=${contentVersion}`
    )
    message.from = this.deps.config.HUB_NAME
    message.content.context = {
      payer: payment.externalPayerName || payment.payerFsp,
      payee: payment.externalPayeeName || payment.payeeFsp
    }

    return message
  }

  private buildForexTimeoutMessage(forex: TimedOutFxTransfer) {
    const destination = forex.externalInitiatingFspName || forex.initiatingFsp
    const source = forex.externalCounterPartyFspName || forex.counterPartyFsp
    const fxTransfersResource = Enum.Http.HeaderResources.FX_TRANSFERS
    const contentVersion = resourceVersions[fxTransfersResource].contentVersion

    const state = Util.StreamingProtocol.createEventState(
      Enum.Events.EventStatus.FAILURE.status,
      this.timeoutError.errorInformation.errorCode,
      this.timeoutError.errorInformation.errorDescription
    )
    const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(
      forex.commitRequestId,
      Enum.Kafka.Topics.NOTIFICATION,
      Action.FX_TIMEOUT_RECEIVED,
      state
    )
    const headers = Util.Http.SwitchDefaultHeaders(
      destination, fxTransfersResource, this.deps.config.HUB_NAME, contentVersion
    )
    const message = Util.StreamingProtocol.createMessage(
      forex.commitRequestId,
      destination,
      source,
      metadata,
      headers,
      this.timeoutError,
      { id: forex.commitRequestId },
      `application/vnd.interoperability.${fxTransfersResource}+json;version=${contentVersion}`
    )
    message.from = this.deps.config.HUB_NAME
    message.content.context = {
      payer: forex.externalInitiatingFspName || forex.initiatingFsp,
      payee: forex.externalCounterPartyFspName || forex.counterPartyFsp
    }

    return message
  }

  private buildForwardedPaymentMessage(payment: ForwardedTransfer) {
    const destination = payment.externalPayerName || payment.payeeFsp
    const source = payment.externalPayeeName || payment.payerFsp
    const transfersResource = Enum.Http.HeaderResources.TRANSFERS
    const contentVersion = resourceVersions[transfersResource].contentVersion

    const state = Util.StreamingProtocol.createEventState(
      Enum.Events.EventStatus.FAILURE.status,
      this.timeoutError.errorInformation.errorCode,
      this.timeoutError.errorInformation.errorDescription
    )
    const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(
      payment.transferId,
      Enum.Kafka.Topics.NOTIFICATION,
      Action.GET,
      state
    )
    const headers = Util.Http.SwitchDefaultHeaders(
      destination, transfersResource, source, contentVersion
    )
    const message = Util.StreamingProtocol.createMessage(
      payment.transferId,
      destination,
      source,
      metadata,
      headers,
      null,
      { id: payment.transferId },
      `application/vnd.interoperability.${transfersResource}+json;version=${contentVersion}`
    )
    message.from = this.deps.config.HUB_NAME

    return message
  }

  private buildForwardedForexMessage(forex: ForwardedFxTransfer) {
    const destination = forex.externalCounterPartyFspName || forex.counterPartyFsp
    const source = forex.externalInitiatingFspName || forex.initiatingFsp
    const fxTransfersResource = Enum.Http.HeaderResources.FX_TRANSFERS
    const contentVersion = resourceVersions[fxTransfersResource].contentVersion

    const state = Util.StreamingProtocol.createEventState(
      Enum.Events.EventStatus.FAILURE.status,
      this.timeoutError.errorInformation.errorCode,
      this.timeoutError.errorInformation.errorDescription
    )
    const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(
      forex.commitRequestId,
      Enum.Kafka.Topics.NOTIFICATION,
      Action.GET,
      state
    )
    const headers = Util.Http.SwitchDefaultHeaders(
      destination, fxTransfersResource, source, contentVersion
    )
    const message = Util.StreamingProtocol.createMessage(
      forex.commitRequestId,
      destination,
      source,
      metadata,
      headers,
      null,
      { id: forex.commitRequestId },
      `application/vnd.interoperability.${fxTransfersResource}+json;version=${contentVersion}`
    )
    message.from = this.deps.config.HUB_NAME

    return message
  }

  /**
   * Validate the payment for a simple Payment with no 'determiningTransfers'.
   */
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

    // TODO: I think there should be a check for determiningTransferCheckResult
    // watch list? But that feels like it doesn't belong here.

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
   * Validate the payment for a simple Payment _with_ 'determiningTransfers'.
   */
  private async validatePayloadLinkedPayment(
    payload: CreatePaymentDto,
    determiningTransferCheckResult: TransferDeterminingCheckResult,
  ): Promise<{
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
   * @description Figure out if the participants in the Payment message are native to the scheme
   * or are proxies.
   */
  private async calculateProxyObligation(payload: CreatePaymentDto):
    Promise<TransferProxyObligation> {
    // If the proxy isn't enabled, just return the default.
    if (!this.deps.config.PROXY_CACHE_CONFIG.enabled) {
      return {
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
      }
    }

    // We need to double check the following validation logic incase of payee side currency
    // conversion.
    const payerResult = await this.deps.proxyCache.getFSPProxy(payload.payerFsp)
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

    // Validate the not found case.
    if (payerResult.inScheme === false && payerResult.proxyId === null) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND,
        `Payer proxy or participant not found: payer: ${payload.payerFsp}.`
      )
      throw fspiopError
    }
    if (payeeResult.inScheme === false && payeeResult.proxyId === null) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND,
        `Payee proxy or participant not found: payee: ${payload.payeeFsp}.`
      )
      throw fspiopError
    }

    const isInitiatingFspProxy = !payerResult.inScheme && payerResult.proxyId !== null
    const isCounterPartyFspProxy = !payeeResult.inScheme && payeeResult.proxyId !== null

    return {
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
        legacyQuery.fromDateTime = query.fromDateTime.toISOString()
      }
      if (query.toDateTime) {
        legacyQuery.toDateTime = query.toDateTime.toISOString()
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
      if (!legacyWindow) {
        return {
          type: 'NOT_FOUND',
          error: new Error(`Settlement window not found for id: ${query.id}.`)
        }
      }
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
        fromDateTime: query.fromDateTime?.toISOString(),
        toDateTime: query.toDateTime?.toISOString(),
        fromSettlementWindowDateTime: query.fromSettlementWindowDateTime?.toISOString(),
        toSettlementWindowDateTime: query.toSettlementWindowDateTime?.toISOString(),
      }

      const result = await SettlementDomain.getSettlementsByParams(
        { query: legacyQuery },
        this.deps.enums
      )

      // @ts-ignore TODO: remove settlementModel from response.
      const settlements: Settlement[] = result.map(settlement => ({
        id: settlement.id,
        // settlementModel: settlement.settlementModel,
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
