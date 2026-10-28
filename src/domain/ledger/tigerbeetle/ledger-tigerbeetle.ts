import { Enum, EventActionEnum, Util } from '@mojaloop/central-services-shared';
import assert, { fail } from "node:assert";
import {
  AccountFilterFlags,
  AccountFlags,
  amount_max,
  Client,
  CreateAccountStatus,
  CreateTransferResult,
  CreateTransferStatus,
  id,
  QueryFilterFlags,
  Transfer,
  TransferFlags
} from 'tigerbeetle-node';
import {
  FulfilHandlerInput,
  PaymentFulfilResult,
  PaymentFulfilResultType
} from '../../../handlers/payment-fulfil';
import {
  PaymentPrepareResult,
  PaymentPrepareResultType,
  PrepareHandlerInput
} from "../../../handlers/payment-prepare";
import { ApplicationConfig, resetOverride } from "../../../lib/config";
import { assertBoolean, assertOneOf, convertBigIntToNumber } from '../../../lib/config/util';
import { logger } from "../../../shared/logger";
import * as Result from '../shared/results';
import {
  AccountCode,
  AnyQuery,
  CommandResult,
  CreateDfspCommand,
  CreateDfspResponse,
  CreateHubAccountCommand,
  CreateHubAccountResponse,
  DeactivateDfspResponse,
  DeactivateDfspResponseType,
  DepositCommand,
  DepositResponse,
  DfspAccountResponse,
  Enums,
  GetAllDfspAccountsQuery,
  GetAllDfspsResponse,
  GetDfspAccountsQuery,
  GetNetDebitCapQuery,
  GetNetDebitCapsQuery,
  GetSettlementQuery,
  GetSettlementsQuery,
  GetSettlementsQueryResponse,
  GetSettlementWindowQuery,
  GetSettlementWindowsQuery,
  GetSettlementWindowsQueryResponse,
  HubAccountResponse,
  Ledger,
  LedgerAccount,
  LegacyLedgerAccount,
  LegacyLedgerAccountNoValue,
  LegacyLedgerDfsp,
  LegacyLimit,
  LegacyLimitItem,
  LookupTransferQuery,
  LookupTransferQueryResponse,
  LookupTransferResultType,
  PayloadFinalizedTransfer,
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
  SweepResult,
  TransferCode,
  WithdrawAbortCommand,
  WithdrawAbortResponse,
  WithdrawCommitCommand,
  WithdrawCommitResponse,
  WithdrawPrepareCommand,
  WithdrawPrepareResponse
} from "../shared/types";
const { TransferState } = Enum.Transfers

import SettlementDomain from '../../settlement';
import { CloseDfspMasterAccountFailureType, DepositFailureType, DisableDfspAccountFailureType, EnableDfspAccountFailureType, FulfilFailureType, FulfilInternalStatus, default as Helper, default as LedgerTigerBeetleHelper, PrepareFailureType, PrepareInternalStatus, SetNetDebitCapFailureType, TransferFailureResult, WithdrawAbortFailureType, WithdrawCommitFailureType, WithdrawPrepareFailureType } from './helper';
import SpecStore, { CmdHubCurrencyEnable, ContextDfsps, ContextFulfil, ContextPayments, CurrencyConfig, DfspCurrency, DfspRoot, GetSpecTransferResult, InternalDfspCurrency, InternalDfspRoot, NetDebitCap, SpecPrepare, SpecTransfer, SpecTransferCreate, SpecTransferUpdate } from './spec-store';
import { currencyList } from '../../../seeds/currency';
import { Reporter } from '../shared/reporter';

const ErrorHandler = require('@mojaloop/central-services-error-handling')

interface Dependencies {
  config: ApplicationConfig
  client: Client,
  helper: Helper,
  enums: Enums,
  specStore: SpecStore,
}


export class LedgerTigerBeetle implements Ledger {
  private readonly config: ApplicationConfig
  private readonly client: Client
  private readonly helper: Helper
  private specStore: SpecStore

  constructor(private deps: Dependencies) {
    this.config = deps.config
    this.client = deps.client
    this.helper = deps.helper
    this.specStore = deps.specStore
  }

  /**
   * In the TigerBeetle Representation of the Ledger, there are no 'Hub' Accounts, since the Hub is
   * implied. Previous handled the Hub as another participant. We _do_ however need to keep track of
   * the settlement models that have been created, and the currencies enabled by the switch.
   */
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
      await this.specStore.validateCurrency(cmd.currency)

      const cmdEnableHubCurrency: CmdHubCurrencyEnable = {
        currency: cmd.currency,
        accountTypes: cmd.accountType ? [
          cmd.accountType
        ] : [],
        accountIds: cmd.ids
      }
      const enableHubCurrencyResponse = await this.specStore.enableHubCurrency(cmdEnableHubCurrency)

      if (enableHubCurrencyResponse.type === 'FAILURE') {
        throw enableHubCurrencyResponse.error
      }

      if (enableHubCurrencyResponse.type === 'EXISTS') {
        return {
          type: 'ALREADY_EXISTS_HUB_ACCOUNT'
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

  /**
   * @method createDfsp
   * @description Create the accounts for the (Dfsp, Currency). If the Dfsp hasn't been created
   * before, it sets up the DfspRoot and DfspCurrency.
   */
  public async createDfsp(cmd: CreateDfspCommand): Promise<CreateDfspResponse> {
    assert(cmd.dfspId)
    assert(cmd.currencies)
    assert(cmd.currencies.length > 0)
    assert.equal(cmd.currencies.length, 1, 'Currently only 1 currency is supported')
    const currency = cmd.currencies[0]
    assertBoolean(cmd.isProxy)

    if (!cmd.ids) {
      const idsToCreate = cmd.currencies.length * 10
      cmd.ids = Array.from({ length: idsToCreate }, (_) => Number(this.deps.helper.idSmall()))
    }
    try {
      await this.specStore.assertCurrenciesEnabled(cmd.currencies)
      await this.specStore.assertHubAccountsCreatedForCurrencies(cmd.currencies)

      // Get or create the specDfsp.
      await this.specStore.getOrCreateDfspRoot(cmd.dfspId, cmd.isProxy, this.deps.helper.idSmall())
      const resultDfspCurrency = await this.specStore.getDfspCurrency(cmd.dfspId, currency)

      if (resultDfspCurrency.type === 'FAILURE') {
        return resultDfspCurrency
      }

      // Lookup accounts in TigerBeetle, ensure they exist.
      if (resultDfspCurrency.type === 'SUCCESS') {
        const spec = resultDfspCurrency.result
        const accounts = await this.deps.client.lookupAccounts([
          spec.deposit,
          spec.unrestricted,
          spec.unrestrictedLock,
          spec.restricted,
          spec.reserved,
          spec.commitedOutgoing,
        ])
        // TODO: it's probably safe to create them now.
        if (accounts.length !== 6) {
          throw new Error(`Found existing dfsp: ${cmd.dfspId} for currency: ${currency}. `
            + `But found only ${accounts.length} in TigerBeetle.`)
        }

        // Already exists.
        return {
          type: 'ALREADY_EXISTS'
        }
      }

      return this.createDfspAccounts(cmd.dfspId, currency, cmd.ids)
    } catch (err: any) {
      logger.error(`createDfsp() failed with error: ${err.message}`)
      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  private async createDfspAccounts(id: string, currency: string, ids: Array<number>): Promise<CreateDfspResponse> {
    try {
      // First we create the DfspCurrency.
      const dfspCurrency = await this.specStore.createDfspCurrency(id, currency, new Date(), ids)
      const dfspRoot = await this.specStore.getDfspRoot(id)
      const currencyConfig = await this.specStore.getCurrencyConfig(currency)

      const accounts = this.helper.buildAccountsDfsp(
        dfspCurrency, currencyConfig, dfspRoot.id
      )
      const createAccountResults = await this.client.createAccounts(accounts)
      let fatal = false
      const readableErrors: Array<any> = []
      createAccountResults.forEach((result, idx) => {
        // Ignore these.
        if (result.status === CreateAccountStatus.linked_event_failed) return
        if (result.status === CreateAccountStatus.created) return
        if (result.status === CreateAccountStatus.exists) return
        // This is fine, the 'different flags' could be closed.
        if (result.status === CreateAccountStatus.exists_with_different_flags) return

        // If the master account was already created, then by definition it exists with a different
        // user_data_64.
        if (idx === 3 &&
          result.status === CreateAccountStatus.exists_with_different_user_data_64) return

        readableErrors.push(CreateAccountStatus[result.status])
        const failedAccount = accounts[idx]
        console.error(`Batch account at ${idx} failed to create: ${CreateAccountStatus[result.status]}.\n`
          + `Failed account: ${LedgerTigerBeetleHelper.stringify(failedAccount)}.`
        )
        fatal = true
      })

      if (fatal) {
        return {
          type: 'FAILURE',
          error: new Error(`LedgerError: ${readableErrors.join(',')}`)
        }
      }

      return {
        type: 'SUCCESS'
      }
    } catch (error: any) {
      return {
        type: 'FAILURE',
        error
      }
    }
  }

  public async disableDfsp(cmd: { dfspId: string; }): Promise<CommandResult<void>> {
    assert(cmd)
    assert(cmd.dfspId)

    try {
      const dfspRoot = await this.specStore.getDfspRoot(cmd.dfspId)
      let closeAccountResult = await this.closeDfspMasterAccount(dfspRoot.id)

      if (closeAccountResult.type === DeactivateDfspResponseType.CREATE_ACCOUNT) {
        await this.createAccountDevNull()
        closeAccountResult = await this.closeDfspMasterAccount(dfspRoot.id)

        if (closeAccountResult.type === DeactivateDfspResponseType.CREATE_ACCOUNT) {
          throw new Error(`Failed to closeDfspMasterAccount again with no DevNull account!`)
        }
      }

      if (closeAccountResult.type === DeactivateDfspResponseType.FAILED) {
        return Result.commandResultFailure(closeAccountResult.error)
      }

      return Result.emptyCommandResultSuccess()
    } catch (err) {
      return Result.commandResultFailure(err)
    }
  }

  private async closeDfspMasterAccount(masterAccountId: bigint): Promise<DeactivateDfspResponse> {
    // Create a closing transfer to mark this Dfsp as deactivated
    const closingTransfer: Transfer = {
      ...Helper.createTransferTemplate,
      id: id(),
      debit_account_id: Helper.accountIds.devNull,
      credit_account_id: masterAccountId,
      amount: 0n,
      ledger: Helper.ledgerIds.globalControl,
      code: 100,
      flags: TransferFlags.closing_credit | TransferFlags.pending,
    }
    const transferResults = await this.deps.client.createTransfers([closingTransfer])
    const fatalErrors: Array<TransferFailureResult<CloseDfspMasterAccountFailureType>> = []
    transferResults.forEach((result, idx) => {
      if (idx === 0) {
        switch (result.status) {
          case CreateTransferStatus.created: return
          case CreateTransferStatus.debit_account_not_found:
            // In this case, the devNull account hasn't been created yet.
            fatalErrors.push({ type: 'DEBIT_ACCOUNT_NOT_FOUND', ...result })
            return
          case CreateTransferStatus.credit_account_already_closed:
            fatalErrors.push({ type: 'ALREADY_CLOSED', ...result })
            return
          default:
            fatalErrors.push({ type: 'UNKNOWN', ...result })
            return
        }
      }

      throw new Error(`Unhandled createTransfers result at ${idx}, ${CreateTransferStatus[result.status]}`)
    })

    if (fatalErrors.length === 0) {
      return {
        type: DeactivateDfspResponseType.SUCCESS
      }
    }

    const firstError = fatalErrors[0]
    switch (firstError.type) {
      case 'DEBIT_ACCOUNT_NOT_FOUND':
        return {
          type: DeactivateDfspResponseType.CREATE_ACCOUNT
        }
      case 'ALREADY_CLOSED':
        return {
          type: DeactivateDfspResponseType.ALREADY_CLOSED
        }
      case 'UNKNOWN':
        return {
          type: DeactivateDfspResponseType.FAILED,
          error: new Error(`closeDfspMasterAccount failed with unexpected error: `
            + `${CreateTransferStatus[firstError.status]}`)
        }
    }
  }

  /**
   * Lazy creation of the devNull account. Used as a counterparty for things such as closing
   * dfsp master accounts.
   */
  private async createAccountDevNull(): Promise<void> {
    const result = await this.deps.client.createAccounts([
      {
        ...LedgerTigerBeetleHelper.createAccountTemplate,
        id: LedgerTigerBeetleHelper.accountIds.devNull,
        ledger: LedgerTigerBeetleHelper.ledgerIds.globalControl,
        code: AccountCode.Dev_Null,
        flags: 0,
      }
    ])
    const fatalErrors = result.map((result, idx) => {
      if (result.status === CreateAccountStatus.exists) return
      if (result.status === CreateAccountStatus.created) return

      return `createAccounts at idx: ${idx} failed with error: ${CreateAccountStatus[result.status]}.`
    }).filter(status => status !== undefined)

    if (fatalErrors.length > 0) {
      throw new Error(`createAccountDevNull - failed to create counterparty account with error: ` +
        `[${fatalErrors.join(', ')}]`)
    }
  }

  public async enableDfsp(cmd: { dfspId: string; }): Promise<CommandResult<void>> {
    assert(cmd)
    assert(cmd.dfspId)

    try {
      const dfspRoot = await this.specStore.getDfspRoot(cmd.dfspId)
      const transfers = await this.deps.client.getAccountTransfers({
        account_id: dfspRoot.id,
        user_data_128: 0n,
        user_data_64: 0n,
        user_data_32: 0,
        code: 0,
        timestamp_min: 0n,
        timestamp_max: 0n,
        limit: 10,
        flags: AccountFilterFlags.credits |
          AccountFilterFlags.reversed,
      })

      if (transfers.length === 0) {
        // Account isn't closed, return success.
        return {
          type: 'SUCCESS'
        }
      }

      // Get the the closing transfer and void it.
      const lastClosingTransferId = transfers[0].id
      const createTransferResults = await this.deps.client.createTransfers([{
        ...LedgerTigerBeetleHelper.createTransferTemplate,
        id: id(),
        debit_account_id: 0n,
        credit_account_id: 0n,
        pending_id: lastClosingTransferId,
        amount: 0n,
        ledger: LedgerTigerBeetleHelper.ledgerIds.globalControl,
        code: 0,
        flags: TransferFlags.void_pending_transfer
      }])

      assert.equal(createTransferResults.length, 1, 'expected just 1 transferError result')
      const result = createTransferResults[0]
      switch (result.status) {
        case CreateTransferStatus.created:
        // Pending closing transfer has already been voided, so the account must be open!
        case CreateTransferStatus.pending_transfer_not_pending:
        case CreateTransferStatus.pending_transfer_already_voided:
          return {
            type: 'SUCCESS'
          }
        default:
          return {
            type: 'FAILURE',
            error: new Error(`enableDfsp failed to void closing transfer with error: `
              + `${CreateTransferStatus[result.status]}`)
          }
      }
    } catch (err) {
      return Result.commandResultFailure(err)
    }
  }

  public async enableDfspAccount(cmd: { dfspId: string; accountId: number; }): Promise<CommandResult<void>> {
    assert(cmd)
    assert(cmd.dfspId)
    assert(typeof cmd.accountId === 'number')
    const accountId = BigInt(cmd.accountId)

    try {
      // Only the Deposit and Unrestricted Accounts can be enabled/disabled
      const dfspCurrencies = await this.specStore.getDfspCurrencies(cmd.dfspId)
      if (dfspCurrencies.length === 0) {
        return {
          type: 'FAILURE',
          error: new Error(`enableDfspAccount() - dfsp: ${cmd.dfspId} not found.`)
        }
      }

      const { currency, code } = await this.specStore.lookupDfspCurrencyByAccountId(cmd.dfspId, accountId)
      switch (code) {
        case AccountCode.Unrestricted:
          break;
        default:
          return {
            type: 'FAILURE',
            error: new Error(`enableDfspAccount() - account id not found, or is not Unrestricted.`)
          }
      }

      const currencyConfig = await this.specStore.getCurrencyConfig(currency.currency)
      // Look up the closing transfer to void it.
      const closingTransfers = (await this.deps.client.getAccountTransfers({
        account_id: accountId,
        user_data_128: 0n,
        user_data_64: 0n,
        user_data_32: 0,
        code: TransferCode.Close_Account,
        timestamp_min: 0n,
        timestamp_max: 0n,
        limit: 10,
        flags: AccountFilterFlags.credits |
          AccountFilterFlags.reversed,
      })).filter(transfer => transfer.flags & TransferFlags.closing_credit)

      if (closingTransfers.length === 0) {
        // no transfers found, therefore this account must not be closed
        // treat is as successful
        return {
          type: 'SUCCESS'
        }
      }
      const lastClosingTransfer = closingTransfers[0]
      // Void the closing transfer to reopen this account.
      const voidClosingTransfer: Transfer = {
        ...LedgerTigerBeetleHelper.createTransferTemplate,
        id: id(),
        pending_id: lastClosingTransfer.id,
        debit_account_id: currency.unrestrictedLock,
        credit_account_id: currency.unrestricted,
        amount: 0n,
        ledger: currencyConfig.idOperation,
        code: TransferCode.Close_Account,
        flags: TransferFlags.void_pending_transfer
      }
      const transferResults = await this.deps.client.createTransfers([voidClosingTransfer])
      const fatalErrors: Array<TransferFailureResult<EnableDfspAccountFailureType>> = []

      transferResults.forEach((result, idx) => {
        if (idx === 0) {
          switch (result.status) {
            case CreateTransferStatus.created:
            case CreateTransferStatus.pending_transfer_already_voided:
              return
            default:
              fatalErrors.push({ type: 'UNKNOWN', ...result })
              return
          }
        }

        throw new Error(`Unhandled transfer error: ${idx}, ${CreateTransferStatus[result.status]}.`)
      })

      return Helper.successEmpty()
    } catch (err: any) {
      return Helper.failure(err)
    }
  }

  public async disableDfspAccount(cmd: { dfspId: string; accountId: number; }): Promise<CommandResult<void>> {
    assert(cmd)
    assert(cmd.dfspId)
    assert(typeof cmd.accountId === 'number')
    const accountId = BigInt(cmd.accountId)

    try {
      // Only the Deposit and Unrestricted Accounts can be enabled/disabled
      const dfspCurrencies = await this.specStore.getDfspCurrencies(cmd.dfspId)
      if (dfspCurrencies.length === 0) {
        return {
          type: 'FAILURE',
          error: new Error(`enableDfspAccount() - dfsp: ${cmd.dfspId} not found.`)
        }
      }

      const { currency, code } = await this.specStore.lookupDfspCurrencyByAccountId(cmd.dfspId, accountId)
      switch (code) {
        case AccountCode.Unrestricted:
          break;
        default:
          return {
            type: 'FAILURE',
            error: new Error(`disableDfspAccount() - Only Unrestricted account update is permitted.`)
          }
      }

      const currencyConfig = await this.specStore.getCurrencyConfig(currency.currency)

      // Create a closing transfer to mark this Account as deactivated
      const closingTransfer: Transfer = {
        ...LedgerTigerBeetleHelper.createTransferTemplate,
        id: id(),
        debit_account_id: currency.unrestrictedLock,
        credit_account_id: currency.unrestricted,
        amount: 0n,
        ledger: currencyConfig.idOperation,
        code: TransferCode.Close_Account,
        flags: TransferFlags.closing_credit | TransferFlags.pending,
      }
      const transferResults = await this.deps.client.createTransfers([closingTransfer])
      const fatalErrors: Array<TransferFailureResult<DisableDfspAccountFailureType>> = []

      transferResults.forEach((result, idx) => {
        if (idx === 0) {
          switch (result.status) {
            case CreateTransferStatus.created:
            case CreateTransferStatus.credit_account_already_closed:
              return
            default:
              fatalErrors.push({ type: 'UNKNOWN', ...result })
              return
          }
        }

        throw new Error(`unhandled transfer error: ${idx}, ${CreateTransferStatus[result.status]}`)
      })

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
   * Get a list of all the CurrencyConfigs registered on the Ledger.
   */
  public async getCurrencyConfigs(): Promise<Array<CurrencyConfig>> {
    const currencyConfigs = await this.specStore.getCurrencyConfigsMap()
    return Object.values(currencyConfigs)
  }

  /**
   * Look up the net debit cap for the dfsp + currency based on the last credit transfer to the 
   * net debit cap control account.
   */
  private async getInternalNetDebitCap(dfspId: string, currency: string):
    Promise<QueryResultWithNotFound<NetDebitCap>> {
    const dfspCurrencyResult = await this.specStore.getDfspCurrency(dfspId, currency)
    if (dfspCurrencyResult.type !== 'SUCCESS') {
      return dfspCurrencyResult
    }

    const dfspCurrency = dfspCurrencyResult.result

    // Lookup the last transfer to the net debit cap account.
    const transfers = await this.deps.client.getAccountTransfers({
      account_id: dfspCurrency.netDebitCap,
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: 0,
      code: TransferCode.Set_Net_Debit_Cap,
      timestamp_min: 0n,
      timestamp_max: 0n,
      limit: 10,
      flags: AccountFilterFlags.credits |
        AccountFilterFlags.reversed,
    })

    if (transfers.length === 0) {
      // throw new Error(`No net debit cap found for dfspId: ${dfspId}, ${currency}.`)
      // If no Net Debit Cap is explicitly set, we assume it is unlimited.
      return {
        type: 'SUCCESS',
        result: {
          type: 'UNLIMITED',
          dfspId,
          currency,
        }
      }
    }


    const last = transfers[0]
    // 1 = LIMITED,  0 = UNLIMITED.
    if (last.user_data_32 === 0) {
      return {
        type: 'SUCCESS',
        result: {
          type: 'UNLIMITED',
          dfspId,
          currency,
        }
      }
    }
    assert(last.user_data_32 === 1, 'Expected last.user_data_32 to be either 1 or 0.')
    const alarmPercentage = convertBigIntToNumber(last.user_data_64)
    const amount = last.amount
    return {
      type: 'SUCCESS',
      result: {
        type: 'LIMITED',
        dfspId,
        currency,
        alarmPercentage,
        amount
      }
    }
  }

  private hydrateNetDebitCap(dfspCurrency: DfspCurrency, transfer: Transfer): NetDebitCap {
    if (transfer.user_data_32 === 0) {
      return {
        type: 'UNLIMITED',
        dfspId: dfspCurrency.dfspId,
        currency: dfspCurrency.currency,
      }
    }

    assert(transfer.user_data_32 === 1, 'Expected last.user_data_32 to be either 1 or 0.')
    const alarmPercentage = convertBigIntToNumber(transfer.user_data_64)
    const amount = transfer.amount
    return {
      type: 'LIMITED',
      dfspId: dfspCurrency.dfspId,
      currency: dfspCurrency.currency,
      alarmPercentage,
      amount,
    }
  }

  // TODO: this really should be called a 'Payment' to avoid confusion elsewhere.
  private hydrateTransfer(transfer: Transfer, spec: SpecTransfer): PayloadFinalizedTransfer {
    // Finalized burned prepare.
    if (transfer.code === TransferCode.Clearing_Burn_Id) {
      const timestamp = transfer.user_data_64
      const completedTimestamp = new Date(Number(timestamp))
      // Backwards compatibilty - MySQL stores timestamp to seconds precision.
      completedTimestamp.setMilliseconds(0)

      return {
        completedTimestamp,
        transferState: 'ABORTED'
      }
    }

    assert.equal(transfer.code, TransferCode.Clearing_Active_Check, 'Invalid transfer code.')

    // If we have a spec fulfilment, then we know the Payment is complete.
    // Ideally we would be able to check the TigerBeetle payment status.
    if (spec.fulfilment) {
      return {
        fulfilment: spec.fulfilment,
        // TODO: figure out where to get this date, ideally it comes from TigerBeetle.
        // Although it is an application date....
        completedTimestamp: new Date(),
        transferState: 'COMMITTED'
      }
    }

    throw new Error('Lewis didnt finish implementing me yet!')
  }

  /**
   * If we don't have the spec, we still have enough information to imply an aborted Payment.
   */
  private hydrateTransferPartial(transfer: Transfer): PayloadFinalizedTransfer {
    assert(transfer.code === TransferCode.Clearing_Burn_Id)
    if (transfer.code === TransferCode.Clearing_Burn_Id) {
      const timestamp = transfer.user_data_64
      const completedTimestamp = new Date(Number(timestamp))
      // Backwards compatibilty - MySQL stores timestamp to seconds precision.
      completedTimestamp.setMilliseconds(0)

      return {
        completedTimestamp,
        transferState: 'ABORTED'
      }
    }

    throw new Error('Lewis didnt finish implementing me yet!')
  }

  /**
   * Returns a map of 'dfspId:currency' => NetDebitCap.
   */
  private async getInternalNetDebitCaps(): Promise<Record<string, NetDebitCap>> {
    // Breadth first - query for all Set_Net_Debit_Cap Transfers. 
    const transfers = await this.client.queryTransfers({
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: 0,
      ledger: 0,
      code: TransferCode.Set_Net_Debit_Cap,
      timestamp_min: 0n,
      timestamp_max: 0n,
      limit: 8000,
      flags: QueryFilterFlags.reversed
    })

    if (transfers.length === 8000) {
      throw new Error(`Not Implemented: Could not find all NetDebitCap transfers.` +
        `We now need to go through each dfsp+currency.`)
    }

    const netDebitCapAccountIdSet: Set<bigint> = new Set()
    const lastTransferMap: Record<string, Transfer> = {}
    transfers.forEach(transfer => {
      if (!netDebitCapAccountIdSet.has(transfer.credit_account_id)) {
        lastTransferMap[transfer.credit_account_id.toString()] = transfer
        netDebitCapAccountIdSet.add(transfer.credit_account_id)
      }
    })

    // Get unique accountIds.
    const netDebitCapAccountIds = [...netDebitCapAccountIdSet]
    // Now lookup the DfspCurrency for these account ids.
    const dfspCurrencies = await this.specStore.dfspCurrenciesForNetDebitCapAccountIds(netDebitCapAccountIds)

    const results: Record<string, NetDebitCap> = {}
    Object.entries(dfspCurrencies).forEach(([id, dfspCurrency]) => {
      const lastTransfer = lastTransferMap[id]
      assert(lastTransfer, `No lastTransfer found for id: ${id}.`)

      const dfspCurrencyKey = `${dfspCurrency.dfspId}:${dfspCurrency.currency}`
      results[dfspCurrencyKey] = this.hydrateNetDebitCap(dfspCurrency, lastTransfer)
    })

    return results
  }

  public async deposit(cmd: DepositCommand): Promise<DepositResponse> {
    assert(cmd.amount)
    assert(cmd.currency)
    assert(cmd.dfspId)
    assert(cmd.transferId)
    assert(cmd.reason)

    try {
      // Backwards compatibility - first check if the Dfsp exists.
      try {
        await this.specStore.getDfspRoot(cmd.dfspId)
      } catch (err) {
        return {
          type: 'NOT_FOUND'
        }
      }

      // Lookup the net debit cap.
      const netDebitCapResult = await this.getInternalNetDebitCap(cmd.dfspId, cmd.currency)
      if (netDebitCapResult.type === 'NOT_FOUND') {
        return { type: 'NOT_FOUND' }
      }
      if (netDebitCapResult.type === 'FAILURE') {
        return Helper.failure(netDebitCapResult.error)
      }
      const netDebitCap = netDebitCapResult.result
      const dfspCurrencyResult = await this.deps.specStore.getDfspCurrency(cmd.dfspId, cmd.currency)
      if (dfspCurrencyResult.type === 'NOT_FOUND') {
        return {
          type: 'NOT_FOUND'
        }
      }
      if (dfspCurrencyResult.type === 'FAILURE') {
        throw dfspCurrencyResult.error
      }
      const dfspCurrency = dfspCurrencyResult.result
      const currency = await this.deps.specStore.getCurrencyConfig(cmd.currency)

      // Save the funding spec before writing to TigerBeetle (write last, read first).
      await this.deps.specStore.saveFundingSpec([{
        transferId: cmd.transferId,
        dfspId: cmd.dfspId,
        currency: cmd.currency,
        action: 'DEPOSIT',
        reason: cmd.reason
      }])

      // const reporter = new Reporter({ledger: this, config: this.config})
      // const bsPre = await reporter.balanceSheet(new Date())
      // console.log("bsPre is \n" + bsPre.toTAccounts([cmd.dfspId], [cmd.currency]))

      let netDebitCapLockAmount = amount_max
      if (netDebitCap.type === 'LIMITED') {
        netDebitCapLockAmount = netDebitCap.amount
      }
      const transfers = this.helper.buildTransfersDeposit(
        cmd.transferId, cmd.amount, netDebitCap, dfspCurrency, currency
      )

      const createTransfersResults = await this.deps.client.createTransfers(transfers)
      const fatalErrors: Array<TransferFailureResult<DepositFailureType>> = []

      createTransfersResults.forEach((result, idx) => {
        // Ignore noisy errors
        if (result.status === CreateTransferStatus.linked_event_failed) return
        if (result.status === CreateTransferStatus.created) return

        if (idx === 0) {
          switch (result.status) {
            case CreateTransferStatus.exists:
              fatalErrors.push({ type: 'EXISTS', ...result })
              return
            case CreateTransferStatus.credit_account_already_closed:
              fatalErrors.push({ type: 'CLOSED', ...result })
              return
            case CreateTransferStatus.exists_with_different_flags:
            case CreateTransferStatus.exists_with_different_pending_id:
            case CreateTransferStatus.exists_with_different_timeout:
            case CreateTransferStatus.exists_with_different_debit_account_id:
            case CreateTransferStatus.exists_with_different_credit_account_id:
            case CreateTransferStatus.exists_with_different_amount:
            case CreateTransferStatus.exists_with_different_user_data_128:
            case CreateTransferStatus.exists_with_different_user_data_64:
            case CreateTransferStatus.exists_with_different_user_data_32:
            case CreateTransferStatus.exists_with_different_ledger:
            case CreateTransferStatus.exists_with_different_code:
              fatalErrors.push({ type: 'MODIFIED', ...result })
              return
          }
        }

        throw new Error(`unhandled transfer error: ${idx}, ${CreateTransferStatus[result.status]}`)
      })

      if (fatalErrors.length > 0) {
        const firstError = fatalErrors[0]
        switch (firstError.type) {
          case 'EXISTS':
            return {
              type: 'ALREADY_EXISTS'
            }
          case 'MODIFIED':
            return {
              type: 'FAILURE',
              error: new Error(`deposit failed - transfer already exists with different parameters`)
            }
          case 'CLOSED':
            return {
              type: 'FAILURE',
              error: new Error(`deposit failed - the dfsp account is closed.`)
            }
          case 'UNKNOWN':
            return {
              type: 'FAILURE',
              error: new Error(`deposit failed with error: ${CreateTransferStatus[firstError.status]}`)
            }
        }
      }

      // const bsPost = await reporter.balanceSheet(new Date())
      // console.log("bsPost is \n" + bsPost.toTAccounts([cmd.dfspId], [cmd.currency]))

      // Backwards compatibility: Keep track of last deposit time in specStore.
      await this.deps.specStore.updateChangedDateSettlement(
        cmd.dfspId, cmd.currency, new Date()
      )

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

  public async withdrawPrepare(cmd: WithdrawPrepareCommand): Promise<WithdrawPrepareResponse> {
    assert(cmd.transferId)
    assert(cmd.currency)
    assert(cmd.dfspId)
    assert(cmd.amount)
    assert(cmd.reason)
    try {
      // TODO: make all these lookups atomic!
      const spec = await this.specStore.getDfspCurrency(cmd.dfspId, cmd.currency)
      if (spec.type === 'NOT_FOUND') {
        return Helper.failure(new Error(`No dfspCurrency found for dfsp: ${cmd.dfspId}, ${cmd.currency}.`))
      }
      if (spec.type === 'FAILURE') {
        return Helper.failure(spec.error)
      }
      const currency = await this.specStore.getCurrencyConfig(cmd.currency)
      const netDebitCapResult = await this.getInternalNetDebitCap(cmd.dfspId, cmd.currency)
      const dfspRoot = await this.specStore.getDfspRoot(cmd.dfspId)

      if (netDebitCapResult.type !== 'SUCCESS') {
        return Helper.failure(netDebitCapResult.error)
      }
      const netDebitCap = netDebitCapResult.result

      // Save the funding metadata before writing to TigerBeetle (write last, read first)
      // await this.specStore.saveFundingSpec()
      const transfers = this.helper.buildTransfersWithdrawPrepare(
        cmd.transferId, cmd.amount, netDebitCap, spec.result, dfspRoot, currency
      )
      const reporter = new Reporter({ ledger: this, config: this.config })
      const bsPre = await reporter.balanceSheet(new Date())
      // console.log("bsPre is \n" + bsPre.toTAccounts([cmd.dfspId], [cmd.currency]))
      // console.log('NDC is:', netDebitCap)
      // console.log('Transfers are:\n' + Helper.formatTransfersAsDRCR(transfers, [spec.result], [dfspRoot], currency))

      const createTransfersResults = await this.deps.client.createTransfers(transfers)
      const fatalErrors = this.helper.mapWithdrawPrepareToPrepareResult(
        createTransfersResults, netDebitCap
      )

      if (fatalErrors.length > 0) {
        const firstError = fatalErrors[0]
        switch (firstError.type) {
          case 'INSUFFICIENT_FUNDS':
            // Backwards compatibility - always update the changed date for the settlement account?
            await this.deps.specStore.updateChangedDateSettlement(
              cmd.dfspId, cmd.currency, new Date()
            )
            // In the future, we should return this error.
            return Helper.failure(new Error(`withdrawPrepare() failed - insufficent funds.`))

          case 'ACCOUNT_CLOSED':
            // In the future, we should return this error.
            return Helper.failure(new Error(`withdrawPrepare() failed - account closed.`))
          case 'TRANSFER_ID_REUSED':
            return Helper.failure(new Error(`withdrawPrepare() failed - transfer already exists.`))
          case 'DFSP_CLOSED':
            return Helper.failure(new Error(`withdrawPrepare() failed - the dfsp account is closed.`))
          case 'UNKNOWN':
            return Helper.failure(new Error(`withdrawPrepare() failed with error: ${CreateTransferStatus[firstError.status]}`))
        }
      }

      const bsPost = await reporter.balanceSheet(new Date())
      // console.log("bsPost is \n" + bsPost.toTAccounts([cmd.dfspId], [cmd.currency]))

      await this.deps.specStore.updateChangedDateSettlement(cmd.dfspId, cmd.currency, new Date())

      return Helper.successEmpty()
    } catch (err: any) {
      return Helper.failure(err)
    }
  }

  public async withdrawCommit(cmd: WithdrawCommitCommand): Promise<WithdrawCommitResponse> {
    assert(cmd.transferId)

    try {
      const transfers: Array<Transfer> = [
        // Commit the withdrawal.
        {
          ...Helper.createTransferTemplate,
          id: id(),
          pending_id: Helper.fromMojaloopId(cmd.transferId),
          debit_account_id: 0n,
          credit_account_id: 0n,
          amount: amount_max,
          ledger: 0,
          code: TransferCode.Withdraw,
          flags: TransferFlags.post_pending_transfer
        },
      ]

      const createTransfersResult = await this.deps.client.createTransfers(transfers)
      let retryAccountWasClosed = false
      const fatalErrors: Array<TransferFailureResult<WithdrawCommitFailureType>> = []
      createTransfersResult.forEach((result, idx) => {
        // Ignore noisy errors
        if (result.status === CreateTransferStatus.linked_event_failed) return
        if (result.status === CreateTransferStatus.created) return

        if (idx === 0) {
          switch (result.status) {
            case CreateTransferStatus.debit_account_already_closed:
              // This is retryable, we need to open the account and close it again.
              retryAccountWasClosed = true
              return
            case CreateTransferStatus.pending_transfer_not_found:
              fatalErrors.push({ type: 'NOT_FOUND', ...result })
              return
            case CreateTransferStatus.pending_transfer_already_posted:
              fatalErrors.push({ type: 'ALREADY_COMMITTED', ...result })
              return
            case CreateTransferStatus.pending_transfer_already_voided:
              fatalErrors.push({ type: 'ALREADY_ABORTED', ...result })
              return
          }
        }

        throw new Error(`unhandled transfer error: ${idx}, ${CreateTransferStatus[result.status]}`)
      })

      if (retryAccountWasClosed) {
        return this.withdrawCommitClosedAccount(cmd)
      }

      // Backwards compatibility: always return success.
      return Helper.successEmpty()
    } catch (err) {
      return Helper.failure(err)
    }
  }

  /**
   * The same as withdrawCommit, but we atomically (1) reopen the closed account, (2) post the
   * pending transfer to apply the withdrawal, (3) reclose the account.
   */
  private async withdrawCommitClosedAccount(cmd: WithdrawCommitCommand):
    Promise<WithdrawCommitResponse> {

    try {
      const idPendingWithdrawal = Helper.fromMojaloopId(cmd.transferId)
      const transferPendingWithdrawal = await this.client.lookupTransfers([idPendingWithdrawal])
      assert(transferPendingWithdrawal.length === 1, `Expected only 1 transfer for id: ${idPendingWithdrawal}.`)
      const accountIdUnrestricted = transferPendingWithdrawal[0].debit_account_id
      const {
        code, currency
      } = await this.specStore.lookupDfspCurrencyByAccountId2(accountIdUnrestricted)
      const currencyConfig = await this.specStore.getCurrencyConfig(currency.currency)

      // Look up the closing transfer.
      const closingTransfers = (await this.deps.client.getAccountTransfers({
        account_id: accountIdUnrestricted,
        user_data_128: 0n,
        user_data_64: 0n,
        user_data_32: 0,
        code: TransferCode.Close_Account,
        timestamp_min: 0n,
        timestamp_max: 0n,
        limit: 10,
        flags: AccountFilterFlags.credits |
          AccountFilterFlags.reversed,
      })).filter(transfer => transfer.flags & TransferFlags.closing_credit)

      if (closingTransfers.length === 0) {
        const error = new Error(`withdrawCommitClosedAccount tried to reopen a closed account but`
          + ` no closing transfer found.`
        )
        return Helper.failure(error)
      }
      const lastClosingTransfer = closingTransfers[0]
      const transfers = [
        // Void the closing transfer to reopen this account.
        {
          ...LedgerTigerBeetleHelper.createTransferTemplate,
          id: id(),
          pending_id: lastClosingTransfer.id,
          debit_account_id: currency.unrestrictedLock,
          credit_account_id: currency.unrestricted,
          amount: 0n,
          ledger: currencyConfig.idOperation,
          code: TransferCode.Close_Account,
          flags: TransferFlags.linked | TransferFlags.void_pending_transfer
        },
        // Apply the withdrawal
        {
          ...Helper.createTransferTemplate,
          id: id(),
          pending_id: idPendingWithdrawal,
          debit_account_id: 0n,
          credit_account_id: 0n,
          amount: amount_max,
          ledger: 0,
          code: TransferCode.Withdraw,
          flags: TransferFlags.linked | TransferFlags.post_pending_transfer
        },
        // Close the account again
        {
          ...LedgerTigerBeetleHelper.createTransferTemplate,
          id: id(),
          debit_account_id: currency.unrestrictedLock,
          credit_account_id: currency.unrestricted,
          amount: 0n,
          ledger: currencyConfig.idOperation,
          code: TransferCode.Close_Account,
          flags: TransferFlags.pending | TransferFlags.closing_credit
        }
      ]
      const transferResults = await this.deps.client.createTransfers(transfers)
      const fatalErrors: Array<TransferFailureResult<WithdrawCommitFailureType>> = []
      transferResults.forEach((result, idx) => {
        if (result.status === CreateTransferStatus.created) return
        if (result.status === CreateTransferStatus.linked_event_failed) return

        throw new Error(`Unhandled transfer error: ${idx}, ${CreateTransferStatus[result.status]}.`)
      })

      return Helper.successEmpty()
    } catch (err: any) {
      return Helper.failure(err)
    }
  }

  public async withdrawAbort(cmd: WithdrawAbortCommand): Promise<WithdrawAbortResponse> {
    assert(cmd.transferId)

    try {
      const transfers: Array<Transfer> = [
        // Abort the withdrawal
        {
          ...Helper.createTransferTemplate,
          id: id(),
          pending_id: Helper.fromMojaloopId(cmd.transferId),
          debit_account_id: 0n,
          credit_account_id: 0n,
          amount: 0n,
          ledger: 0,
          code: TransferCode.Withdraw,
          flags: TransferFlags.void_pending_transfer
        },
      ]

      const createTransfersResult = await this.deps.client.createTransfers(transfers)
      const fatalErrors: Array<TransferFailureResult<WithdrawAbortFailureType>> = []
      createTransfersResult.forEach((result, idx) => {
        if (result.status === CreateTransferStatus.created) return

        if (idx === 0) {
          switch (result.status) {
            case CreateTransferStatus.pending_transfer_not_found:
              fatalErrors.push({ type: 'NOT_FOUND', ...result })
              return
            case CreateTransferStatus.pending_transfer_already_posted:
              fatalErrors.push({ type: 'ALREADY_COMMITTED', ...result })
              return
            case CreateTransferStatus.pending_transfer_already_voided:
              fatalErrors.push({ type: 'ALREADY_ABORTED', ...result })
              return
          }
        }

        throw new Error(`unhandled transfer error: ${idx}, ${CreateTransferStatus[result.status]}`)
      })

      // Backwards compatibility: always return success.
      return Helper.successEmpty()
    } catch (err) {
      return Helper.failure(err)
    }
  }

  /**
   * @method getHubAccounts
   * 
   * @description There is no concept of a 'Hub Account' in the TigerBeetle implementation, but to 
   * keep backwards compatbility, we return mock Hub accounts.
   */
  public async getHubAccounts(_: AnyQuery): Promise<HubAccountResponse> {
    try {
      const legacyHubCurrencies = await this.specStore.getLegacyHubCurrenciesAll()
      const accounts: Array<LegacyLedgerAccount> = []
      legacyHubCurrencies.forEach(currency => {
        accounts.push({
          id: BigInt(currency.id),
          ledgerAccountType: currency.accountType,
          currency: currency.currency,
          isActive: true,
          changedDate: currency.changedDate,
          createdDate: currency.createdDate,
          value: 0,
          reservedValue: 0,
        })
      })

      // Backwards compatibility. We don't store the Hub's created date in LedgerTigerBeetle,
      // but return the date of the first account created.
      let createdDate = new Date(0)
      if (legacyHubCurrencies.length > 0) {
        createdDate = legacyHubCurrencies[0].createdDate
      }

      return {
        type: 'SUCCESS',
        createdDate,
        accounts: accounts
      }
    } catch (error: any) {
      return {
        type: 'FAILURE',
        error
      }
    }
  }

  public async getDfsp(query: { dfspId: string; }):
    Promise<QueryResultWithNotFound<LegacyLedgerDfsp>> {
    try {
      let dfspRoot: DfspRoot | null
      // Backwards compatibility.
      try {
        dfspRoot = await this.specStore.getDfspRoot(query.dfspId)
      } catch (err) {
        return {
          type: 'NOT_FOUND',
          error: new Error(`Dfsp not found for dfspId: ${query.dfspId}`)
        }
      }
      const specAccounts = await this.deps.specStore.getDfspCurrencies(query.dfspId)
      if (specAccounts.length === 0) {
        return {
          type: 'NOT_FOUND',
          error: new Error(`Dfsp not found for dfclearspId: ${query.dfspId}`)
        }
      }

      // For this query we need:
      // 1. Master Account for the DFSP
      // 2. The SpecAccounts for the DFSP
      // 3. Iterate through all specAccounts and get the TigerBeetle Account ids (we're currently
      //    doing this in 2 steps).
      // 4. Lookup Accounts in TigerBeetle
      // 5. Join it all together into a 'virtual' POSITION and SETTLEMENT Account.
      assert(dfspRoot)
      const masterAccount = (await this._internalDfspRoots([dfspRoot]))[0]
      const internalLedgerAccounts = await this._internalDfspCurrencies(specAccounts)

      // Group by currency and convert to legacy accounts.
      const internalLedgerAccountsPerCurrency = internalLedgerAccounts.reduce((acc, ila) => {
        (acc[ila.currency] = acc[ila.currency] || []).push(ila);
        return acc;
      }, {} as Record<string, Array<InternalDfspCurrency>>);

      // Lookup the currencies.
      const currencyConfigs = await this.specStore.getCurrencyConfigsMap()
      const legacyLedgerAccounts = Object.entries(internalLedgerAccountsPerCurrency)
        .flatMap(([currency, accounts]) => {
          const currencyLedger = currencyConfigs[currency]
          assert(currencyLedger)

          // TODO: find something more optimal.
          const specAccount = specAccounts.find(specAccount => specAccount.currency === currency)
          assert(specAccount)

          const legacyAccounts = this._fromInternalAccountsToLegacyLedgerAccounts(accounts, currencyLedger, specAccount)
          // Strip the values for backwards compatibility.
          const legacyAccountsNoValue = legacyAccounts.map((acc: any) => {
            delete acc['reservedValue']
            delete acc['value']
            delete acc['changedDate']

            return acc as LegacyLedgerAccountNoValue
          })

          return legacyAccountsNoValue
        })

      // Backwards compatibility, sort by createdDate, then Currency, then ledgerAccountType.
      legacyLedgerAccounts.sort(Helper.legacyAccountComparator)


      const dfspCreatedDate = new Date(Number(masterAccount.user_data_64))
      if (Number.isNaN(dfspCreatedDate.getTime())) {
        throw new Error(`expected dfspMasterAccount.user_data_64 to contain a valid ms timestamp.`)
      }
      // Backwards compatibility. Past implementations only store seconds, whereas we store ms.
      dfspCreatedDate.setMilliseconds(0)

      const ledgerDfsp: LegacyLedgerDfsp = {
        name: query.dfspId,
        isActive: !(masterAccount.flags & AccountFlags.closed),
        // Created Date of the DFSP is on the user_data_64 of the master account.
        created: dfspCreatedDate,
        accounts: legacyLedgerAccounts,
        isProxy: dfspRoot.isProxy
      }

      return {
        type: 'SUCCESS',
        result: ledgerDfsp
      }
    } catch (error: any) {
      return {
        type: 'FAILURE',
        error
      }
    }
  }

  private async _internalDfspRoots(dfspRoots: Array<DfspRoot>):
    Promise<Array<InternalDfspRoot>> {
    const masterAccountIds = dfspRoots.map(spec => spec.id)
    const accountResult = await Helper.safeLookupAccounts(this.deps.client, masterAccountIds)
    if (accountResult.type === 'FAILURE') {
      logger.error(`_internalDfspRoots() - failed with error: ${accountResult.error.message}`)
      throw accountResult.error
    }

    return accountResult.result.map((account, idx) => {
      const spec = dfspRoots[idx]
      assert(spec)

      return {
        ...account,
        dfspId: spec.dfspId,
        isProxy: spec.isProxy,
      }
    })
  }

  private async _internalDfspCurrencies(specAccounts: Array<DfspCurrency>):
    Promise<Array<InternalDfspCurrency>> {
    // Flat map.
    const buildKey = (dfspId: string, currency: string, code: AccountCode) =>
      `${dfspId};${currency};${code}`
    const dfspIdMap: Record<string, null> = {}
    const accountKeys: Array<string> = []
    const accountIds: Array<bigint> = []

    specAccounts.forEach(specAccount => {
      dfspIdMap[specAccount.dfspId] = null
      const keys = [
        buildKey(specAccount.dfspId, specAccount.currency, AccountCode.Deposit),
        buildKey(specAccount.dfspId, specAccount.currency, AccountCode.Unrestricted),
        buildKey(specAccount.dfspId, specAccount.currency, AccountCode.Clearing_Credit),
        buildKey(specAccount.dfspId, specAccount.currency, AccountCode.Restricted),
        buildKey(specAccount.dfspId, specAccount.currency, AccountCode.Reserved),
        buildKey(specAccount.dfspId, specAccount.currency, AccountCode.Committed_Outgoing),
        buildKey(specAccount.dfspId, specAccount.currency, AccountCode.Unrestricted_Lock),
        buildKey(specAccount.dfspId, specAccount.currency, AccountCode.Clearing_Setup),
        buildKey(specAccount.dfspId, specAccount.currency, AccountCode.Clearing_Limit),
      ]
      const ids = [
        specAccount.deposit,
        specAccount.unrestricted,
        specAccount.clearingCredit,
        specAccount.restricted,
        specAccount.reserved,
        specAccount.commitedOutgoing,
        specAccount.unrestrictedLock,
        specAccount.clearingSetup,
        specAccount.clearingLimit,
      ]

      accountKeys.push(...keys)
      accountIds.push(...ids)
    })
    const dfspIds = Object.keys(dfspIdMap)
    logger.debug(`_internalAccountsForSpecAccounts() - found: ${dfspIds.length} unique dfsps.`)

    assert(accountIds.length < 8000, 'Exceeded maximum number of accounts.')

    // Look up TigerBeetle Accounts
    const accountResult = await Helper.safeLookupAccounts(this.deps.client, accountIds)
    if (accountResult.type === 'FAILURE') {
      logger.error(`_internalAccountsForSpecAccounts() - failed with error: ${accountResult.error.message}`)
      throw accountResult.error
    }

    const internalLedgerAccounts: Array<InternalDfspCurrency> = []
    for (let idx = 0; idx < accountResult.result.length; idx++) {
      const key = accountKeys[idx]
      const [dfspId, currency, accountCodeStr] = key.split(';')
      assert(dfspId)
      assert(currency)
      assert(accountCodeStr)
      const accountCode = parseInt(accountCodeStr) as AccountCode
      const tigerbeetleAccount = accountResult.result[idx]

      internalLedgerAccounts.push({
        dfspId,
        currency,
        accountCode,
        ...tigerbeetleAccount
      })
    }

    return internalLedgerAccounts
  }

  /**
   * @description Map from an internal TigerBeetle Ledger representation of a LedgerAccount to a
   *   backwards compatible representation.
   * 
   * TODO: we need to inject the account specs as context.
   */
  private _fromInternalAccountsToLegacyLedgerAccounts(
    input: Array<InternalDfspCurrency>,
    currencyLedger: CurrencyConfig,
    spec: DfspCurrency
  ):
    Array<LegacyLedgerAccount> {

    const accounts: Array<LegacyLedgerAccount> = []
    const currencies = [...new Set(input.map(item => item.currency))]
    input.map(internalAccount => internalAccount.currency)
    assert.equal(currencies.length, 1, '_fromInternalAccountsToLegacyLedgerAccounts expects accounts of only 1 currency at a time.')
    const currency = currencies[0]

    const accountUnrestricted = input.find(acc => acc.accountCode === AccountCode.Unrestricted)
    assert(accountUnrestricted, 'could not find unrestricted account')

    const accountRestricted = input.find(acc => acc.accountCode === AccountCode.Restricted)
    assert(accountRestricted, 'could not find restricted account')

    const accountDeposit = input.find(acc => acc.accountCode === AccountCode.Deposit)
    assert(accountDeposit, 'could not find deposit account')

    const accountClearingCredit = input.find(acc => acc.accountCode === AccountCode.Clearing_Credit)
    assert(accountClearingCredit, 'could not find clearing credit account')

    // Legacy Settlement Balance: How much Dfsp has available to settle.
    // Was a negative number in the legacy API once the dfsp had deposited funds.
    const legacySettlementBalancePosted = (accountDeposit.debits_posted - accountDeposit.credits_posted) * -1n
    // TODO(LD): This doesn't make any more sense, since we won't use pending/posted
    const legacySettlementBalancePending = (accountDeposit.debits_pending - accountDeposit.credits_pending) * -1n

    // Legacy Position Balance: How much Dfsp is owed or how much this Dfsp owes.
    const clearingBalancePosted = accountUnrestricted.credits_posted - accountUnrestricted.debits_posted
      + accountRestricted.credits_posted - accountRestricted.debits_posted
      + accountClearingCredit.credits_posted - accountClearingCredit.debits_posted

    // instead this should be the net credit balance of the Reserved account
    const clearingBalancePending = accountUnrestricted.credits_pending - accountUnrestricted.debits_pending
    const legacyPositionBalancePosted = (legacySettlementBalancePosted + clearingBalancePosted) * BigInt(-1)
    const legacyPositionBalancePending = (legacySettlementBalancePending + clearingBalancePending) * BigInt(-1)

    // Funds withdrawal internally uses Pending/Posted, but doesn't expose this in the API
    const settlementValue = (accountDeposit.debits_posted - accountDeposit.credits_pending
      - accountDeposit.credits_posted) * -1n

    accounts.push({
      id: accountUnrestricted.id,
      ledgerAccountType: 'POSITION',
      currency,
      isActive: !((accountUnrestricted.flags & AccountFlags.closed) === AccountFlags.closed),
      // TODO: This might diverge given that we have just 1 spec per virtual POSITION and 
      // SETTLEMENT account
      changedDate: spec.changedDatePosition,
      createdDate: spec.createdDate,
      value: Helper.toRealAmount(legacyPositionBalancePosted, currencyLedger.assetScale),
      reservedValue: Helper.toRealAmount(legacyPositionBalancePending, currencyLedger.assetScale),
    })

    accounts.push({
      id: accountDeposit.id,
      ledgerAccountType: 'SETTLEMENT',
      currency,
      isActive: !((accountDeposit.flags & AccountFlags.closed) === AccountFlags.closed),
      // TODO: This might diverge given that we have just 1 spec per virtual POSITION and 
      // SETTLEMENT account
      changedDate: spec.changedDateSettlement,
      createdDate: spec.createdDate,
      // TODO: Set this to match the LedgerSQL, but I think ledgerSQL is wrong!
      value: Helper.toRealAmount(settlementValue, currencyLedger.assetScale),
      // value: 0,
      reservedValue: 0,
    })

    return accounts.sort(Helper.legacyAccountComparator)
  }

  public async getAllDfsps(query: AnyQuery): Promise<QueryResult<GetAllDfspsResponse>> {
    try {
      // Look up all metadata: 
      // 1. Master Accounts joined with DfspCurrencies
      const result = await this.specStore.queryDfspRootsWithCurrencies()

      // Join together all TB Accounts to look up into a single account array.
      const masterSpecs = await this._internalDfspRoots(result.dfspRoots)
      const internalLedgerAccounts = await this._internalDfspCurrencies(result.dfspCurrencies)

      // Lookup the currencies //TODO: we can put this in the same query as above.
      const currencyLedgerMap = await this.specStore.getCurrencyConfigsMap()

      // Initialize per dfsp.
      const internalAccountsPerDfsp: Record<string, Array<InternalDfspCurrency>> = masterSpecs.reduce((acc, curr) => {
        acc[curr.dfspId] = []
        return acc
      }, {} as Record<string, Array<InternalDfspCurrency>>)
      internalLedgerAccounts.forEach(account => {
        internalAccountsPerDfsp[account.dfspId].push(account)
      })
      const accountsPerDfsp: Record<string, Array<LegacyLedgerAccountNoValue>> = result.dfspRoots.reduce((acc, curr) => {
        acc[curr.dfspId] = []
        return acc
      }, {} as Record<string, []>)
      Object.entries(internalAccountsPerDfsp).flatMap(([dfspId, accounts]) => {
        const dfspCurrencies = [... new Set(accounts.map(account => account.currency))]

        // Now group the accounts by currency.
        dfspCurrencies.forEach(currency => {
          const accountsPerCurrency = accounts.filter(acc => acc.currency === currency)
          const currencyLedger = currencyLedgerMap[currency]
          assert(currencyLedger)

          const specAccount = result.dfspCurrencies.find(specAccount =>
            specAccount.currency === currency && specAccount.dfspId === dfspId
          )
          assert(specAccount)

          const legacyAccounts = this._fromInternalAccountsToLegacyLedgerAccounts(
            accountsPerCurrency, currencyLedger, specAccount
          )
          // Strip the values for backwards compatibility.
          const legacyAccountsNoValue = legacyAccounts.map((acc: any) => {
            delete acc['reservedValue']
            delete acc['value']
            delete acc['changedDate']

            return acc as LegacyLedgerAccountNoValue
          })
          accountsPerDfsp[dfspId].push(...legacyAccountsNoValue)
        })
      })

      const dfsps: Array<LegacyLedgerDfsp> = []
      masterSpecs.forEach(spec => {
        const created = new Date(Number(spec.user_data_64))
        // Legacy has accuracy only to seconds.
        created.setMilliseconds(0)

        const accounts = accountsPerDfsp[spec.dfspId]
        accounts.sort(Helper.legacyAccountComparator)

        dfsps.push({
          name: spec.dfspId,
          isActive: !((spec.flags & AccountFlags.closed) === AccountFlags.closed),
          created,
          accounts,
          isProxy: spec.isProxy,
        })
      })

      return {
        type: 'SUCCESS',
        result: {
          dfsps
        }
      }
    } catch (error: any) {
      return {
        type: 'FAILURE',
        error
      }
    }
  }

  public async getDfspAccounts(query: GetDfspAccountsQuery): Promise<DfspAccountResponse> {
    try {
      const specCurrencyResult = await this.deps.specStore.getDfspCurrency(query.dfspId, query.currency)
      if (specCurrencyResult.type === 'NOT_FOUND') {
        return {
          // Backwards compatibility. This used to be a failure.
          type: 'FAILURE',
          error: new Error(`No dfspAccount found for dfspId: ${query.dfspId}, currency: ${query.currency}.`)
        }
      }
      if (specCurrencyResult.type === 'FAILURE') {
        return specCurrencyResult
      }
      const currency = await this.deps.specStore.getCurrencyConfig(query.currency)
      const internalDfspCurrencies = await this._internalDfspCurrencies([specCurrencyResult.result])

      const legacyAccounts = this._fromInternalAccountsToLegacyLedgerAccounts(
        internalDfspCurrencies, currency, specCurrencyResult.result
      )
      // .sort(Helper.legacyAccountComparator)

      return {
        type: 'SUCCESS',
        accounts: legacyAccounts
      }
    } catch (error: any) {
      return Helper.failure(error)
    }
  }

  public async getAllDfspAccounts(query: GetAllDfspAccountsQuery): Promise<DfspAccountResponse> {
    try {
      await this.deps.specStore.getDfspRoot(query.dfspId)
      // Lookup all specCurrency for the dfsp.
      // Now need to iterate over the currencies for this dfsp.
      const specCurrencies = await this.deps.specStore.getDfspCurrencies(query.dfspId)
      if (specCurrencies.length === 0) {
        return {
          type: 'FAILURE',
          error: new Error(`No dfspAccounts found for dfspId: ${query.dfspId}.`)
        }
      }
      const internalLedgerAccounts = await this._internalDfspCurrencies(specCurrencies)
      const currencyConfigs = await this.deps.specStore.getCurrencyConfigsMap()

      const internalLedgerAccountsPerCurrency = internalLedgerAccounts.reduce((acc, ledgerAccount) => {
        (acc[ledgerAccount.currency] = acc[ledgerAccount.currency] || []).push(ledgerAccount)
        return acc
      }, {} as Record<string, Array<InternalDfspCurrency>>);

      const accounts = Object.entries(internalLedgerAccountsPerCurrency)
        .flatMap(([currency, accounts]) => {
          const currencyLedger = currencyConfigs[currency]
          assert(currencyLedger)
          const specAccount = specCurrencies.find(spec => spec.currency === currency)
          assert(specAccount)
          return this._fromInternalAccountsToLegacyLedgerAccounts(accounts, currencyLedger, specAccount)
        })
        .sort(Helper.legacyAccountComparator)

      return {
        type: 'SUCCESS',
        accounts
      }
    } catch (error: any) {
      return {
        type: 'FAILURE',
        error
      }
    }
  }

  /**
   * Gets a detailed account balance of all dfsp accounts across all currencies.
   */
  public async getAllDfspAccountsExtended(): Promise<Record<string, Array<LedgerAccount>>> {
    const { dfspCurrencies } = await this.specStore.queryDfspRootsWithCurrencies()
    const dfspIds = [...new Set(dfspCurrencies.map(dfspCurrency => dfspCurrency.dfspId))]
    const currencies = [...new Set(dfspCurrencies.map(dfspCurrency => dfspCurrency.currency))]

    const results: Record<string, Array<LedgerAccount>> = {}
    const internalLedgerAccounts = await this._internalDfspCurrencies(dfspCurrencies)
    dfspIds.forEach(dfspId => {
      const dfspCurrencyAccounts: Array<LedgerAccount> = []
      currencies.forEach(currency => {
        const internalLedgerAccountsPerCurrency = internalLedgerAccounts
          .filter(account => account.dfspId === dfspId && account.currency === currency)

        if (internalLedgerAccountsPerCurrency.length === 0) return
        // If we have _some_ ledger accounts, we should have them all.
        assert(internalLedgerAccountsPerCurrency.length === 9,
          `Expected dfsp + currency: ${dfspId}, ${currency} to have 9 accounts.`
        )

        dfspCurrencyAccounts.push(...Helper.toLedgerAccount(internalLedgerAccountsPerCurrency))
      })
      results[dfspId] = dfspCurrencyAccounts
    })

    return results
  }

  public async setNetDebitCap(cmd: SetNetDebitCapCommand): Promise<CommandResult<void>> {
    assert(cmd.currency)
    assert(cmd.dfspId)

    try {
      const currencyConfig = await this.specStore.getCurrencyConfig(cmd.currency)
      let amountNetDebitCap: bigint
      switch (cmd.netDebitCapType) {
        case 'LIMITED': {
          assert(typeof cmd.amount === 'number')
          amountNetDebitCap = Helper.toTigerBeetleAmount(cmd.amount, currencyConfig.assetScale)
          break;
        }
        case 'UNLIMITED': {
          amountNetDebitCap = 0n
          break;
        }
      }
      const dfspCurrencyResult = await this.specStore.getDfspCurrency(cmd.dfspId, cmd.currency)
      if (dfspCurrencyResult.type === 'NOT_FOUND') {
        return Helper.failure(new Error(`no dfspId + currency found: ${cmd.dfspId} + ${cmd.currency}`))
      }
      if (dfspCurrencyResult.type === 'FAILURE') {
        return Helper.failure(dfspCurrencyResult.error)
      }
      const dfspCurrency = dfspCurrencyResult.result

      // Write Last, Read First.
      // This is subtle, but we only want to store this record iff the TigerBeetle transfers
      // succeed.
      // await this.deps.specStore.saveNetDebitCap({
      //   type: cmd.netDebitCapType,
      //   amount: amountNetDebitCap,
      //   alarmPercentage: cmd.netDebitCapType === 'LIMITED' ? cmd.alarmPercentage : 0,
      //   dfspId: cmd.dfspId,
      //   currency: cmd.currency
      // })

      const transfers = this.helper.buildTranfersSetNetDebitCap(
        dfspCurrency,
        currencyConfig,
        amountNetDebitCap,
        cmd.netDebitCapType,
        cmd.netDebitCapType === 'LIMITED' ? cmd.alarmPercentage : 0,
      )
      const createTransfersResults = await this.deps.client.createTransfers(transfers)
      const fatalErrors: Array<TransferFailureResult<SetNetDebitCapFailureType>> = []

      createTransfersResults.forEach((result, idx) => {
        // Ignore noisy statuses.
        if (result.status === CreateTransferStatus.linked_event_failed) return
        if (result.status === CreateTransferStatus.created) return

        // if (idx === 0) {
        //   switch (result.status) {
        //     default:
        //       fatalErrors.push({ type: 'UNKNOWN', ...error })
        //       return
        //   }
        // }

        throw new Error(`unhandled transfer status at index: ${idx}, ` +
          `${CreateTransferStatus[result.status]}`
        )
      })

      if (fatalErrors.length > 0) {
        const firstError = fatalErrors[0]
        return {
          type: 'FAILURE',
          error: new Error(`setNetDebitCap() failed with error: ${CreateTransferStatus[firstError.status]}`)
        }
      }

      return Helper.successEmpty()
    } catch (err) {
      return Helper.failure(err)
    }
  }

  public async getNetDebitCap(query: GetNetDebitCapQuery):
    Promise<QueryResultWithNotFound<LegacyLimit>> {
    assert(query.currency)
    assert(query.dfspId)

    // Backwards compatibility - if the currency isn't doesn't exist return NOT_FOUND instead of
    // throwing an error
    let currency
    try {
      currency = await this.deps.specStore.getCurrencyConfig(query.currency)
    } catch (err: any) {
      return {
        type: 'NOT_FOUND',
        error: new Error(`failed to get currency: ${query.currency}.`)
      }
    }

    try {
      assert(currency)
      const netDebitCapResult = await this.getInternalNetDebitCap(query.dfspId, query.currency)
      if (netDebitCapResult.type === 'FAILURE') {
        return {
          type: 'FAILURE',
          error: netDebitCapResult.error
        }
      }

      if (netDebitCapResult.type === 'NOT_FOUND') {
        return {
          type: 'NOT_FOUND',
          error: netDebitCapResult.error
        }
      }
      const netDebitCap = netDebitCapResult.result

      // Backwards compatability: LedgerTigerBeetle sees this internally as an Unlimited limit,
      // but to match the Admin API we consider it a missing limit.
      if (netDebitCap.type === 'UNLIMITED') {
        return {
          type: 'NOT_FOUND',
          error: ErrorHandler.Factory.createFSPIOPError(
            ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND,
            `getNetDebitCap() - no limits found for dfspId: ${query.dfspId},` +
            `currency: ${query.currency}, type: 'NET_DEBIT_CAP`
          )
        }
      }
      const limit: LegacyLimit = {
        type: "NET_DEBIT_CAP",
        value: Helper.toRealAmount(netDebitCap.amount, currency.assetScale),
        alarmPercentage: netDebitCap.alarmPercentage,
      }

      return {
        type: 'SUCCESS',
        result: limit
      }
    } catch (err) {
      return Helper.failure(err)
    }
  }

  public async getNetDebitCaps(query: GetNetDebitCapsQuery):
    Promise<QueryResultWithNotFound<Array<LegacyLimitItem>>> {
    assert(query.dfspId)

    // Backwards compatibility, return NOT_FOUND if the dfsp does not exist.
    try {
      await this.specStore.getDfspRoot(query.dfspId)
    } catch (err) {
      return {
        type: 'NOT_FOUND',
        error: new Error(`Dfsp not found for id: ${query.dfspId}.`)
      }
    }

    try {
      const dfspCurrencies = await this.specStore.getDfspCurrencies(query.dfspId)
      const currencies = dfspCurrencies.map(dfspCurrency => dfspCurrency.currency)
      const netDebitCaps: Array<LegacyLimitItem> = []

      // Backwards compatibility. If the account is closed, filter it out.
      const unrestrictedAccountIds = dfspCurrencies.map(dfspCurrency => dfspCurrency.unrestricted)
      const accounts = await this.client.lookupAccounts(unrestrictedAccountIds)
      assert.equal(unrestrictedAccountIds.length, accounts.length, 'getNetDebitCaps() - missing accounts in TigerBeetle.')

      for (let idx = 0; idx < currencies.length; idx++) {
        const currency = currencies[idx]
        assert(currency)
        const accountUnrestricted = accounts[idx]
        assert(accountUnrestricted)

        if ((accountUnrestricted.flags & AccountFlags.closed) === AccountFlags.closed) {
          continue
        }

        // TODO: optimize me for bulk lookup!
        const netDebitCap = await this.getNetDebitCap({
          dfspId: query.dfspId, currency
        })
        if (netDebitCap.type === 'SUCCESS') netDebitCaps.push({ currency, limit: netDebitCap.result })
      }

      return {
        type: 'SUCCESS',
        result: netDebitCaps
      }
    } catch (err) {
      return Helper.failure(err)
    }
  }

  public async getNetDebitCapsForDfsps(dfsps: Array<string>): Promise<any> {
    return []
  }

  /**
   * Given a list of prepares and some context, validate each prepare. 
   * Returns an array with a result per prepare.
   */
  private prepareCheckValid(
    prepares: Array<PrepareHandlerInput>,
    context: ContextDfsps,
    netDebitCaps: Array<NetDebitCap>
  ): Array<PrepareInternalStatus> {
    const dfspCurrenciesMap = Helper.toMapBy(
      context.dfspCurrencies,
      item => `${item.dfspId}:${item.currency}`
    )
    const netDebitCapsMap = Helper.toMapBy(
      netDebitCaps,
      item => `${item.dfspId}:${item.currency}`
    )

    const results: Array<PrepareInternalStatus> = []
    prepares.forEach(prepare => {
      const keyPayer = `${prepare.payload.payerFsp}:${prepare.payload.amount.currency}`
      const keyPayee = `${prepare.payload.payeeFsp}:${prepare.payload.amount.currency}`
      const payer = dfspCurrenciesMap[keyPayer]
      const payee = dfspCurrenciesMap[keyPayee]
      const netDebitCapPayer = netDebitCapsMap[keyPayer]
      const netDebitCapPayee = netDebitCapsMap[keyPayee]

      let failValidation = false
      let failureReasons: Array<string> = []
      if (!payer) {
        failValidation = true
        failureReasons.push(`Payer proxy or participant not found: payer: ${prepare.payload.payerFsp}.`)
      }
      if (!payee) {
        failValidation = true
        failureReasons.push(`Payee proxy or participant not found: payee: ${prepare.payload.payeeFsp}.`)
      }

      // Backwards compatibility: Check that the net debit cap is defined for the participants.
      if (!netDebitCapPayer) {
        failValidation = true
        failureReasons.push(`Payer net debit cap not defined.`)
      }

      if (!netDebitCapPayee) {
        failValidation = true
        failureReasons.push(`Payee net debit cap not defined.`)
      }

      if (prepare.payload.payerFsp === prepare.payload.payeeFsp) {
        failValidation = true
        failureReasons.push(`Payer FSP and Payee FSP should be different, unless on-us tranfers are allowed by the Scheme`)
      }

      const expirationMs = Date.parse(prepare.payload.expiration)
      if (isNaN(expirationMs)) {
        failValidation = true
        failureReasons.push(`invalid transfer expiration`)
      }
      const nowMs = (new Date()).getTime()
      if (nowMs > expirationMs) {
        failValidation = true
        failureReasons.push(`Expiration date already in the past.`)
      }

      if (failValidation) {
        // Backwards compatibility.
        failureReasons.sort()

        // Update the results.
        const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          failureReasons.toString()
        )

        results.push({ tag: 'FAIL_VALIDATION', context: { failureReasons } })
        return
      }

      results.push({ tag: 'OK' })
    })

    assert.equal(prepares.length, results.length)
    return results
  }

  private prepareCheckIdempotent(
    prepares: Array<PrepareHandlerInput>,
    context: ContextPayments,
    hashes: Array<number>
  ): Array<PrepareInternalStatus> {
    const specPreparesMap = Helper.toMapBy(context.specPrepares, item => item.id)
    const specTransfersMap = Helper.toMapBy(context.specTransfers, item => item.id)

    const results: Array<PrepareInternalStatus> = []
    prepares.forEach((prepare, idx) => {
      const hash = hashes[idx]
      const specPrepare = specPreparesMap[prepare.transferId]
      const specTransfer = specTransfersMap[prepare.transferId]

      // Brand new Prepare.
      if (!specPrepare && !specTransfer) {
        results.push({ tag: 'OK' })
        return
      }

      assert(specPrepare)
      // Seen the id, but the payload is different!
      if (specPrepare.payloadHash !== hash) {
        results.push({ tag: 'MODIFIED', context: {} })
        return
      }

      // Already been finalized.
      if (specPrepare.abortedAt) {
        results.push({
          tag: 'DUPLICATE_FINAL',
          context: {
            specPrepare,
          }
        })
        return
      }
      if (specTransfer && specTransfer.fulfilment) {
        results.push({
          tag: 'DUPLICATE_FINAL',
          context: {
            specPrepare,
            specTransfer
          }
        })
        return
      }

      // We've at least recorded the prepare, but don't know it's final state.
      // TigerBeetle response DUPLICATE_FINAL might override this, since between this check
      // and saving to TigerBeetle, the fulfilment might have come in. 
      results.push({
        tag: 'DUPLICATE_NON_FINAL',
        context: {}
      })
    })

    assert.equal(prepares.length, results.length)
    return results
  }

  /**
   * Prepare a batch of payments.
   * 
   * Performance characteristics:
   * 
   * Amplification factor = 8 (let's say 10 to be safe). That means that for the TigerBeetle batch
   * size of 8189 transfers, we can do 818 prepares per TigerBeetle batch.
   * If TigerBeetle can do 500,000 TPS, then we can reach a theoretical maximum of 50,000 Prepares
   * per second.
   * 
   * 1. Get the Dfsp + Payment context.                (2x MySQL Round Trips)
   * 2. Look up the net debit caps.                    (1x TigerBeetle Round Trip best case)
   * 3. Save Payment context.                          (2x MySQL Round Trips)
   * 4. Create TigerBeetle Transfers.                  (1x TigerBeetle Round Trip)
   * 5. For the failed prepares, save abort timestamp. (1x MySQL Round Trips)
   * 
   * = 7 round trips per batch of 818 prepares.
   */
  public async prepare(prepares: Array<PrepareHandlerInput>):
    Promise<Array<PaymentPrepareResult>> {

    const dfspIds = [...new Set(
      prepares.map(prepare => [prepare.payload.payerFsp, prepare.payload.payeeFsp]).flat()
    )].sort()
    const currencies = [...new Set(prepares.map(prepare => prepare.payload.amount.currency))].sort()
    const prepareIds = [...new Set(prepares.map(prepare => prepare.transferId))].sort()

    const contextDfsps = await this.specStore.getPrepareContextDfsps(currencies, dfspIds)
    const contextPayments = await this.specStore.getPrepareContextPayments(prepareIds)
    const netDebitCaps = Object.values(await this.getInternalNetDebitCaps())
    const prepareHashes = prepares.map(input => Helper.hashTransferProperties2(input.payload))

    // Results are sparse arrays. Undefined if we passed the check, the failure if not.
    const resultsValidation = this.prepareCheckValid(prepares, contextDfsps, netDebitCaps)
    const resultsIdempotent = this.prepareCheckIdempotent(prepares, contextPayments, prepareHashes)
    assert.equal(prepares.length, resultsValidation.length)
    assert.equal(prepares.length, resultsIdempotent.length)

    // Save the results and inputs to the spec store.
    const specPreparesToSave: Array<SpecPrepare> = []
    const specTransfersToSave: Array<SpecTransferCreate> = []
    // Keep track of the original position of the prepare.
    const preparesOk: Array<{ prepare: PrepareHandlerInput, idx: number }> = []
    const hashesOk: Array<number> = []
    for (let idx = 0; idx < prepares.length; idx++) {
      const resultIdempotent = resultsIdempotent[idx]
      // Don't need to do anything if the idempotency check came back.
      // We've already seen this prepare.
      if (resultIdempotent.tag !== 'OK') continue

      const prepare = prepares[idx]
      const resultValidation = resultsValidation[idx]
      const payloadHash = prepareHashes[idx]
      if (resultValidation.tag !== 'OK') {
        // The prepare is invalid, but we still need to save it to ensure we don't allow it to succeed
        // in the future.
        specPreparesToSave.push({ id: prepare.transferId, payloadHash, abortedAt: new Date() })
        continue
      }

      // Save the valid specPrepare and transfer payload.
      specPreparesToSave.push({ id: prepare.transferId, payloadHash })
      specTransfersToSave.push(Helper.prepareToSpecTransferCreate(prepare.payload))

      // Mark as passed the valid and idempotency check.
      preparesOk.push({ idx, prepare })
      hashesOk.push(prepareHashes[idx])
    }
    await this.specStore.savePreparesAndTransfers(specPreparesToSave, specTransfersToSave)

    const transfers = this.helper.buildTransfersPrepare(
      preparesOk.map(item => item.prepare), contextDfsps, hashesOk
    )
    const resultsTigerBeetle = await this.client.createTransfers(transfers)
    const resultsTigerBeetleSubset = this.helper.mapResultsPrepare(resultsTigerBeetle)

    // Project from results to the full sized array.
    const resultsCreateTransfers: Array<PrepareInternalStatus | undefined>
      = new Array(prepares.length).fill(undefined)
    preparesOk.forEach(({ prepare, idx }, idxSubset) => {
      resultsCreateTransfers[idx] = resultsTigerBeetleSubset[idxSubset]
    })

    const specPreparesAborted: Array<string> = []
    const results: Array<PaymentPrepareResult> = []
    for (let idx = 0; idx < prepares.length; idx++) {
      const prepare = prepares[idx]
      const resultIdempotent = resultsIdempotent[idx]
      const resultValidation = resultsValidation[idx]
      const resultCreateTransfers = resultsCreateTransfers[idx]

      // Make sure we update the specPrepare to aborted.
      if (resultCreateTransfers) {
        switch (resultCreateTransfers.tag) {
          case 'FAIL_LIQUIDITY':
          case 'FAIL_ACCOUNT_CLOSED':
          case 'FAIL_OTHER':
            specPreparesAborted.push(prepare.transferId)
            break;
        }
      }

      // Error order of precedence.
      let failure
      if (resultIdempotent.tag !== 'OK') {
        failure = resultIdempotent
      } else if (resultValidation.tag !== 'OK') {
        failure = resultValidation
      } else if (resultCreateTransfers && resultCreateTransfers?.tag !== 'OK') {
        failure = resultCreateTransfers
      }
      if (failure) {
        results.push(this.helper.mapPrepareInternalToPrepareResult(prepare, failure))
        continue
      }

      // No errors found for this Prepare!
      assert(resultCreateTransfers)
      assert(resultCreateTransfers.tag === 'OK')
      const success = resultCreateTransfers
      results.push(this.helper.mapPrepareInternalToPrepareResult(prepare, success))
    }
    assert.equal(prepares.length, results.length)
    await this.specStore.attachSpecPrepareAbortedAt(
      specPreparesAborted, specPreparesAborted.map(id => new Date())
    )
    return results
  }

  public async fulfil(fulfils: Array<FulfilHandlerInput>): Promise<Array<PaymentFulfilResult>> {
    const fulfilIds = [...new Set(fulfils.map(fulfil => fulfil.transferId))].sort()
    const context = await this.specStore.getFulfilContext(fulfilIds)
    const netDebitCaps = await this.getNetDebitCapsForDfsps(context.dfspIds)

    // Results are arrays that line up with the fulfils
    const resultsValidation = this.fulfilCheckValid(fulfils, context, netDebitCaps)
    assert.equal(fulfils.length, resultsValidation.length)

    // Keep track of what to save to the spec store?
    // 1. Aborted at timestamp for prepare?
    // 2. For succesful payments, attach the fulfilment.
    const specPreparesAborted: Array<string> =  []
    // Keep track of the original position of the prepare.
    const fulfilsNext: Array<{ fulfil: FulfilHandlerInput, idx: number }> = []
    for (let idx = 0; idx < fulfils.length; idx++) {
      const resultValidation = resultsValidation[idx]
      assert(resultValidation)
      
      const fulfil = fulfils[idx]
      assert(fulfil)

      if (resultValidation.tag !== 'OK') {
        specPreparesAborted.push(fulfil.transferId)

        continue
      }

      // Mark as passed the checks.
      fulfilsNext.push({idx, fulfil})
    }
    const transfers = this.helper.buildTransfersFulfil2(
      fulfilsNext.map(item => item.fulfil), context, netDebitCaps
    )
    const resultsTigerBeetle = await this.client.createTransfers(transfers)
    const resultsTigerBeetleSubset = this.helper.mapResultsFulfil(
      resultsTigerBeetle, fulfilsNext.map(item => item.fulfil)
    )

    // Project from results to the full sized array.
    const resultsCreateTransfers: Array<FulfilInternalStatus | undefined>
      = new Array(fulfils.length).fill(undefined)
    fulfilsNext.forEach(({ fulfil, idx }, idxSubset) => {
      resultsCreateTransfers[idx] = resultsTigerBeetleSubset[idxSubset]
    })

    const results: Array<PaymentFulfilResult> = []

    // Now we iterate through the different result arrays.
    const specTransferUpdates: Array<SpecTransferUpdate> = []
    for (let idx = 0; idx < fulfils.length; idx++) {
      const fulfil = fulfils[idx]
      const resultValidation = resultsValidation[idx]
      assert(resultValidation)
      const resultCreateTransfers = resultsCreateTransfers[idx]

      if (resultCreateTransfers && resultCreateTransfers.tag !== 'OK') {
        specPreparesAborted.push(fulfil.transferId)
      }

      let failure
      if (resultValidation.tag !== 'OK') {
        failure = resultValidation
      } else if (resultsCreateTransfers && resultCreateTransfers?.tag !== 'OK') {
        failure = resultCreateTransfers
      }
      if (failure) {
        results.push(this.helper.mapFulfilInternalToFulfilResult(fulfil, failure))
        continue
      }

      // No errors found for this Prepare!
      assert(resultCreateTransfers)
      assert(resultCreateTransfers.tag === 'OK')
      const success = resultCreateTransfers
      results.push(this.helper.mapFulfilInternalToFulfilResult(fulfil, success))
      if (fulfil.payload.transferState !== 'ABORTED') {
        specTransferUpdates.push({
          id: fulfil.transferId,
          fulfilment: fulfil.payload.fulfilment
        })
      }
    }

    assert.equal(fulfils.length, results.length)
    await this.specStore.attachSpecPrepareAbortedAt(specPreparesAborted, specPreparesAborted.map(_ => new Date()))
    await this.specStore.attachFulfillments(specTransferUpdates)

    return results
  }

  private fulfilCheckValid(
    fulfils: Array<FulfilHandlerInput>,
    context: ContextFulfil,
    netDebitCaps: Array<NetDebitCap>
  ): Array<FulfilInternalStatus> {
    const specTransfersMap = Helper.toMapBy(context.specTransfers, item => item.id)
    const dfspRootsMap = Helper.toMapBy(context.dfspRoots, item => item.dfspId)
    const netDebitCapsMap = Helper.toMapBy(netDebitCaps, item => `${item.dfspId}:${item.currency}`)

    return fulfils.map(fulfil => {
      const failureReasons: Array<string> = []
      const specTransfer = specTransfersMap[fulfil.transferId]
      if (!specTransfer) {
        return {
          tag: 'FAIL_VALIDATION' as const,
          context: { failureReasons: ['Transfer not found'] }
        }
      }

      const rootPayer = dfspRootsMap[specTransfer.payerId]
      const rootPayee = dfspRootsMap[specTransfer.payeeId]
      const netDebitCapPayer = netDebitCapsMap[`${specTransfer.payerId}:${specTransfer.currency}`]
      const netDebitCapPayee = netDebitCapsMap[`${specTransfer.payeeId}:${specTransfer.currency}`]

      if (!rootPayer) failureReasons.push(`Payer DFSP '${specTransfer.payerId}' not found`)
      if (!rootPayee) failureReasons.push(`Payee DFSP '${specTransfer.payeeId}' not found`)
      if (!netDebitCapPayer) failureReasons.push(`net debit cap not found for: ${specTransfer.payerId} + ${specTransfer.currency}.`)
      if (!netDebitCapPayee) failureReasons.push(`net debit cap not found for: ${specTransfer.payeeId} + ${specTransfer.currency}.`)
      if (fulfil.callerDfspId !== specTransfer.payeeId) {
        failureReasons.push(`Caller FSP '${fulfil.callerDfspId}' does not match payee '${specTransfer.payeeId}'`)
      }
      if (fulfil.destinationDfspId !== specTransfer.payerId) {
        failureReasons.push(`Destination FSP '${fulfil.destinationDfspId}' does not match payer '${specTransfer.payerId}'`)
      }
      if (failureReasons.length > 0) {
        return { tag: 'FAIL_VALIDATION', context: { failureReasons } }
      }

      // Validate fulfilment matches condition.
      if (fulfil.payload.transferState !== 'ABORTED') {
        const fulfilmentResult = Helper.validateFulfilmentAndCondition(
          fulfil.payload.fulfilment,
          specTransfer.ilpCondition
        )
        if (fulfilmentResult.type === 'FAIL') {
          return { tag: 'INVALID_FULFILMENT' }
        }
      }

      return { tag: 'OK'}
    })
  }

  public async fulfilOld(inputs: Array<FulfilHandlerInput>): Promise<Array<PaymentFulfilResult>> {
    const amplificationFactor = 3 // How many physical transfers per fulfil.
    const physicalTransfers = inputs.length * amplificationFactor
    if (physicalTransfers > Helper.maxBatchSize) {
      throw new Error(`fulfil() called with: ${inputs.length} fulfil === ${physicalTransfers} `
        + `physical transfers. This exceeds the max batch size of ${Helper.maxBatchSize}.`);
    }

    // Initialize the results.
    const resultsMap: Record<string, PaymentFulfilResult | undefined> = {}
    const fulfilsMap: Record<string, FulfilHandlerInput> = {}
    const transferIds: Array<string> = []
    inputs.forEach((fulfil, idx) => {
      resultsMap[fulfil.transferId] = undefined
      fulfilsMap[fulfil.transferId] = fulfil
      transferIds.push(fulfil.transferId)
    })

    // Lookup all specs in batch.
    const specLookupResult = await this.specStore.getTransferSpecs(transferIds)
    const specsMap: Record<string, SpecTransfer> = {}
    specLookupResult.forEach(specResult => {
      if (specResult.type === 'NOT_FOUND') {
        delete fulfilsMap[specResult.id]

        resultsMap[specResult.id] = {
          type: PaymentFulfilResultType.FAIL_VALIDATION,
          effects: [],
          error: new Error(`Spec not found for id: ${specResult.id}`)
        }
        return
      }

      specsMap[specResult.id] = specResult.result

      // TODO: validate the condition + fulfilment here!
    })
    const currencies = await this.specStore.getCurrencyConfigsMap()
    // const masterAccounts = (await this.specStore.getAllDfspMasterAccounts()).reduce((acc, curr) => {
    //   acc[curr.dfspId] = curr
    //   return acc
    // }, {} as Record<string, MasterAccount>)
    const dfspIdMap = Object.values(specsMap).reduce((acc, curr) => {
      acc[curr.payerId] = true
      acc[curr.payeeId] = true
      return acc
    }, {} as Record<string, true>)
    const dfspIds = Object.keys(dfspIdMap)
    const specCurrencyAccounts = (await this.specStore.getDfspCurrenciesAll(dfspIds)).reduce((acc, curr) => {
      const key = `${curr.dfspId}:${curr.currency}`
      acc[key] = curr
      return acc
    }, {} as Record<string, DfspCurrency>)

    // Now save transfers.
    const transfers = this.helper.buildTransfersFulfil(
      Object.values(fulfilsMap),
      Object.values(specsMap),
      currencies,
      specCurrencyAccounts
    )

    const fatalErrors: Record<string, Array<TransferFailureResult<FulfilFailureType>>> = {}
    // Initialize the errors.
    Object.values(fulfilsMap).forEach(fulfil => {
      fatalErrors[fulfil.transferId] = []
    })

    const createTransferResults = await this.deps.client.createTransfers(transfers)
    createTransferResults.forEach((result, idxAllTransfers) => {
      if (result.status === CreateTransferStatus.created) return

      // Ignore noisy errors.
      if (result.status === CreateTransferStatus.linked_event_failed) return

      const msg = `unhandled transfer result: ${idxAllTransfers}, ${CreateTransferStatus[result.status]}`
      console.error(msg)
      logger.error(msg)
      throw new Error(msg)
    })

    // Now save the fulfilments.
    const fulfilmentUpdates: Array<SpecTransferUpdate> = inputs.map(fulfil => {
      // TODO: filter out the failed ones.
      assert(fulfil.payload.transferState !== 'ABORTED')
      return {
        id: fulfil.transferId,
        fulfilment: fulfil.payload.fulfilment
      }
    })

    const attachFulfilmentResults = await this.specStore.attachFulfillments(fulfilmentUpdates)
    return inputs.map(input => {
      return {
        type: PaymentFulfilResultType.PASS,
        // TODO: build me!
        effects: []
      }
    })
  }
  public async sweepTimedOut(now: Date): Promise<SweepResult> {
    throw new Error('Method not implemented.');
  }
  public async lookupTransfer(query: LookupTransferQuery): Promise<LookupTransferQueryResponse> {
    throw new Error('Method not implemented.');
  }

  public async lookupTransfers(transferIds: Array<string>): Promise<Record<string, LookupTransferQueryResponse>> {
    if (transferIds.length === 0) {
      return {}
    }
    // TODO: look them up! Also partials etc.
    // Should be at most 2 round trips
    // Look up TigerBeetle, then look up spec.
    const tbIds = transferIds.map(Helper.fromMojaloopId)
    const idTransferMap: Record<string, Transfer | undefined> = {}
    const idSpecMap: Record<string, GetSpecTransferResult | undefined> = {}
    // Set up out id maps.
    transferIds.forEach(id => {
      idTransferMap[id] = undefined
      idSpecMap[id] = undefined
    })

    const transfers = await this.client.lookupTransfers(tbIds)
    transfers.forEach(transfer => {
      const idMoja = Helper.toMojaloopId(transfer.id)
      idTransferMap[idMoja] = transfer
    })

    const specs = await this.specStore.getTransferSpecs(transferIds)
    specs.forEach(spec => idSpecMap[spec.id] = spec)

    assert.equal(Object.values(idTransferMap).length, Object.values(idSpecMap).length)
    const results: Record<string, LookupTransferQueryResponse> = {}
    transferIds.forEach(id => {
      const transfer = idTransferMap[id]
      const specResult = idSpecMap[id]
      assert(specResult)

      if (!transfer) {
        results[id] = { type: LookupTransferResultType.NOT_FOUND }
        return
      }

      // If the spec does not exist, then we must have only recorded the partial in TigerBeetle for
      // idempotency checks
      if (specResult.type !== 'SUCCESS') {
        results[id] = {
          type: LookupTransferResultType.FOUND,
          transfer: this.hydrateTransferPartial(transfer)
        }
        return
      }

      results[id] = {
        type: LookupTransferResultType.FOUND,
        transfer: this.hydrateTransfer(transfer, specResult.result)
      }
    })

    return results
  }

  public async closeSettlementWindow(cmd: SettlementCloseWindowCommand): Promise<CommandResult<void>> {
    throw new Error('Method not implemented.');
  }
  public async settlementPrepare(cmd: SettlementPrepareCommand): Promise<CommandResult<{ id: number; }>> {
    throw new Error('Method not implemented.');
  }
  public async settlementAbort(cmd: SettlementAbortCommand): Promise<CommandResult<SettlementUpdateResult>> {
    throw new Error('Method not implemented.');
  }
  public async settlementCommit(cmd: SettlementCommitCommand): Promise<CommandResult<void>> {
    throw new Error('Method not implemented.');
  }
  public async settlementUpdate(cmd: SettlementUpdateCommand): Promise<CommandResult<SettlementUpdateResult>> {
    throw new Error('Method not implemented.');
  }
  public async getSettlementWindows(query: GetSettlementWindowsQuery): Promise<QueryResult<GetSettlementWindowsQueryResponse>> {
    throw new Error('Method not implemented.');
  }
  public async getSettlementWindow(query: GetSettlementWindowQuery): Promise<QueryResultWithNotFound<SettlementWindow>> {
    throw new Error('Method not implemented.');
  }
  public async getSettlement(query: GetSettlementQuery): Promise<QueryResultWithNotFound<Settlement>> {
    throw new Error('Method not implemented.');
  }
  public async getSettlements(query: GetSettlementsQuery): Promise<GetSettlementsQueryResponse> {
    throw new Error('Method not implemented.');
  }
}