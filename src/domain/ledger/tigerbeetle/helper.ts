import { failureWithError, QueryResult } from "../../../shared/results"
import { Account, AccountFlags, amount_max, Client, id, Transfer, TransferFlags } from "tigerbeetle-node";
import crypto from "crypto";
import assert from "assert";
import { CurrencyLedger, MasterAccount, SpecAccount } from "./spec-store";
import { AccountCode, TransferCode } from "../shared/types";
import { PrepareHandlerInput } from "../../../handlers/payment-prepare";

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
  randomBytes: (length: number) => Buffer
}

export default class Helper {

  constructor(private deps: Dependencies) { }

  /**
   * Global account ids that persist across all Ledgers
   */
  public static accountIds = {
    // TODO(LD): Find better account ids
    bookmarkDebit: 1000n,
    bookmarkCredit: 1001n,

    /**
     * Counterparty account for Super Ledger
     * Essentially a /dev/null for Accounts
     */
    devNull: 80000000000n
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
   *
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
    spec: SpecAccount,
    currencyLedger: CurrencyLedger,
    accountIdSettlementBalance: bigint,
    masterAccountId: bigint
  ): Array<Account> {
    const ledgerOperation = currencyLedger.ledgerOperation
    const accounts: Array<Account> = [
      // Settlement_Balance
      {
        ...Helper.createAccountTemplate,
        id: accountIdSettlementBalance,
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
      // Dfsp/Participant account. Keeps track of Dfsp active/not active and creation timestamp
      {
        ...Helper.createAccountTemplate,
        id: masterAccountId,
        ledger: Helper.ledgerIds.globalControl,
        code: AccountCode.Dfsp,
        flags: 0,
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
    ]

    return accounts
  }

  public buildTransfersDeposit(
    transferId: string,
    amount: number,
    netDebitCapLockAmount: bigint,
    spec: SpecAccount,
    ledger: CurrencyLedger
  ): Array<Transfer> {
    const idLockTransfer = id()
    return [
      // Deposit funds into Unrestricted.
      {
        ...Helper.createTransferTemplate,
        id: Helper.fromMojaloopId(transferId),
        debit_account_id: spec.deposit,
        credit_account_id: spec.unrestricted,
        amount: Helper.toTigerBeetleAmount(amount, ledger.assetScale),
        ledger: ledger.ledgerOperation,
        code: TransferCode.Deposit,
        flags: TransferFlags.linked

      },
      // Sweep total balance from Restricted to Unrestricted.
      {
        ...Helper.createTransferTemplate,
        id: id(),
        debit_account_id: spec.restricted,
        credit_account_id: spec.unrestricted,
        amount: amount_max,
        ledger: ledger.ledgerOperation,
        code: TransferCode.Net_Debit_Cap_Sweep_To_Unrestricted,
        flags: TransferFlags.linked | TransferFlags.balancing_debit
      },
      // Temporarily lock up to the net debit cap.
      {
        ...Helper.createTransferTemplate,
        id: idLockTransfer,
        debit_account_id: spec.unrestricted,
        credit_account_id: spec.unrestrictedLock,
        amount: netDebitCapLockAmount,
        ledger: ledger.ledgerOperation,
        code: TransferCode.Net_Debit_Cap_Lock,
        flags: TransferFlags.linked | TransferFlags.pending | TransferFlags.balancing_debit
      },
      // Sweep whatever remains in Unrestricted to Restricted.
      {
        ...Helper.createTransferTemplate,
        id: id(),
        debit_account_id: spec.unrestricted,
        credit_account_id: spec.restricted,
        amount: amount_max,
        ledger: ledger.ledgerOperation,
        code: TransferCode.Net_Debit_Cap_Sweep_To_Restricted,
        flags: TransferFlags.linked | TransferFlags.balancing_debit
      },
      // Reset the pending limit transfer.
      {
        ...Helper.createTransferTemplate,
        id: id(),
        pending_id: idLockTransfer,
        debit_account_id: 0n,
        credit_account_id: 0n,
        amount: 0n,
        ledger: ledger.ledgerOperation,
        code: TransferCode.Net_Debit_Cap_Lock,
        flags: TransferFlags.void_pending_transfer
      }
    ]
  }

  public buildTransfersPrepares(
    prepares: Array<PrepareHandlerInput>,
    currencyLedgers: Record<string, CurrencyLedger>,
    masterAccounts: Record<string, MasterAccount>,
    specAccounts: Record<string, SpecAccount>
  ): Array<Transfer> {

    const transfers: Array<Transfer> = []
    for (const prepare of prepares) {
      // Shortcut.
      const amountStr = prepare.payload.amount.amount
      const currency = prepare.payload.amount.currency
      const masterAccountPayer = masterAccounts[prepare.payload.payerFsp]
      assert(masterAccountPayer)
      const masterAccountPayee = masterAccounts[prepare.payload.payeeFsp]
      assert(masterAccountPayee)
      const specPayer = specAccounts[prepare.payload.payerFsp + '_' + currency]
      assert(specPayer)
      const specPayee = specAccounts[prepare.payload.payeeFsp + '_' + currency]
      assert(specPayee)

      // TODO: come back to this - we need to ensure increasing ids.
      const prepareId = Helper.fromMojaloopId(prepare.transferId)
      const ledger = currencyLedgers[currency]
      assert(ledger)
      const assetScale = ledger.assetScale
      const amountTigerBeetle = Helper.fromMojaloopAmount(amountStr, assetScale)

      const nowMs = (new Date()).getTime()
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

      // if (nowMs > expirationMs) {
      //   throw new Error(`Expiration date already in the past.`)
      // }

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

      transfers.push(
        // Ensure both Participants are active
        {
          ...Helper.createTransferTemplate,
          id: prepareId,
          debit_account_id: masterAccountPayer.masterAccountId,
          credit_account_id: masterAccountPayee.masterAccountId,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          user_data_64: BigInt(expirationMs),
          user_data_32: transferHash,
          ledger: Helper.ledgerIds.globalControl,
          code: TransferCode.Clearing_Active_Check,
          flags: TransferFlags.linked | TransferFlags.pending,
        },
        // Setup the limit account for this payment.
        {
          ...Helper.createTransferTemplate,
          id: id(),
          debit_account_id: specPayer.clearingSetup,
          credit_account_id: specPayee.clearingLimit,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          ledger: ledger.ledgerOperation,
          code: 1,
          flags: TransferFlags.linked
        },
        // Reserve funds for Participant A from Clearing Credit.
        {
          ...Helper.createTransferTemplate,
          id: id(),
          debit_account_id: specPayer.clearingCredit,
          credit_account_id: specPayee.clearingSetup,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          ledger: ledger.ledgerOperation,
          code: TransferCode.Clearing_Reserve,
          flags: TransferFlags.linked | TransferFlags.balancing_debit
            | TransferFlags.balancing_credit
        },
        // Reserve funds for Participant A from Unrestricted
        {
          ...Helper.createTransferTemplate,
          id: id(),
          debit_account_id: specPayer.unrestricted,
          credit_account_id: specPayee.clearingSetup,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          ledger: ledger.ledgerOperation,
          code: TransferCode.Clearing_Reserve,
          flags: TransferFlags.linked | TransferFlags.balancing_debit
            | TransferFlags.balancing_credit
        },
        // Reserve funds for Participant A from Clearing_Setup
        {
          ...Helper.createTransferTemplate,
          id: prepareId + 3n,
          debit_account_id: specPayer.clearingSetup,
          credit_account_id: specPayee.reserved,
          amount: amountTigerBeetle,
          user_data_128: prepareId,
          ledger: ledger.ledgerOperation,
          code: TransferCode.Clearing_Reserve,
          // flags: TransferFlags.linked
          flags: 0
        },
        // // ??
        // {
        //   ...Helper.createTransferTemplate,
        //   id: id(),
        //   debit_account_id: specPayer.clearingLimit,
        //   credit_account_id: specPayee.clearingSetup,
        //   amount: amount_max,
        //   user_data_128: prepareId,
        //   ledger: ledger.ledgerOperation,
        //   code: 1,
        //   flags: TransferFlags.balancing_credit
        // },
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

    const realAmount = input / BigInt(valueDivisor)
    if (realAmount > BigInt(Number.MAX_SAFE_INTEGER) ||
      realAmount < BigInt(Number.MIN_SAFE_INTEGER)
    ) {
      throw new Error(`toRealAmount() failed: realAmount is outside of safe range.`)
    }

    return Number(realAmount)
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
}

const bigIntReplacer = (_key: string, value: unknown) =>
  typeof value === 'bigint' ? value.toString() : value
