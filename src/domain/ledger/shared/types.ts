/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the 'License') and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

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

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------

 ******/

import { PrepareHandlerInput, PaymentPrepareResult } from '../../../handlers/payment-prepare'
import { FulfilHandlerInput, PaymentFulfilResult } from '../../../handlers/payment-fulfil'
import { TimeoutResult } from '../../../handlers/timeout-v2'

/**
 * Common interface for all Ledger implementations.
 */
export interface Ledger {
  /**
   * Onboarding/Lifecycle Management Commands.
   */
  createHubAccount(cmd: CreateHubAccountCommand): Promise<CreateHubAccountResponse>;
  createDfsp(cmd: CreateDfspCommand): Promise<CreateDfspResponse>;
  disableDfsp(cmd: { dfspId: string }): Promise<CommandResult<void>>;
  enableDfsp(cmd: { dfspId: string }): Promise<CommandResult<void>>;
  enableDfspAccount(cmd: { dfspId: string, accountId: number }): Promise<CommandResult<void>>;
  disableDfspAccount(cmd: { dfspId: string, accountId: number }): Promise<CommandResult<void>>;
  deposit(cmd: DepositCommand): Promise<DepositResponse>;
  withdrawPrepare(cmd: WithdrawPrepareCommand): Promise<WithdrawPrepareResponse>;
  withdrawCommit(cmd: WithdrawCommitCommand): Promise<WithdrawCommitResponse>;
  withdrawAbort(cmd: WithdrawAbortCommand): Promise<WithdrawAbortResponse>;
  setNetDebitCap(cmd: SetNetDebitCapCommand): Promise<CommandResult<void>>;

  /**
   * Onboarding/Lifecycle Management Queries.
   */
  getHubAccounts(query: AnyQuery): Promise<HubAccountResponse>
  getDfsp(query: { dfspId: string }): Promise<QueryResultWithNotFound<LegacyLedgerDfsp>>
  getAllDfsps(query: AnyQuery): Promise<QueryResult<GetAllDfspsResponse>>
  getDfspAccounts(query: GetDfspAccountsQuery): Promise<DfspAccountResponse>
  getAllDfspAccounts(query: GetAllDfspAccountsQuery): Promise<DfspAccountResponse>
  getNetDebitCap(query: GetNetDebitCapQuery): Promise<QueryResultWithNotFound<LegacyLimit>>
  getNetDebitCaps(query: GetNetDebitCapsQuery): Promise<QueryResultWithNotFound<Array<LegacyLimitItem>>>


  /**
   * Clearing Methods.
   */

  /**
   * @method prepare
   * @description Prepares a payment for clearing, reserving the payment amount from the Payer's
   *   account to prevent double spending.
   */
  prepare(inputs: Array<PrepareHandlerInput>): Promise<Array<PaymentPrepareResult>>;

  /**
   * @method fulfil
   * @description Clears a previously prepared payment.
   */
  fulfil(inputs: Array<FulfilHandlerInput>): Promise<Array<PaymentFulfilResult>>;

  /**
   * @method sweepTimedOut
   * @description Looks through the ledger timed out transfers. Once a transfer has been swept,
   *  it will not be returned again with sweepForTimedOutTransfers()
   */
  sweepTimedOut(now: Date): Promise<CommandResult<TimeoutResult>>;

  /**
   * @method lookupTransfer
   * @description Looks up a previously created Mojaloop Transfer.
   */
  lookupTransfer(query: LookupTransferQuery): Promise<LookupTransferQueryResponse>

  /**
   * Settlement Methods
   */
  closeSettlementWindow(cmd: SettlementCloseWindowCommand): Promise<CommandResult<void>>
  settlementPrepare(cmd: SettlementPrepareCommand): Promise<CommandResult<{ id: number }>>;
  settlementAbort(cmd: SettlementAbortCommand): Promise<CommandResult<SettlementUpdateResult>>;

  /**
   * Update the internal, per Dfsp status of a Settlement
   */
  settlementUpdate(cmd: SettlementUpdateCommand): Promise<CommandResult<SettlementUpdateResult>>;

  getSettlementWindows(query: GetSettlementWindowsQuery): Promise<QueryResult<GetSettlementWindowsQueryResponse>>
  getSettlementWindow(query: GetSettlementWindowQuery): Promise<QueryResultWithNotFound<SettlementWindow>>
  getSettlement(query: GetSettlementQuery): Promise<QueryResultWithNotFound<Settlement>>
  getSettlements(query: GetSettlementsQuery): Promise<GetSettlementsQueryResponse>
}


// ============================================================================
// Common/Generic Types
// ============================================================================

/**
 * Generic interface for Ledger Commands
 * When T is void, result property is omitted
 */
export type CommandResultSuccess<T> = T extends void
  ? { type: 'SUCCESS' }
  : { type: 'SUCCESS'; result: T }

export type CommandResultFailure = {
  type: 'FAILURE'
  error: Error
}

export type CommandResult<T> = CommandResultSuccess<T> | CommandResultFailure

/**
 * Empty interface for queries that have no params
 */
export interface AnyQuery { }

// ============================================================================
// Domain Models
// ============================================================================

export interface SettlementModel {
  name: string
  settlementGranularity: string
  settlementInterchange: string
  settlementDelay: string
  currency: string
  requireLiquidityCheck: boolean
  ledgerAccountType: string
  settlementAccountType: string
  autoPositionReset: boolean
}

/**
 * Legacy Internal Represenation of a Dfsp.
 */
export interface LegacyLedgerDfsp {
  name: string
  isActive: boolean
  created: Date
  accounts: Array<LegacyLedgerAccountNoValue>,
  isProxy: boolean,
}


/**
 * Represents a ledger account
 *
 * For the TigerBeetle implementation, we throw away information to make it backwards compatible.
 *
 * Once everything is migrated to the TigerBeetle Ledger, we can deprecate this in favour of
 * LedgerAccount
 */
export type LegacyLedgerAccount = {
  id: bigint
  ledgerAccountType: string
  currency: string
  isActive: boolean
  value: number
  reservedValue: number
  changedDate: Date
  createdDate: Date
}

export type LegacyLedgerAccountNoValue = Omit<LegacyLedgerAccount, 'value' | 'reservedValue' | 'changedDate'>

/**
 * LedgerAccount with TigerBeetle Accounting Model
 */
export interface LedgerAccount {
  id: bigint
  code: AccountCode
  currency: string
  status: 'ENABLED' | 'DISABLED'
  creditsPending: bigint
  debitsPending: bigint
  creditsPosted: bigint
  debitsPosted: bigint
}

export enum AccountCode {
  Settlement_Balance = 10100,
  Deposit = 10200,
  Unrestricted = 20100,
  Clearing_Credit = 20101,
  Restricted = 20200,
  Reserved = 20300,
  Return = 20400,
  Committed_Outgoing = 20401,
  Dfsp = 60100,
  Net_Debit_Cap = 60200,
  Net_Debit_Cap_Control = 60201,
  Net_Debit_Cap_Set = 60210,
  Net_Debit_Cap_Set_Util = 60211,
  Dev_Null = 60300,
  Clearing_Setup = 60400,
  Clearing_Limit = 60500,
  /**
   * @deprecated, replaced by Net_Debit_Cap_Set and Net_Debit_Cap_Set_Util
   */
  Unrestricted_Lock = 60600,
  Settlement_Outgoing = 60701,
  Settlement_Incoming = 60702,

  Bookmark_Debit = 7100,
  Bookmark_Credit = 7101,
}

export enum TransferCode {
  Deposit = 10001,
  Withdraw = 20001,
  Clearing_Reserve = 30001,
  Clearing_Active_Check = 30002,
  Clearing_Fulfil = 30003,
  Clearing_Credit = 30004,
  Clearing_Reverse = 30005,
  Clearing_Burn_Id = 30006,
  Settlement_Deposit_Reduce = 40001,
  Settlement_Deposit_Increase = 40002,
  Net_Debit_Cap_Lock = 50001,
  Net_Debit_Cap_Sweep_To_Restricted = 50002,
  Net_Debit_Cap_Set_Limited = 50004,
  Net_Debit_Cap_Set_Unlimited = 50005,
  Net_Debit_Cap_Sweep_To_Unrestricted = 50006,
  Close_Account = 50007,
  Set_Net_Debit_Cap = 60001,
  Sweep_Bookmark = 7001
}

export const TransferCodeDescription = {
  [TransferCode.Deposit]: 'Deposit funds into Unrestricted',
  [TransferCode.Withdraw]: 'Withdraw funds',
  [TransferCode.Clearing_Reserve]: 'Reserve funds for Payee Participant.',
  [TransferCode.Clearing_Active_Check]: 'Ensure both Participants are active.',
  [TransferCode.Clearing_Fulfil]: 'Fulfil payment.',
  [TransferCode.Clearing_Credit]: 'Make credit available for transfers',
  [TransferCode.Clearing_Reverse]: 'Reverse reservation.',
  [TransferCode.Clearing_Burn_Id]: `Marks the payment as 'burned' so the id cannot be reused.`,
  [TransferCode.Settlement_Deposit_Reduce]: 'Reduce Deposit amount by sum of debits.',
  [TransferCode.Settlement_Deposit_Increase]: 'Increase Deposit amount by sum of credits.',
  [TransferCode.Net_Debit_Cap_Lock]: 'Temporarily lock up to the net debit cap amount.',
  [TransferCode.Net_Debit_Cap_Sweep_To_Restricted]: 'Sweep whatever remains in Unrestricted to Restricted.',
  [TransferCode.Net_Debit_Cap_Set_Limited]: 'Set the new Net Debit Cap to a finite number.',
  [TransferCode.Net_Debit_Cap_Set_Unlimited]: 'Set the new Net Debit Cap to unlimited.',
  [TransferCode.Net_Debit_Cap_Sweep_To_Unrestricted]: 'Sweep total balance from Restricted to Unrestricted',
  [TransferCode.Close_Account]: 'Close account.',
  [TransferCode.Set_Net_Debit_Cap]: 'Set net debit cap.',
  [TransferCode.Sweep_Bookmark]: 'Sweep bookmark.',
}


/**
 * Legacy Representation of the net debit cap limit, backwards compatible with the admin api
 */
export interface LegacyLimit {
  type: 'NET_DEBIT_CAP'
  value: number
  alarmPercentage: number
}

export interface LegacyLimitItem {
  currency: string,
  limit: LegacyLimit
}

export interface TimedOutTransfer {
  id: string
  payeeId: string
  payerId: string
}

// ============================================================================
// Lifecycle Commands (CreateHub/CreateDfsp/Deposit/Withdraw)
// ============================================================================

export interface CreateHubAccountCommand {
  currency: string
  /**
   * If provided, will create ONLY this account type, otherwise will create 
   * HUB_MULTILATERAL_SETTLEMENT and HUB_RECONCILIATION by default.
   */
  accountType?: string,
  settlementModel: SettlementModel,

  /**
   * The ids to assign to the participantCurrencyIds or specCurrencyAccount.id
   * Allows us to deterministically create hub accounts across ledgers.
   */
  ids?: Array<number>
}

export type CreateHubAccountResponse = {
  type: 'SUCCESS'
} | {
  type: 'ALREADY_EXISTS_HUB_ACCOUNT'
} | {
  type: 'ALREADY_EXISTS_SETTLEMENT_MODEL'
} | {
  type: 'FAILURE'
  error: Error
}

export interface CreateDfspCommand {
  dfspId: string
  isProxy: boolean
  currencies: Array<string>

  /**
   * Optionally provide a list of internal ids to be associated with the 
   * participantCurrency (LedgerSql) or specCurrencyAccount (LedgerTigerBeetle).
   *
   * This ensures determinism of the accountIds internally between both implementations.
   */
  ids?: Array<number>
}

export type CreateDfspResponse = {
  type: 'SUCCESS'
} | {
  type: 'ALREADY_EXISTS'
} | {
  type: 'FAILURE'
  error: Error
}

export interface DepositCommand {
  transferId: string
  dfspId: string
  currency: string
  amount: number
  reason: string,
}

export type DepositResponse = {
  type: 'SUCCESS'
} | {
  type: 'NOT_FOUND'
} | {
  type: 'ALREADY_EXISTS'
} | {
  type: 'FAILURE'
  error: Error
}

export interface WithdrawPrepareCommand {
  transferId: string
  dfspId: string
  currency: string
  amount: number
  reason: string
}

export type WithdrawPrepareResponse = {
  type: 'SUCCESS'
} | {
  type: 'INSUFFICIENT_FUNDS'
} | {
  type: 'FAILURE'
  error: Error
}

export interface WithdrawCommitCommand {
  transferId: string
}

export type WithdrawCommitResponse = {
  type: 'SUCCESS'
} | {
  type: 'FAILURE'
  error: Error
}

export interface WithdrawAbortCommand {
  transferId: string
}

export type WithdrawAbortResponse = {
  type: 'SUCCESS'
} | {
  type: 'FAILURE'
  error: Error
}

export interface EnableDfspAccountCommand {
  dfspId: string
  accountId: number
}

export interface DisableDfspAccountCommand {
  dfspId: string
  accountId: number
}

export type SetNetDebitCapCommand = {
  netDebitCapType: 'LIMITED'
  dfspId: string
  currency: string
  amount: number,
  alarmPercentage: number,
} | {
  netDebitCapType: 'UNLIMITED'
  dfspId: string
  currency: string
}

export type DeactivateDfspResponse = {
  type: 'SUCCESS'
} | {
  type: 'ALREADY_CLOSED' | 'CREATE_ACCOUNT'
} | {
  type: 'FAILURE'
  error: Error
}

export interface GetAllDfspsResponse {
  dfsps: Array<LegacyLedgerDfsp>
}

export interface GetDfspAccountsQuery {
  dfspId: string
  currency: string
}

export interface GetAllDfspAccountsQuery {
  dfspId: string
}

export type DfspAccountResponse = {
  type: 'SUCCESS'
  accounts: Array<LegacyLedgerAccount>
} | {
  type: 'NOT_FOUND'
  error: Error
} | {
  type: 'FAILURE'
  error: Error
}

export interface GetHubAccountsQuery { }

export type HubAccountResponse = {
  type: 'SUCCESS'
  createdDate: Date,
  accounts: Array<LegacyLedgerAccount>
} | {
  type: 'FAILURE'
  error: Error
}

export interface GetNetDebitCapQuery {
  dfspId: string
  currency: string
}

export interface GetNetDebitCapsQuery {
  dfspId: string
}

export interface LookupTransferQuery {
  /**
   * The mojaloop logical transfer id
   */
  transferId: string
}

export enum LookupTransferResultType {
  /**
   * Found transfer.
   */
  FOUND = 'FOUND',

  /**
   * Could not find the Transfer.
   */
  NOT_FOUND = 'NOT_FOUND',

  /**
   * Lookup failed
   */
  FAILED = 'FAILED',
}

export type LookupTransferQueryResponse = {
  type: LookupTransferResultType.FOUND,
  transfer: PayloadFinalizedTransfer
} | {
  type: LookupTransferResultType.NOT_FOUND
} | {
  type: LookupTransferResultType.FAILED
  error: Error
}


// ============================================================================
// Clearing
// ============================================================================

export enum PrepareResultType {
  /**
   * Prepare step completed validation
   */
  PASS = 'PASS',

  /**
   * Duplicate transfer found in a finalized state
   */
  DUPLICATE_FINAL = 'DUPLICATE_FINAL',

  /**
   * Duplicate transfer found that is still being processed
   */
  DUPLICATE_NON_FINAL = 'DUPLICATE_NON_FINAL',

  /**
   * An existing transfer exists with this id but different parameters
   */
  MODIFIED = 'MODIFIED',

  /**
   * Transfer failed validation
   */
  FAIL_VALIDATION = 'FAIL_VALIDATION',

  /**
   * Transfer failed as payer didn't have sufficent liquidity
   */
  FAIL_LIQUIDITY = 'FAIL_LIQUIDITY',

  /**
   * Catch-all Transfer failed for another reason
   */
  FAIL_OTHER = 'FAIL_OTHER',
}


export enum FulfilResultType {
  /**
   * Fulfil step completed validation. Transfer was either fulfilled succesfully or aborted
   * sucessfully
   */
  PASS = 'PASS',

  /**
   * Duplicate transfer found in a finalized state
   */
  DUPLICATE_FINAL = 'DUPLICATE_FINAL',

  /**
   * Duplicate transfer found that is still being processed
   */
  DUPLICATE_NON_FINAL = 'DUPLICATE_NON_FINAL',

  /**
   * Transfer failed validation
   */
  FAIL_VALIDATION = 'FAIL_VALIDATION',

  /**
   * Catch-all Transfer failed for another reason
   */
  FAIL_OTHER = 'FAIL_OTHER',
}

export type FulfilResult = {
  type: FulfilResultType.PASS
} | {
  type: FulfilResultType.DUPLICATE_FINAL
} | {
  type: FulfilResultType.FAIL_VALIDATION
  error: Error
} | {
  type: FulfilResultType.FAIL_OTHER
  error: Error
}

export type SweepResult = {
  type: 'SUCCESS'
  result: TimeoutResult
} | {
  type: 'FAILURE'
  error: Error
}

// ============================================================================
// Settlement 
// ============================================================================

export type SettlementCloseWindowCommand = {
  id: number,
  reason: string,
  now: Date
}

export type SettlementPrepareCommand = {
  windowIds: Array<number>,
  model: string,
  reason: string,
  now: Date
}

export type SettlementAbortCommand = {
  /**
   * The settlement id
   */
  id: number
  reason: string

}

export type SettlementUpdate = {
  participantId: number
  accountId: number
  participantState: 'PS_TRANSFERS_RECORDED'
  | 'PS_TRANSFERS_RESERVED'
  | 'PS_TRANSFERS_COMMITTED'
  | 'SETTLED'
  reason: string
  externalReference: string
}

export type SettlementUpdateCommand = {
  /**
   * The settlement id.
   */
  id: number

  /**
   * A list of updates to apply to the settlement.
   */
  updates: Array<SettlementUpdate>
}

export type CloseSettlementWindowResult = {
  changedDate: Date,
  createdDate: Date,
  reason: string,
  settlementWindowId: number,
  state: SettlementWindowState,
}

export type SettlementUpdateResult = {
  createdDate: Date,
  id: number,
  participants: Array<{
    accounts: Array<SettlementAccount>
    id: number
  }>
  settlementWindows: Array<SettlementWindow>
  state: LegacySettlementState
}

export type SettlementWindowState = 'OPEN' | 'CLOSED' | 'PENDING_SETTLEMENT' | 'SETTLED'
  | 'ABORTED' | 'PROCESSING' | 'FAILED'

export type InternalSettlementState =
  | 'PENDING_SETTLEMENT'
  | 'PS_TRANSFERS_RECORDED'
  | 'PS_TRANSFERS_RESERVED'
  | 'PS_TRANSFERS_COMMITTED'
  | 'SETTLING'
  | 'SETTLED'
  | 'ABORTED'

export type LegacySettlementState = 'PENDING_SETTLEMENT' | 'PS_TRANSFERS_RECORDED' | 'PS_TRANSFERS_RESERVED'
  | 'PS_TRANSFERS_COMMITTED' | 'SETTLING' | 'SETTLED' | 'ABORTED'

export type GetSettlementWindowsQuery = {
  participantId?: number
  state?: SettlementWindowState
  fromDateTime?: Date
  toDateTime?: Date,
  currency?: string
}

export type GetSettlementWindowQuery = {
  /**
   * The settlementWindowId.
   */
  id: number
}

export type GetSettlementWindowsQueryResponse = Array<SettlementWindow>

export type GetSettlementQuery = {
  /**
   * The settlement id of the settlement
   */
  id: number
}

export type GetSettlementsQuery = {
  currency?: string
  participantId?: number
  settlementWindowId?: number
  accountId?: number,
  state?: InternalSettlementState
  fromDateTime?: Date
  toDateTime?: Date,
  fromSettlementWindowDateTime?: Date,
  toSettlementWindowDateTime?: Date,
}

export type SettlementWindow = {
  settlementWindowId: number,
  state: SettlementWindowState,
  reason: string,
  createdDate: Date,
  changedDate: Date,
  content: Array<{
    id: number,
    state: string
    ledgerAccountType: string
    currencyId: string,
    createdDate: Date,
    changedDate: Date,
  }>
}

export type SettlementAccount = {
  id: number
  state: string
  reason: string,
  owing: number,
  owed: number,
  currency: string
  netSettlementAmount: {
    amount: string,
    currency: string
  }
}

export type Settlement = {
  id: number
  state: LegacySettlementState,
  reason: string,
  createdDate: Date,
  changedDate: Date,
  settlementWindows: Array<SettlementWindow>
  participants: Array<SettlementParticipant>
}

export type SettlementParticipant = {
  id: number,
  accounts: Array<SettlementAccount>
}

export type GetSettlementQueryResponse = Settlement & {
  type: 'FOUND',
} | {
  type: 'NOT_FOUND'
} | {
  type: 'FAILED',
  error: Error
}

export type GetSettlementsQueryResponse = QueryResult<Array<Settlement>>

export type SettlementPrepareCommandV2 = {

  /**
   * Unique id (64 bit bigint) to represent the settlement
   */
  settlementId: bigint,

  /**
   * Currency to be settled
   */
  currency: string,

  /**
   * The selector used to select Payments to be settled
   */
  selector: SettlementSelector
}

export type SettlementSelector = {
  type: 'LEDGER_TIMERANGE',

  /**
   * The minimum Ledger creation timestamp to include in the Settlement
   * inclusive range.
   */
  timestampMin: number,

  /**
   * The maximum Ledger creation timestamp to include in the Settlement
   * inclusive range.
   */
  timestampMax: number
} | {
  type: 'TRANSFER_ID',
  transferIds: Array<string>
}

// could also be batchId, time range from Dfsp's perspective?

export type SettlementReport = {
  payments: Array<Payment>
  currency: string
  participants: Array<string>
  netMoneyMovements: Record<string, NetMoneyMovement>
}

export type SettlementPrepareResult = {
  type: 'SUCCESS',
  report: SettlementReport
} | {
  // failure during the setup
  type: 'SETUP_FAILURE'
  error: Error
} | {
  type: 'UNKNOWN_FAILURE',
  error: Error
}


// Internal representation of a payment
type Payment = {
  status: 'CREATED' | 'ABORTED' | 'FULFILLED' | 'SETTLED'
  amount: number
  currency: string,
  payer: string,
  payee: string,
  // could do even better and have this as a dict based on the status
  transfers: Array<any>
}

type NetMoneyMovement = {
  participant: string,
  currency: string,
  owingGross: number
  owedGross: number
  net: {
    direction: 'OWING',
    amount: number
  } | {
    direction: 'OWED',
    amount: number
  }
}

/**
 * Convenience Types for QueryResult
 * When T is void, result property is omitted
 */

export type QueryResultSuccess<T> = T extends void
  ? { type: 'SUCCESS' }
  : { type: 'SUCCESS'; result: T }

export type QueryResultFailure = {
  type: 'FAILURE',
  error: Error
}

export type QueryResultNotFound = {
  type: 'NOT_FOUND',
  error: Error
}

export type QueryResult<T> = QueryResultSuccess<T> | QueryResultFailure
export type QueryResultWithNotFound<T> = QueryResultSuccess<T> | QueryResultNotFound | QueryResultFailure


/**
 * Mojaloop internal enums for things such as Transfer States, account types etc.
 * We inject these into the ledger so we don't need to keep looking them up from the db.
 */
export interface Enums {
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

export type PayloadFinalizedTransfer = {
  completedTimestamp: Date
  transferState: 'ABORTED'
} | {
  completedTimestamp: Date
  transferState: 'COMMITTED'
  fulfilment: string
}