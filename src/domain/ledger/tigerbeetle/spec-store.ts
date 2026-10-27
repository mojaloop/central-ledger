import { Knex } from 'knex'
import assert from 'node:assert'
import LedgerTigerBeetleHelper from './helper'
import { ApplicationConfig } from '../../../lib/config'
import { AccountCode, Enums, QueryResultWithNotFound } from '../shared/types'
import Helper from './helper'
import { Account } from 'tigerbeetle-node'
import { logger } from '../../../shared/logger'
import { assertOneOf } from '../../../lib/config/util'

export type CmdHubCurrencyEnable = {
  currency: string,
  accountTypes: Array<string>
  accountIds: Array<number>
}

export type EnableHubCurrencyResponse = {
  type: 'OK'
} | {
  type: 'EXISTS'
} | {
  type: 'FAILURE',
  error: any
}

export interface CurrencyConfig {
  /**
   * What precision to store the currency amounts in.
   * See [asset scale](https://docs.tigerbeetle.com/coding/data-modeling/#asset-scale)
   * for more information.
   */
  assetScale: number

  /**
   * ISO 4217 Currency code for this Ledger.
   */
  currency: string,

  /**
   * The TigerBeetle ledger where 'real' funds are tracked. 
   * Used for financial reporting.
   */
  idOperation: number,

  /**
   * A separate 'control' ledger for non-financial operations.
   */
  idControl: number,

  /**
   * Backwards Compatibility: The AccountId for the settlement balance account.
   */
  settlementBalance: bigint,
}

/**
 * The Hub account's representation of each individual accounts. 
 * This is used to maintain backwards compatibility with LedgerSQL.
 */
export type LegacyHubCurrency = {
  /**
   * The id of the currency account.
   */
  id: number,

  currency: string,
  /**
   * The Legacy account type.
   */
  accountType: string,

  /**
   * When the LegacyHubCurrency was created.
   */
  createdDate: Date,

  /**
   * When the LegacyHubCurrency was last updated.
   */
  changedDate: Date,
}

/**
 * Stores the mapping between the dfspId => DfspRoot Id on TigerBeetle.
 */
export interface DfspRoot {
  dfspId: string,
  id: bigint,
  isProxy: boolean
}

/**
 * The set of TigerBeetle Account ids.
 */
export interface DfspAccountIds {
  deposit: bigint,
  unrestricted: bigint,
  /**
   * @deprecated Replaced by netDebitCapSet and netDebitCapSetUtil.
   */
  unrestrictedLock: bigint,
  netDebitCapSet: bigint
  netDebitCapSetUtil: bigint
  restricted: bigint,
  reserved: bigint,
  commitedOutgoing: bigint,
  clearingCredit: bigint
  clearingSetup: bigint
  clearingLimit: bigint


  /**
   * Control account to act as counterparty for netDebitCap.
   */
  control: bigint,

  /**
   * TigerBeetle account id of the net debit cap control account.
   */
  netDebitCap: bigint
}

/**
 * Defines the TigerBeetle Accounts for a dfspId + currency.
 */
export interface DfspCurrency extends DfspAccountIds {
  dfspId: string,
  currency: string,

  /**
   * When the account was last activated/deactivated.
   */
  changedDate: Date,

  /**
   * Backwards compatibility: Keep track of the application timestamp when the position
   * account was last changed.
   */
  changedDatePosition: Date,

  /**
   * Backwards compatibility: Keep track of the application timestamp when the settlement
   * account was last changed.
   */
  changedDateSettlement: Date,

  /**
   * When the account was created.
   */
  createdDate: Date,
}

/**
 * Internal representation of the DfspRoot account.
 */
export interface InternalDfspRoot extends Account {
  dfspId: string,
  isProxy: boolean,
}

/**
 * Internal representation of the DfspCurrency Account.
 */
export interface InternalDfspCurrency extends Account {
  dfspId: string,
  currency: string,

  /**
   * Technically we don't need this since it lives on the account.code, but as a number,
   * but explicit typing here makes accessing this property easier.
   */
  accountCode: AccountCode
}

/**
 * Mapping from a currency => Set of TigerBeetle Ledger Ids.
 * 
 * TODO: rename to just Ledger?
 * @deprecated
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
 * 
 * TODO: rename to HubCurrency?
 * @deprecated
 */
export type CurrencyAccount = {
  /**
   * The id of the currency account.
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

/**
 * Stores the mapping between the dfspId => MasterAccount Id on TigerBeetle.
 * TODO: rename to SpecMaster?
 * @deprecated
 */
export interface MasterSpec {
  dfspId: string,
  id: bigint,
  isProxy: boolean
}

export type NetDebitCap = {
  type: 'UNLIMITED',
  dfspId: string,
  currency: string,
} | {
  type: 'LIMITED',

  /**
   * The amount to cap at. This is stored as a currency-native bigint, same as TigerBeetle.
   */
  amount: bigint,
  dfspId: string,
  currency: string,
  alarmPercentage: number,
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

export type GetSpecTransferResult = {
  type: 'SUCCESS'
  id: string,
  result: SpecTransfer
} | {
  type: 'NOT_FOUND',
  id: string
}

export type AttachFulfilmentResult = {

}

/**
 * Store these parameters of a prepare so that we can keep track of the aborted timestamp, and
 * the payload hash to check for modified prepares.
 */
export type SpecPrepare = {
  id: string,
  payloadHash: number,
  abortedAt?: Date
}

export type GetSpecPrepareResult = {
  type: 'SUCCESS'
  id: string,
  result: SpecPrepare
} | {
  type: 'NOT_FOUND',
  id: string
}

export interface DepsSpecStore {
  config: ApplicationConfig
  enums: Enums,
  db: Knex,
  helper: Helper,
}

export type ContextDfsps = {
  currencies: Array<string>
  dfspIds: Array<string>,
  currencyConfigs: Array<CurrencyConfig>
  dfspRoots: Array<DfspRoot>
  dfspCurrencies: Array<DfspCurrency>
}

export type ContextPayments = {
  prepareIds: Array<string>,
  specPrepares: Array<SpecPrepare>,
  specTransfers: Array<SpecTransfer>
}

const TABLE_CURRENCY_CONFIG = 'specCurrencyConfig'
const TABLE_CURRENCY_ACCOUNT = 'specLegacyHubCurrency'
const TABLE_DFSP_ROOT = 'specDfspRoot'
const TABLE_DFSP_CURRENCY = 'specDfspCurrency'
const TABLE_PREPARE = 'specPrepare'
const TABLE_TRANSFER = 'specTransfer'
const TABLE_NET_DEBIT_CAP = 'specNetDebitCap'

/**
 * @class SpecStore
 * @description Metadata store for TigerBeetle Account, Transfer and Hub metadata: 'Specifications'.
 */
export default class SpecStore {
  private db: Knex;
  private readonly helper: Helper

  constructor(private deps: DepsSpecStore) {
    this.db = deps.db;
    this.helper = deps.helper
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
      assert(cmd.currency)
      assert(Array.isArray(cmd.accountTypes))
      assert(Array.isArray(cmd.accountIds))

      assert(cmd.accountIds.length >= 2, 'enableHubCurrency expects accountIds to be provided.')

      // If accounts is empty, we just assume it's these two.
      if (cmd.accountTypes.length === 0) {
        cmd.accountTypes.push(
          'HUB_MULTILATERAL_SETTLEMENT',
          'HUB_RECONCILIATION',
        )
      }

      // Validate the account types.
      cmd.accountTypes.forEach(type => {
        const ledgerAccountTypeId = this.deps.enums.ledgerAccountType[type];
        if (!ledgerAccountTypeId) {
          throw new Error('Ledger account type was not found.');
        }

        const permittedHubAccountType = this.deps.config.HUB_ACCOUNTS.find(acc => acc === type);
        if (!permittedHubAccountType) {
          throw new Error(`The requested hub operator account type is not allowed.`);
        }
      });

      await this.insertCurrencyConfig(cmd.currency)

      for (let idx = 0; idx < cmd.accountTypes.length; idx++) {
        const id = cmd.accountIds[idx]
        const accountType = cmd.accountTypes[idx]
        assert(id)
        assert(accountType)

        const result = await this.insertLegacyHubCurrency({
          id,
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
      return Helper.failure(error)
    }
  }

  private async insertCurrencyConfig(currency: string): Promise<void> {
    let trx: Knex.Transaction | undefined
    try {
      trx = await this.db.transaction()

      // Look up the CurrencyConfig.
      const existing = await trx(TABLE_CURRENCY_CONFIG)
        .select('currency')
        .where({ currency })
      if (existing.length > 0) {
        await trx.commit()
        return
      }

      // Create a new CurrencyConfig, ids are based on the number of existing currencies.
      const currencyCountResult = await trx(TABLE_CURRENCY_CONFIG).count('* as count')
      const currencyCount = Number(currencyCountResult[0].count)
      const [
        ledgerOperation,
        ledgerControl
      ] = LedgerTigerBeetleHelper.generateLedgerIds(currencyCount);

      await trx(TABLE_CURRENCY_CONFIG).insert({
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

  private async insertLegacyHubCurrency(account: LegacyHubCurrency)
    : Promise<EnableHubCurrencyResponse> {
    let trx: Knex.Transaction | undefined
    try {
      trx = await this.db.transaction()

      // Look up the LegacyHubCurrency.
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
          id: account.id,
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

  public async getCurrencyConfig(currency: string): Promise<CurrencyConfig> {
    const rows = await this.db(TABLE_CURRENCY_CONFIG).where({ currency }).select('*')
    if (rows.length === 0) {
      throw new Error(`getCurrencyConfig() - no CurrencyConfig found for currency: ${currency}`);
    }

    assert(rows.length === 1, 'Expected only 1 row.')
    const row = rows[0]

    return SpecStore.hydrateCurrencyConfig(row)
  }

  public async getCurrencyConfigsMap(): Promise<Record<string, CurrencyConfig>> {
    const rows = await this.db(TABLE_CURRENCY_CONFIG).select('*')

    return rows.map(SpecStore.hydrateCurrencyConfig)
      .reduce((acc, curr) => {
        acc[curr.currency] = curr
        return acc
      }, {} as Record<string, CurrencyConfig>)
  }

  public async getLegacyHubCurrenciesAll(): Promise<Array<LegacyHubCurrency>> {
    const rows = await this.db(TABLE_CURRENCY_ACCOUNT).select('*')
    return rows.map(SpecStore.hydrateLegacyHubCurrency)
  }

  public async getLegacyHubCurrency(currency: string): Promise<Array<LegacyHubCurrency>> {
    const rows = await this.db(TABLE_CURRENCY_ACCOUNT).where({ currency }).select('*')
    return rows.map(SpecStore.hydrateLegacyHubCurrency)
  }

  public async assertCurrenciesEnabled(currencies: Array<string>): Promise<void> {
    assert(Array.isArray(currencies));
    assert(currencies.length > 0, 'Expected at least one currency.');

    const errors: Array<string> = [];
    const currencyConfigs = await this.getCurrencyConfigsMap()
    currencies.forEach(currency => {
      const found = currencyConfigs[currency]
      if (!found) {
        errors.push(`No CurrencyConfig found for: ${currency}.`);
      }
    });

    if (errors.length > 0) {
      throw new Error(`assertCurrenciesFailed with errors: [${errors.join(', ')}]`);
    }
  }

  /**
   * Backwards compatibility, check that the correct legacy accounts have been created.
   */
  public async assertHubAccountsCreatedForCurrencies(currencies: Array<string>): Promise<void> {
    for (const currency of currencies) {
      const currencyAccounts = await this.getLegacyHubCurrency(currency)
      const hubReconcilation = currencyAccounts
        .find(acc => acc.accountType === 'HUB_RECONCILIATION')
      const hubMultilateralSettlement = currencyAccounts
        .find(acc => acc.accountType === 'HUB_MULTILATERAL_SETTLEMENT')
      if (!hubReconcilation) {
        throw new Error(`Hub reconciliation account for the specified currency does not exist.`)
      }
      if (!hubMultilateralSettlement) {
        throw new Error(`Hub multilateral net settlement account for the specified currency does `
          + `not exist.`)
      }
    }
  }

  /**
   * Create the TigerBeetle DfspRoot id for this DFSP.
   * Pass in an id to use if this is a new DfspRoot.
   */
  public async getOrCreateDfspRoot(dfspId: string, isProxy: boolean, id: bigint): Promise<DfspRoot> {
    let trx: Knex.Transaction | undefined
    try {
      trx = await this.db.transaction()

      const row = await trx(TABLE_DFSP_ROOT).where({ dfspId }).select('*').first()
      if (row) {
        await trx.commit()
        return {
          dfspId: row.dfspId,
          // TODO: rename.
          id: row.masterAccountId,
          isProxy: Boolean(row.isProxy),
        }
      }

      await trx(TABLE_DFSP_ROOT).insert({ dfspId, masterAccountId: id, isProxy })

      await trx.commit()
      return {
        dfspId,
        id,
        isProxy,
      }
    } catch (err) {
      if (trx) {
        await trx.rollback()
      }

      throw err
    }
  }

  public async getDfspRoot(dfspId: string): Promise<DfspRoot> {
    const row = await this.db(TABLE_DFSP_ROOT).where({ dfspId }).select('*').first()
    if (!row) {
      throw new Error(`No dfsp found for id: ${dfspId}`)
    }

    return SpecStore.hydrateDfspRoot(row)
  }

  /**
   * Gets all of the DfspRoots for the dfspIds given by the ids as a mapping of id => DfspRoot.
   * If a dfspid could not be found, it is not returned (doesn't throw an error).
   */
  public async getDfspRoots(dfspIds: Array<string>): Promise<Record<string, DfspRoot>> {
    const rows = await this.db(TABLE_DFSP_ROOT).whereIn('dfspId', dfspIds).select('*')
    return rows.map(SpecStore.hydrateDfspRoot)
      .reduce((acc, curr) => {
        acc[curr.dfspId] = curr
        return acc
      }, {} as Record<string, DfspRoot>)
  }

  public async getPrepareContextDfsps(
    currencies: Array<string>,
    dfspIds: Array<string>
  ): Promise<ContextDfsps> {
    const rows = await this.db('specDfspCurrency')
      .join('specDfspRoot', 'specDfspCurrency.dfspId', 'specDfspRoot.dfspId')
      .join('specCurrencyConfig', 'specDfspCurrency.currency', 'specCurrencyConfig.currency')
      .whereIn('specDfspCurrency.dfspId', dfspIds)
      .whereIn('specDfspCurrency.currency', currencies)
      .select('*')

    // Now map and deduplicate.
    const currencyConfigIds: Record<string, true> = {}
    const currencyConfigs: Array<CurrencyConfig> = []
    const dfspRootIds: Record<string, true> = {}
    const dfspRoots: Array<DfspRoot> = []
    const dfspCurrencyIds: Record<string, true> = {}
    const dfspCurrencies: Array<DfspCurrency> = []
    rows.forEach(row => {
      const currencyConfig = SpecStore.hydrateCurrencyConfig(row)
      const dfspRoot = SpecStore.hydrateDfspRoot(row)
      const dfspCurrency: DfspCurrency = SpecStore.hydrateDfspCurrency(row)

      if (!currencyConfigIds[currencyConfig.currency]) {
        currencyConfigIds[currencyConfig.currency] = true
        currencyConfigs.push(currencyConfig)
      }

      if (!dfspRootIds[dfspRoot.dfspId]) {
        dfspRootIds[dfspRoot.dfspId] = true
        dfspRoots.push(dfspRoot)
      }

      const dfspAndCurrency = `${dfspCurrency.dfspId}:${dfspCurrency.currency}`
      if (!dfspCurrencyIds[dfspAndCurrency]){
        dfspCurrencyIds[dfspAndCurrency] = true
        dfspCurrencies.push(dfspCurrency) 
      }
    })

    const context: ContextDfsps = {
      currencies: Object.keys(currencyConfigIds),
      dfspIds: Object.keys(dfspRootIds),
      currencyConfigs: currencyConfigs,
      dfspRoots: dfspRoots,
      dfspCurrencies: dfspCurrencies,
    }

    return context
  }

  public async getPrepareContextPayments(prepareIds: Array<string>): Promise<ContextPayments> {
    const rows = await this.db('specTransfer')
      .rightJoin('specPrepare', 'specTransfer.id', 'specPrepare.id')
      .whereIn('specPrepare.id', prepareIds)
      .select('*')

    const prepareIdsFound: Array<string> = []
    const idsSeen: Record<string, true> = {}
    const specPrepares: Array<SpecPrepare> = []
    const specTransfers: Array<SpecTransfer> = []
    rows.forEach(row => {
      // specPrepare should exist, specTransfer maybe not.
      const specPrepare = SpecStore.hydrateSpecPrepare(row)
      if (idsSeen[specPrepare.id]) return

      idsSeen[specPrepare.id] = true
      specPrepares.push(specPrepare)

      if (row.amount) {
        const specTransfer = SpecStore.hydrateSpecTransfer(row)
        specTransfers.push(specTransfer)
      }
    })
    
    const context: ContextPayments = {
      prepareIds: prepareIdsFound,
      specPrepares,
      specTransfers,
    }
    return context
  }

  public async savePreparesAndTransfers(prepares: Array<SpecPrepare>, transfers: Array<SpecTransfer>) {
    await this.saveSpecPrepares(prepares)
    await this.saveTransferSpecs(transfers)
  }

  public async queryDfspRootsWithCurrencies(): Promise<{
    // All rows joined together.
    dfspRootAndCurrency: Array<DfspRoot & DfspCurrency>,
    dfspRoots: Array<DfspRoot>,
    dfspCurrencies: Array<DfspCurrency>
  }> {
    const result = await this.db(TABLE_DFSP_CURRENCY)
      .join(TABLE_DFSP_ROOT, `${TABLE_DFSP_CURRENCY}.dfspId`, `${TABLE_DFSP_ROOT}.dfspId`)
      .select('*')

    const dfspRoots: Array<DfspRoot> = []
    const uniqueRootIds: Record<string, true> = {}

    const dfspCurrencies: Array<DfspCurrency> = []
    const uniqueDfspCurrencyIds: Record<string, true> = {}

    const rows: Array<DfspRoot & DfspCurrency> = []
    result.forEach(row => {
      const dfspRoot = SpecStore.hydrateDfspRoot(row)
      const dfspCurrency: DfspCurrency = SpecStore.hydrateDfspCurrency(row)

      if (!uniqueRootIds[dfspRoot.dfspId]) {
        uniqueRootIds[dfspRoot.dfspId] = true
        dfspRoots.push(dfspRoot)
      }

      const key = dfspCurrency.dfspId + dfspCurrency.currency
      if (!uniqueDfspCurrencyIds[key]) {
        uniqueDfspCurrencyIds[key] = true
        dfspCurrencies.push(dfspCurrency)
      }

      rows.push({ ...dfspRoot, ...dfspCurrency })
    })

    return {
      dfspRootAndCurrency: rows,
      dfspRoots,
      dfspCurrencies
    }
  }

  public async getDfspCurrency(dfspId: string, currency: string):
    Promise<QueryResultWithNotFound<DfspCurrency>> {
    const row = await this.db(TABLE_DFSP_CURRENCY).where({ dfspId, currency }).select('*').first()
    if (!row) {
      return {
        type: 'NOT_FOUND',
        error: new Error(`getDfspCurrency no spec found for id:${dfspId} + currency: ${currency}.`)
      };
    }

    return {
      type: 'SUCCESS',
      result: SpecStore.hydrateDfspCurrency(row)
    };
  }

  public async getDfspCurrencies(id: string): Promise<Array<DfspCurrency>> {
    const rows = await this.db(TABLE_DFSP_CURRENCY).where({ dfspId: id }).select('*')
    return rows.map(SpecStore.hydrateDfspCurrency)
  }

  // TODO: should we auto transform this to be a map of (dfspId,currency) => DfspCurrency ?
  // Or even better a proper data structure?
  public async getDfspCurrenciesAll(dfsps: Array<string>): Promise<Array<DfspCurrency>> {
    const rows = await this.db(TABLE_DFSP_CURRENCY).whereIn('dfspId', dfsps).select('*')
    return rows.map(SpecStore.hydrateDfspCurrency)
  }

  /**
   * Look up the account within the DfspCurrency for the dfspid and account id.
   */
  public async lookupDfspCurrencyByAccountId(dfspId: string, accountId: bigint):
    Promise<{ code: AccountCode; currency: DfspCurrency; }> {

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
      throw new Error(`lookupDfspCurrencyByAccountId() not found for dfspId: ${dfspId}, `
        + `accountId: ${accountId}.`)
    }

    const currency = SpecStore.hydrateDfspCurrency(row)

    // Check which field matched.
    let code: AccountCode
    if (currency.deposit === accountId) {
      code = AccountCode.Deposit
    } else if (currency.unrestricted === accountId) {
      code = AccountCode.Unrestricted
    } else if (currency.unrestrictedLock === accountId) {
      code = AccountCode.Unrestricted_Lock
    } else if (currency.restricted === accountId) {
      code = AccountCode.Restricted
    } else if (currency.reserved === accountId) {
      code = AccountCode.Reserved
    } else if (currency.commitedOutgoing === accountId) {
      code = AccountCode.Committed_Outgoing
    } else if (currency.clearingCredit === accountId) {
      code = AccountCode.Clearing_Credit
    } else if (currency.clearingSetup === accountId) {
      code = AccountCode.Clearing_Setup
    } else if (currency.clearingLimit === accountId) {
      code = AccountCode.Clearing_Limit
    } else {
      throw new Error(`lookupDfspCurrencyByAccountId() - matched row ` +
        `but no field matched accountId: ${accountId}`
      )
    }

    return { code, currency }
  }

  public async dfspCurrenciesForNetDebitCapAccountIds(ids: Array<bigint>):
    Promise<Record<string, DfspCurrency>> {

    const rows = await this.db(TABLE_DFSP_CURRENCY)
      .whereIn('netDebitCap', ids.map(id => id.toString()))
      .select('*')

    const dfspCurrencies = rows.map(SpecStore.hydrateDfspCurrency)
    const resultMap: Record<string, DfspCurrency> = {}
    dfspCurrencies.forEach(currency => {
      resultMap[currency.netDebitCap.toString()] = currency
    })

    return resultMap
  }

  public async createDfspCurrency(dfspId: string, currency: string, now: Date, ids: Array<number>):
    Promise<DfspCurrency> {
    let trx: Knex.Transaction | undefined
    assert(ids.length >= 12)
    try {
      trx = await this.db.transaction()

      const row = await trx(TABLE_DFSP_CURRENCY).where({ dfspId, currency }).select('*').first()
      if (row) {
        await trx.commit()
        return SpecStore.hydrateDfspCurrency(row)
      }

      const dfspCurrency: DfspCurrency = {
        dfspId,
        currency,
        // Note: These orders are important for the fuzz tests, to ensure determinism between
        // LedgerSql and LedgerTigerBeetle.
        unrestricted: BigInt(ids[0]),
        deposit: BigInt(ids[1]),
        unrestrictedLock: BigInt(ids[2]),
        restricted: BigInt(ids[3]),
        reserved: BigInt(ids[4]),
        commitedOutgoing: BigInt(ids[5]),
        clearingCredit: BigInt(ids[6]),
        clearingSetup: BigInt(ids[7]),
        clearingLimit: BigInt(ids[8]),
        control: BigInt(ids[9]),
        netDebitCap: BigInt(ids[10]),
        netDebitCapSet: BigInt(ids[11]),
        netDebitCapSetUtil: BigInt(ids[12]),
        changedDate: now,
        changedDatePosition: now,
        changedDateSettlement: now,
        createdDate: now,
      };
      await trx(TABLE_DFSP_CURRENCY).insert(dfspCurrency)

      await trx.commit()
      return dfspCurrency
    } catch (err) {
      if (trx) {
        await trx.rollback()
      }

      throw err
    }
  }

  public async saveFundingSpec(funding: any): Promise<void> {
    return
  }

  public async saveSpecPrepares(prepares: Array<SpecPrepare>): Promise<void> {
    if (prepares.length === 0) return

    try {
      const records = prepares.map(prepare => {
        const record: any = {
          id: prepare.id,
          payloadHash: prepare.payloadHash
        }
        if (prepare.abortedAt) {
          record.abortedAt = prepare.abortedAt
        }
        return record
      })

      await this.db.from(TABLE_PREPARE)
        .insert(records)
        .onConflict('id')
        .ignore()

    } catch (err: any) {
      logger.error(`saveSpecPrepares() - failed with error: ${err.message}`)
      throw err
    }
  }

  public async getSpecPrepares(transferIds: Array<string>): Promise<Array<GetSpecPrepareResult>> {
    try {
      const resultMap: Record<string, GetSpecPrepareResult> = {}
      // Populate with not founds.
      transferIds.forEach(id => resultMap[id] = {
        type: 'NOT_FOUND' as 'NOT_FOUND',
        id,
      })

      const rows = await this.db.from(TABLE_PREPARE)
        .whereIn('id', transferIds)
        .select('*')

      rows.forEach(row => {
        resultMap[row.id] = {
          type: 'SUCCESS' as 'SUCCESS',
          id: row.id,
          result: SpecStore.hydrateSpecPrepare(row),
        }
      })

      assert.equal(transferIds.length, Object.values(resultMap).length, 'Dropped a value.')
      return Object.values(resultMap)
    } catch (err: any) {
      logger.error(`getTransferSpecs() failed with error: ${err.message}`)
      throw err
    }
  }

  public async attachSpecPrepareAbortedAt(ids: Array<string>, dates: Array<Date>): Promise<void> {
    assert.equal(ids.length, dates.length, 'Expected ids and dates to be the same length.')

    if (ids.length === 0) {
      return
    }

    const bindings: Array<string | Date> = []
    const clauses = ids.map((id, idx) => {
      bindings.push(id, dates[idx])
      return `WHEN id = ? THEN ?`
    })

    await this.db.raw(
      `UPDATE ?? SET abortedAt = CASE ${clauses.join(' ')} END` +
      ` WHERE id in (${ids.map(() => '?').join(',')}) AND abortedAt IS NULL`,
      [TABLE_PREPARE, ...bindings, ...ids]
    )
  }

  public async saveTransferSpecs(specs: Array<SpecTransferCreate>): Promise<Array<SaveSpecTransferResult>> {
    if (specs.length === 0) return []

    try {
      const records = specs.map(spec => {
        const record = {
          id: spec.id,
          currency: spec.currency,
          amount: spec.amount,
          expiration: spec.expiration,
          payerId: spec.payerId,
          payeeId: spec.payeeId,
          ilpCondition: spec.ilpCondition,
          ilpPacket: spec.ilpPacket,
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

  public async getTransferSpecs(transferIds: Array<string>): Promise<Array<GetSpecTransferResult>> {
    try {
      const resultMap: Record<string, GetSpecTransferResult> = {}
      // Populate with not founds.
      transferIds.forEach(id => resultMap[id] = {
        type: 'NOT_FOUND' as 'NOT_FOUND',
        id,
      })

      const rows = await this.db.from(TABLE_TRANSFER)
        .whereIn('id', transferIds)
        .select('*')

      rows.forEach(row => {
        resultMap[row.id] = {
          type: 'SUCCESS' as 'SUCCESS',
          id: row.id,
          result: row,
        }
      })

      assert.equal(transferIds.length, Object.values(resultMap).length, 'Dropped a value.')
      return Object.values(resultMap)
    } catch (err: any) {
      logger.error(`getTransferSpecs() failed with error: ${err.message}`)
      throw err
    }
  }

  public async attachFulfillments(updates: Array<SpecTransferUpdate>): Promise<Array<AttachFulfilmentResult>> {
    try {
      if (updates.length === 0) {
        return []
      }

      // Build with raw for efficient bulk update.

      const ids: Array<string> = []
      const bindings: Array<string> = []
      const clauses = updates.map(update => {
        ids.push(update.id)
        bindings.push(update.id, update.fulfilment)
        return `WHEN id = ? THEN ?`
      })

      await this.db.raw(
        `UPDATE ?? SET fulfilment = CASE ${clauses.join(' ')} END` +
        ` WHERE id in (${ids.map(() => '?').join(',')})`,
        [TABLE_TRANSFER, ...bindings, ...ids]
      )

      return updates.map(update => ({
        type: 'SUCCESS',
        id: update.id
      }))
    } catch (err: any) {
      logger.error(`attachFulfillment() - failed with error: ${err.message}`)
      return updates.map(update => {
        return {
          type: 'FAILURE',
          id: update.id
        }
      })
    }
  }

  public async updateChangedDatePositionAndSettlement(
    dfspId: string, currency: string, now: Date
  ): Promise<void> {
    await this.db(TABLE_DFSP_CURRENCY)
      .where({ dfspId, currency })
      .update({
        changedDatePosition: now,
        changedDateSettlement: now
      })
  }

  public async updateChangedDatePosition(
    dfspId: string, currency: string, now: Date
  ): Promise<void> {
    await this.db(TABLE_DFSP_CURRENCY)
      .where({ dfspId, currency })
      .update({
        changedDatePosition: now,
      })
  }

  public async updateChangedDateSettlement(
    dfspId: string, currency: string, now: Date
  ): Promise<void> {
    await this.db(TABLE_DFSP_CURRENCY)
      .where({ dfspId, currency })
      .update({
        changedDateSettlement: now,
      })
  }

  private static hydrateCurrencyConfig(row: any): CurrencyConfig {
    return {
      currency: row.currency,
      idOperation: row.ledgerOperation,
      idControl: row.ledgerControl,
      settlementBalance: BigInt(row.settlementBalance),
      assetScale: row.assetScale
    }
  }

  private static hydrateLegacyHubCurrency(row: any): LegacyHubCurrency {
    return {
      id: row.id,
      currency: row.currency,
      accountType: row.accountType,
      createdDate: row.createdDate,
      changedDate: row.changedDate,
    }
  }

  private static hydrateDfspRoot(row: any): DfspRoot {
    return {
      dfspId: row.dfspId,
      // TODO: rename.
      id: BigInt(row.masterAccountId),
      isProxy: Boolean(row.isProxy),
    }
  }

  private static hydrateDfspCurrency(row: any): DfspCurrency {
    const dfspCurrency: DfspCurrency = {
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
      control: BigInt(row.control),
      netDebitCap: BigInt(row.netDebitCap),
      netDebitCapSet: BigInt(row.netDebitCapSet),
      netDebitCapSetUtil: BigInt(row.netDebitCapSetUtil),
      changedDate: row.changedDate,
      changedDatePosition: row.changedDatePosition,
      changedDateSettlement: row.changedDateSettlement,
      createdDate: row.createdDate,
    }
    return dfspCurrency
  }

  private static hydrateSpecPrepare(row: any): SpecPrepare {
    const specPrepare: SpecPrepare = {
      id: row.id,
      payloadHash: row.payloadHash
    }
    if (row.abortedAt) {
      specPrepare.abortedAt = new Date(row.abortedAt)
    }

    return specPrepare
  }

  private static hydrateSpecTransfer(row: any): SpecTransfer {
    const specTransfer: SpecTransfer = {
      id: row.id,
      currency: row.currency,
      amount: row.amount,
      expiration: row.expiration,
      payerId: row.payerId,
      payeeId: row.payeeId,
      ilpCondition: row.ilpCondition,
      ilpPacket: row.ilpPacket,
    }

    if (row.fulfilment) {
      specTransfer.fulfilment = row.fulfilment
    }

    return specTransfer
  }

  // private static hydrateNetDebitCap(row: any): NetDebitCap {
  //   assertOneOf(row.type, ['LIMITED', 'UNLIMITED'])
  //   if (row.type === 'UNLIMITED') {
  //     assert(row.amount === null,
  //       `hydrateNetDebitCap - expected amount to be null when type == UNLIMITED.`
  //     )

  //     return {
  //       type: 'UNLIMITED',
  //       dfspId: row.dfspId,
  //       currency: row.currency,
  //     }
  //   }

  //   return {
  //     type: 'LIMITED',
  //     dfspId: row.dfspId,
  //     amount: BigInt(row.amount),
  //     currency: row.currency,
  //     alarmPercentage: Number.parseFloat(row.alarmPercentage),
  //   }
  // }
}
