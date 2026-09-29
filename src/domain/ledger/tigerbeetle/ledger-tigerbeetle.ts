import { Enum, Util } from '@mojaloop/central-services-shared';
import assert from "node:assert";
import {
  AccountFilterFlags,
  AccountFlags,
  amount_max,
  Client,
  CreateAccountStatus,
  CreateTransferResult,
  CreateTransferStatus,
  id,
  Transfer,
  TransferFlags
} from 'tigerbeetle-node';
import {
  FulfilHandlerInput,
  PaymentFulfilResult
} from '../../../handlers/payment-fulfil';
import {
  PaymentPrepareResult,
  PaymentPrepareResultType,
  PrepareHandlerInput
} from "../../../handlers/payment-prepare";
import { ApplicationConfig } from "../../../lib/config";
import { assertBoolean } from '../../../lib/config/util';
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
  LegacyLedgerAccount,
  LegacyLedgerDfsp,
  LegacyLimit,
  LegacyLimitItem,
  LookupTransferQuery,
  LookupTransferQueryResponse,
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
import { default as Helper, default as LedgerTigerBeetleHelper } from './helper';
import SpecStore, { CmdHubCurrencyEnable, CurrencyLedger, InternalLedgerAccount, InternalMasterAccount, MasterAccount, SpecAccount } from './spec-store';

const ErrorHandler = require('@mojaloop/central-services-error-handling')

interface Dependencies {
  config: ApplicationConfig
  client: Client,
  helper: Helper,
  enums: Enums,
  specStore: SpecStore,
}


type TransferFailureResult<T> = CreateTransferResult & {
  type: T
}

type PrepareFailureType = 'FAIL_LIQUIDITY' | 'PAYER_CLOSED' | 'PAYEE_CLOSED' | 'MODIFIED' |
  'EXISTS' | 'UNKNOWN'
type AbortFailureType = 'ALREADY_ABORTED' | 'ALREADY_FULFILLED' | 'NOT_FOUND' | 'UNKNOWN'
type FulfilFailureType = 'ALREADY_ABORTED' | 'PAYER_CLOSED' | 'PAYEE_CLOSED' | 'ALREADY_FULFILLED'
  | 'NOT_FOUND' | 'PAYER_ACCOUNT_CLOSED' | 'PAYEE_ACCOUNT_CLOSED' | 'METADATA_CORRUPTED' | 'UNKNOWN'
type WithdrawPrepareFailureType = 'ACCOUNT_CLOSED' | 'TRANSFER_ID_REUSED' | 'INSUFFICIENT_FUNDS' |
  'UNKNOWN'
type WithdrawCommitFailureType = 'NOT_FOUND' | 'UNKNOWN'
type WithdrawAbortFailureType = 'NOT_FOUND' | 'UNKNOWN'
type DepositFailureType = 'EXISTS' | 'MODIFIED' | 'UNKNOWN'
type SetNetDebitCapFailureType = 'UNKNOWN'
type CloseDfspMasterAccountFailureType = 'DEBIT_ACCOUNT_NOT_FOUND' | 'ALREADY_CLOSED' | 'UNKNOWN'
type EnableDfspAccountFailureType = 'ALREADY_ENABLED' | 'UNKNOWN'
type DisableDfspAccountFailureType = 'ALREADY_CLOSED' | 'UNKNOWN'
type SettlementPrepareCreateAccountsFailureType = 'UNKNOWN'

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

    try {
      // Validate the currency is valid.
      await this.specStore.validateCurrency(cmd.currency)

      const cmdEnableHubCurrency: CmdHubCurrencyEnable = {
        currency: cmd.currency,
        accounts: cmd.accountType ? [cmd.accountType] : []
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
   * @description Create the accounts for the (Dfsp, Currency). If the Dfsp hasn't been created before
   *   sets up the SpecDfsp
   */
  public async createDfsp(cmd: CreateDfspCommand): Promise<CreateDfspResponse> {
    assert(cmd.dfspId)
    assert(cmd.currencies)
    assert(cmd.currencies.length > 0)
    assert.equal(cmd.currencies.length, 1, 'Currently only 1 currency is supported')
    const currency = cmd.currencies[0]

    try {
      await this.specStore.assertCurrenciesEnabled(cmd.currencies)

      // Get or create the specDfsp.
      const masterAccountId = await this.specStore.getOrCreateDfspMasterAccount(cmd.dfspId)
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

      return this.createDfspAccounts(cmd.dfspId, currency)
    } catch (err: any) {
      logger.error(`createDfsp() failed with error: ${err.message}`)
      return {
        type: 'FAILURE',
        error: err
      }
    }
  }

  private async createDfspAccounts(id: string, currency: string): Promise<CreateDfspResponse> {
    try {
      // Backwards compatibility, check that the correct legacy accounts have been created.
      const currencyAccounts = await this.specStore.getCurrencyAccounts(currency)
      const hubReconcilation = currencyAccounts.find(acc => acc.accountType === 'HUB_RECONCILIATION')
      const hubMultilateralSettlement = currencyAccounts.find(acc => acc.accountType === 'HUB_MULTILATERAL_SETTLEMENT')
      if (!hubReconcilation) {
        throw new Error(`Hub reconciliation account for the specified currency does not exist.`)
      }
      if (!hubMultilateralSettlement) {
        throw new Error(`Hub multilateral net settlement account for the specified currency does not exist.`)
      }

      // First we create the spec.
      const spec = await this.specStore.newAccountSpec(id, currency)
      const masterAccountId = await this.specStore.getOrCreateDfspMasterAccount(id)
      const ledger = await this.specStore.getCurrencyLedger(currency)
      const accountIdSettlementBalance = await this.specStore.getAccountIdSettlementBalance(currency)

      const accounts = this.helper.buildAccountsDfsp(
        spec, ledger, accountIdSettlementBalance, masterAccountId
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
      const masterAccountId = await this.specStore.getDfspMasterAccount(cmd.dfspId)
      let closeAccountResult = await this.closeDfspMasterAccount(masterAccountId)

      if (closeAccountResult.type === DeactivateDfspResponseType.CREATE_ACCOUNT) {
        await this.createAccountDevNull()
        closeAccountResult = await this.closeDfspMasterAccount(masterAccountId)

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
      const masterAccountId = await this.specStore.getDfspMasterAccount(cmd.dfspId)
      const transfers = await this.deps.client.getAccountTransfers({
        account_id: masterAccountId,
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
        code: 100,
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

      const { currency, code, spec } = await this.specStore.getCurrencyCodeAndSpec(cmd.dfspId, accountId)
      switch (code) {
        case AccountCode.Deposit:
        case AccountCode.Unrestricted:
          break;
        default:
          return {
            type: 'FAILURE',
            error: new Error(`enableDfspAccount() - account id not found, or is not Deposit or Unrestricted.`)
          }
      }

      const ledgers = await this.specStore.getCurrencyLedger(currency)
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
        debit_account_id: spec.unrestrictedLock,
        credit_account_id: code === AccountCode.Deposit ? spec.deposit : spec.unrestricted,
        amount: 0n,
        ledger: ledgers.ledgerOperation,
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

      const { currency, code, spec } = await this.specStore.getCurrencyCodeAndSpec(cmd.dfspId, accountId)
      switch (code) {
        case AccountCode.Deposit:
        case AccountCode.Unrestricted:
          break;
        default:
          return {
            type: 'FAILURE',
            error: new Error(`disableDfspAccount() - account is not Deposit or Unrestricted.`)
          }
      }

      const ledgers = await this.specStore.getCurrencyLedger(spec.currency)

      // Create a closing transfer to mark this Account as deactivated
      const closingTransfer: Transfer = {
        ...LedgerTigerBeetleHelper.createTransferTemplate,
        id: id(),
        debit_account_id: spec.unrestrictedLock,
        credit_account_id: spec.unrestricted,
        amount: 0n,
        ledger: ledgers.ledgerOperation,
        code: TransferCode.Close_Account,
        flags: TransferFlags.closing_credit | TransferFlags.pending,
      }
      const transferResults = await this.deps.client.createTransfers([closingTransfer])
      const fatalErrors: Array<TransferFailureResult<DisableDfspAccountFailureType>> = []

      transferResults.forEach((result, idx) => {
        if (idx) {
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

  public async deposit(cmd: DepositCommand): Promise<DepositResponse> {
    assert(cmd.amount)
    assert(cmd.currency)
    assert(cmd.dfspId)
    assert(cmd.transferId)
    assert(cmd.reason)

    try {
      // Backwards compatibility - first check if the dfsp exists.
      try {
        await this.specStore.getDfspMasterAccount(cmd.dfspId)
      } catch (err) {
        return {
          type: 'NOT_FOUND'
        }
      }

      // Lookup the net debit cap.
      const netDebitCap = await this.specStore.getNetDebitCap(cmd.dfspId, cmd.currency)
      const dfspCurrencyResult = await this.deps.specStore.getDfspCurrency(cmd.dfspId, cmd.currency)
      if (dfspCurrencyResult.type !== 'SUCCESS') {
        throw dfspCurrencyResult.error
      }
      const dfspCurrency = dfspCurrencyResult.result

      const ledger = await this.deps.specStore.getCurrencyLedger(cmd.currency)

      // Save the funding spec before writing to TigerBeetle (write last, read first).
      await this.deps.specStore.saveFundingSpec([{
        transferId: cmd.transferId,
        dfspId: cmd.dfspId,
        currency: cmd.currency,
        action: 'DEPOSIT',
        reason: cmd.reason
      }])

      let netDebitCapLockAmount = amount_max
      if (netDebitCap.type === 'LIMITED') {
        netDebitCapLockAmount = Helper.toTigerBeetleAmount(netDebitCap.amount, ledger.assetScale)
      }
      const transfers = this.helper.buildTransfersDeposit(
        cmd.transferId, cmd.amount, netDebitCapLockAmount, dfspCurrency, ledger
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
            default:
              fatalErrors.push({ type: 'UNKNOWN', ...result })
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
          case 'UNKNOWN':
            return {
              type: 'FAILURE',
              error: new Error(`deposit failed with error: ${CreateTransferStatus[firstError.status]}`)
            }
        }
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

  public async withdrawPrepare(cmd: WithdrawPrepareCommand): Promise<WithdrawPrepareResponse> {
    throw new Error('Method not implemented.');
  }

  public async withdrawCommit(cmd: WithdrawCommitCommand): Promise<WithdrawCommitResponse> {
    throw new Error('Method not implemented.');
  }

  public async withdrawAbort(cmd: WithdrawAbortCommand): Promise<WithdrawAbortResponse> {
    throw new Error('Method not implemented.');
  }

  public async setNetDebitCap(cmd: SetNetDebitCapCommand): Promise<CommandResult<void>> {
    return {type: 'SUCCESS'}
  }

  /**
   * @method getHubAccounts
   * 
   * @description There is no concept of a 'Hub Account' in the TigerBeetle implementation, but to 
   * keep backwards compatbility, we return mock Hub accounts.
   */
  public async getHubAccounts(query: AnyQuery): Promise<HubAccountResponse> {
    try {
      const createdDate = await this.specStore.getFirstOrImplyCreationDate()
      const currencyAccounts = await this.specStore.getAllCurrencyAccounts()

      const accounts: Array<LegacyLedgerAccount> = []
      currencyAccounts.forEach(acc => {
        accounts.push({
          // TODO: disabled this for now, the LedgerSql implementation is quite hard to 
          // match with LedgerTigerBeetle since the database autoincrements the id on failure.
          // id: BigInt(acc.id),
          id: BigInt(0),
          ledgerAccountType: acc.accountType,
          currency: acc.currency,
          isActive: true,
          changedDate: acc.changedDate,
          createdDate: acc.createdDate,
          value: 0,
          reservedValue: 0,
        })
      })
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
      let masterAccountId
      // Backwards compatibility.
      try {
        masterAccountId = await this.specStore.getDfspMasterAccount(query.dfspId)
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
          error: new Error(`Dfsp not found for dfspId: ${query.dfspId}`)
        }
      }

      const masterAccount = (await this._internalAccountsForSpecDfsps([{
        dfspId: query.dfspId, masterAccountId
      }]))[0]
      const internalLedgerAccounts = await this._internalAccountsForSpecAccounts(specAccounts)

      // Group by currency and convert to legacy accounts.
      const internalLedgerAccountsPerCurrency = internalLedgerAccounts.reduce((acc, ila) => {
        (acc[ila.currency] = acc[ila.currency] || []).push(ila);
        return acc;
      }, {} as Record<string, Array<InternalLedgerAccount>>);

      // Lookup the currencies.
      const currencyLedgers = await this.specStore.getCurrencyLedgers()
      const currencyLedgerMap: Record<string, CurrencyLedger> = {}
      for (const currencyLedger of currencyLedgers) {
        currencyLedgerMap[currencyLedger.currency] = currencyLedger
      }

      const legacyLedgerAccounts = Object.entries(internalLedgerAccountsPerCurrency)
        .flatMap(([currency, accounts]) => {
          const currencyLedger = currencyLedgerMap[currency]
          assert(currencyLedger)
          return this._fromInternalAccountsToLegacyLedgerAccounts(accounts, currencyLedger)
        })

      const ledgerDfsp: LegacyLedgerDfsp = {
        name: query.dfspId,
        isActive: !(masterAccount.flags & AccountFlags.closed),
        // TODO: need to get from somewhere.
        created: new Date(),
        accounts: legacyLedgerAccounts,
        // TODO: need to store on master account?
        isProxy: false,
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

  private async _internalAccountsForSpecDfsps(masterAccounts: Array<MasterAccount>):
    Promise<Array<InternalMasterAccount>> {
    const masterAccountIds = masterAccounts.map(acc => acc.masterAccountId)
    const accountResult = await Helper.safeLookupAccounts(this.deps.client, masterAccountIds)
    if (accountResult.type === 'FAILURE') {
      logger.error(`_internalAccountsForSpecDfsps() - failed with error: ${accountResult.error.message}`)
      throw accountResult.error
    }

    return accountResult.result.map((account, idx) => {
      const spec = masterAccounts[idx]
      assert(spec)

      return {
        ...account,
        dfspId: spec.dfspId
      }
    })
  }

  private async _internalAccountsForSpecAccounts(specAccounts: Array<SpecAccount>):
    Promise<Array<InternalLedgerAccount>> {
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

    const internalLedgerAccounts: Array<InternalLedgerAccount> = []
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
    input: Array<InternalLedgerAccount>,
    currencyLedger: CurrencyLedger
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

    // I'm pretty sure this should always be 0.
    const settlementReservedValue = 0

    accounts.push({
      id: accountUnrestricted.id,
      ledgerAccountType: 'POSITION',
      currency,
      isActive: !(accountUnrestricted.flags & AccountFlags.closed),
      // TODO: get from the spec.
      changedDate: new Date(0),
      createdDate: new Date(0),
      value: Helper.toRealAmount(legacyPositionBalancePosted, currencyLedger.assetScale),
      reservedValue: Helper.toRealAmount(legacyPositionBalancePending, currencyLedger.assetScale),
    })

    accounts.push({
      id: accountDeposit.id,
      ledgerAccountType: 'SETTLEMENT',
      currency,
      isActive: !(accountDeposit.flags & AccountFlags.closed),
      // TODO: get from the spec.
      changedDate: new Date(0),
      createdDate: new Date(0),
      // TODO: Set this to match the LedgerSQL, but I think ledgerSQL is wrong!
      // value: Helper.toRealAmount(settlementValue, currencyLedger.assetScale),
      value: 0,
      reservedValue: settlementReservedValue,
    })

    return accounts;
  }


  public async getAllDfsps(query: AnyQuery): Promise<QueryResult<GetAllDfspsResponse>> {
    throw new Error('Method not implemented.');
  }

  public async getDfspAccounts(query: GetDfspAccountsQuery): Promise<DfspAccountResponse> {
    throw new Error('Method not implemented.');
  }

  public async getAllDfspAccounts(query: GetAllDfspAccountsQuery): Promise<DfspAccountResponse> {
    throw new Error('Method not implemented.');
  }

  public async getNetDebitCap(query: GetNetDebitCapQuery):
   Promise<QueryResultWithNotFound<LegacyLimit>> {
    throw new Error('Method not implemented.');
  }

  public async getNetDebitCaps(query: GetNetDebitCapsQuery):
   Promise<QueryResultWithNotFound<Array<LegacyLimitItem>>> {
    throw new Error('Method not implemented.');
  }

  public async prepare(inputs: Array<PrepareHandlerInput>): Promise<Array<PaymentPrepareResult>> {
    const prepareAmpFactor = 6 // How many physical transfers per prepare.
    const physicalTransfers = inputs.length * prepareAmpFactor
    if (physicalTransfers > Helper.maxBatchSize) {
      throw new Error(`prepare() called with: ${inputs.length} prepares === ${physicalTransfers} `
        + `physical transfers. This exceeds the max batch size of ${Helper.maxBatchSize}.`);
    }

    // Initialize the results.
    const resultsMap: Record<string, PaymentPrepareResult | undefined> = {}
    const preparesMap: Record<string, PrepareHandlerInput> = {}
    inputs.forEach((prepare, idx) => {
      const key = prepare.transferId + `:` + idx
      resultsMap[key] = undefined
      preparesMap[prepare.transferId] = prepare
    })

    // Collect all dfsps + currencies.
    const dfspIdMap = inputs.reduce((acc, curr) => {
      acc[curr.payload.payerFsp] = true
      acc[curr.payload.payeeFsp] = true
      return acc
    }, {} as Record<string, true>)

    const dfsps = await this.specStore.getAllDfspCurrencies(Object.keys(dfspIdMap))
    const masterAccounts = (await this.specStore.getDfspMasterAccounts(Object.keys(dfspIdMap)))
      .reduce((acc, curr) => {
        acc[curr.dfspId] = curr
        return acc
      }, {} as Record<string, MasterAccount>)
    const dfspCurrencyMap: Record<string, SpecAccount> = {}
    dfsps.forEach(specAccount => {
      dfspCurrencyMap[`${specAccount.dfspId}_${specAccount.currency}`] = specAccount
    })

    inputs.forEach((prepare, idx) => {
      const key = prepare.transferId + `:` + idx
      const payer = dfspCurrencyMap[`${prepare.payload.payerFsp}_${prepare.payload.amount.currency}`]
      const payee = dfspCurrencyMap[`${prepare.payload.payeeFsp}_${prepare.payload.amount.currency}`]

      let failValidation = false
      let failureReasons: Array<string> = []
      if (prepare.payload.payerFsp === prepare.payload.payeeFsp) {
        failValidation = true
        failureReasons.push(`payerFsp and payeeFsp must be different.`)
      }
      if (!payer) {
        failValidation = true
        failureReasons.push(`payerFsp not found: ${prepare.payload.payerFsp}`)
      }
      if (!payee) {
        failValidation = true
        failureReasons.push(`payeeFsp not found: ${prepare.payload.payeeFsp}`)
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
        // Update the results.
        resultsMap[key] = {
          type: PaymentPrepareResultType.FAIL_VALIDATION,
          // TODO: build these!
          effects: [],
          failureReasons
        }

        // Remove from the set of prepares to continue with.
        // TODO: need to burn the transferId or something?
        delete preparesMap[prepare.transferId]
      }
    })

    // TODO: need to burn the errored transferId or something?
    // TODO: more validation here.

    const currencyLedgers = (await this.specStore.getCurrencyLedgers()).reduce((acc, curr) => {
      acc[curr.currency] = curr
      return acc
    }, {} as Record<string, CurrencyLedger>)

    const specs = this.helper.buildTransferSpecs(Object.values(preparesMap))
    const saveSpecResults = await this.specStore.saveTransferSpecs(specs)
    saveSpecResults.forEach(result => {
      if (result.type === 'SUCCESS') return
      // Remove from the preparesMap if it failed.
      delete preparesMap[result.id]

      resultsMap[result.id] = {
        type: PaymentPrepareResultType.FAIL_OTHER,
        effects: [],
        error: new Error(`Failed to save transfer spec for transfer: ${result.id}`)
      }
    })

    const transfers = this.helper.buildTransfersPrepares(
      Object.values(preparesMap),
      currencyLedgers,
      masterAccounts,
      dfspCurrencyMap
    )

    const fatalErrors: Record<string, Array<TransferFailureResult<PrepareFailureType>>> = {}
    // Initialize the errors.
    Object.values(preparesMap).forEach(prepare => {
      fatalErrors[prepare.transferId] = []
    })

    const createTransferResults = await this.deps.client.createTransfers(transfers)
    createTransferResults.forEach((result, idxAllTransfers) => {
      // We can skip this.
      if (result.status === CreateTransferStatus.created) return

      // Figure out what prepare we're handling.
      const idxPrepare = Math.floor(idxAllTransfers / prepareAmpFactor)
      const prepare = Object.values(preparesMap)[idxPrepare]
      assert(prepare)
      const transferId = prepare.transferId

      // The individual transfer within the prepare.
      const idxTransfer = idxAllTransfers % prepareAmpFactor

      // Ignore noisy errors
      if (result.status === CreateTransferStatus.linked_event_failed) {
        return
      }

      if (idxTransfer === 0) {
        switch (result.status) {
          case CreateTransferStatus.exists: {
            fatalErrors[transferId].push({ type: 'EXISTS', ...result })
            return
          }
          case CreateTransferStatus.exists_with_different_amount:
          case CreateTransferStatus.exists_with_different_debit_account_id:
          case CreateTransferStatus.exists_with_different_credit_account_id:
          case CreateTransferStatus.exists_with_different_user_data_64:
          case CreateTransferStatus.exists_with_different_user_data_32: {
            fatalErrors[transferId].push({ type: 'MODIFIED', ...result })
            return
          }
          case CreateTransferStatus.debit_account_already_closed:
            fatalErrors[transferId].push({ type: 'PAYER_CLOSED', ...result })
            return
          case CreateTransferStatus.credit_account_already_closed:
            fatalErrors[transferId].push({ type: 'PAYEE_CLOSED', ...result })
            return
          case CreateTransferStatus.id_already_failed:
            fatalErrors[transferId].push({ type: 'MODIFIED', ...result })
            return
        }
      }

      if (idxTransfer === 3) {
        switch (result.status) {
          // Collapse the DFSP deactivated and DFSP account deactivated into the same error
          case CreateTransferStatus.debit_account_already_closed:
            fatalErrors[transferId].push({ type: 'PAYER_CLOSED', ...result })
            return
        }
      }

      if (idxTransfer === 5) {
        switch (result.status) {
          case CreateTransferStatus.exceeds_credits: {
            fatalErrors[transferId].push({ type: 'FAIL_LIQUIDITY', ...result })
            return
          }
        }
      }

      const msg = `unhandled transfer result: ${idxAllTransfers}, ${CreateTransferStatus[result.status]}`
      console.error(msg)
      logger.error(msg)
      throw new Error(msg)
    })

    // Map from Transfer Results => PaymentPrepareResults.
    const resultsTigerBeetle: Record<string, PaymentPrepareResult> = {}
    Object.entries(fatalErrors).forEach(([transferId, errors]) => {
      let result: PaymentPrepareResult
      if (errors.length === 0) {
        result = {
          type: PaymentPrepareResultType.PASS,
          effects: [],
        }
        resultsTigerBeetle[transferId] = result
        return
      }
      const firstError = errors[0]
      switch (firstError.type) {
        case 'FAIL_LIQUIDITY':
          result = {
            type: PaymentPrepareResultType.FAIL_LIQUIDITY,
            effects: [],
            error: new Error(`Payer insufficent liquidity.`)
          }
          break;
        case 'MODIFIED':
          result = {
            type: PaymentPrepareResultType.MODIFIED,
            effects: [],
          }
          break;

        case 'EXISTS': {
          // TODO: need to do another lookup to determine final or not, right?
          result = {
            type: PaymentPrepareResultType.DUPLICATE_NON_FINAL,
            effects: [],
          }
          break;
        }
        case 'PAYER_CLOSED':
          result = {
            type: PaymentPrepareResultType.FAIL_VALIDATION,
            effects: [],
            failureReasons: [`Payer account closed.`]
          }
          break
        case 'PAYEE_CLOSED':
          result = {
            type: PaymentPrepareResultType.FAIL_VALIDATION,
            effects: [],
            failureReasons: [`Payee account closed.`]
          }
          break
        case 'UNKNOWN':
          result = {
            type: PaymentPrepareResultType.FAIL_OTHER,
            effects: [],
            error: new Error(`TigerBeetle transfer failed with: ${CreateTransferStatus[firstError.status]}`)
          }
      }
      assert(result)
      resultsTigerBeetle[transferId] = result
    })


    const resultsOrdered: Record<string, PaymentPrepareResult> = {}

    Object.entries(resultsMap).forEach(([key, result]) => {
      const [transferId, idx] = key.split(':')
      assert(transferId)
      assert(idx)

      // Check the failedTigerBeetle.
      if (resultsTigerBeetle[transferId]) {
        resultsOrdered[idx] = resultsTigerBeetle[transferId]
        return
      }

      if (result === undefined) {
        logger.error(`no result found for transferId: ${transferId} (idx: ${idx})`)
        return
      }

      resultsOrdered[idx] = result
    })

    assert.equal(inputs.length, Object.values(resultsOrdered).length, 'We dropped a result somewhere.')
    return Object.values(resultsOrdered)
  }

  public async fulfil(inputs: Array<FulfilHandlerInput>): Promise<Array<PaymentFulfilResult>> {
    throw new Error('Method not implemented.');
  }
  public async sweepTimedOut(now: Date): Promise<SweepResult> {
    throw new Error('Method not implemented.');
  }
  public async lookupTransfer(query: LookupTransferQuery): Promise<LookupTransferQueryResponse> {
    throw new Error('Method not implemented.');
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