import { failureWithError, QueryResult } from "../../../shared/results"
import { Account, AccountFlags, amount_max, Client, CreateTransferResult, CreateTransferStatus, id, Transfer, TransferFlags } from "tigerbeetle-node";
import crypto, { hash } from "crypto";
import assert from "assert";
import { ContextDfsps, CurrencyConfig, DfspCurrency, DfspRoot, InternalDfspCurrency, NetDebitCap, SpecPrepare, SpecTransfer, SpecTransferCreate } from "./spec-store";
import { AccountCode, LedgerAccount, LegacyLedgerAccountNoValue, PayloadFinalizedTransfer, TransferCode } from "../shared/types";
import { CreatePaymentDto, PaymentPrepareResult, PaymentPrepareResultType, PrepareHandlerInput } from "../../../handlers/payment-prepare";
import { FulfilHandlerAction, FulfilHandlerInput, PaymentFulfilResultType } from "../../../handlers/payment-fulfil";
import { Effect } from "../../../messaging/message-bus";
import { ApplicationConfig } from "../../../lib/config";
import { Enum, Util } from '@mojaloop/central-services-shared';
import { rootCertificates } from "tls";
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const { Type, Action } = Enum.Events.Event

export type TransferFailureResult<T> = CreateTransferResult & {
  type: T
}

export type PrepareInternalStatus = {
  tag: 'FAIL_VALIDATION'
  // TODO:
  context: {
    failureReasons: Array<string>
  }
} | {
  tag: 'MODIFIED',
  context: {}
} | {
  tag: 'DUPLICATE_FINAL'
  context: {
    specPrepare: SpecPrepare,
    specTransfer?: SpecTransfer,
  }
} | {
  tag: 'DUPLICATE_NON_FINAL'
  context: {}
} | {
  tag: 'FAIL_ACCOUNT_CLOSED'
  context: {}
} | {
  tag: 'FAIL_LIQUIDITY'
  context: {}
} | {
  tag: 'FAIL_OTHER'
  context: {}
}
  | {
    tag: 'OK'
  }

type PrepareInternalStatusTag = PrepareInternalStatus['tag']



export type PrepareFailureType = 'FAIL_LIQUIDITY' | 'PAYER_CLOSED' | 'PAYEE_CLOSED' | 'MODIFIED' |
  'EXISTS' | 'UNKNOWN' | 'ALREADY_FAILED'
export type AbortFailureType = 'ALREADY_ABORTED' | 'ALREADY_FULFILLED' | 'NOT_FOUND' | 'UNKNOWN'
export type FulfilFailureType = 'ALREADY_ABORTED' | 'PAYER_CLOSED' | 'PAYEE_CLOSED' | 'ALREADY_FULFILLED'
  | 'NOT_FOUND' | 'PAYER_ACCOUNT_CLOSED' | 'PAYEE_ACCOUNT_CLOSED' | 'METADATA_CORRUPTED' | 'UNKNOWN'
export type WithdrawPrepareFailureType = 'DFSP_CLOSED' | 'ACCOUNT_CLOSED' | 'TRANSFER_ID_REUSED' | 'INSUFFICIENT_FUNDS' |
  'UNKNOWN'
export type WithdrawCommitFailureType = 'NOT_FOUND' | 'UNKNOWN' | 'ALREADY_COMMITTED' | 'ALREADY_ABORTED' | 'ACCOUNT_CLOSED'
export type WithdrawAbortFailureType = 'NOT_FOUND' | 'UNKNOWN' | 'ALREADY_COMMITTED' | 'ALREADY_ABORTED'
export type DepositFailureType = 'EXISTS' | 'MODIFIED' | 'UNKNOWN' | 'CLOSED'
export type SetNetDebitCapFailureType = 'UNKNOWN'
export type CloseDfspMasterAccountFailureType = 'DEBIT_ACCOUNT_NOT_FOUND' | 'ALREADY_CLOSED' | 'UNKNOWN'
export type EnableDfspAccountFailureType = 'ALREADY_ENABLED' | 'UNKNOWN'
export type DisableDfspAccountFailureType = 'ALREADY_CLOSED' | 'UNKNOWN'
export type SettlementPrepareCreateAccountsFailureType = 'UNKNOWN'

interface InterledgerValidationPass {
  type: 'PASS'
}

interface InterledgerValidationFail {
  type: 'FAIL',
  reason: string
}

export type InterledgerValidationResult = InterledgerValidationPass
  | InterledgerValidationFail


interface Dependencies {
  randomBytes: (length: number) => Buffer,
  config: ApplicationConfig
}

export default class Helper {

  constructor(private deps: Dependencies) {
    assert(deps.randomBytes)
    assert(deps.config)
  }

  /**
   * Global account ids that persist across all Ledgers
   */
  public static accountIds = {
    // TODO(LD): Find better account ids
    bookmarkDebit: 1000n,
    bookmarkCredit: 1001n,

    /**
     * Counterparty account for Master Ledger
     * Essentially a /dev/null for Accounts
     */
    devNull: 80000000000n,

    /**
     * A counterparty control account for burning prepares.
     */
    prepareBurn: 80000000001n
  }

  /**
   * Fixed ledger ids
   */
  public static ledgerIds = {
    globalControl: 9000,
    /**
     * @deprecated
     */
    timeoutHandler: 9001,
  }

  /**
   * @deprecated
   */
  public static transferCodes = {
    unknown: 1,
    timeoutBookmark: 9000,
  }

  public static maxBatchSize = 8189

  public static createAccountTemplate = {
    debits_pending: 0n,
    debits_posted: 0n,
    credits_pending: 0n,
    credits_posted: 0n,
    user_data_128: 0n,
    user_data_64: 0n,
    user_data_32: 0,
    reserved: 0,
    timestamp: 0n,
  }

  public static createTransferTemplate = {
    user_data_128: 0n,
    user_data_64: 0n,
    user_data_32: 0,
    timeout: 0,
    code: 1,
    timestamp: 0n,
    pending_id: 0n,
  }

  /**
   * Hash transfer properties to detect modifications
   * Returns a 32-bit integer hash for use in user_data
   */
  public static hashTransferProperties(props: {
    amount: string,
    currency: string,
    expiration: string,
    payeeFsp: string,
    payerFsp: string,
    condition: string,
    ilpPacket: string
  }): number {
    // Create a deterministic string representation of the transfer
    const transferString = [
      props.amount,
      props.currency,
      props.expiration,
      props.payeeFsp,
      props.payerFsp,
      props.condition,
      props.ilpPacket
    ].join('|')

    // Hash with SHA-256 and take first 32 bits
    const hash = crypto.createHash('sha256').update(transferString).digest()
    const hash32 = hash.readInt32BE(0)
    return hash32
  }

  /**
   * Hash transfer properties to detect modifications
   * Returns a 32-bit integer hash for use in user_data
   */
  public static hashTransferProperties2(props: {
    amount: {
      amount: string,
      currency: string,
    },
    expiration: string,
    payeeFsp: string,
    payerFsp: string,
    condition: string,
    ilpPacket: string
  }): number {
    // Create a deterministic string representation of the transfer
    const transferString = [
      props.amount.amount,
      props.amount.currency,
      props.expiration,
      props.payeeFsp,
      props.payerFsp,
      props.condition,
      props.ilpPacket
    ].join('|')

    // Hash with SHA-256 and take first 32 bits
    const hash = crypto.createHash('sha256').update(transferString).digest()
    const hash32 = hash.readInt32BE(0)

    // TODO: this is sometimes negative!
    return hash32
  }

  public static async safeLookupAccounts(client: Client, accountIds: Array<bigint>):
    Promise<QueryResult<Array<Account>>> {
    if (accountIds.length === 0) {
      return {
        type: 'SUCCESS',
        result: []
      }
    }
    const accounts = await client.lookupAccounts(accountIds)
    if (accounts.length !== accountIds.length) {
      return failureWithError(new Error(`account lookup mismatch. Expected: ${accountIds.length}, \
        but instead found: ${accounts.length}`))
    }

    return {
      type: 'SUCCESS',
      result: accounts
    }
  }

  /**
   * Create a random bigint id within Number.MAX_SAFE_INTEGER (53 bits)
   * 
   * TigerBeetle Accounts can be 128 bits, but since the Admin API uses javascript/json numbers
   * to maintain backwards compatibility, we generate our own random accountIds under 
   * Number.MAX_SAFE_INTEGER to be safe.
   */
  // TODO: we should also namespace this so we can have multiple runs against a single TB instance.
  public idSmall(): bigint {
    const bytes = this.deps.randomBytes(8)
    const value = bytes.readBigUInt64BE();
    return value & 0x1FFFFFFFFFFFFFn;
  }

  /**
   * Generate a set of TigerBeetle ledger ids based on a count for the number of currencies
   * registered.
   * 
   * E.g. if 0 currencies are registered, then we get [100, 101], then [200, 201].
   * 
   * We probably want to come up with a more sophisticated ledger scheme at some point.
   */
  public static generateLedgerIds(currentCount: number): [number, number] {
    const base = (currentCount + 1) * 100
    return [base, base + 1]
  }

  public buildAccountsDfsp(
    spec: DfspCurrency,
    currencyLedger: CurrencyConfig,
    masterAccountId: bigint
  ): Array<Account> {
    const ledgerOperation = currencyLedger.idOperation
    const accounts: Array<Account> = [
      // Settlement_Balance
      {
        ...Helper.createAccountTemplate,
        id: currencyLedger.settlementBalance,
        ledger: ledgerOperation,
        code: AccountCode.Settlement_Balance,
        flags: 0,
      },
      // dev/null account
      {
        ...Helper.createAccountTemplate,
        id: Helper.accountIds.devNull,
        ledger: Helper.ledgerIds.globalControl,
        code: AccountCode.Dev_Null,
        flags: 0,
      },
      // Global 
      {
        ...Helper.createAccountTemplate,
        id: Helper.accountIds.prepareBurn,
        ledger: Helper.ledgerIds.globalControl,
        code: AccountCode.Dev_Null,
        flags: 0,
      },
      // Dfsp/Participant account. Keeps track of Dfsp active/not active and creation timestamp
      {
        ...Helper.createAccountTemplate,
        id: masterAccountId,
        ledger: Helper.ledgerIds.globalControl,
        // TODO: rename this code DfspRoot
        code: AccountCode.Dfsp,
        flags: 0,
        // Store the application-side DFSP Creation time on the Root Account.
        user_data_64: BigInt((new Date()).getTime())
      },
      // Deposit
      {
        ...Helper.createAccountTemplate,
        id: spec.deposit,
        ledger: ledgerOperation,
        code: AccountCode.Deposit,
        flags: AccountFlags.linked | AccountFlags.credits_must_not_exceed_debits
      },
      // Unrestricted
      {
        ...Helper.createAccountTemplate,
        id: spec.unrestricted,
        ledger: ledgerOperation,
        code: AccountCode.Unrestricted,
        flags: AccountFlags.linked | AccountFlags.debits_must_not_exceed_credits,
      },
      // Unrestricted_Lock
      {
        ...Helper.createAccountTemplate,
        id: spec.unrestrictedLock,
        ledger: ledgerOperation,
        code: AccountCode.Unrestricted_Lock,
        flags: AccountFlags.linked | AccountFlags.debits_must_not_exceed_credits,
      },
      // Restricted
      {
        ...Helper.createAccountTemplate,
        id: spec.restricted,
        ledger: ledgerOperation,
        code: AccountCode.Restricted,
        flags: AccountFlags.linked | AccountFlags.debits_must_not_exceed_credits,
      },
      // Reserved
      {
        ...Helper.createAccountTemplate,
        id: spec.reserved,
        ledger: ledgerOperation,
        code: AccountCode.Reserved,
        flags: AccountFlags.linked | AccountFlags.debits_must_not_exceed_credits,
      },
      // Committed_Outgoing
      {
        ...Helper.createAccountTemplate,
        id: spec.commitedOutgoing,
        ledger: ledgerOperation,
        code: AccountCode.Committed_Outgoing,
        flags: AccountFlags.debits_must_not_exceed_credits,
      },
      // Clearing_Setup
      {
        ...Helper.createAccountTemplate,
        id: spec.clearingSetup,
        ledger: ledgerOperation,
        code: AccountCode.Clearing_Setup,
        flags: 0,
      },
      // Clearing_Limit
      {
        ...Helper.createAccountTemplate,
        id: spec.clearingLimit,
        ledger: ledgerOperation,
        code: AccountCode.Clearing_Limit,
        flags: AccountFlags.debits_must_not_exceed_credits,
      },
      // Clearing_Credit
      {
        ...Helper.createAccountTemplate,
        id: spec.clearingCredit,
        ledger: ledgerOperation,
        code: AccountCode.Clearing_Credit,
        flags: AccountFlags.debits_must_not_exceed_credits,
      },
      // Control 
      {
        ...Helper.createAccountTemplate,
        id: spec.control,
        ledger: currencyLedger.idControl,
        code: AccountCode.Net_Debit_Cap_Control,
        flags: 0,
      },
      // Net Debit Cap
      {
        ...Helper.createAccountTemplate,
        id: spec.netDebitCap,
        ledger: currencyLedger.idControl,
        code: AccountCode.Net_Debit_Cap,
        flags: 0,
      },
      // Net Debit Cap Set
      {
        ...Helper.createAccountTemplate,
        id: spec.netDebitCapSet,
        ledger: currencyLedger.idOperation,
        code: AccountCode.Net_Debit_Cap_Set,
        flags: 0,
      },
      {
        ...Helper.createAccountTemplate,
        id: spec.netDebitCapSetUtil,
        ledger: currencyLedger.idOperation,
        code: AccountCode.Net_Debit_Cap_Set_Util,
        flags: 0,
      },
    ]

    return accounts
  }

  /**
   * Reusable transfer template for setting the net debit cap.
   * This ensures we apply the net debit cap across the Unrestricted and Restricted account, 
   * while also counting the Reserved funds against the net debit cap.
   * 
   * Example DRCR Snippet:
   * 
   * USD DR dfsp_a:ndc_set      CR dfsp_a:ndc_set_util   900
   * USD DR dfsp_a:restricted   CR dfsp_a:unrestricted 10000 balancing_debit
   * USD DR dfsp_a:reserved     CR dfsp_a:ndc_set      10000 balancing_debit,pending ^14
   * USD DR dfsp_a:unrestricted CR dfsp_a:ndc_set      10000 balancing_credit,pending ^15
   * USD DR dfsp_a:unrestricted CR dfsp_a:restricted   10000 balancing_debit
   * USD DR dfsp_a:unrestricted CR dfsp_a:ndc_set          0 void_pending_transfer ^15
   * USD DR dfsp_a:reserved     CR dfsp_a:ndc_set          0 void_pending_transfer ^14
   * USD DR dfsp_a:ndc_set_util CR dfsp_a:ndc_set        900 balancing_debit
   */
  public transferTemplateNDC(
    netDebitCapLockAmount: bigint,
    spec: DfspCurrency,
    currencyConfig: CurrencyConfig
  ): Array<Transfer> {
    const idLockReserved = id()
    const idLockUnrestricted = id()
    return [
      // Set the Net_Debit_Cap_Set account to the NDC Value.
      {
        ...Helper.createTransferTemplate,
        id: id(),
        debit_account_id: spec.netDebitCapSet,
        credit_account_id: spec.netDebitCapSetUtil,
        amount: netDebitCapLockAmount,
        ledger: currencyConfig.idOperation,
        code: TransferCode.Net_Debit_Cap_Lock,
        flags: TransferFlags.linked
      },
      // Sweep total balance from Restricted to Unrestricted.
      {
        ...Helper.createTransferTemplate,
        id: id(),
        debit_account_id: spec.restricted,
        credit_account_id: spec.unrestricted,
        amount: amount_max,
        ledger: currencyConfig.idOperation,
        code: TransferCode.Net_Debit_Cap_Sweep_To_Unrestricted,
        flags: TransferFlags.linked | TransferFlags.balancing_debit
      },
      // Reduce the Net_Debit_Cap_Set amount by the reserved amount.
      {
        ...Helper.createTransferTemplate,
        id: idLockReserved,
        debit_account_id: spec.reserved,
        credit_account_id: spec.netDebitCapSet,
        amount: amount_max,
        ledger: currencyConfig.idOperation,
        code: TransferCode.Net_Debit_Cap_Lock,
        flags: TransferFlags.linked | TransferFlags.pending | TransferFlags.balancing_debit
      },
      // Temporarily lock up the remaining net debit amount after subtracting reserved.
      {
        ...Helper.createTransferTemplate,
        id: idLockUnrestricted,
        debit_account_id: spec.unrestricted,
        credit_account_id: spec.netDebitCapSet,
        amount: amount_max,
        ledger: currencyConfig.idOperation,
        code: TransferCode.Net_Debit_Cap_Lock,
        flags: TransferFlags.linked 
          | TransferFlags.pending 
          | TransferFlags.balancing_credit 
          | TransferFlags.balancing_debit
      },
      // Sweep remaining funds in Unrestricted to Restricted.
      {
        ...Helper.createTransferTemplate,
        id: id(),
        debit_account_id: spec.unrestricted,
        credit_account_id: spec.restricted,
        amount: amount_max,
        ledger: currencyConfig.idOperation,
        code: TransferCode.Net_Debit_Cap_Sweep_To_Restricted,
        flags: TransferFlags.linked | TransferFlags.balancing_debit
      },
      // Reset the pending locks.
      {
        ...Helper.createTransferTemplate,
        id: id(),
        pending_id: idLockUnrestricted,
        debit_account_id: 0n,
        credit_account_id: 0n,
        amount: 0n,
        ledger: currencyConfig.idOperation,
        code: TransferCode.Net_Debit_Cap_Lock,
        flags: TransferFlags.linked | TransferFlags.void_pending_transfer
      },
      {
        ...Helper.createTransferTemplate,
        id: id(),
        pending_id: idLockReserved,
        debit_account_id: 0n,
        credit_account_id: 0n,
        amount: 0n,
        ledger: currencyConfig.idOperation,
        code: TransferCode.Net_Debit_Cap_Lock,
        flags: TransferFlags.linked | TransferFlags.void_pending_transfer
      },
      // Reset the Net_Debit_Cap_Set account to zero.
      {
        ...Helper.createTransferTemplate,
        id: id(),
        debit_account_id: spec.netDebitCapSetUtil,
        credit_account_id: spec.netDebitCapSet,
        amount: netDebitCapLockAmount,
        ledger: currencyConfig.idOperation,
        code: TransferCode.Net_Debit_Cap_Lock,
        flags: TransferFlags.balancing_debit
      }
    ]
  }

  public buildTransfersDeposit(
    transferId: string,
    amount: number,
    netDebitCap: NetDebitCap,
    spec: DfspCurrency,
    currencyConfig: CurrencyConfig
  ): Array<Transfer> {
    const tranferDeposit = {
      ...Helper.createTransferTemplate,
      id: Helper.fromMojaloopId(transferId),
      debit_account_id: spec.deposit,
      credit_account_id: spec.unrestricted,
      amount: Helper.toTigerBeetleAmount(amount, currencyConfig.assetScale),
      ledger: currencyConfig.idOperation,
      code: TransferCode.Deposit,
      flags: 0
    }
    if (netDebitCap.type === 'UNLIMITED') {
      return [tranferDeposit]
    }

    tranferDeposit.flags = TransferFlags.linked
    return [
      tranferDeposit,
      ...this.transferTemplateNDC(netDebitCap.amount, spec, currencyConfig)
    ]
  }

  public buildTransfersWithdrawPrepare(
    transferId: string,
    amount: number,
    netDebitCap: NetDebitCap,
    spec: DfspCurrency,
    master: DfspRoot,
    currencyConfig: CurrencyConfig,
  ): Array<Transfer> {
    if (netDebitCap.type === 'UNLIMITED') {
      return [
        // Ensure DFSP is active.
        {
          ...Helper.createTransferTemplate,
          id: id(),
          debit_account_id: Helper.accountIds.devNull,
          credit_account_id: master.id,
          amount: 0n,
          ledger: Helper.ledgerIds.globalControl,
          code: 1,
          flags: TransferFlags.linked,
        },
        // Prepare the withdrawal.
        {
          ...Helper.createTransferTemplate,
          id: Helper.fromMojaloopId(transferId),
          debit_account_id: spec.unrestricted,
          credit_account_id: spec.deposit,
          amount: Helper.toTigerBeetleAmount(amount, currencyConfig.assetScale),
          ledger: currencyConfig.idOperation,
          code: TransferCode.Withdraw,
          flags: TransferFlags.pending
        },
      ]
    }

    return [
      // Ensure DFSP is active.
      {
        ...Helper.createTransferTemplate,
        id: id(),
        debit_account_id: Helper.accountIds.devNull,
        credit_account_id: master.id,
        amount: 0n,
        ledger: Helper.ledgerIds.globalControl,
        code: 1,
        flags: TransferFlags.linked,
      },
      // Sweep Restricted funds to Unrestricted.
      {
        ...Helper.createTransferTemplate,
        id: id(),
        debit_account_id: spec.restricted,
        credit_account_id: spec.unrestricted,
        amount: amount_max,
        ledger: currencyConfig.idOperation,
        code: TransferCode.Net_Debit_Cap_Sweep_To_Unrestricted,
        flags: TransferFlags.linked | TransferFlags.balancing_debit
      },
      // Prepare the withdrawal.
      {
        ...Helper.createTransferTemplate,
        id: Helper.fromMojaloopId(transferId),
        debit_account_id: spec.unrestricted,
        credit_account_id: spec.deposit,
        amount: Helper.toTigerBeetleAmount(amount, currencyConfig.assetScale),
        ledger: currencyConfig.idOperation,
        code: TransferCode.Withdraw,
        flags: TransferFlags.linked | TransferFlags.pending
      },
      ...this.transferTemplateNDC(netDebitCap.amount, spec, currencyConfig)
    ]
  }

  public mapWithdrawPrepareToPrepareResult(
    results: Array<CreateTransferResult>,
    netDebitCap: NetDebitCap,
  ): Array<TransferFailureResult<WithdrawPrepareFailureType>> {
    const fatalErrors: Array<TransferFailureResult<WithdrawPrepareFailureType>> = []
    if (netDebitCap.type === 'UNLIMITED') {
      assert(results.length === 2)
      results.forEach((result, idx) => {
        // Ignore noisy errors
        if (result.status === CreateTransferStatus.linked_event_failed) return
        if (result.status === CreateTransferStatus.created) return

        if (idx === 0) {
          switch (result.status) {
            case CreateTransferStatus.credit_account_already_closed:
              fatalErrors.push({ type: 'DFSP_CLOSED', ...result })
              return
          }
        }

        if (idx === 1) {
          switch (result.status) {
            // Insufficent funds masks the reusal error.
            // And because we ignore the insufficent funds errors, we can't properly pull out the
            // proper response.
            case CreateTransferStatus.exceeds_credits:
              fatalErrors.push({ type: 'INSUFFICIENT_FUNDS', ...result })
              return
            case CreateTransferStatus.debit_account_already_closed:
              fatalErrors.push({ type: 'ACCOUNT_CLOSED', ...result })
              return
            case CreateTransferStatus.exists:
              fatalErrors.push({ type: 'TRANSFER_ID_REUSED', ...result })
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
            case CreateTransferStatus.id_already_failed:
              fatalErrors.push({ type: 'TRANSFER_ID_REUSED', ...result })
              return
          }
        }

        throw new Error(`unhandled transfer error: ${idx}, ${CreateTransferStatus[result.status]}`)
      })

      return fatalErrors
    }

    assert(netDebitCap.type === 'LIMITED')
    results.forEach((result, idx) => {
      assert(results.length === 11)
      // Ignore noisy errors
      if (result.status === CreateTransferStatus.linked_event_failed) return
      if (result.status === CreateTransferStatus.created) return

      if (idx === 0) {
        switch (result.status) {
          case CreateTransferStatus.credit_account_already_closed:
            fatalErrors.push({ type: 'DFSP_CLOSED', ...result })
            return
        }
      }

      if (idx === 1) {
        switch (result.status) {
          case CreateTransferStatus.credit_account_already_closed:
            fatalErrors.push({ type: 'ACCOUNT_CLOSED', ...result })
            return
        }
      }

      if (idx === 2) {
        switch (result.status) {
          // Insufficent funds masks the reusal error.
          // And because we ignore the insufficent funds errors, we can't properly pull out the
          // proper response.
          case CreateTransferStatus.exceeds_credits:
            fatalErrors.push({ type: 'INSUFFICIENT_FUNDS', ...result })
            return
          case CreateTransferStatus.debit_account_already_closed:
            fatalErrors.push({ type: 'ACCOUNT_CLOSED', ...result })
            return
          case CreateTransferStatus.exists:
            fatalErrors.push({ type: 'TRANSFER_ID_REUSED', ...result })
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
          case CreateTransferStatus.id_already_failed:
            fatalErrors.push({ type: 'TRANSFER_ID_REUSED', ...result })
            return
        }
      }

      throw new Error(`unhandled transfer error: ${idx}, ${CreateTransferStatus[result.status]}`)
    })
    return fatalErrors
  }


  public buildTranfersSetNetDebitCap(
    dfspCurrency: DfspCurrency,
    currencyConfig: CurrencyConfig,
    amountNetDebitCap: bigint,
    netDebitCapType: 'LIMITED' | 'UNLIMITED',
    alarmPercentage: number,
  ): Array<Transfer> {
    const idLockTransfer = id()
    const transfers: Array<Transfer> = [
      // TODO: add in the 
      // CTL DR dfsp_a:netDebitCap  CR dfsp_a:control          10000 balancing_debit
      // to reset the amount of netDebitCap

      // NDC is encoded on the latest Transfer to the net debit cap control account.
      {
        ...Helper.createTransferTemplate,
        id: id(),
        debit_account_id: dfspCurrency.control,
        credit_account_id: dfspCurrency.netDebitCap,
        amount: amountNetDebitCap,
        ledger: currencyConfig.idControl,
        user_data_64: BigInt(alarmPercentage),
        user_data_32: netDebitCapType === 'LIMITED' ? 1 : 0,
        code: TransferCode.Set_Net_Debit_Cap,
        flags: TransferFlags.linked
      },
      ...this.transferTemplateNDC(
        netDebitCapType === 'LIMITED' ? amountNetDebitCap : amount_max,
        dfspCurrency,
        currencyConfig
      )

      // // Sweep total balance from Restricted to Unrestricted
      // {
      //   ...Helper.createTransferTemplate,
      //   id: id(),
      //   debit_account_id: dfspCurrency.restricted,
      //   credit_account_id: dfspCurrency.unrestricted,
      //   amount: amount_max,
      //   ledger: currencyConfig.idOperation,
      //   code: TransferCode.Net_Debit_Cap_Sweep_To_Unrestricted,
      //   flags: TransferFlags.linked | TransferFlags.balancing_debit
      // },
      // // Move the new NDC amount out to a temporary account.
      // // if the new NDC amount is unlimited, then move all into temporary account.
      // {
      //   ...Helper.createTransferTemplate,
      //   id: idLockTransfer,
      //   debit_account_id: dfspCurrency.unrestricted,
      //   credit_account_id: dfspCurrency.unrestrictedLock,
      //   amount: netDebitCapType === 'LIMITED' ? amountNetDebitCap : amount_max,
      //   ledger: currencyConfig.idOperation,
      //   code: TransferCode.Net_Debit_Cap_Lock,
      //   flags: TransferFlags.linked | TransferFlags.balancing_debit | TransferFlags.pending
      // },
      // // Sweep whatever remains in Unrestricted to Restricted.
      // {
      //   ...Helper.createTransferTemplate,
      //   id: id(),
      //   debit_account_id: dfspCurrency.unrestricted,
      //   credit_account_id: dfspCurrency.restricted,
      //   amount: amount_max,
      //   ledger: currencyConfig.idOperation,
      //   code: TransferCode.Net_Debit_Cap_Sweep_To_Restricted,
      //   flags: TransferFlags.linked | TransferFlags.balancing_debit
      // },
      // // Void the pending limit lock transfer.
      // {
      //   ...Helper.createTransferTemplate,
      //   id: id(),
      //   pending_id: idLockTransfer,
      //   debit_account_id: 0n,
      //   credit_account_id: 0n,
      //   amount: 0n,
      //   ledger: currencyConfig.idOperation,
      //   code: TransferCode.Net_Debit_Cap_Lock,
      //   flags: TransferFlags.void_pending_transfer
      // },
    ]

    return transfers
  }

  public buildTransferSpecs(prepares: Array<PrepareHandlerInput>): Array<SpecTransfer> {
    const specs: Array<SpecTransfer> = []
    prepares.forEach(prepare => {
      const spec: SpecTransfer = {
        id: prepare.transferId,
        currency: prepare.payload.amount.currency,
        amount: prepare.payload.amount.amount,
        expiration: prepare.payload.expiration,
        payerId: prepare.payload.payerFsp,
        payeeId: prepare.payload.payeeFsp,
        ilpCondition: prepare.payload.condition,
        ilpPacket: prepare.payload.ilpPacket
      }

      specs.push(spec)
    })

    return specs
  }

  public buildSpecsPrepare(prepares: Array<PrepareHandlerInput>): Array<SpecPrepare> {
    return prepares.map(prepare => {
      return {
        id: prepare.transferId,
        payloadHash: Helper.hashTransferProperties({
          amount: prepare.payload.amount.amount,
          currency: prepare.payload.amount.currency,
          expiration: prepare.payload.expiration,
          payeeFsp: prepare.payload.payeeFsp,
          payerFsp: prepare.payload.payerFsp,
          condition: prepare.payload.condition,
          ilpPacket: prepare.payload.ilpPacket,
        })
      }
    })
  }

  /**
   * How many TigerBeetle transfers for each Prepare.
   */
  public static readonly ampFactorPrepare = 7

  /**
   * Given a list of validated prepares, return a list of TigerBeetle transfers to be created.
   */
  public buildTransfersPrepare(
    prepares: Array<PrepareHandlerInput>,
    context: ContextDfsps,
    hashes: Array<number>
  ): Array<Transfer> {
    assert(prepares.length === hashes.length)
    const physicalTransfers = prepares.length * Helper.ampFactorPrepare
    assert(physicalTransfers <= Helper.maxBatchSize,
      `buildPrepareTransfersOk() called with: ${prepares.length} prepares === ${physicalTransfers} `
      + `physical transfers. This exceeds the max batch size of ${Helper.maxBatchSize}.`
    )

    const currencyLedgersMap = Helper.toMapBy(context.currencyConfigs, item => item.currency)
    const dfspRootsMap = Helper.toMapBy(
      context.dfspRoots, item => item.dfspId
    )
    const dfspCurrenciesMap = Helper.toMapBy(
      context.dfspCurrencies,
      item => `${item.dfspId}:${item.currency}`
    )

    const transfers: Array<Transfer> = []
    prepares.forEach((prepare, idx) => {
      // Shortcut.
      const amountStr = prepare.payload.amount.amount
      const currency = prepare.payload.amount.currency
      const masterAccountPayer = dfspRootsMap[prepare.payload.payerFsp]
      assert(masterAccountPayer)
      const masterAccountPayee = dfspRootsMap[prepare.payload.payeeFsp]
      assert(masterAccountPayee)
      const specPayer = dfspCurrenciesMap[prepare.payload.payerFsp + ':' + currency]
      assert(specPayer)
      const specPayee = dfspCurrenciesMap[prepare.payload.payeeFsp + ':' + currency]
      assert(specPayee)

      // TODO: come back to this - we need to ensure increasing ids.
      const prepareId = Helper.fromMojaloopId(prepare.transferId)
      const ledger = currencyLedgersMap[currency]
      assert(ledger)
      const assetScale = ledger.assetScale
      const amountTigerBeetle = Helper.fromMojaloopAmount(amountStr, assetScale)

      /**
       * In future versions of the FSPIOP API, expiration will be defined in relative seconds,
       * instead of absolute timestamps. That will make the below timeout calculations less error
       * prone.
       */
      // TODO: validate these before this step.
      const expirationMs = Date.parse(prepare.payload.expiration)
      if (isNaN(expirationMs)) {
        throw new Error(`invalid transfer expiration`)
      }

      // Hash key properties of the transfer for idempotency/modification detection
      const transferHash = hashes[idx]
      assert(transferHash)

      // DRCR Example Snippet:
      // GLB DR dfsp_a:root           CR dfsp_b:root             45 pending ^3
      // USD DR dfsp_a:clearingSetup  CR dfsp_a:clearingLimit    45
      // USD DR dfsp_a:clearingCredit CR dfsp_a:clearingSetup    45 balancing_debit
      // USD DR dfsp_a:unrestricted   CR dfsp_a:clearingSetup    45 balancing_debit
      // USD DR dfsp_a:clearingSetup  CR dfsp_a:reserved         45
      // USD DR dfsp_a:clearingLimit  CR dfsp_a:clearingSetup 10000 balancing_credit

      const transfersPrepare = [
        // 1. Ensure both Participants are active.
        {
          ...Helper.createTransferTemplate,
          id: prepareId,
          debit_account_id: masterAccountPayer.id,
          credit_account_id: masterAccountPayee.id,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          user_data_64: BigInt(expirationMs),
          user_data_32: transferHash,
          ledger: Helper.ledgerIds.globalControl,
          code: TransferCode.Clearing_Active_Check,
          flags: TransferFlags.linked | TransferFlags.pending,
        },
        // 2. Ensure both Participant's currency accounts are active
        {
          ...Helper.createTransferTemplate,
          id: id(),
          debit_account_id: specPayer.unrestricted,
          credit_account_id: specPayee.unrestricted,
          amount: 0n,
          user_data_128: prepareId,
          ledger: ledger.idOperation,
          code: TransferCode.Clearing_Active_Check,
          flags: TransferFlags.linked,
        },
        // Note: This is the Multi-Debit, single Credit pattern from TigerBeetle.
        // https://docs.tigerbeetle.com/coding/recipes/multi-debit-credit-transfers/#multiple-debits-single-credit-balancing-debits
        // 3. Setup the limit account for this payment.
        {
          ...Helper.createTransferTemplate,
          id: id(),
          debit_account_id: specPayer.clearingSetup,
          credit_account_id: specPayer.clearingLimit,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          ledger: ledger.idOperation,
          code: 1,
          flags: TransferFlags.linked
        },
        // 4. Reserve funds for Participant A from Clearing Credit.
        {
          ...Helper.createTransferTemplate,
          id: id(),
          debit_account_id: specPayer.clearingCredit,
          credit_account_id: specPayer.clearingSetup,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          ledger: ledger.idOperation,
          code: TransferCode.Clearing_Reserve,
          flags: TransferFlags.linked | TransferFlags.balancing_debit
        },
        // 5. Reserve funds for Participant A from Unrestricted.
        {
          ...Helper.createTransferTemplate,
          id: id(),
          debit_account_id: specPayer.unrestricted,
          credit_account_id: specPayer.clearingSetup,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          ledger: ledger.idOperation,
          code: TransferCode.Clearing_Reserve,
          flags: TransferFlags.linked | TransferFlags.balancing_debit
        },
        // 6. The money movement.
        {
          ...Helper.createTransferTemplate,
          id: prepareId + 3n,
          debit_account_id: specPayer.clearingSetup,
          credit_account_id: specPayer.reserved,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          ledger: ledger.idOperation,
          code: TransferCode.Clearing_Reserve,
          flags: TransferFlags.linked
        },
        // 7. Close the loop, resetting clearingSetup.
        {
          ...Helper.createTransferTemplate,
          id: id(),
          debit_account_id: specPayer.clearingLimit,
          credit_account_id: specPayer.clearingSetup,
          amount: amount_max,
          user_data_128: prepareId,
          ledger: ledger.idOperation,
          code: 1,
          flags: TransferFlags.balancing_credit
        },
      ]

      // console.log(Helper.formatTransfersAsDRCR(transfersPrepare, [specPayer], [masterAccountPayer], ledger))
      transfers.push(...transfersPrepare)
    })


    return transfers
  }

  /**
   * Map from a PrepareInternalStatus -> PaymentPrepareResult.
   */
  public mapPrepareInternalToPrepareResult(
    prepare: PrepareHandlerInput,
    status: PrepareInternalStatus
  ): PaymentPrepareResult {
    switch (status.tag) {
      case "OK": {
        return {
          type: PaymentPrepareResultType.PASS,
          effects: [this.buildEffectNotificationSuccess(prepare)]
        }
      }
      case "FAIL_VALIDATION": {
        const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          status.context.failureReasons.join(', ')
        )
        return {
          type: PaymentPrepareResultType.FAIL_VALIDATION,
          effects: [this.buildEffectNotificationError(prepare, errorFspiop)],
          failureReasons: status.context.failureReasons
        }
      }
      case "MODIFIED": {
        const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST
        )
        return {
          type: PaymentPrepareResultType.MODIFIED,
          effects: [this.buildEffectNotificationError(prepare, errorFspiop)]
        }
      }
      case "DUPLICATE_FINAL": {
        const payload: PayloadFinalizedTransfer = {
          completedTimestamp: status.context.specPrepare.abortedAt ?? new Date(0),
          transferState: 'ABORTED'
        }
        return {
          type: PaymentPrepareResultType.DUPLICATE_FINAL,
          effects: [this.buildEffectNotificationDuplicate(prepare, payload)],
          finalizedTransfer: {
            completedTimestamp: payload.completedTimestamp.toISOString(),
            transferState: 'ABORTED'
          }
        }
      }
      case "DUPLICATE_NON_FINAL": {
        return {
          type: PaymentPrepareResultType.DUPLICATE_NON_FINAL,
          effects: []
        }
      }
      case "FAIL_ACCOUNT_CLOSED": {
        const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          'Validation error'
        )
        return {
          type: PaymentPrepareResultType.FAIL_VALIDATION,
          effects: [this.buildEffectNotificationError(prepare, errorFspiop)],
          failureReasons: ['Account closed.']
        }
      }
      case "FAIL_LIQUIDITY": {
        const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_INSUFFICIENT_LIQUIDITY
        )
        return {
          type: PaymentPrepareResultType.FAIL_LIQUIDITY,
          effects: [this.buildEffectNotificationErrorLiquidity(prepare, errorFspiop)],
          error: errorFspiop
        }
      }
      case "FAIL_OTHER": {
        const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR
        )
        return {
          type: PaymentPrepareResultType.FAIL_OTHER,
          effects: [this.buildEffectNotificationError(prepare, errorFspiop)],
          error: errorFspiop
        }
      }
    }
  }

  public mapResultsPrepare(
    results: Array<CreateTransferResult>,
  ): Array<PrepareInternalStatus> {
    const preparesCount = results.length / Helper.ampFactorPrepare
    // Initialize all statuses as OK
    const statuses: Array<PrepareInternalStatus> = Array.from(
      { length: preparesCount },
      () => ({ tag: 'OK' })
    )

    results.forEach((result, idxAllTransfers) => {
      if (result.status === CreateTransferStatus.created) return

      const idxPrepare = Math.floor(idxAllTransfers / Helper.ampFactorPrepare)
      const idxTransfer = idxAllTransfers % Helper.ampFactorPrepare

      // Ignore noisy errors
      if (result.status === CreateTransferStatus.linked_event_failed) return

      if (idxTransfer === 0) {
        switch (result.status) {
          case CreateTransferStatus.exists:
            statuses[idxPrepare] = { tag: 'DUPLICATE_NON_FINAL', context: {} }
            return
          case CreateTransferStatus.exists_with_different_amount:
          case CreateTransferStatus.exists_with_different_debit_account_id:
          case CreateTransferStatus.exists_with_different_credit_account_id:
          case CreateTransferStatus.exists_with_different_user_data_64:
          case CreateTransferStatus.exists_with_different_user_data_32:
          case CreateTransferStatus.id_already_failed:
            statuses[idxPrepare] = { tag: 'MODIFIED', context: {} }
            return
          case CreateTransferStatus.debit_account_already_closed:
          case CreateTransferStatus.credit_account_already_closed:
            statuses[idxPrepare] = { tag: 'FAIL_ACCOUNT_CLOSED', context: {} }
            return
        }
      }

      if (idxTransfer === 1) {
        switch (result.status) {
          case CreateTransferStatus.debit_account_already_closed:
          case CreateTransferStatus.credit_account_already_closed:
            statuses[idxPrepare] = { tag: 'FAIL_ACCOUNT_CLOSED', context: {} }
            return
        }
      }

      if (idxTransfer === 4) {
        switch (result.status) {
          case CreateTransferStatus.debit_account_already_closed:
            statuses[idxPrepare] = { tag: 'FAIL_ACCOUNT_CLOSED', context: {} }
            return
        }
      }

      if (idxTransfer === 6) {
        switch (result.status) {
          case CreateTransferStatus.exceeds_credits:
            statuses[idxPrepare] = { tag: 'FAIL_LIQUIDITY', context: {} }
            return
        }
      }

      const msg = `mapResultsPrepare: unhandled transfer result at idx ${idxAllTransfers}: ${CreateTransferStatus[result.status]}`
      throw new Error(msg)
    })

    return statuses
  }

  public buildPrepareTransfersOk(
    prepares: Array<PrepareHandlerInput>,
    currencyLedgers: Record<string, CurrencyConfig>,
    masterSpecs: Record<string, DfspRoot>,
    specAccounts: Record<string, DfspCurrency>
  ): Array<Transfer> {
    const physicalTransfers = prepares.length * Helper.ampFactorPrepare
    assert(physicalTransfers <= Helper.maxBatchSize,
      `buildPrepareTransfersOk() called with: ${prepares.length} prepares === ${physicalTransfers} `
      + `physical transfers. This exceeds the max batch size of ${Helper.maxBatchSize}.`
    )

    const transfers: Array<Transfer> = []
    for (const prepare of prepares) {
      // Shortcut.
      const amountStr = prepare.payload.amount.amount
      const currency = prepare.payload.amount.currency
      const masterAccountPayer = masterSpecs[prepare.payload.payerFsp]
      assert(masterAccountPayer)
      const masterAccountPayee = masterSpecs[prepare.payload.payeeFsp]
      assert(masterAccountPayee)
      const specPayer = specAccounts[prepare.payload.payerFsp + ':' + currency]
      assert(specPayer)
      const specPayee = specAccounts[prepare.payload.payeeFsp + ':' + currency]
      assert(specPayee)

      // TODO: come back to this - we need to ensure increasing ids.
      const prepareId = Helper.fromMojaloopId(prepare.transferId)
      const ledger = currencyLedgers[currency]
      assert(ledger)
      const assetScale = ledger.assetScale
      const amountTigerBeetle = Helper.fromMojaloopAmount(amountStr, assetScale)

      /**
       * In future versions of the FSPIOP API, expiration will be defined in relative seconds,
       * instead of absolute timestamps. That will make the below timeout calculations less error
       * prone.
       */
      // TODO: validate these before this step.
      const expirationMs = Date.parse(prepare.payload.expiration)
      if (isNaN(expirationMs)) {
        throw new Error(`invalid transfer expiration`)
      }

      // Hash key properties of the transfer for idempotency/modification detection
      const transferHash = Helper.hashTransferProperties({
        amount: amountStr,
        currency: currency,
        expiration: prepare.payload.expiration,
        payeeFsp: prepare.payload.payeeFsp,
        payerFsp: prepare.payload.payerFsp,
        condition: prepare.payload.condition,
        ilpPacket: prepare.payload.ilpPacket,
      })

      // DRCR Example Snippet:
      // GLB DR dfsp_a:root           CR dfsp_b:root             45 pending ^3
      // USD DR dfsp_a:clearingSetup  CR dfsp_a:clearingLimit    45
      // USD DR dfsp_a:clearingCredit CR dfsp_a:clearingSetup    45 balancing_debit
      // USD DR dfsp_a:unrestricted   CR dfsp_a:clearingSetup    45 balancing_debit
      // USD DR dfsp_a:clearingSetup  CR dfsp_a:reserved         45
      // USD DR dfsp_a:clearingLimit  CR dfsp_a:clearingSetup 10000 balancing_credit

      transfers.push(
        // 1. Ensure both Participants are active.
        {
          ...Helper.createTransferTemplate,
          id: prepareId,
          debit_account_id: masterAccountPayer.id,
          credit_account_id: masterAccountPayee.id,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          user_data_64: BigInt(expirationMs),
          user_data_32: transferHash,
          ledger: Helper.ledgerIds.globalControl,
          code: TransferCode.Clearing_Active_Check,
          flags: TransferFlags.linked | TransferFlags.pending,
        },
        // Note: This is the Multi-Debit, single Credit pattern from TigerBeetle.
        // https://docs.tigerbeetle.com/coding/recipes/multi-debit-credit-transfers/#multiple-debits-single-credit-balancing-debits
        // 2. Setup the limit account for this payment.
        {
          ...Helper.createTransferTemplate,
          id: id(),
          debit_account_id: specPayer.clearingSetup,
          credit_account_id: specPayer.clearingLimit,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          ledger: ledger.idOperation,
          code: 1,
          flags: TransferFlags.linked
        },
        // 3. Reserve funds for Participant A from Clearing Credit.
        {
          ...Helper.createTransferTemplate,
          id: id(),
          debit_account_id: specPayer.clearingCredit,
          credit_account_id: specPayer.clearingSetup,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          ledger: ledger.idOperation,
          code: TransferCode.Clearing_Reserve,
          flags: TransferFlags.linked | TransferFlags.balancing_debit
            | TransferFlags.balancing_credit
        },
        // 3. Reserve funds for Participant A from Unrestricted.
        {
          ...Helper.createTransferTemplate,
          id: id(),
          debit_account_id: specPayer.unrestricted,
          credit_account_id: specPayer.clearingSetup,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          ledger: ledger.idOperation,
          code: TransferCode.Clearing_Reserve,
          flags: TransferFlags.linked | TransferFlags.balancing_debit
            | TransferFlags.balancing_credit
        },
        // 4. The money movement.
        {
          ...Helper.createTransferTemplate,
          id: prepareId + 3n,
          debit_account_id: specPayer.clearingSetup,
          credit_account_id: specPayer.reserved,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          ledger: ledger.idOperation,
          code: TransferCode.Clearing_Reserve,
          flags: TransferFlags.linked
        },
        // 5. Close the loop, resetting clearingSetup.
        {
          ...Helper.createTransferTemplate,
          id: id(),
          debit_account_id: specPayer.clearingLimit,
          credit_account_id: specPayer.clearingSetup,
          amount: amount_max,
          user_data_128: prepareId,
          ledger: ledger.idOperation,
          code: 1,
          flags: TransferFlags.balancing_credit
        },
      )
    }

    return transfers
  }

  /**
   * In case the prepare failed validation for some reason, we still want to record it in 
   * TigerBeetle so we can check for idempotency.
   */
  public buildPrepareTransfersBurn(
    prepares: Array<PrepareHandlerInput>,
  ): Array<Transfer> {
    const transfers: Array<Transfer> = []

    for (const prepare of prepares) {
      const amountStr = prepare.payload.amount.amount
      const currency = prepare.payload.amount.currency
      const prepareId = Helper.fromMojaloopId(prepare.transferId)
      if (prepare.transferId === '27d9a584-afff-4be8-a459-e6e35727986b') {
        console.log(`mojaId: ${prepare.transferId} -> tbId: ${prepareId}`)
      }

      // Hash key properties of the transfer for idempotency/modification detection
      const transferHash = Helper.hashTransferProperties({
        amount: amountStr,
        currency: currency,
        expiration: prepare.payload.expiration,
        payeeFsp: prepare.payload.payeeFsp,
        payerFsp: prepare.payload.payerFsp,
        condition: prepare.payload.condition,
        ilpPacket: prepare.payload.ilpPacket,
      })

      // We know that we can at least create this transfer.
      transfers.push(
        {
          ...Helper.createTransferTemplate,
          id: prepareId,
          debit_account_id: Helper.accountIds.devNull,
          credit_account_id: Helper.accountIds.prepareBurn,
          amount: 0n,
          user_data_128: prepareId,
          // Store the application-side prepare-burn time on the Root Account.
          user_data_64: BigInt((new Date()).getTime()),
          user_data_32: transferHash,
          ledger: Helper.ledgerIds.globalControl,
          code: TransferCode.Clearing_Burn_Id,
          flags: 0
        }
      )
    }

    return transfers
  }

  /**
   * For the Prepare Transfers, convert from TigerBeetle results => Application Results.
   */
  public mapResultsPrepareOk(
    results: Array<CreateTransferResult>,
    preparesMap: Record<string, PrepareHandlerInput>
  ): Record<string, Array<TransferFailureResult<PrepareFailureType>>> {
    const fatalErrors: Record<string, Array<TransferFailureResult<PrepareFailureType>>> = {}
    // Initialize the errors.
    Object.values(preparesMap).forEach(prepare => {
      fatalErrors[prepare.transferId] = []
    })

    results.forEach((result, idxAllTransfers) => {
      // We can skip this.
      if (result.status === CreateTransferStatus.created) return

      // Figure out what prepare we're handling.
      const idxPrepare = Math.floor(idxAllTransfers / Helper.ampFactorPrepare)
      const prepare = Object.values(preparesMap)[idxPrepare]
      assert(prepare)
      const transferId = prepare.transferId

      // The individual transfer within the prepare.
      const idxTransfer = idxAllTransfers % Helper.ampFactorPrepare

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
      throw new Error(msg)
    })

    return fatalErrors
  }

  /**
   * For the Prepare Burn Transfers, convert from TigerBeetle results => Application Results.
   */
  public mapResultsPrepareBurn(
    results: Array<CreateTransferResult>,
    preparesMap: Record<string, PrepareHandlerInput>
  ): Record<string, Array<TransferFailureResult<PrepareFailureType>>> {
    const fatalErrors: Record<string, Array<TransferFailureResult<PrepareFailureType>>> = {}
    // Initialize the errors.
    Object.values(preparesMap).forEach(prepare => {
      fatalErrors[prepare.transferId] = []
    })

    results.forEach((result, idxAllTransfers) => {
      // We can skip this.
      if (result.status === CreateTransferStatus.created) return

      // Figure out what prepare we're handling.
      const idxPrepare = Math.floor(idxAllTransfers / 1)
      const prepare = Object.values(preparesMap)[idxPrepare]
      assert(prepare)
      const transferId = prepare.transferId

      // The individual transfer within the prepare.
      const idxTransfer = idxAllTransfers % 1

      // Ignore noisy errors
      if (result.status === CreateTransferStatus.linked_event_failed) {
        return
      }

      // TODO: think through these
      if (idxTransfer === 0) {
        switch (result.status) {
          case CreateTransferStatus.exists: {
            fatalErrors[transferId].push({ type: 'EXISTS', ...result })
            return
          }
          case CreateTransferStatus.exists_with_different_amount:
          case CreateTransferStatus.exists_with_different_debit_account_id:
          case CreateTransferStatus.exists_with_different_credit_account_id:
          case CreateTransferStatus.exists_with_different_flags:
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
            fatalErrors[transferId].push({ type: 'ALREADY_FAILED', ...result })
            return
        }
      }

      const msg = `unhandled transfer result: ${idxAllTransfers}, ${CreateTransferStatus[result.status]}`
      throw new Error(msg)
    })

    return fatalErrors
  }

  /**
   * Build the TigerBeetle Transfers for the fulfil inputs.
   * Note that this is using the existing accounting model, which gives the payee dfsp clearing
   * credit above their net debit cap. 
   */
  public buildTransfersFulfil(
    fulfils: Array<FulfilHandlerInput>,
    specTransfers: Array<SpecTransfer>,
    currencyLedgers: Record<string, CurrencyConfig>,
    specCurrencyAccounts: Record<string, DfspCurrency>,
  ): Array<Transfer> {
    assert.equal(fulfils.length, specTransfers.length)

    const transfers: Array<Transfer> = []
    for (let idx = 0; idx < fulfils.length; idx++) {
      const fulfil = fulfils[idx]
      const specTransfer = specTransfers[idx]
      assert(fulfil)
      assert(specTransfer)

      const ledger = currencyLedgers[specTransfer.currency]
      assert(ledger, `No ledger found for specTransfer.currency: ${specTransfer.currency}.`)
      // TODO: ideally we wouldn't have to have the amount in the spec store.
      const amountTigerBeetle = Helper.fromMojaloopAmount(specTransfer.amount, ledger.assetScale)

      const prepareId = Helper.fromMojaloopId(fulfil.transferId)
      const specPayer = specCurrencyAccounts[`${specTransfer.payerId}:${specTransfer.currency}`]
      assert(specPayer, `SpecPayer not found for payerId: ${specTransfer.payerId} and currency: ${specTransfer.currency}.`)
      const specPayee = specCurrencyAccounts[`${specTransfer.payeeId}:${specTransfer.currency}`]
      assert(specPayee, `SpecPayer not found for payeeId: ${specTransfer.payeeId} and currency: ${specTransfer.currency}.`)

      // Hmm we probably need to use this.
      const transferHash = Helper.hashTransferProperties({
        amount: specTransfer.amount,
        currency: specTransfer.currency,
        expiration: specTransfer.expiration,
        payeeFsp: specTransfer.payeeId,
        payerFsp: specTransfer.payerId,
        condition: specTransfer.ilpCondition,
        ilpPacket: specTransfer.ilpPacket,
      })

      // DRCR Example Snippet:
      // GLB DR dfsp_a:root     CR dfsp_b:root           45 post_pending_transfer ^1
      // USD DR dfsp_a:reserved CR dfsp_b:clearingCredit 45

      transfers.push(
        // 1. Complete the logical payment.
        {
          ...Helper.createTransferTemplate,
          id: id(),
          pending_id: prepareId,
          debit_account_id: 0n,
          credit_account_id: 0n,
          user_data_128: prepareId,
          amount: 0n,
          ledger: 0,
          code: 0,
          flags: TransferFlags.linked | TransferFlags.post_pending_transfer,
        },
        // 2. Make credit available for transfers.
        {
          ...Helper.createTransferTemplate,
          id: id(),
          debit_account_id: specPayee.reserved,
          credit_account_id: specPayee.clearingCredit,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          ledger: ledger.idOperation,
          code: TransferCode.Clearing_Credit,
          flags: 0
        },
      )
    }
    return transfers
  }

  public static fromMojaloopId(mojaloopId: string): bigint {
    assert(mojaloopId)
    // TODO: assert that this actually is a uuid

    const hex = mojaloopId.replace(/-/g, '');
    return BigInt(`0x${hex}`);
  }

  public static toMojaloopId(id: bigint): string {
    assert(id !== undefined && id !== null, 'id is required')

    // Convert bigint to hex string (without 0x prefix)
    let hex = id.toString(16);

    // Pad to 32 characters (128 bits = 16 bytes = 32 hex chars)
    hex = hex.padStart(32, '0');

    // Insert dashes to create UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }


  /**
    * Converts a Mojaloop amount string to a bigint representation based on the currency's scale
    */
  public static fromMojaloopAmount(amountStr: string, currencyScale: number): bigint {
    assert(currencyScale >= 0)
    assert(currencyScale <= 10)
    // Validate input
    if (typeof amountStr !== 'string') {
      throw new Error('Amount must be a string');
    }

    if (!/^-?\d+(\.\d+)?$/.test(amountStr.trim())) {
      throw new Error('Invalid amount format. Expected format: "123.45" or "123"');
    }

    const trimmed = amountStr.trim();
    const [integerPart, decimalPart = ''] = trimmed.split('.');

    const normalizedDecimal = decimalPart.padEnd(currencyScale, '0').slice(0, currencyScale);
    const combinedStr = integerPart + normalizedDecimal;

    return BigInt(combinedStr);
  }


  /**
    * Checks that the fulfilment matches the preimage
    * 
    * From the Mojaloop FSPIOP Specification v1.1:
    * https://docs.mojaloop.io/api/fspiop/v1.1/api-definition.html#interledger-payment-request-2
    * 
    * > The fulfilment is submitted to the Payee FSP ledger to instruct the ledger to commit the 
    * > reservation in favor of the Payee. The ledger will validate that the SHA-256 hash of the
    * > fulfilment matches the condition attached to the transfer. If it does, it commits the 
    * > reservation of the transfer. If not, it rejects the transfer and the Payee FSP rejects the 
    * > payment and cancels the previously-performed reservation.
    * 
    */
  public static validateFulfilmentAndCondition(fulfilment: string, condition: string):
    InterledgerValidationResult {
    try {
      assert(fulfilment)
      assert(condition)
      const preimage = Buffer.from(fulfilment, 'base64url')
      if (preimage.length !== 32) {
        return {
          type: 'FAIL',
          reason: 'Interledger preimages must be exactly 32 bytes'
        }
      }

      const calculatedCondition = crypto.createHash('sha256')
        .update(preimage)
        .digest('base64url')

      if (calculatedCondition !== condition) {
        return {
          type: 'FAIL',
          reason: 'Condition and Fulfillment mismatch'
        }
      }

      return {
        type: 'PASS'
      }
    } catch (err: any) {
      return {
        type: "FAIL",
        reason: err.message
      }
    }
  }

  /**
   * Convert from a real positive number money amount to a TigerBeetle Ledger representation.
   */
  public static toTigerBeetleAmount(input: number, assetScale: number): bigint {
    assert(input >= 0, `toTigerBeetleAmount expected 0 or positive number`)
    assert(assetScale >= -7)
    assert(assetScale <= 8)
    const valueMultiplier = 10 ** assetScale

    // we have to do this before converting to BigInt because input could be a decimal.
    const tigerBeetleAmount = input * valueMultiplier
    if (tigerBeetleAmount > Number.MAX_SAFE_INTEGER) {
      throw new Error(`toTigerBeetleAmount() - lost precision`)
    }

    return BigInt(tigerBeetleAmount)
  }

  /**
   * Convert from an TigerBeetle Ledger representation of an amount to a real amount.
   */
  public static toRealAmount(input: bigint, assetScale: number): number {
    assert(assetScale >= -7)
    assert(assetScale <= 8)
    const valueDivisor = 10 ** assetScale

    if (input === 0n) {
      return 0
    }

    if (input > BigInt(Number.MAX_SAFE_INTEGER) ||
      input < BigInt(Number.MIN_SAFE_INTEGER)
    ) {
      throw new Error(`toRealAmount() failed: realAmount is outside of safe range.`)
    }

    return Number(input) / valueDivisor
  }

  /**
   * Convert an absolute FSPIOP expiration time to a TigerBeetle-compatible
   * seconds timeout
   * @deprecated
   */
  public static toTigerBeetleTimeout(now: Date, expiration: string):
    'INVALID' | 'ALREADY_EXPIRED' | 'ROUNDED_DOWN_TO_ZERO' | number {
    const nowMs = (now).getTime()
    const expirationMs = Date.parse(expiration)
    if (isNaN(expirationMs)) {
      return 'INVALID'
    }

    if (nowMs > expirationMs) {
      return 'ALREADY_EXPIRED'
    }

    // TigerBeetle timeouts are specified in seconds. I'm not sure if we should round this up or
    // down. For now, let's be pessimistic and round down.
    const timeoutMs = expirationMs - nowMs
    assert(timeoutMs > 0)
    const timeoutSeconds = Math.floor(timeoutMs / 1000)
    if (timeoutSeconds === 0) {
      return 'ROUNDED_DOWN_TO_ZERO'
    }

    return timeoutSeconds
  }

  public static mergeWith<T>(
    a: Record<string, T>,
    b: Record<string, T>,
    onConflict: (aVal: T, bVal: T) => T
  ): Record<string, T> {
    const result = { ...a }
    for (const key of Object.keys(b)) {
      result[key] = key in a ? onConflict(a[key], b[key]) : b[key]
    }
    return result
  }

  public static stringify(accountOrTransfer: Account | Transfer): string {
    // We could make this context aware to map the ledger ids etc.
    return JSON.stringify(accountOrTransfer, bigIntReplacer, 2)
  }

  // Backwards compatibility, sort by createdDate, then Currency, then ledgerAccountType.
  public static legacyAccountComparator(a: LegacyLedgerAccountNoValue, b: LegacyLedgerAccountNoValue): number {
    if (a.createdDate.getTime() === b.createdDate.getTime()) {
      return `${a.currency}_${a.ledgerAccountType}`.localeCompare(`${b.currency}_${b.ledgerAccountType}`)
    }

    return a.createdDate.getTime() - b.createdDate.getTime()
  }

  public static successEmpty() {
    return {
      type: 'SUCCESS' as 'SUCCESS'
    }
  }

  public static failure(error: any) {
    return {
      type: "FAILURE" as 'FAILURE',
      error
    }
  }

  public buildEffectNotificationError(
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

  public buildEffectNotificationErrorLiquidity(
    input: PrepareHandlerInput,
    fspiopError: any
  ): Effect {
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)

    const headers = { ...input.message.value.content.headers }
    headers['fspiop-destination'] = input.payload.payerFsp
    headers['fspiop-source'] = this.deps.config.HUB_NAME
    delete headers['content-length']

    const state = Util.StreamingProtocol.createEventState(
      Enum.Events.EventStatus.FAILURE.status,
      apiFSPIOPError.errorInformation.errorCode,
      apiFSPIOPError.errorInformation.errorDescription
    )

    const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(
      input.payload.transferId,
      Enum.Kafka.Topics.NOTIFICATION,
      Action.PREPARE,
      state
    )

    const message = Util.StreamingProtocol.createMessage(
      input.payload.transferId,
      input.payload.payerFsp,
      this.deps.config.HUB_NAME,
      metadata,
      headers,
      apiFSPIOPError,
      { id: input.payload.transferId },
      'application/json',
    )

    const effect: Effect = {
      functionality: Type.NOTIFICATION,
      action: Action.PREPARE,
      message,
      topicName: 'topic-notification-event',
      status: 'FAILURE',
    }
    return effect
  }

  public buildEffectNotificationSuccess(
    input: PrepareHandlerInput
  ): Effect {
    const headers = { ...input.message.value.content.headers }
    delete headers['content-length']

    const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(
      input.payload.transferId,
      Enum.Kafka.Topics.TRANSFER,
      Action.PREPARE,
      {
        status: 'success',
        code: null,
        description: null,
      }
    )

    const message = Util.StreamingProtocol.createMessage(
      input.payload.transferId,
      input.payload.payeeFsp,
      input.payload.payerFsp,
      metadata,
      headers,
      input.payload,
      {},
      'application/json',
    )

    const effect: Effect = {
      functionality: Type.NOTIFICATION,
      action: Action.PREPARE,
      message,
      topicName: 'topic-notification-event',
      status: 'SUCCESS',
    }
    return effect
  }

  public buildEffectNotificationDuplicate(
    input: PrepareHandlerInput,
    payload: PayloadFinalizedTransfer
  ): Effect {
    const message = structuredClone(input.message.value)
    if (payload.transferState === 'ABORTED') {
      message.content.payload = {
        completedTimestamp: payload.completedTimestamp.toISOString(),
        transferState: payload.transferState,
      }
    } else {
      message.content.payload = {
        completedTimestamp: payload.completedTimestamp.toISOString(),
        transferState: payload.transferState,
        fulfilment: payload.fulfilment,
      }
    }

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

  public static prepareToSpecTransferCreate(prepare: CreatePaymentDto): SpecTransferCreate {
    return {
      id: prepare.transferId,
      currency: prepare.amount.currency,
      amount: prepare.amount.amount,
      expiration: prepare.expiration,
      payerId: prepare.payerFsp,
      payeeId: prepare.payeeFsp,
      ilpCondition: prepare.condition,
      ilpPacket: prepare.ilpPacket,
    }
  }

  /**
   * Utility function to convert from an Array<T> to a Record<string, T>.
   */
  public static toMapBy<T>(items: T[], key: (item: T) => string): Record<string, T> {
    return items.reduce((acc, curr) => {
      acc[key(curr)] = curr
      return acc
    }, {} as Record<string, T>)
  }

  public static toLedgerAccount(inputs: Array<InternalDfspCurrency>): Array<LedgerAccount> {
    return inputs.map(input => {
      const result: LedgerAccount = {
        id: input.id,
        code: input.accountCode,
        currency: input.currency,
        status: ((input.flags & AccountFlags.closed) === AccountFlags.closed) ? 'DISABLED' : 'ENABLED',
        creditsPending: input.credits_pending,
        creditsPosted: input.credits_posted,
        debitsPending: input.debits_pending,
        debitsPosted: input.debits_posted,
      }

      return result
    })
  }

  /**
   * Format a list of TigerBeetle transfers as a DRCR snippet.
   */
  public static formatTransfersAsDRCR(
    transfers: Array<Transfer>,
    dfspCurrencies: Array<DfspCurrency>,
    dfspRoots: Array<DfspRoot>,
    currencyConfig: CurrencyConfig
  ): string {
    // Build reverse mapping from account id -> account name
    const accountIdToName: Record<string, string> = {
      // Global control accounts
      [Helper.accountIds.devNull.toString()]: 'dev_null',
      [Helper.accountIds.prepareBurn.toString()]: 'prepare_burn',
      [Helper.accountIds.bookmarkDebit.toString()]: 'bookmark_debit',
      [Helper.accountIds.bookmarkCredit.toString()]: 'bookmark_credit',
    }

    // Add dfsp root accounts
    for (const dfspRoot of dfspRoots) {
      accountIdToName[dfspRoot.id.toString()] = `${dfspRoot.dfspId}:root`
    }

    // Add dfsp currency accounts
    for (const dfspCurrency of dfspCurrencies) {
      accountIdToName[dfspCurrency.deposit.toString()] = `${dfspCurrency.dfspId}:deposit`
      accountIdToName[dfspCurrency.unrestricted.toString()] = `${dfspCurrency.dfspId}:unrestricted`
      accountIdToName[dfspCurrency.unrestrictedLock.toString()] = `${dfspCurrency.dfspId}:unrestricted_lock`
      accountIdToName[dfspCurrency.netDebitCapSet.toString()] = `${dfspCurrency.dfspId}:ndc_set`
      accountIdToName[dfspCurrency.netDebitCapSetUtil.toString()] = `${dfspCurrency.dfspId}:ndc_set_util`
      accountIdToName[dfspCurrency.restricted.toString()] = `${dfspCurrency.dfspId}:restricted`
      accountIdToName[dfspCurrency.reserved.toString()] = `${dfspCurrency.dfspId}:reserved`
      accountIdToName[dfspCurrency.commitedOutgoing.toString()] = `${dfspCurrency.dfspId}:committed_outgoing`
      accountIdToName[dfspCurrency.clearingCredit.toString()] = `${dfspCurrency.dfspId}:clearing_credit`
      accountIdToName[dfspCurrency.clearingSetup.toString()] = `${dfspCurrency.dfspId}:clearing_setup`
      accountIdToName[dfspCurrency.clearingLimit.toString()] = `${dfspCurrency.dfspId}:clearing_limit`
      accountIdToName[dfspCurrency.control.toString()] = `${dfspCurrency.dfspId}:control`
      accountIdToName[dfspCurrency.netDebitCap.toString()] = `${dfspCurrency.dfspId}:net_debit_cap`
    }

    // Build mapping from transfer id -> index for pending references
    const transferIdToIdx: Record<string, number> = {}
    transfers.forEach((t, idx) => {
      transferIdToIdx[t.id.toString()] = idx
    })

    const lines: Array<string> = []

    for (let idx = 0; idx < transfers.length; idx++) {
      const transfer = transfers[idx]

      // Resolve account names
      const debitName = accountIdToName[transfer.debit_account_id.toString()]
        ?? `unknown(${transfer.debit_account_id})`
      const creditName = accountIdToName[transfer.credit_account_id.toString()]
        ?? `unknown(${transfer.credit_account_id})`

      // Determine currency label based on ledger
      let currencyLabel: string
      if (transfer.ledger === Helper.ledgerIds.globalControl) {
        currencyLabel = 'GLB'
      } else if (transfer.ledger === currencyConfig.idOperation) {
        currencyLabel = currencyConfig.currency
      } else if (transfer.ledger === currencyConfig.idControl) {
        currencyLabel = 'CTL'
      } else {
        currencyLabel = `L${transfer.ledger}`
      }

      // Format amount - use amount_max representation or scaled real amount
      let amountStr: string
      if (transfer.amount === amount_max) {
        amountStr = 'MAX'
      } else {
        const realAmount = Helper.toRealAmount(transfer.amount, currencyConfig.assetScale)
        amountStr = realAmount.toString()
      }

      // Decode flags
      const flagNames: Array<string> = []
      if (transfer.flags & TransferFlags.linked) flagNames.push('linked')
      if (transfer.flags & TransferFlags.pending) flagNames.push('pending')
      if (transfer.flags & TransferFlags.post_pending_transfer) flagNames.push('post_pending_transfer')
      if (transfer.flags & TransferFlags.void_pending_transfer) flagNames.push('void_pending_transfer')
      if (transfer.flags & TransferFlags.balancing_debit) flagNames.push('balancing_debit')
      if (transfer.flags & TransferFlags.balancing_credit) flagNames.push('balancing_credit')
      if (transfer.flags & TransferFlags.closing_debit) flagNames.push('closing_debit')
      if (transfer.flags & TransferFlags.closing_credit) flagNames.push('closing_credit')

      // Build the line
      let line = `${currencyLabel} DR ${debitName.padEnd(25)} CR ${creditName.padEnd(25)} ${amountStr.padStart(10)}`

      // Add flags if any
      if (flagNames.length > 0) {
        line += ` ${flagNames.join(',')}`
      }

      // Add pending reference if this refers to another transfer
      if (transfer.pending_id !== 0n) {
        const pendingIdx = transferIdToIdx[transfer.pending_id.toString()]
        if (pendingIdx !== undefined) {
          line += ` ^${pendingIdx}`
        } else {
          line += ` ^?`
        }
      }

      lines.push(line)
    }

    return lines.join('\n')
  }
}

const bigIntReplacer = (_key: string, value: unknown) =>
  typeof value === 'bigint' ? value.toString() : value
