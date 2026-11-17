/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

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

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------
 ******/
import { Knex } from 'knex'
import assert from 'node:assert'
import { ApplicationConfig } from '../../../lib/config'
import { AccountCode, Enums, GetSettlementWindowsQuery, QueryResultWithNotFound, SettlementCloseWindowCommand } from '../shared/types'
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
  type: 'FAILURE'
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
  currency: string

  /**
   * The TigerBeetle ledger where 'real' funds are tracked. 
   * Used for financial reporting.
   */
  idOperation: number

  /**
   * A separate 'control' ledger for non-financial operations.
   */
  idControl: number

  /**
   * Backwards Compatibility: The AccountId for the settlement balance account.
   */
  settlementBalance: bigint
}

/**
 * The Hub account's representation of each individual accounts. 
 * This is used to maintain backwards compatibility with LedgerSQL.
 */
export type LegacyHubCurrency = {
  /**
   * The id of the currency account.
   */
  id: number
  currency: string
  /**
   * The Legacy account type.
   */
  accountType: string

  /**
   * When the LegacyHubCurrency was created.
   */
  createdDate: Date

  /**
   * When the LegacyHubCurrency was last updated.
   */
  changedDate: Date
}

/**
 * Stores the mapping between the dfspId => DfspRoot Id on TigerBeetle.
 */
export interface DfspRoot {
  dfspId: string
  id: bigint
  isProxy: boolean
}

/**
 * The set of TigerBeetle Account ids.
 */
export interface DfspAccountIds {
  deposit: bigint
  unrestricted: bigint
  /**
   * @deprecated Replaced by netDebitCapSet and netDebitCapSetUtil.
   */
  unrestrictedLock: bigint
  netDebitCapSet: bigint
  netDebitCapSetUtil: bigint
  restricted: bigint
  reserved: bigint

  /**
   * Move funds into this account when a payment expires or is aborted.
   * Funds are swept from return back to unrestricted/restricted periodially.
   */
  return: bigint

  commitedOutgoing: bigint
  clearingCredit: bigint
  clearingSetup: bigint
  clearingLimit: bigint

  /**
   * Control account to act as counterparty for netDebitCap.
   * ledger: operation
   */
  control: bigint

  /**
   * TigerBeetle account id of the net debit cap control account.
   * ledger: operation
   */
  netDebitCap: bigint
}

/**
 * Defines the TigerBeetle Accounts for a dfspId + currency.
 */
export interface DfspCurrency extends DfspAccountIds {
  dfspId: string
  currency: string

  /**
   * When the account was last activated/deactivated.
   */
  changedDate: Date

  /**
   * Backwards compatibility: Keep track of the application timestamp when the position
   * account was last changed.
   */
  changedDatePosition: Date

  /**
   * Backwards compatibility: Keep track of the application timestamp when the settlement
   * account was last changed.
   */
  changedDateSettlement: Date

  /**
   * When the account was created.
   */
  createdDate: Date
}

/**
 * Internal representation of the DfspRoot account.
 */
export interface InternalDfspRoot extends Account {
  dfspId: string
  isProxy: boolean
}

/**
 * Internal representation of the DfspCurrency Account.
 */
export interface InternalDfspCurrency extends Account {
  dfspId: string,
  currency: string

  /**
   * Technically we don't need this since it lives on the account.code, but as a number,
   * but explicit typing here makes accessing this property easier.
   */
  accountCode: AccountCode
}

export type NetDebitCap = {
  type: 'UNLIMITED'
  dfspId: string
  currency: string
} | {
  type: 'LIMITED'

  /**
   * The amount to cap at. This is stored as a currency-native bigint, same as TigerBeetle.
   */
  amount: bigint
  dfspId: string
  currency: string
  alarmPercentage: number
}

/**
 * Keep track of whether or not the payer or payee is directly connected to the Hub (LOCAL) or 
 * proxied through another Participant (PROXY).
 */
export type ParticipantLocation = 'LOCAL' | 'PROXY'

/**
 * Metadata relating to the payment.
 */
export type PaymentMeta = {
  id: string
  currency: string
  amount: string
  expiration: Date
  payerId: string
  payeeId: string
  payerLocation: ParticipantLocation
  payeeLocation: ParticipantLocation
  ilpCondition: string
  ilpPacket: string
}

export type FulfilMetaUpdate = {
  id: string,
  fulfilment: string,
  fulfiledAt: Date
}

export type SavePaymentMetaResult = {
  id: string,
  type: 'SUCCESS' | 'FAILURE'
}

export type GetPaymentMetaResult = {
  type: 'SUCCESS'
  id: string,
  paymentMeta: PaymentMeta
  fulfilMeta: FulfilMeta
} | {
  type: 'NOT_FOUND'
  id: string
}

export type PrepareMeta = {
  id: string
  payloadHash: number

  /**
   * When the Prepare was aborted by the application.
   */
  abortedAt?: Date
}

export type GetPrepareMetaResult = {
  type: 'SUCCESS'
  id: string,
  result: PrepareMeta
} | {
  type: 'NOT_FOUND'
  id: string
}

export type FulfilMeta = {
  id: string,
  payloadHash: number
  fulfilment?: string,
  fulfiledAt?: Date,
  abortedAt?: Date
}

/**
 * Combined context object which contains all of the metadata for processing prepare() + fulfil().
 */
export type ContextPayments = {
  currencies: Array<string>
  dfspIds: Array<string>
  currencyConfigs: Array<CurrencyConfig>
  dfspRoots: Array<DfspRoot>
  dfspCurrencies: Array<DfspCurrency>
  prepareMetas: Record<string, PrepareMeta>
  fulfilMetas: Record<string, FulfilMeta>
  paymentMetas: Record<string, PaymentMeta>
}

/**
 * Combined context object which contains all of the metadata for processing ledger lifecycle
 * methods.
 */
export type ContextDfsps = {
  currencies: Array<string>
  dfspIds: Array<string>,
  currencyConfigs: Array<CurrencyConfig>
  dfspRoots: Array<DfspRoot>
  dfspCurrencies: Array<DfspCurrency>
}

export type CmdSettlementPrepare = {
  reason: string,
  now: Date,
  modelId: number,
  windows: Array<number>
}

export type CmdSettlementPrepare2 = {
  reason: string,
  now: Date,
  model: string,
  windows: Array<number>
}

export type ResultSettlementPrepare = {
  settlementId: number,
  windowMetas: Array<SettlementWindowMetaClosed>
}

export enum SettlementWindowMetaState {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export type SettlementWindowMeta = {
  id: number,
  /**
   * When the settlement window was opened. Always the previous 
   * settlement window's closeDate + 1ms.
   */
  openDate: Date,
  state: SettlementWindowMetaState.OPEN
} | {
  id: number,
  reason: string,
  openDate: Date,
  /**
   * When the settlement window was closed
   */
  closeDate: Date,
  /**
   * The Open/Closed state of the Settlement Window.
   */
  state: SettlementWindowMetaState.CLOSED

  /**
   * If the window has been assigned to a settlement, the settlement id.
   */
  settlementId: number | undefined
}

export type SettlementWindowContext = {
  windowMeta: SettlementWindowMeta,

}

export type SettlementWindowMetaOpen = Extract<
  SettlementWindowMeta, { state: SettlementWindowMetaState.OPEN }
>

export type SettlementWindowMetaClosed = Extract<
  SettlementWindowMeta, { state: SettlementWindowMetaState.CLOSED }
>

export type SettlementMeta = {
  id: number,
  reason: string,
  createdDate: Date,
  model: string,
}

export type SettlementContext = {
  meta: SettlementMeta,
  legs: Array<SettlementLegMeta>
  windows: Array<SettlementWindowMeta>
  currencyConfigs: Record<string, CurrencyConfig>
  dfspCurrencies: Record<string, DfspCurrency>
}

export type SettlementLegMeta = {
  /**
   * Autogenerated by MySQL.
   */
  id: number,

  settlementId: number,
  windowId: number,
  currency: string,
  dfspId: string,

  /**
   * Account id references into TigerBeetle
   */
  staging: bigint

  /**
   * The pending id of the transfer to resolve the Debit side of the settlement leg.
   */
  debitPendingId: bigint,

  /**
   * The pending id of the transfer to resolve the Credit side of the settlement leg.
   */
  creditPendingId: bigint
}

export type SettlementLegMetaCreate = Omit<SettlementLegMeta, 'id'>

export type QuerySettlementsQuery = {
  currency?: string
  settlementWindowId?: number
  fromDateTime?: Date
  toDateTime?: Date,
  fromSettlementWindowDateTime?: Date,
  toSettlementWindowDateTime?: Date,
}

export interface DepsMetaStore {
  config: ApplicationConfig
  enums: Enums,
  db: Knex,
  helper: Helper,
}

/**
 * @class MetaStore
 * @description Metadata store for TigerBeetle Accounts, and Transfers.
 */
export default class MetaStore {
  private db: Knex;
  private readonly helper: Helper

  constructor(private deps: DepsMetaStore) {
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

      // If accounts is empty, assume it's these two.
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
      const existing = await trx('metaCurrencyConfig')
        .select('currency')
        .where({ currency })
      if (existing.length > 0) {
        await trx.commit()
        return
      }

      // Create a new CurrencyConfig, ids are based on the number of existing currencies.
      const currencyCountResult = await trx('metaCurrencyConfig').count('* as count')
      const currencyCount = Number(currencyCountResult[0].count)
      const [
        ledgerOperation,
        ledgerControl
      ] = Helper.generateLedgerIds(currencyCount);

      const rowScale = await trx('currency').where('currencyId', currency).select('scale').first()
      assert(rowScale)
      assert(rowScale.scale)

      await trx('metaCurrencyConfig').insert({
        currency,
        ledgerOperation,
        ledgerControl,
        settlementBalance: this.helper.idSmall(),
        assetScale: rowScale.scale
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
      const existing = await trx('metaLegacyHubCurrency')
        .select('currency')
        .where({ currency: account.currency, accountType: account.accountType })
      if (existing.length > 0) {
        await trx.commit()
        return {
          type: 'EXISTS'
        }
      }

      await trx('metaLegacyHubCurrency')
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
    const rows = await this.db('metaCurrencyConfig').where({ currency }).select('*')
    if (rows.length === 0) {
      throw new Error(`getCurrencyConfig() - no CurrencyConfig found for currency: ${currency}`);
    }

    assert(rows.length === 1, 'Expected only 1 row.')
    const row = rows[0]

    return MetaStore.hydrateCurrencyConfig(row)
  }

  public async getCurrencyConfigsMap(): Promise<Record<string, CurrencyConfig>> {
    const rows = await this.db('metaCurrencyConfig').select('*')

    return rows.map(MetaStore.hydrateCurrencyConfig)
      .reduce((acc, curr) => {
        acc[curr.currency] = curr
        return acc
      }, {} as Record<string, CurrencyConfig>)
  }

  public async getLegacyHubCurrenciesAll(): Promise<Array<LegacyHubCurrency>> {
    const rows = await this.db('metaLegacyHubCurrency').select('*')
    return rows.map(MetaStore.hydrateLegacyHubCurrency)
  }

  public async getLegacyHubCurrency(currency: string): Promise<Array<LegacyHubCurrency>> {
    const rows = await this.db('metaLegacyHubCurrency').where({ currency }).select('*')
    return rows.map(MetaStore.hydrateLegacyHubCurrency)
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
  public async getOrCreateDfspRoot(dfspId: string, isProxy: boolean, id: bigint):
    Promise<DfspRoot> {
    let trx: Knex.Transaction | undefined
    try {
      trx = await this.db.transaction()

      const row = await trx('metaDfspRoot').where({ dfspId }).select('*').first()
      if (row) {
        await trx.commit()
        return {
          dfspId: row.dfspId,
          id: row.id,
          isProxy: Boolean(row.isProxy),
        }
      }

      await trx('metaDfspRoot').insert({ dfspId, id, isProxy })

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
    const row = await this.db('metaDfspRoot').where({ dfspId }).select('*').first()
    if (!row) {
      throw new Error(`No dfsp found for id: ${dfspId}`)
    }

    return MetaStore.hydrateDfspRoot(row)
  }

  /**
   * Gets all of the DfspRoots for the dfspIds given by the ids as a mapping of id => DfspRoot.
   * If a dfspid could not be found, it is not returned (doesn't throw an error).
   */
  public async getDfspRoots(dfspIds: Array<string>): Promise<Record<string, DfspRoot>> {
    const rows = await this.db('metaDfspRoot').whereIn('dfspId', dfspIds).select('*')
    return rows.map(MetaStore.hydrateDfspRoot)
      .reduce((acc, curr) => {
        acc[curr.dfspId] = curr
        return acc
      }, {} as Record<string, DfspRoot>)
  }

  /**
   * Given a list of paymentIds which may or not exist, and a list of currencies, lookup all of the 
   * required metadata for processing payments.
   * 
   * This implementation does it in 2 round trips to the database, but could be optimized by:
   * 1. Caching the Dfsp context results, since they will change only very slowly.
   * 2. Combining into one mega query, at the cost of making that query very hard to understand.
   */
  public async getPaymentContext(
    paymentIds: Array<string>,
    currencies: Array<string> = [],
    dfspIds: Array<string> = []
  ): Promise<ContextPayments> {
    if (paymentIds.length === 0 && currencies.length === 0 && dfspIds.length === 0) {
      return {
        currencies: [],
        dfspIds: [],
        currencyConfigs: [],
        dfspRoots: [],
        dfspCurrencies: [],
        prepareMetas: {},
        fulfilMetas: {},
        paymentMetas: {},
      }
    }

    const rowsTransfer = await this.db('metaPrepare')
      .leftJoin('metaPayment', 'metaPrepare.id', 'metaPayment.id')
      .leftJoin('metaFulfil', 'metaPrepare.id', 'metaFulfil.id')
      .whereIn('metaPrepare.id', paymentIds)
      .select(
        'metaPrepare.id as id',
        'metaPrepare.payloadHash as preparePayloadHash',
        'metaPrepare.abortedAt as abortedAt',
        'metaFulfil.payloadHash as fulfilPayloadHash',
        'metaFulfil.abortedAt as fulfilAbortedAt',
        'metaFulfil.fulfiledAt as fulfilFulfiledAt',
        'metaFulfil.fulfilment as fulfilFulfilment',
        'metaPayment.currency as currency',
        'metaPayment.amount as amount',
        'metaPayment.expiration as expiration',
        'metaPayment.payerId as payerId',
        'metaPayment.payeeId as payeeId',
        'metaPayment.payerLocation as payerLocation',
        'metaPayment.payeeLocation as payeeLocation',
        'metaPayment.ilpCondition as ilpCondition',
        'metaPayment.ilpPacket as ilpPacket'
      )

    const idsSeen: Record<string, true> = {}
    const prepareMetas: Record<string, PrepareMeta> = {}
    const fulfilMetas: Record<string, FulfilMeta> = {}
    const paymentMetas: Record<string, PaymentMeta> = {}
    const currencySet: Set<string> = new Set()
    const dfspIdSet: Set<string> = new Set()

    rowsTransfer.forEach(row => {
      if (idsSeen[row.id]) return
      idsSeen[row.id] = true

      const prepareMeta = MetaStore.hydratePrepareMeta({
        id: row.id,
        payloadHash: row.preparePayloadHash,
        abortedAt: row.abortedAt
      })
      prepareMetas[row.id] = prepareMeta

      if (row.fulfilPayloadHash != null) {
        const fulfilMeta = MetaStore.hydrateFulfilMeta({
          id: row.id,
          payloadHash: row.fulfilPayloadHash,
          abortedAt: row.fulfilAbortedAt,
          fulfiledAt: row.fulfilFulfiledAt,
          fulfilment: row.fulfilFulfilment,
        })

        fulfilMetas[row.id] = fulfilMeta
      }

      if (row.amount != null) {
        const paymentMeta = MetaStore.hydratePaymentMeta(row)
        paymentMetas[row.id] = paymentMeta
        currencySet.add(paymentMeta.currency)
        dfspIdSet.add(paymentMeta.payerId)
        dfspIdSet.add(paymentMeta.payeeId)
      }
    })

    const paymentCurrencies = Array.from(currencySet)
    const paymentDfspIds = Array.from(dfspIdSet)

    const allCurrencies = [...currencies, ...paymentCurrencies]
    const allDfspIds = [...dfspIds, ...paymentDfspIds]
    const dfspContext = await this.getContextDfsps(allCurrencies, allDfspIds)

    return {
      currencies: allCurrencies,
      dfspIds,
      currencyConfigs: dfspContext.currencyConfigs,
      dfspRoots: dfspContext.dfspRoots,
      dfspCurrencies: dfspContext.dfspCurrencies,
      prepareMetas,
      fulfilMetas,
      paymentMetas,
    }
  }

  public async getContextDfsps(
    currencies: Array<string>,
    dfspIds: Array<string>
  ): Promise<ContextDfsps> {
    const rows = await this.db('metaDfspCurrency')
      .join('metaDfspRoot', 'metaDfspCurrency.dfspId', 'metaDfspRoot.dfspId')
      .join('metaCurrencyConfig', 'metaDfspCurrency.currency', 'metaCurrencyConfig.currency')
      .whereIn('metaDfspCurrency.dfspId', dfspIds)
      .whereIn('metaDfspCurrency.currency', currencies)
      .select('*')

    // Now map and deduplicate.
    const currencyConfigIds: Record<string, true> = {}
    const currencyConfigs: Array<CurrencyConfig> = []
    const dfspRootIds: Record<string, true> = {}
    const dfspRoots: Array<DfspRoot> = []
    const dfspCurrencyIds: Record<string, true> = {}
    const dfspCurrencies: Array<DfspCurrency> = []
    rows.forEach(row => {
      const currencyConfig = MetaStore.hydrateCurrencyConfig(row)
      const dfspRoot = MetaStore.hydrateDfspRoot(row)
      const dfspCurrency: DfspCurrency = MetaStore.hydrateDfspCurrency(row)

      if (!currencyConfigIds[currencyConfig.currency]) {
        currencyConfigIds[currencyConfig.currency] = true
        currencyConfigs.push(currencyConfig)
      }

      if (!dfspRootIds[dfspRoot.dfspId]) {
        dfspRootIds[dfspRoot.dfspId] = true
        dfspRoots.push(dfspRoot)
      }

      const dfspAndCurrency = `${dfspCurrency.dfspId}:${dfspCurrency.currency}`
      if (!dfspCurrencyIds[dfspAndCurrency]) {
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

  public async savePreparesAndPayments(prepares: Array<PrepareMeta>, payments: Array<PaymentMeta>) {
    await this.savePrepareMetas(prepares)
    await this.savePaymentMetas(payments)
  }

  /**
   * Look up the payments that might have expired between the two given dates.
   */
  public async lookupPaymentsByExpiryBetween(start: Date, end: Date): Promise<Array<PaymentMeta>> {
    assert(end.getTime() > start.getTime())

    const rows = await this.db('metaPayment')
      .whereBetween('expiration', [start, end])
      .select('*')

    return rows.map(MetaStore.hydratePaymentMeta)
  }

  public async queryDfspRootsWithCurrencies(): Promise<{
    // All rows joined together.
    dfspRootAndCurrency: Array<DfspRoot & DfspCurrency>,
    dfspRoots: Array<DfspRoot>,
    dfspCurrencies: Array<DfspCurrency>
  }> {
    const result = await this.db('metaDfspCurrency')
      .join('metaDfspRoot', `${'metaDfspCurrency'}.dfspId`, `${'metaDfspRoot'}.dfspId`)
      .select('*')

    const dfspRoots: Array<DfspRoot> = []
    const uniqueRootIds: Record<string, true> = {}

    const dfspCurrencies: Array<DfspCurrency> = []
    const uniqueDfspCurrencyIds: Record<string, true> = {}

    const rows: Array<DfspRoot & DfspCurrency> = []
    result.forEach(row => {
      const dfspRoot = MetaStore.hydrateDfspRoot(row)
      const dfspCurrency: DfspCurrency = MetaStore.hydrateDfspCurrency(row)

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
    const row = await this.db('metaDfspCurrency').where({ dfspId, currency }).select('*').first()
    if (!row) {
      return {
        type: 'NOT_FOUND',
        error: new Error(`getDfspCurrency no meta found for id:${dfspId} + currency: ${currency}.`)
      };
    }

    return {
      type: 'SUCCESS',
      result: MetaStore.hydrateDfspCurrency(row)
    };
  }

  public async getDfspCurrencies(id: string): Promise<Array<DfspCurrency>> {
    const rows = await this.db('metaDfspCurrency').where({ dfspId: id }).select('*')
    return rows.map(MetaStore.hydrateDfspCurrency)
  }

  public async getDfspCurrenciesAll(dfsps: Array<string>): Promise<Array<DfspCurrency>> {
    const rows = await this.db('metaDfspCurrency').whereIn('dfspId', dfsps).select('*')
    return rows.map(MetaStore.hydrateDfspCurrency)
  }

  /**
   * Look up the account within the DfspCurrency for the dfspid and account id.
   */
  public async lookupDfspCurrencyByAccountId(dfspId: string, accountId: bigint):
    Promise<{ code: AccountCode; currency: DfspCurrency; }> {

    const accountIdStr = accountId.toString()
    const row = await this.db('metaDfspCurrency')
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

    const currency = MetaStore.hydrateDfspCurrency(row)

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

  public async lookupDfspCurrencyByAccountId2(accountId: bigint):
    Promise<{ code: AccountCode; currency: DfspCurrency; }> {

    const accountIdStr = accountId.toString()
    const row = await this.db('metaDfspCurrency')
      .where(function () {
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
      throw new Error(`lookupDfspCurrencyByAccountId() not found for accountId: ${accountId}.`)
    }

    const currency = MetaStore.hydrateDfspCurrency(row)

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

    const rows = await this.db('metaDfspCurrency')
      .whereIn('netDebitCap', ids.map(id => id.toString()))
      .select('*')

    const dfspCurrencies = rows.map(MetaStore.hydrateDfspCurrency)
    const resultMap: Record<string, DfspCurrency> = {}
    dfspCurrencies.forEach(currency => {
      resultMap[currency.netDebitCap.toString()] = currency
    })

    return resultMap
  }

  public async createDfspCurrency(dfspId: string, currency: string, now: Date, ids: Array<number>):
    Promise<DfspCurrency> {
    let trx: Knex.Transaction | undefined
    assert(ids.length >= 13)
    try {
      trx = await this.db.transaction()

      const row = await trx('metaDfspCurrency').where({ dfspId, currency }).select('*').first()
      if (row) {
        await trx.commit()
        return MetaStore.hydrateDfspCurrency(row)
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
        return: BigInt(ids[13]),
        changedDate: now,
        changedDatePosition: now,
        changedDateSettlement: now,
        createdDate: now,
      };
      await trx('metaDfspCurrency').insert(dfspCurrency)

      await trx.commit()
      return dfspCurrency
    } catch (err) {
      if (trx) {
        await trx.rollback()
      }

      throw err
    }
  }

  public async savePrepareMetas(prepares: Array<PrepareMeta>): Promise<void> {
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

      await this.db.from('metaPrepare')
        .insert(records)
        .onConflict('id')
        .ignore()

    } catch (err: any) {
      logger.error(`savePrepareMetas() - failed with error: ${err.message}`)
      throw err
    }
  }

  public async saveFulfilMetas(fulfils: Array<FulfilMeta>): Promise<void> {
    if (fulfils.length === 0) return

    try {
      const records = fulfils.map(fulfil => {
        const record: any = {
          id: fulfil.id,
          payloadHash: fulfil.payloadHash
        }

        return record
      })

      await this.db.from('metaFulfil')
        .insert(records)
        .onConflict('id')
        .ignore()

    } catch (err: any) {
      logger.error(`saveFulfilMetas() - failed with error: ${err.message}`)
      throw err
    }
  }

  public async attachPrepareMetaAbortedAt(ids: Array<string>, dates: Array<Date>): Promise<void> {
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
      ['metaPrepare', ...bindings, ...ids]
    )
  }

  public async savePaymentMetas(metas: Array<PaymentMeta>): Promise<Array<SavePaymentMetaResult>> {
    if (metas.length === 0) return []

    try {
      const records = metas.map(meta => {
        const record = {
          id: meta.id,
          currency: meta.currency,
          amount: meta.amount,
          expiration: meta.expiration,
          payerId: meta.payerId,
          payeeId: meta.payeeId,
          payerLocation: MetaStore.dehydrateLocation(meta.payerLocation),
          payeeLocation: MetaStore.dehydrateLocation(meta.payeeLocation),
          ilpCondition: meta.ilpCondition,
          ilpPacket: meta.ilpPacket,
        }

        return record
      })

      await this.db.from('metaPayment')
        .insert(records)
        .onConflict('id')
        .ignore()

      return metas.map(meta => {
        return {
          type: 'SUCCESS',
          id: meta.id
        }
      })
    } catch (err: any) {
      logger.error(`savePaymentMetas() - failed with error: ${err.message}`)
      return metas.map(meta => {
        return {
          type: 'FAILURE',
          id: meta.id
        }
      })
    }
  }

  public async getPaymentMetas(transferIds: Array<string>): Promise<Array<GetPaymentMetaResult>> {
    try {
      const resultMap: Record<string, GetPaymentMetaResult> = {}
      // Populate with not founds.
      transferIds.forEach(id => resultMap[id] = {
        type: 'NOT_FOUND' as 'NOT_FOUND',
        id,
      })

      const rows = await this.db.from('metaPayment')
        .leftJoin('metaFulfil', 'metaFulfil.id', 'metaPayment.id')
        .whereIn('id', transferIds)
        .select('*')

      rows.forEach(row => {
        resultMap[row.id] = {
          type: 'SUCCESS' as 'SUCCESS',
          id: row.id,
          paymentMeta: MetaStore.hydratePaymentMeta(row),
          fulfilMeta: MetaStore.hydrateFulfilMeta(row),
        }
      })

      assert.equal(transferIds.length, Object.values(resultMap).length, 'Dropped a value.')
      return Object.values(resultMap)
    } catch (err: any) {
      logger.error(`getPaymentMetas() failed with error: ${err.message}`)
      throw err
    }
  }

  public async attachFulfilments(updates: Array<FulfilMetaUpdate>):
    Promise<Array<SavePaymentMetaResult>> {
    try {
      if (updates.length === 0) {
        return []
      }

      // Bulk insert.
      const ids: Array<string> = []
      const bindings: Array<any> = []

      const clauses = updates.map(update => {
        ids.push(update.id)
        bindings.push(update.id, update.fulfilment, update.id, update.fulfiledAt)

        return {
          fulfilment: `WHEN id = '${update.id}' THEN '${update.fulfilment}'`,
          fulfiledAt: `WHEN id = '${update.id}' THEN '${MetaStore.dehydrateDate(update.fulfiledAt)}'`,
        }
      })
      const fulfilmentClauses = clauses.map(c => c.fulfilment).join(' ')
      const fulfiledAtClauses = clauses.map(c => c.fulfiledAt).join(' ')

      await this.db.raw(
        `UPDATE ?? SET fulfilment = CASE ${fulfilmentClauses} END,` +
        `fulfiledAt = CASE ${fulfiledAtClauses} END` +
        ` WHERE id in (${ids.map(id => `'${id}'`).join(',')})`,
        ['metaFulfil']
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

  public async attachFulfilAborts(ids: Array<string>, dates: Array<Date>): Promise<void> {
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
      ` WHERE id in (${ids.map(() => '?').join(',')}) AND abortedAt IS NULL AND fulfiledAt IS NULL`,
      ['metaFulfil', ...bindings, ...ids]
    )
  }

  public async updateChangedDateSettlement(
    dfspId: string, currency: string, now: Date
  ): Promise<void> {
    await this.db('metaDfspCurrency')
      .where({ dfspId, currency })
      .update({
        changedDateSettlement: now,
      })
  }

  public async closeSettlementWindow(cmd: SettlementCloseWindowCommand): Promise<void> {
    assert(cmd.id)
    assert(cmd.now)
    assert(cmd.reason)
    const { id, now, reason } = cmd

    let trx: Knex.Transaction | undefined
    try {
      trx = await this.db.transaction()

      // Make sure a settlementWindow already exists, or create it.
      const windowFirst = await trx('metaSettlementWindow')
        .where('id', 1)
        .first()

      if (!windowFirst) {
        logger.debug('Creating initial settlement window (id=1).')
        await trx('metaSettlementWindow').insert({
          openDate: new Date(0),
          reason: 'Initial settlement window'
        })
      }

      // Get the current open window.
      const windowRow = await trx('metaSettlementWindow')
        .where('state', 'OPEN')
        .first()

      if (!windowRow) {
        throw new Error('No open settlement window found.')
      }

      if (windowRow.id !== id) {
        throw new Error(`Cannot close window ${id}. Current open window is ${windowRow.id}.`)
      }

      // Close the current window.
      await trx('metaSettlementWindow').update({
        reason,
        closeDate: now,
        state: 'CLOSED'
      }).where({ id })

      // Open a new window atomically, one ms after the last closedDate.
      const openDate = (new Date(now.getTime() + 1))
      await trx('metaSettlementWindow').insert({
        openDate,
        state: 'OPEN'
      })

      await trx.commit()
    } catch (err) {
      if (trx) {
        await trx.rollback()
      }

      throw err
    }
  }

  public async querySettlementWindows(query: GetSettlementWindowsQuery):
    Promise<Array<SettlementWindowMeta>> {

    const wheres: Array<string> = []
    const whereRawBindings = []
    // Ignore currency and participantId, they have no meaning in LedgerTigerBeetle.
    if (query.fromDateTime) {
      wheres.push(`metaSettlementWindow.openDate >= ?`)
      whereRawBindings.push(MetaStore.dehydrateDate(query.fromDateTime))
    }

    if (query.toDateTime) {
      wheres.push(`metaSettlementWindow.openDate <= ?`)
      whereRawBindings.push(MetaStore.dehydrateDate(query.toDateTime))
    }

    if (query.state) {
      assertOneOf(query.state, [
        SettlementWindowMetaState.OPEN,
        SettlementWindowMetaState.CLOSED,
      ])
      if (query.state === 'OPEN') {
        wheres.push(`metaSettlementWindow.state is ?`)
        whereRawBindings.push(null)
      } else {
        wheres.push(`metaSettlementWindow.state = ?`)
        whereRawBindings.push(query.state)
      }
    }

    const whereRaw = wheres.join(' AND ')
    const rows = await this.db('metaSettlementWindow')
      .leftJoin(
        'metaSettlementWindow_Settlement',
        'metaSettlementWindow.id',
        'metaSettlementWindow_Settlement.windowId'
      )
      .orderBy('metaSettlementWindow.id', 'desc')
      .whereRaw(whereRaw, whereRawBindings)
      .select(
        'metaSettlementWindow.*',
        'metaSettlementWindow_Settlement.settlementId as settlementId'
      )

    return rows.map(MetaStore.hydrateSettlementWindow)
  }
  
  public async getSettlementWindow(id: number): Promise<QueryResultWithNotFound<SettlementWindowMeta>> {
    try {
      const row = await this.db('metaSettlementWindow')
        .leftJoin(
          'metaSettlementWindow_Settlement',
          'metaSettlementWindow.id',
          'metaSettlementWindow_Settlement.windowId'
        )
        .orderBy('metaSettlementWindow.id', 'desc')
        .select(
          'metaSettlementWindow.*',
          'metaSettlementWindow_Settlement.settlementId as settlementId'
        )
        .where('metaSettlementWindow.id', id)
        .first()

      if (!row) {
        return {
          type: 'NOT_FOUND',
          error: new Error(`No settlement window found for id: ${id}.`)
        }
      }

      const window = MetaStore.hydrateSettlementWindow(row)
      return {
        type: 'SUCCESS',
        result: window
      }
    } catch (error: any) {
      return Helper.failure(error)
    }
  }

  public async lookupSettlementWindows(ids: Array<number>): Promise<Array<SettlementWindowMeta>> {
    const rows = await this.db('metaSettlementWindow')
      .orderBy('metaSettlementWindow.id', 'desc')
      .select('metaSettlementWindow.*')
      .whereIn('metaSettlementWindow.id', ids)

    if (rows.length < ids.length) {
      const missing = ids.filter(id => !rows.find(row => row.id === id))
      throw new Error(`lookupSettlementWindows missing the ids: [${missing.join(',')}].`)
    }

    return rows.map(MetaStore.hydrateSettlementWindow)
  }


  /**
   * @method querySettlements
   * @description Lookup the settlement ids given the settlement query.
   * 
   * The following query parameters are not supported here, and will be ignored.
   * 1. participantId - There is no participantId in LedgerTigerBeetle.
   * 2. accountId     - The 'accountId' for each settlement is now a bigint.
   * 3. state         - State is now derived from TigerBeetle transfers.
   */
  public async querySettlements(query: QuerySettlementsQuery): Promise<Array<number>> {
    const wheres: Array<string> = []
    const whereRawBindings: Array<string> = []

    if (query.currency) {
      wheres.push(`settlementModel.currencyId = ?`)
      whereRawBindings.push(query.currency)
    }
    
    if (query.settlementWindowId) {
      wheres.push(`metaSettlementWindow.id = ?`)
      whereRawBindings.push(query.settlementWindowId.toString())
    }

    if (query.fromDateTime) {
      wheres.push(`metaSettlement.createdDate >= ?`)
      whereRawBindings.push(MetaStore.dehydrateDate(query.fromDateTime))
    }

    if (query.toDateTime) {
      wheres.push(`metaSettlement.createdDate <= ?`)
      whereRawBindings.push(MetaStore.dehydrateDate(query.toDateTime))
    }

    if (query.fromSettlementWindowDateTime) {
      wheres.push(`metaSettlementWindow.openDate >= ?`)
      whereRawBindings.push(MetaStore.dehydrateDate(query.fromSettlementWindowDateTime))
    }

    if (query.toSettlementWindowDateTime) {
      wheres.push(`metaSettlementWindow.closeDate >= ?`)
      whereRawBindings.push(MetaStore.dehydrateDate(query.toSettlementWindowDateTime))
    }

    const whereRaw = wheres.join(' AND ')
    const rows = await this.db('metaSettlement')
      .join(
        'metaSettlementWindow_Settlement',
        'metaSettlement.id',
        'metaSettlementWindow_Settlement.settlementId'
      )
      .join(
        'metaSettlementWindow',
        'metaSettlementWindow.id',
        'metaSettlementWindow_Settlement.windowId'
      )
      .join(
        'settlementModel',
        'settlementModel.settlementModelId',
        'metaSettlement.modelId'
      )
      .orderBy('metaSettlement.id')
      .distinct()
      .whereRaw(whereRaw, whereRawBindings)
      .select(
        'metaSettlement.id'
      )

    return rows.map(row => row.id)
  }

  public async lookupFulfiledPayments(from: Date, to: Date): Promise<Array<{
    paymentMeta: PaymentMeta,
    fulfilMeta: FulfilMeta
  }>> {
    const rows = await this.db('metaFulfil')
      .join('metaPayment', 'metaPayment.id', 'metaFulfil.id')
      .where('fulfiledAt', '>=', from)
      .andWhere('fulfiledAt', '<=', to)

    return rows.map(row => {
      return {
        paymentMeta: MetaStore.hydratePaymentMeta(row),
        fulfilMeta: MetaStore.hydrateFulfilMeta(row),
      }
    })
  }

  /**
   * Prepares a new settlement, and links the settlement windows in metaSettlementWindow_Settlement.
   */
  public async settlementPrepare(cmd: CmdSettlementPrepare2): 
    Promise<ResultSettlementPrepare> {
    assert(cmd.now)
    assert(cmd.reason)
    assert(cmd.model)
    assert(cmd.windows)
    assert(cmd.windows.length > 0)
    const { now, reason, model, windows } = cmd

    let trx: Knex.Transaction | undefined
    try {
      trx = await this.db.transaction()

      // Ensure the Settlement Model exists and was is valid.
      const rowModel = await trx('settlementModel')
        .join(
          'settlementGranularity',
          'settlementGranularity.settlementGranularityId',
          'settlementModel.settlementGranularityId'
        )
        .join(
          'settlementDelay',
          'settlementDelay.settlementDelayId',
          'settlementModel.settlementDelayId'
        )
        .select(
          'settlementModelId',
          'settlementModel.name',
          'settlementGranularity.name as settlementGranularityName',
          'settlementDelay.name as settlementDelayName',
        )
        .where('settlementModel.name', cmd.model)
        .first()
      if (!rowModel) {
        throw new Error(`No settlement model found: ${cmd.model}.`)
      }
      assert(rowModel.settlementModelId)
      assert(rowModel.settlementGranularityName === 'NET')
      assert(rowModel.settlementDelayName === 'DEFERRED')

      // Make sure the windows exist and are all closed.
      const rowsWindow = await this.db('metaSettlementWindow')
        .orderBy('metaSettlementWindow.id', 'desc')
        .select('metaSettlementWindow.*')
        .whereIn('metaSettlementWindow.id', cmd.windows)

      if (rowsWindow.length < cmd.windows.length) {
        const missing = cmd.windows.filter(id => !rowsWindow.find(row => row.id === id))
        throw new Error(`lookupSettlementWindows missing the ids: [${missing.join(',')}].`)
      }

      const windowMetas = rowsWindow.map(MetaStore.hydrateSettlementWindow)    
      windowMetas.forEach(window => assert(window.state === SettlementWindowMetaState.CLOSED))
      const ids = await trx('metaSettlement').insert({
        reason,
        createdDate: now,
        modelId: rowModel.settlementModelId
      })
      const settlementId = ids[0]
      assert(typeof settlementId === 'number')

      // Ensure these windows are not already associated to a settlement.
      const windowAssociationRows = await trx('metaSettlementWindow_Settlement')
        .whereIn('windowId', windows)
        .select('*')
      assert(
        windowAssociationRows.length === 0,
        `Found existing settlement association for windows: ${windows}`
      )

      // Associate the settlementWindows with the newly created settlement.
      const rows = windows.map(window => ({
        windowId: window,
        settlementId: ids[0],
        createdDate: now,
      }))
      await trx('metaSettlementWindow_Settlement').insert(rows)
      await trx.commit()
    
      return {
        settlementId,
        windowMetas: windowMetas as Array<SettlementWindowMetaClosed>
      }
    } catch (err) {
      if (trx) {
        await trx.rollback()
      }

      throw err
    }
  }

  public async createSettlementLegMetas(
    legs: Array<SettlementLegMetaCreate>
  ): Promise<Array<SettlementLegMeta>> {
    if (legs.length === 0) return []

    const records = legs.map(leg => ({
      ...leg,
      // MySQL can't handle 128 bit NodeJS BigInts.
      staging: leg.staging.toString(),
      debitPendingId: leg.debitPendingId.toString(),
      creditPendingId: leg.creditPendingId.toString(),
    }))

    let trx: Knex.Transaction | undefined
    try {
      trx = await this.db.transaction()

      const [firstId] = await trx('metaSettlementLeg').insert(records)

      // MySQL returns the first auto-increment ID; subsequent IDs are sequential
      const ids = records.map((_, idx) => firstId + idx)

      const rows = await trx('metaSettlementLeg')
        .whereIn('id', ids)
        .select('*')

      await trx.commit()

      return rows.map(MetaStore.hydrateSettlementLegMeta)
    } catch (err) {
      if (trx) {
        await trx.rollback()
      }
      throw err
    }
  }

  public async getSettlementContext(ids: Array<number>):
    Promise<Array<SettlementContext>> {
    const trx = await this.db.transaction()

    try {
      const rowsSettlementAndLegs = await trx('metaSettlement')
        .leftJoin('metaSettlementLeg', 'metaSettlement.id', 'metaSettlementLeg.settlementId')
        .join('settlementModel', 'settlementModel.settlementModelId', 'metaSettlement.modelId')
        .select(
          'metaSettlement.id as metaSettlement_id',
          'metaSettlement.reason as metaSettlement_reason',
          'metaSettlement.createdDate as metaSettlement_createdDate',
          'settlementModel.name as metaSettlement_model',
          'metaSettlementLeg.id as metaSettlementLeg_id',
          'metaSettlementLeg.windowId as metaSettlementLeg_windowId',
          'metaSettlementLeg.dfspId as metaSettlementLeg_dfspId',
          'metaSettlementLeg.currency as metaSettlementLeg_currency',
          'metaSettlementLeg.staging as metaSettlementLeg_staging',
          'metaSettlementLeg.debitPendingId as metaSettlementLeg_debitPendingId',
          'metaSettlementLeg.creditPendingId as metaSettlementLeg_creditPendingId',
        )
        .whereIn('metaSettlement.id', ids)

      if (rowsSettlementAndLegs.length === 0) {
        return []
      }

      const rowsSettlementAndWindows = await trx('metaSettlement')
        .leftJoin('metaSettlementWindow_Settlement', 'metaSettlement.id', 'metaSettlementWindow_Settlement.settlementId')
        .leftJoin('metaSettlementWindow', 'metaSettlementWindow.id', 'metaSettlementWindow_Settlement.windowId')
        .select('*')
        .whereIn('metaSettlement.id', ids)

      // Left join, any row will have the metaSettlement.
      const settlementMetas = rowsSettlementAndLegs.map(row => {
        return MetaStore.hydrateSettlementMeta({
          id: row.metaSettlement_id,
          reason: row.metaSettlement_reason,
          createdDate: row.metaSettlement_createdDate,
          state: row.metaSettlement_state,
          model: row.metaSettlement_model,
        })
      })
      const settlementMetaMap = Helper.toMapBy(settlementMetas, item => item.id.toString())

      const legs = rowsSettlementAndLegs
        .filter(row => row.metaSettlementLeg_id !== null)
      .map(row => {
        const remapped = {
          id: row.metaSettlementLeg_id,
          settlementId: row.metaSettlement_id,
          windowId: row.metaSettlementLeg_windowId,
          dfspId: row.metaSettlementLeg_dfspId,
          currency: row.metaSettlementLeg_currency,
          staging: row.metaSettlementLeg_staging,
          debitPendingId: row.metaSettlementLeg_debitPendingId,
          creditPendingId: row.metaSettlementLeg_creditPendingId,
        }
        return MetaStore.hydrateSettlementLegMeta(remapped)
      })
      const windows = rowsSettlementAndWindows.map(MetaStore.hydrateSettlementWindow)

      const currencies = [...new Set(legs.map(leg => leg.currency))].sort()
      const rowsCurrencyConfig = await trx('metaCurrencyConfig')
        .select('*')
        .whereIn('currency', currencies)
      const currencyConfigList = rowsCurrencyConfig.map(MetaStore.hydrateCurrencyConfig)
      const currencyConfigs = Helper.toMapBy(currencyConfigList, (item) => item.currency)

      const dfspIds = [... new Set(legs.map(leg => leg.dfspId))].sort()
      const dfspCurrencies = Helper.toMapByDfspAndCurrency(await this.getDfspCurrenciesAll(dfspIds))

      return Object.values(settlementMetaMap).map(meta => {
        const context: SettlementContext = {
          meta,
          legs: legs.filter(leg => leg.settlementId === meta.id),
          windows: windows.filter(window =>
            window.state === SettlementWindowMetaState.CLOSED &&
            window.settlementId === meta.id
          ),
          currencyConfigs,
          dfspCurrencies,
        }
        return context
      })
    } finally {
      if (!trx.isCompleted()) {
        await trx.rollback()
      }
    }
  }

  public async unlinkWindowFromSettlement(settlementId: number): Promise<void> {
    assert(settlementId)
  
    let trx: Knex.Transaction | undefined
    try {
      trx = await this.db.transaction()

      // Ensure there are actually windows associated with the settlement.
      const windowAssociationRows = await trx('metaSettlementWindow_Settlement')
        .where('settlementId', settlementId)
        .select('*')
      assert(
        windowAssociationRows.length > 0,
        `Found no existing windows for settlementId: ${settlementId}`
      )
      
      await trx.commit()

      return
    } catch (err) {
      if (trx) {
        await trx.rollback()
      }

      throw err
    }
  }

  /**
   * Hydrators.
   */
  private static hydrateSettlementMeta(row: any): SettlementMeta {
    assert(row.id)
    assert(row.reason)
    assert(row.createdDate)
    assert(row.model)

    return {
      id: row.id,
      reason: row.reason,
      createdDate: row.createdDate,
      model: row.model,
    }
  }

  private static hydrateSettlementLegMeta(row: any): SettlementLegMeta {
    assert(row.id)
    assert(row.settlementId)
    assert(row.windowId)
    assert(row.dfspId)
    assert(row.currency)
    assert(row.staging)
    assert(row.debitPendingId)
    assert(row.creditPendingId)

    return {
      id: row.id,
      settlementId: row.settlementId,
      windowId: row.windowId,
      dfspId: row.dfspId,
      currency: row.currency,
      staging: BigInt(row.staging),
      debitPendingId: BigInt(row.debitPendingId),
      creditPendingId: BigInt(row.creditPendingId),
    }
  }

  private static hydrateSettlementWindow(row: any): SettlementWindowMeta {
    assert(row.id)
    assert(row.openDate)
    assert(row.state)

    const state = MetaStore.hydrateSettlementWindowState(row.state)
    switch (state) {
      case SettlementWindowMetaState.OPEN: {
        const window: SettlementWindowMetaOpen = {
          id: row.id,
          openDate: row.openDate,
          state
        }
        return window
      }
      case SettlementWindowMetaState.CLOSED:
        assert(row.reason)
        assert(row.closeDate)
        let settlementId = undefined
        if (row.settlementId) {
          settlementId = row.settlementId
        }
        const window: SettlementWindowMetaClosed = {
          id: row.id,
          openDate: row.openDate,
          closeDate: row.closeDate,
          state,
          reason: row.reason,
          settlementId
        }
        return window
      default: {
        throw new Error(`unhandled settlement window state: ${state}`)
      }
    }
  }

  private static hydrateSettlementWindowState(str: any): SettlementWindowMetaState {
    assert(typeof str === 'string')

    switch (str) {
      case 'OPEN': return SettlementWindowMetaState.OPEN
      case 'CLOSED': return SettlementWindowMetaState.CLOSED
      default:
        throw new Error(`Unhandled settlementWindowState: ${str}.`)
    }
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
      id: BigInt(row.id),
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
      return: BigInt(row.return),
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

  private static hydratePrepareMeta(row: any): PrepareMeta {
    const meta: PrepareMeta = {
      id: row.id,
      payloadHash: row.payloadHash
    }
    if (row.abortedAt) {
      meta.abortedAt = new Date(row.abortedAt)
    }

    return meta
  }

  private static hydrateFulfilMeta(row: any): FulfilMeta {
    const meta: FulfilMeta = {
      id: row.id,
      payloadHash: row.payloadHash
    }

    if (row.abortedAt) meta.abortedAt = new Date(row.abortedAt)
    if (row.fulfiledAt) meta.fulfiledAt = new Date(row.fulfiledAt)
    if (row.fulfilment) meta.fulfilment = row.fulfilment

    assert(
      !(meta.fulfiledAt && meta.abortedAt),
      'FulfilMeta must have either fulfiledAt or abortedAt, not both.'
    )
    if (meta.fulfiledAt) {
      assert(meta.fulfilment, 'meta.fulfilment is required if the Payment is fulfiled.')
    }

    return meta
  }

  private static hydratePaymentMeta(row: any): PaymentMeta {
    const meta: PaymentMeta = {
      id: row.id,
      currency: row.currency,
      amount: row.amount,
      expiration: row.expiration,
      payerId: row.payerId,
      payeeId: row.payeeId,
      payerLocation: MetaStore.hydrateLocation(row.payerLocation),
      payeeLocation: MetaStore.hydrateLocation(row.payeeLocation),
      ilpCondition: row.ilpCondition,
      ilpPacket: row.ilpPacket,
    }

    return meta
  }

  private static hydrateLocation(location: any): ParticipantLocation {
    switch (location) {
      case 'local': return 'LOCAL'
      case 'proxy': return 'PROXY'
      default: {
        throw new Error(`hydrateLocation - invalid location: ${location}`)
      }
    }
  }

  /**
   * Dehydrators.
   */
  private static dehydrateLocation(location: ParticipantLocation): string {
    assertOneOf(location, ['LOCAL', 'PROXY'])

    switch (location) {
      case 'LOCAL': return 'local'
      case 'PROXY': return 'proxy'
    }
  }

  private static dehydrateDate(date: Date): string {
    return date.toISOString().replace('T', ' ').replace('Z', '')
  }
}
