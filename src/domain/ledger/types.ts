import { FSPIOPError } from '@mojaloop/central-services-error-handling'
import { PrepareHandlerInput, PaymentPrepareResult } from '../../handlers/payment-prepare';
import { FulfilHandlerInput, PaymentFulfilResult } from '../../handlers/payment-fulfil';
import { TimeoutResult } from '../../handlers/timeout-v2';

/**
 * Common interface for all Ledger implementations
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
  sweepTimedOut(now: Date): Promise<SweepResult>;

  /**
   * @method lookupTransfer
   * @description Looks up a previously created Mojaloop Transfer.
   * 
   * TODO(LD): We need to also include the transfer metadata, such as payer and payee ids
   *   in the response here, so that we can check if the ultimate caller of lookupTransfer
   *   is allowed to execute this request.
   */
  lookupTransfer(query: LookupTransferQuery): Promise<LookupTransferQueryResponse>

  /**
   * Settlement Methods
   */
  closeSettlementWindow(cmd: SettlementCloseWindowCommand): Promise<CommandResult<void>>
  settlementPrepare(cmd: SettlementPrepareCommand): Promise<CommandResult<{ id: number }>>;
  settlementAbort(cmd: SettlementAbortCommand): Promise<CommandResult<void>>;

  /**
   * Commit the settlement - this doesn't really match legacy settlement, since it depends
   * on the individual particpants to be updated internally
   */
  settlementCommit(cmd: SettlementCommitCommand): Promise<CommandResult<void>>;

  /**
   * Update the internal, per Dfsp status of a Settlement
   */
  settlementUpdate(cmd: SettlementUpdateCommand): Promise<CommandResult<void>>;

  getSettlementWindows(query: GetSettlementWindowsQuery): Promise<QueryResult<GetSettlementWindowsQueryResponse>>
  getSettlement(query: GetSettlementQuery): Promise<GetSettlementQueryResponse>
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
 * Legacy Internal Represenation of Dfsp
 */
export interface LegacyLedgerDfsp {
  name: string
  // TODO(LD): rename to simply active
  isActive: boolean
  created: Date
  accounts: Array<LegacyLedgerAccount>,
  isProxy: boolean,
}

/**
 * TigerBeetle Accounting model compatible represenation of the Dfsp
 */
export interface LedgerDfsp {
  name: string
  status: 'ENABLED' | 'DISABLED'
  created: Date
  accounts: Array<LedgerAccount>
}

/**
 * Represents a ledger account
 *
 * For the TigerBeetle implementation, we throw away information to make it backwards compatible.
 *
 * Once everything is migrated to the TigerBeetle Ledger, we can deprecate this in favour of
 * LedgerAccount
 */
export interface LegacyLedgerAccount {
  // TODO(LD): should this be a number?
  id: bigint
  ledgerAccountType: string
  currency: string
  isActive: boolean
  value: number
  reservedValue: number
  // TODO(LD): When do we actually use this? What does it mean?
  // E.g. in the TigerBeetle world, can it be just the creation date since
  // accounts cannot be modified? Or should it include the reopen date
  // if we closed and reopened an account?
  changedDate: Date
  createdDate: Date
}

/**
 * LedgerAccount with TigerBeetle Accounting Model
 *
 * Outside of the boundaries of the Ledger, we map from a BigInt represenation -> currency base
 */
export interface LedgerAccount {
  id: bigint
  code: AccountCode
  currency: string
  status: 'ENABLED' | 'DISABLED'

  // TODO: why did we prefix with `real`? This is bad naming.
  /**
   * sum(credits_pending)/assetScale
   */
  realCreditsPending: number

  /**
   * sum(debits_pending)/assetScale
   */
  realDebitsPending: number

  /**
   * sum(credits_posted)/assetScale
   */
  realCreditsPosted: number

  /**
   * sum(debits_posted)/assetScale
   */
  realDebitsPosted: number
}

export enum AccountCode {
  // TODO: rename - we should save Settlement* for accounts that get used in settlement
  Settlement_Balance = 10100,
  Deposit = 10200,
  Unrestricted = 20100,
  Clearing_Credit = 20101,
  Restricted = 20200,
  Reserved = 20300,
  Committed_Outgoing = 20400,
  Dfsp = 60100,
  Net_Debit_Cap = 60200,
  Net_Debit_Cap_Control = 60201,
  Dev_Null = 60300,
  Clearing_Setup = 60400,
  Clearing_Limit = 60500,
  Unrestricted_Lock = 60600,
  Settlement_Outgoing = 60701,
  Settlement_Incoming = 60702,

  // TODO(LD): remove me! 
  TIMEOUT = 9000,
}

export enum TransferCode {
  Deposit = 10001,
  Withdraw = 20001,
  Clearing_Reserve = 30001,
  Clearing_Active_Check = 30002,
  Clearing_Fulfil = 30003,
  Clearing_Credit = 30004,
  Clearing_Reverse = 30005,
  Settlement_Deposit_Reduce = 40001,
  Settlement_Deposit_Increase = 40002,
  Net_Debit_Cap_Lock = 50001,
  Net_Debit_Cap_Sweep_To_Restricted = 50002,
  Net_Debit_Cap_Set_Limited = 50004,
  Net_Debit_Cap_Set_Unlimited = 50005,
  Net_Debit_Cap_Sweep_To_Unrestricted = 50006,
  Close_Account = 50007,
}

export const TransferCodeDescription = {
  [TransferCode.Deposit]: 'Deposit funds into Unrestricted',
  [TransferCode.Withdraw]: 'Withdraw funds',
  [TransferCode.Clearing_Reserve]: 'Reserve funds for Payee Participant.',
  [TransferCode.Clearing_Active_Check]: 'Ensure both Participants are active.',
  [TransferCode.Clearing_Fulfil]: 'Fulfil payment.',
  [TransferCode.Clearing_Credit]: 'Make credit available for transfers',
  [TransferCode.Clearing_Reverse]: 'Reverse reservation.',
  [TransferCode.Settlement_Deposit_Reduce]: 'Reduce Deposit amount by sum of debits.',
  [TransferCode.Settlement_Deposit_Increase]: 'Increase Deposit amount by sum of credits.',
  [TransferCode.Net_Debit_Cap_Lock]: 'Temporarily lock up to the net debit cap amount.',
  [TransferCode.Net_Debit_Cap_Sweep_To_Restricted]: 'Sweep whatever remains in Unrestricted to Restricted.',
  [TransferCode.Net_Debit_Cap_Set_Limited]: 'Set the new Net Debit Cap to a finite number.',
  [TransferCode.Net_Debit_Cap_Set_Unlimited]: 'Set the new Net Debit Cap to unlimited.',
  [TransferCode.Net_Debit_Cap_Sweep_To_Unrestricted]: 'Sweep total balance from Restricted to Unrestricted',
  [TransferCode.Close_Account]: 'Close account.',
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
  settlementModel: SettlementModel
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

export enum DeactivateDfspResponseType {
  /**
   * Closed the account successfully
   */
  SUCCESS = 'SUCCESS',

  /**
   * Account is already closed
   */
  ALREADY_CLOSED = 'ALREADY_CLOSED',

  /**
   * Retryable error - control account not created
   */
  CREATE_ACCOUNT = 'CREATE_ACCOUNT',

  /**
   * Fatal Error
   */
  FAILED = 'FAILED'
}

export type DeactivateDfspResponse = {
  type: DeactivateDfspResponseType.SUCCESS | DeactivateDfspResponseType.ALREADY_CLOSED
} | {
  type: DeactivateDfspResponseType.CREATE_ACCOUNT
} | {
  type: DeactivateDfspResponseType.FAILED
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
  error: FSPIOPError
} | {
  type: 'FAILURE'
  error: FSPIOPError
}

export interface GetHubAccountsQuery { }

export type HubAccountResponse = {
  type: 'SUCCESS'
  createdDate: Date,
  accounts: Array<LegacyLedgerAccount>
} | {
  type: 'FAILURE'
  error: FSPIOPError
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
   * Found transfer, it's in a non final state.
   */
  FOUND_NON_FINAL = 'FOUND_NON_FINAL',

  /**
   * Found transfer, it's in a final state.
   */
  FOUND_FINAL = 'FOUND_FINAL',

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
  type: LookupTransferResultType.FOUND_NON_FINAL,
  // Transfer amount from Clearing Credit -> Reserved
  amountClearingCredit: bigint
  // Transfer amount from Unrestricted -> Reserved
  amountUnrestricted: bigint
} | {
  type: LookupTransferResultType.FOUND_FINAL
  finalizedTransfer: {
    completedTimestamp: string
    transferState: 'ABORTED' | 'COMMITTED'
    fulfilment?: string
  }
} | {
  type: LookupTransferResultType.NOT_FOUND
} | {
  type: LookupTransferResultType.FAILED
  error: FSPIOPError
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
   * Transfer failed as payee didn't have sufficent liquidity
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
  error: FSPIOPError
} | {
  type: FulfilResultType.FAIL_OTHER
  error: FSPIOPError
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

/**
 * In the new ledger interface, we either commit a prepared settlement or
 * abort it. All participants are settled at the same time.
 * 
 * We may want to revist this decision later on to provide better interop with
 * the Settlement API, but maintaining the 
 *  PS_TRANSFERS_RECORDED -> PS_TRANSFERS_RESERVED -> PS_TRANSFERS_COMMITTED
 * 
 * For each Dfsp
 */
export type SettlementCommitCommand = {

}

export type SettlementUpdateCommand = {
  /**
   * The settlement id
   */
  id: number

  /**
   * A list of updates to apply to the settlement
   */
  updates: Array<{
    participantId: number

    /**
     * TODO(LD):
     * Not sure if we need this, but it's on the API.
     * I suspect it shouldn't be, since accountId is internal and shouldn't be exposed
     */
    accountId: number
    participantState: 'RECORDED' | 'RESERVED' | 'COMMITTED' | 'SETTLED',
    reason: string
    externalReference: string
  }>
}

export type SettlementWindowState = 'OPEN' | 'CLOSED' | 'PENDING_SETTLEMENT' | 'SETTLED'
  | 'ABORTED' | 'PROCESSING' | 'FAILED'

export type InternalSettlementState = 'PENDING' | 'PROCESSING' | 'COMMITTED' | 'ABORTED'

// TODO: we should remove this completely
export type LegacySettlementState = 'PENDING_SETTLEMENT' | 'PS_TRANSFERS_RECORDED' | 'PS_TRANSFERS_RESERVED'
  | 'PS_TRANSFERS_COMMITTED' | 'SETTLING' | 'SETTLED' | 'ABORTED'

export type GetSettlementWindowsQuery = {
  participantId?: number
  state?: SettlementWindowState
  fromDateTime?: Date
  toDateTime?: Date,
  currency?: string
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
  state?: InternalSettlementState
  fromDateTime?: Date
  toDateTime?: Date,
}

export type SettlementWindow = {
  id: number,
  state: SettlementWindowState,
  reason: string,
  createdDate: Date,
  // TODO(LD): I don't know what this is meant to be. The closed date? or does that not get used?
  changedDate: Date,
  content: Array<{
    id: number,
    // TODO(LD): better typing
    state: string
    // TODO(LD): better typing
    ledgerAccountType: string
    currencyId: string,
    createdDate: Date,
    changedDate: Date,
  }>
}

export type SettlementAccount = {
  id: number
  // TODO(LD): better typing
  state: string
  reason: string,
  owing: number,
  owed: number,
  currency: string

  // legacy amount
  netSettlementAmount: {
    // TODO(LD): should this be a number?
    amount: string,
    currency: string
  }
}

export type Settlement = {
  id: number
  settlementModel: string,
  // TODO(LD): refactor to just SettlementState, and adapt on the outside
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
  // TODO(LD): This should be Logical Transfers
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

// TODO: can we just combine this into QueryResult?
export type QueryResultWithNotFound<T> = QueryResultSuccess<T> | QueryResultNotFound | QueryResultFailure

export function failureWithError(error: any): QueryResultFailure {
  return {
    type: 'FAILURE',
    error
  }
}