import { Knex } from 'knex';
import assert from 'node:assert';
import LedgerTigerBeetleHelper from './helper';
import { ApplicationConfig } from '../../../lib/config';
import { AccountCode, Enums, QueryResultWithNotFound } from '../shared/types';
import Helper from './helper';
import { Account } from 'tigerbeetle-node';
import { logger } from '../../../shared/logger';

export type CmdHubCurrencyEnable = {
  currency: string,
  accounts: Array<string>
}

export type EnableHubCurrencyResponse = {
  type: 'OK'
} | {
  type: 'EXISTS'
} | {
  type: 'FAILURE',
  error: any
}

/**
 * Mapping from a currency => Set of TigerBeetle Ledger Ids.
 */
export interface CurrencyLedger {
  currency: string,
  /**
   * The TigerBeetle ledger where 'real' funds are tracked. 
   * Used for financial reporting.
   */
  ledgerOperation: number,

  /**
   * A separate 'control' ledger for non-financial operations.
   */
  ledgerControl: number,

  /** 
   * The AccountId for the settlement balance account.
   * This isn't really the best place for this, but we need to put it somewhere!
   */
  settlementBalance: bigint,

  assetScale: number
}

/**
 * The Hub account's representation of each individual accounts. 
 * This is mainly used to maintain backwards compatibility with LedgerSQL.
 */
export type CurrencyAccount = {
  /**
   * A mocked out id to match LedgerSQL.
   */
  id: number,

  currency: string,
  /**
   * The Legacy account type.
   */
  accountType: string,

  /**
   * When the CurrencyAccount was created.
   */
  createdDate: Date,

  /**
   * When the CurrencyAccount was last updated.
   */
  changedDate: Date,
}

type CurrencyAccountSave = Omit<CurrencyAccount, 'id'>

/**
 * Stores the mapping between the dfspId => MasterAccount Id on TigerBeetle.
 */
export interface MasterAccount {
  dfspId: string,
  masterAccountId: bigint
}

/**
 * The set of TigerBeetle Account ids.
 */
export interface DfspAccountIds {
  deposit: bigint,
  unrestricted: bigint,
  unrestrictedLock: bigint,
  restricted: bigint,
  reserved: bigint,
  commitedOutgoing: bigint,
  clearingCredit: bigint
  clearingSetup: bigint
  clearingLimit: bigint
}

/**
 * The specification which defines the TigerBeetle Accounts for a dfspId + currency.
 */
export interface SpecAccount extends DfspAccountIds {
  dfspId: string,
  currency: string,
}

export interface InternalLedgerAccount extends Account {
  dfspId: string,
  currency: string,
  // Technically we don't need this since it lives on the account.code, but as a number,
  // but explicit typing here makes accessing this property easier.
  accountCode: AccountCode
}

/**
 * Internal representation of the Dfsp/Participant Master account
 */
export interface InternalMasterAccount extends Account {
  dfspId: string,
}

export type SpecNetDebitCap = {
  type: 'UNLIMITED',
  dfspId: string,
  currency: string,
} | {
  type: 'LIMITED',
  amount: number,
  dfspId: string,
  currency: string,
}

export type SpecTransfer = {
  id: string
  currency: string
  amount: string
  expiration: string
  payerId: string
  payeeId: string
  ilpCondition: string
  ilpPacket: string
  fulfilment?: string
}

export type SpecTransferCreate = Omit<SpecTransfer, 'fulfilment'>
export type SpecTransferUpdate = {
  id: string,
  fulfilment: string
}

export type SaveSpecTransferResult = {
  id: string,
  type: 'SUCCESS' | 'FAILURE'
}

export type AttachFulfilmentResult = {

}

export interface DepsSpecStore {
  config: ApplicationConfig
  enums: Enums,
  db: Knex,
  helper: Helper,
}

const TABLE_CURRENCY_LEDGER = 'specCurrencyLedger'
const TABLE_CURRENCY_ACCOUNT = 'specCurrencyAccount'
const TABLE_DFSP = 'specDfsp'
const TABLE_DFSP_CURRENCY = 'specDfspCurrency'
const TABLE_TRANSFER = 'specTransfer'


/**
 * @class SpecStore
 * @description Metadata-sidecar store for TigerBeetle Account, Transfer and Hub metadata: 'Specs'.
 */
export default class SpecStore {
  private db: Knex;
  private readonly helper: Helper

  private hubAccountId = 0;

  /**
   * Backwards compatibility - keep track of the very first date the first currency was created.
   */
  private firstCreationDate: Date | null = null;

  private dfsps: Array<{
    id: string;
    /**
     * The master account id of the dfsp.
     */
    masterAccountId: bigint;
  }> = [];
  private dfspSpecs: Array<SpecAccount> = [];

  constructor(private deps: DepsSpecStore) {
    this.db = deps.db;
    this.helper = deps.helper
    // This mimicks how the participant gets setup in LedgerSQL.
    this.getFirstOrImplyCreationDate();
  }

  /**
   * Strip the MS off of the date, this mimicks what MySQL does internally.
   */
  public static stripMs(date: Date): Date {
    return new Date(new Date().setMilliseconds(0));
  }

  public async getFirstOrImplyCreationDate(): Promise<Date> {
    if (!this.firstCreationDate) {
      this.firstCreationDate = SpecStore.stripMs(new Date());
    }

    return this.firstCreationDate;
  }

  public async validateCurrency(currency: string): Promise<void> {
    assert(currency)
    const result = await this.db('currency').where('currencyId', currency).first()
    if (!result) {
      throw new Error(`Currency: ${currency} not defined.`)
    }
  }

  public async enableHubCurrency(cmd: CmdHubCurrencyEnable): Promise<EnableHubCurrencyResponse> {
    try {
      assert(cmd.currency);
      assert(Array.isArray(cmd.accounts));

      // If accounts is empty, we just assume it's these two.
      if (cmd.accounts.length === 0) {
        cmd.accounts.push('HUB_MULTILATERAL_SETTLEMENT', 'HUB_RECONCILIATION');
      }

      // Validate the account types.
      cmd.accounts.forEach(account => {
        const ledgerAccountTypeId = this.deps.enums.ledgerAccountType[account];
        if (!ledgerAccountTypeId) {
          throw new Error('Ledger account type was not found.');
        }

        const permittedHubAccountType = this.deps.config.HUB_ACCOUNTS.find(acc => acc === account);
        if (!permittedHubAccountType) {
          throw new Error(`The requested hub operator account type is not allowed.`);
        }
      });

      await this.insertCurrencyLedger(cmd.currency)

      for (const accountType of cmd.accounts) {
        // Do only one at a time, to match LedgerSQL implementation.
        const result = await this.insertCurrencyAccount({
          currency: cmd.currency,
          accountType,
          createdDate: new Date(),
          changedDate: new Date(),
        })

        if (result.type === 'EXISTS') {
          return {
            type: 'EXISTS'
          }
        }
      }

      return { type: 'OK' };
    } catch (error) {
      return {
        type: 'FAILURE', error
      };
    }
  }

  private async insertCurrencyLedger(currency: string): Promise<void> {
    let trx: Knex.Transaction | undefined
    try {
      trx = await this.db.transaction()

      // Look up the currency ledger.
      const existing = await trx(TABLE_CURRENCY_LEDGER)
        .select('currency')
        .where({ currency })
      if (existing.length > 0) {
        await trx.commit()
        return
      }

      // Create a new currency ledger, ids are based on the number of existing currencies.
      const currencyCountResult = await trx(TABLE_CURRENCY_LEDGER).count('* as count')
      const currencyCount = Number(currencyCountResult[0].count)
      const [
        ledgerOperation,
        ledgerControl
      ] = LedgerTigerBeetleHelper.generateLedgerIds(currencyCount);

      await trx(TABLE_CURRENCY_LEDGER).insert({
        currency,
        ledgerOperation,
        ledgerControl,
        settlementBalance: this.helper.idSmall(),
        // TODO: should we just take this from the currency table?
        assetScale: 4,
      })

      await trx.commit()
    } catch (err) {
      if (trx) {
        await trx.rollback()
      }

      throw err
    }
  }

  private async insertCurrencyAccount(account: CurrencyAccountSave)
    : Promise<EnableHubCurrencyResponse> {
    let trx: Knex.Transaction | undefined
    try {
      trx = await this.db.transaction()

      // Look up the currency ledger.
      const existing = await trx(TABLE_CURRENCY_ACCOUNT)
        .select('currency')
        .where({ currency: account.currency, accountType: account.accountType })
      if (existing.length > 0) {
        await trx.commit()
        return {
          type: 'EXISTS'
        }
      }

      await trx(TABLE_CURRENCY_ACCOUNT)
        .insert({
          currency: account.currency,
          accountType: account.accountType,
          createdDate: account.createdDate,
          changedDate: account.changedDate,
        })

      await trx.commit()

      return {
        type: 'OK'
      }
    } catch (err) {
      if (trx) {
        await trx.rollback()
      }

      throw err
    }
  }

  public async getCurrencyLedger(currency: string): Promise<CurrencyLedger> {
    const rows = await this.db(TABLE_CURRENCY_LEDGER).where({ currency }).select('*')
    if (rows.length === 0) {
      throw new Error(`getCurrencyLedger() - no ledger found for currency: ${currency}`);
    }

    assert(rows.length === 1, 'Expected only 1 row.')
    const row = rows[0]

    return {
      currency: row.currency,
      ledgerOperation: row.ledgerOperation,
      ledgerControl: row.ledgerControl,
      settlementBalance: BigInt(row.settlementBalance),
      assetScale: row.assetScale
    }
  }

  public async getCurrencyLedgers(): Promise<Array<CurrencyLedger>> {
    const rows = await this.db(TABLE_CURRENCY_LEDGER).select('*')

    return rows.map(row => ({
      currency: row.currency,
      ledgerOperation: row.ledgerOperation,
      ledgerControl: row.ledgerControl,
      settlementBalance: BigInt(row.settlementBalance),
      assetScale: row.assetScale
    }))
  }

  public async getAllCurrencyAccounts(): Promise<Array<CurrencyAccount>> {
    const rows = await this.db(TABLE_CURRENCY_ACCOUNT).select('*')

    return rows.map(row => ({
      id: row.id,
      currency: row.currency,
      accountType: row.accountType,
      createdDate: row.createdDate,
      changedDate: row.changedDate,
    }))
  }

  public async getCurrencyAccounts(currency: string): Promise<Array<CurrencyAccount>> {
    const rows = await this.db(TABLE_CURRENCY_ACCOUNT).where({ currency }).select('*')

    return rows.map(row => ({
      id: row.id,
      currency: row.currency,
      accountType: row.accountType,
      createdDate: row.createdDate,
      changedDate: row.changedDate,
    }))
  }

  public async getAccountIdSettlementBalance(currency: string): Promise<bigint> {
    const currencyLedger = await this.getCurrencyLedger(currency)
    return currencyLedger.settlementBalance
  }

  public async assertCurrenciesEnabled(currencies: Array<string>): Promise<void> {
    assert(Array.isArray(currencies));
    assert(currencies.length > 0, 'Expected at least one currency.');

    const errors: Array<string> = [];
    const currencyLedgerSet: Record<string, true> = (await this.getCurrencyLedgers())
      .reduce((acc, curr) => {
        acc[curr.currency] = true
        return acc
      }, {} as Record<string, true>)
    currencies.forEach(currency => {
      const found = currencyLedgerSet[currency]
      if (!found) {
        errors.push(`No currencyLedger found for: ${currency}.`);
      }
    });

    if (errors.length > 0) {
      throw new Error(`assertCurrenciesFailed with errors: [${errors.join(', ')}]`);
    }
  }

  /**
   * Create the TigerBeetle master account id for this DFSP.
   */
  public async getOrCreateDfspMasterAccount(dfspId: string): Promise<bigint> {
    let trx: Knex.Transaction | undefined
    try {
      trx = await this.db.transaction()

      const row = await trx(TABLE_DFSP).where({ dfspId }).select('*').first()
      if (row) {
        await trx.commit()
        return BigInt(row.masterAccountId)
      }

      const masterAccountId = this.helper.idSmall()
      await trx(TABLE_DFSP).insert({ dfspId, masterAccountId })

      await trx.commit()
      return masterAccountId
    } catch (err) {
      if (trx) {
        await trx.rollback()
      }

      throw err
    }
  }

  public async getDfspMasterAccount(dfspId: string): Promise<bigint> {
    const row = await this.db(TABLE_DFSP).where({ dfspId }).select('*').first()
    if (!row) {
      throw new Error(`No dfsp found for id: ${dfspId}`)
    }

    return BigInt(row.masterAccountId)
  }

  public async getDfspMasterAccounts(dfspIds: Array<string>): Promise<Array<MasterAccount>> {
    const rows = await this.db(TABLE_DFSP).whereIn('dfspId', dfspIds).select('*')

    return rows.map(row => ({
      dfspId: row.dfspId,
      masterAccountId: BigInt(row.masterAccountId)
    }))
  }

  public async getDfspCurrency(dfspId: string, currency: string):
    Promise<QueryResultWithNotFound<SpecAccount>> {

    const row = await this.db(TABLE_DFSP_CURRENCY).where({ dfspId, currency }).select('*').first()
    if (!row) {
      return {
        type: 'NOT_FOUND',
        error: new Error(`getDfspCurrency no spec found for id:${dfspId} + currency: ${currency}.`)
      };
    }

    return {
      type: 'SUCCESS',
      result: SpecStore.hydrateSpecAccount(row)
    };
  }

  public async getDfspCurrencies(id: string): Promise<Array<SpecAccount>> {
    const rows = await this.db(TABLE_DFSP_CURRENCY).where({dfspId: id}) .select('*')
    return rows.map(SpecStore.hydrateSpecAccount)
  }

  public async getAllDfspCurrencies(dfsps: Array<string>): Promise<Array<SpecAccount>> {
    const rows = await this.db(TABLE_DFSP_CURRENCY).whereIn('dfspId', dfsps).select('*')
    return rows.map(SpecStore.hydrateSpecAccount)
  }

  /**
   * Look up the account within the spec for the dfspid and account id.
   */
  public async getCurrencyCodeAndSpec(dfspId: string, accountId: bigint):
    Promise<{ currency: string; code: AccountCode; spec: SpecAccount; }> {

    const accountIdStr = accountId.toString()
    const row = await this.db(TABLE_DFSP_CURRENCY)
      .where({ dfspId })
      .andWhere(function () {
        this.where('deposit', accountIdStr)
          .orWhere('unrestricted', accountIdStr)
          .orWhere('unrestrictedLock', accountIdStr)
          .orWhere('restricted', accountIdStr)
          .orWhere('reserved', accountIdStr)
          .orWhere('commitedOutgoing', accountIdStr)
          .orWhere('clearingCredit', accountIdStr)
          .orWhere('clearingSetup', accountIdStr)
          .orWhere('clearingLimit', accountIdStr)
      })
      .select('*')
      .first()

    if (!row) {
      throw new Error(`getCurrencyCodeAndSpec() not found for dfspId: ${dfspId}, ` 
        + `accountId: ${accountId}.`)
    }

    const spec = SpecStore.hydrateSpecAccount(row)

    // Check which field matched.
    let code: AccountCode
    if (spec.deposit === accountId) {
      code = AccountCode.Deposit
    } else if (spec.unrestricted === accountId) {
      code = AccountCode.Unrestricted
    } else if (spec.unrestrictedLock === accountId) {
      code = AccountCode.Unrestricted_Lock
    } else if (spec.restricted === accountId) {
      code = AccountCode.Restricted
    } else if (spec.reserved === accountId) {
      code = AccountCode.Reserved
    } else if (spec.commitedOutgoing === accountId) {
      code = AccountCode.Committed_Outgoing
    } else if (spec.clearingCredit === accountId) {
      code = AccountCode.Clearing_Credit
    } else if (spec.clearingSetup === accountId) {
      code = AccountCode.Clearing_Setup
    } else if (spec.clearingLimit === accountId) {
      code = AccountCode.Clearing_Limit
    } else {
      throw new Error(`getCurrencyCodeAndSpec() - matched row ` + 
        `but no field matched accountId: ${accountId}`
      )
    }

    return { 
      currency: spec.currency, 
      code, 
      spec 
    }
  }

  public async newAccountSpec(dfspId: string, currency: string): Promise<SpecAccount> {
    let trx: Knex.Transaction | undefined
    try {
      trx = await this.db.transaction()

      const row = await trx(TABLE_DFSP_CURRENCY).where({ dfspId, currency }).select('*').first()
      if (row) {
        await trx.commit()
        return SpecStore.hydrateSpecAccount(row)
      }

      const spec: SpecAccount = {
        dfspId,
        currency,
        deposit: this.helper.idSmall(),
        unrestricted: this.helper.idSmall(),
        unrestrictedLock: this.helper.idSmall(),
        restricted: this.helper.idSmall(),
        reserved: this.helper.idSmall(),
        commitedOutgoing: this.helper.idSmall(),
        clearingCredit: this.helper.idSmall(),
        clearingSetup: this.helper.idSmall(),
        clearingLimit: this.helper.idSmall(),
      };
      await trx(TABLE_DFSP_CURRENCY).insert(spec)

      await trx.commit()

      return spec
    } catch (err) {
      if (trx) {
        await trx.rollback()
      }

      throw err
    }
  }

  public async getNetDebitCap(dfspId: string, currency: string): Promise<SpecNetDebitCap> {
    // Mock result for now.
    return {
      type: 'UNLIMITED',
      dfspId,
      currency
    } 
  }

  public async saveFundingSpec(funding: any): Promise<void> {
    return
  }

  private static hydrateSpecAccount(row: any): SpecAccount {
    const spec: SpecAccount = {
      dfspId: row.dfspId,
      currency: row.currency,
      deposit: BigInt(row.deposit),
      unrestricted: BigInt(row.unrestricted),
      unrestrictedLock: BigInt(row.unrestrictedLock),
      restricted: BigInt(row.restricted),
      reserved: BigInt(row.reserved),
      commitedOutgoing: BigInt(row.commitedOutgoing),
      clearingCredit: BigInt(row.clearingCredit),
      clearingSetup: BigInt(row.clearingSetup),
      clearingLimit: BigInt(row.clearingLimit),
    }
    return spec
  }

  public async saveTransferSpecs(specs: Array<SpecTransferCreate>): Promise<Array<SaveSpecTransferResult>> {
    try {
      const records = specs.map(m => {
        const record = {
          id: m.id,
          currency: m.currency,
          amount: m.amount,
          expiration: m.expiration,
          payerId: m.payerId,
          payeeId: m.payeeId,
          ilpCondition: m.ilpCondition,
          ilpPacket: m.ilpPacket,
        }

        return record
      })

      await this.db.from(TABLE_TRANSFER)
        .insert(records)
        .onConflict('id')
        .ignore()

      return specs.map(spec => {
        return {
          type: 'SUCCESS',
          id: spec.id
        }
      })
    } catch (err: any) {
      logger.error(`saveTransferSpecs() - failed with error: ${err.message}`)
      return specs.map(spec => {
        return {
          type: 'FAILURE',
          id: spec.id
        }
      })
    }
  }

  public async attachFulfillment(specUpdates: Array<SpecTransferUpdate>): Promise<Array<AttachFulfilmentResult>> {
    throw new Error(`not implemented`)
  }
}

