import assert from "node:assert"
import { ApplicationConfig } from "../../../lib/config"
import { AccountCode, Ledger, LedgerAccount, LegacyLedgerAccount, LegacyLimitItem } from "./types"
import { CurrencyConfig, NetDebitCap } from "../tigerbeetle/meta-store"
import { LedgerTigerBeetle } from "../tigerbeetle/ledger-tigerbeetle"

interface DepsReporter {
  ledger: Ledger
  config: ApplicationConfig
}


/**
 * BalanceSheet is a snapshot of the Ledger's balance at a point in time.
 */

interface OptionsBalanceSheet {
  generatedAt: Date,
  dfspAccounts: Record<string, Array<LegacyLedgerAccount>>
  netDebitCaps: Record<string, Array<LegacyLimitItem>>
  dfspAccountsExtended?: Record<string, Array<LedgerAccount>>
  currencyConfigs?: Array<CurrencyConfig>
}

interface Balance {
  // Gross amounts, directly from TigerBeetle.
  creditsPending: bigint
  creditsPosted: bigint
  debitsPending: bigint
  debitsPosted: bigint

  // Net amounts for convenience.
  creditsPendingNet: number
  creditsPostedNet: number
  debitsPendingNet: number
  debitsPostedNet: number

  accountCode: AccountCode
}

interface DfspBalance {
  id: string,
  currency: string,
  /**
   * Summary account balances tracked by both LedgerSQL and LedgerTigerBeetle.
   */
  dfspAccountsLegacy: {
    balancePosition: number
    balanceSettlement: number,
  },
  /**
   * Detailed account balances tracked by LedgerTigerBeetle.
   */
  dfspAccountsDetailed?: {
    deposit: Balance,
    unrestricted: Balance,
    unrestrictedLock: Balance,
    restricted: Balance,
    reserved: Balance,
    commitedOutgoing: Balance,
    clearingCredit: Balance,
    clearingSetup: Balance,
    clearingLimit: Balance,
  },
  netDebitCap?: LegacyLimitItem
}

interface CurrencyBalance {
  currency: string,
  dfsps: Record<string, DfspBalance>
}

type DfspAccountsDetailed = NonNullable<DfspBalance['dfspAccountsDetailed']>

class BalanceSheet {
  private generatedAt: Date
  private dfspAccounts: Record<string, Array<LegacyLedgerAccount>>
  private netDebitCaps: Record<string, Array<LegacyLimitItem>>
  private dfspAccountsExtended: Record<string, Array<LedgerAccount>>
  private currencyConfigs: Array<CurrencyConfig>
  private currencies: Array<string>
  private dfspIds: Array<string>
  private currencyBalances: Array<CurrencyBalance>

  constructor(private options: OptionsBalanceSheet) {
    assert(options.generatedAt)
    assert(options.dfspAccounts)
    assert(options.netDebitCaps)
    assert.equal(Object.keys(options.dfspAccounts).length, Object.keys(options.netDebitCaps).length)

    this.generatedAt = options.generatedAt
    this.dfspAccounts = options.dfspAccounts
    this.netDebitCaps = options.netDebitCaps
    this.currencies = [...new Set(
      Object.values(this.dfspAccounts).flat().map(acc => acc.currency)
    )].sort()

    if (options.dfspAccountsExtended) {
      assert.equal(
        Object.keys(options.dfspAccounts).length,
        Object.keys(options.dfspAccountsExtended).length
      )
      this.dfspAccountsExtended = options.dfspAccountsExtended
    } else {
      this.dfspAccountsExtended = {}
    }

    if (options.currencyConfigs && this.currencies.length > 0) {
      assert(options.currencyConfigs)
      assert(options.currencyConfigs.length >= this.currencies.length)
      this.currencyConfigs = options.currencyConfigs
    } else {
      this.currencyConfigs = []
    }

    this.currencyBalances = []
    this.dfspIds = Object.keys(this.dfspAccounts).sort()
    for (const currency of this.currencies) {
      const dfspBalances: Record<string, DfspBalance> = {}
      for (const dfspId of this.dfspIds) {
        const accounts = this.dfspAccounts[dfspId].filter(acc => acc.currency === currency)
        const position = accounts.find(acc => acc.ledgerAccountType === 'POSITION')
        const settlement = accounts.find(acc => acc.ledgerAccountType === 'SETTLEMENT')

        const netDebitCap = this.netDebitCaps[dfspId].find(acc => acc.currency === currency)
        
        // This is fine, not every dfsp will have an account for every currency.
        if (!position) continue
        if (!settlement) continue

        let dfspAccountsDetailed: DfspBalance['dfspAccountsDetailed']
        if (this.dfspAccountsExtended[dfspId]) {
          dfspAccountsDetailed = BalanceSheet.mapToDetailedAccounts(
            this.dfspAccountsExtended[dfspId],
            currency
          )
        }

        const dfspBalance: DfspBalance = {
          id: dfspId,
          currency,
          dfspAccountsLegacy: {
            balancePosition: position.value,
            balanceSettlement: settlement.value,
          },
          dfspAccountsDetailed,
          netDebitCap
        }
        dfspBalances[dfspId] = dfspBalance
      }

      const currencyBalance: CurrencyBalance = {
        currency,
        dfsps: dfspBalances
      }
      this.currencyBalances.push(currencyBalance)
    }
  }

  public toStringAll(): string {
    const eachReport = this.currencies.map(currency => this.toStringCurrency(currency))
    return eachReport.join('\n')
  }

  public toStringCurrency(currency: string): string {
    const dfspBalances = this.currencyBalances.find(balance => balance.currency === currency)
    if (!dfspBalances) {
      throw new Error(`toStringCurrency() - no dfspBalances found for currency: ${currency}.`)
    }

    const COL_DFSP = 12
    const COL_VAL = 12
    let builder = ''
    const width = COL_DFSP + 3 + COL_VAL + 3 + COL_VAL + 3 + COL_VAL + 1
    builder += `┌${'─'.repeat(width - 1)}┐\n`
    builder += `│ ${currency.padEnd(width - 4)}  │\n`
    builder += `├${'─'.repeat(COL_DFSP)}┬${'─'.repeat(COL_VAL + 2)}┬${'─'.repeat(COL_VAL + 2)}┬${'─'.repeat(COL_VAL + 2)}┤\n`
    builder += `│${' DFSP'.padEnd(COL_DFSP)}│${'NDC'.padStart(COL_VAL)}  │${'Position'.padStart(COL_VAL)}  │${'Settlement'.padStart(COL_VAL)}  │\n`
    builder += `├${'─'.repeat(COL_DFSP)}┼${'─'.repeat(COL_VAL + 2)}┼${'─'.repeat(COL_VAL + 2)}┼${'─'.repeat(COL_VAL + 2)}┤\n`

    for (const dfspId of this.dfspIds) {
      const dfspBalance = dfspBalances.dfsps[dfspId]
      if (!dfspBalance) {
        // Print empty columns.
        builder += `│ ${dfspId.padEnd(COL_DFSP - 1)}│${'-'.padStart(COL_VAL)}  │${'-'.padStart(COL_VAL)}  │${'-'.padStart(COL_VAL)}  │\n`
        continue
      }
      const netDebitCap = dfspBalance.netDebitCap ? dfspBalance.netDebitCap.limit.value.toString() : 'none'
      const valueNetDebitCap = netDebitCap.padStart(COL_VAL)
      const valuePosition = dfspBalance.dfspAccountsLegacy.balancePosition.toString().padStart(COL_VAL)
      const valueSettlement = dfspBalance.dfspAccountsLegacy.balanceSettlement.toString().padStart(COL_VAL)
      builder += `│ ${dfspId.padEnd(COL_DFSP - 1)}|${valueNetDebitCap}  │${valuePosition}  │${valueSettlement}  │\n`
    }
    builder += `└${'─'.repeat(COL_DFSP)}┴${'─'.repeat(COL_VAL + 2)}┴${'─'.repeat(COL_VAL + 2)}┴${'─'.repeat(COL_VAL + 2)}┘\n`

    return builder
  }

  public toTAccounts(dfsps: Array<string>, currencies: Array<string>): string {
    let builder = ''

    for (const currency of currencies) {
      const currencyBalance = this.currencyBalances.find(balance => balance.currency === currency)
      const currencyConfig = this.currencyConfigs.find(config => config.currency === currency)
      if (!currencyBalance) continue

      assert(currencyConfig)
      for (const dfsp of dfsps) {
        const dfspBalance = currencyBalance.dfsps[dfsp]
        if (!dfspBalance?.dfspAccountsDetailed) continue

        builder += this.formatDfspTAccounts(dfsp, currencyConfig, dfspBalance.dfspAccountsDetailed)
        builder += '\n'
      }
    }

    return builder
  }

  private formatDfspTAccounts(dfspId: string, currencyConfig: CurrencyConfig, detailed: DfspAccountsDetailed): string {
    const COL = 10
    const NAME_COL = 26
    let builder = ''
    const currency = currencyConfig.currency
    const assetScale = currencyConfig.assetScale
    const divisor = Math.pow(10, assetScale)

    builder += `${dfspId} (${currency})`.padEnd(NAME_COL) + 'DR'.padStart(COL) + '  ' + 'CR'.padStart(COL) + '\n'
    builder += '─'.repeat(NAME_COL + COL * 2 + 2) + '\n'

    // Note: I've commented out some of the transient-only accounts here, since they will always be
    // zero.
    const accounts: Array<{ name: string; balance: Balance }> = [
      { name: '    asset:Deposit', balance: detailed.deposit },
      { name: 'liability:Unrestricted', balance: detailed.unrestricted },
      // { name: 'liability:UnrestrictedLock', balance: detailed.unrestrictedLock },
      { name: 'liability:Restricted', balance: detailed.restricted },
      { name: 'liability:Reserved', balance: detailed.reserved },
      // { name: 'liability:CommitedOutgoing', balance: detailed.commitedOutgoing },
      // { name: 'liability:ClearingCredit', balance: detailed.clearingCredit },
      // { name: 'liability:ClearingSetup', balance: detailed.clearingSetup },
      // { name: 'liability:ClearingLimit', balance: detailed.clearingLimit },
    ]

    for (const { name, balance } of accounts) {
      const drNet = Number(balance.debitsPosted - balance.creditsPosted) / divisor
      const crNet = Number(balance.creditsPosted - balance.debitsPosted) / divisor
      const drPendingNet = Number(balance.debitsPending - balance.creditsPending) / divisor
      const crPendingNet = Number(balance.creditsPending - balance.debitsPending) / divisor

      const drStr = this.formatBalanceCell(drNet > 0 ? drNet : 0, drPendingNet > 0 ? drPendingNet : 0)
      const crStr = this.formatBalanceCell(crNet > 0 ? crNet : 0, crPendingNet > 0 ? crPendingNet : 0)

      builder += name.padEnd(NAME_COL) + drStr.padStart(COL) + '  ' + crStr.padStart(COL) + '\n'
    }

    return builder
  }

  private formatBalanceCell(posted: number, pending: number): string {
    if (posted === 0 && pending === 0) return ''

    const parts: string[] = []
    if (pending > 0) parts.push(`${pending.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}p`)
    if (posted > 0) parts.push(`${posted.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) }`)

    return parts.join(' ')
  }

  /**
   * Go from a list of LedgerAccounts -> Balance.
   */
  static mapToDetailedAccounts(
    accounts: Array<LedgerAccount>,
    currency: string
  ): DfspAccountsDetailed | undefined {
    const filtered = accounts.filter(acc => acc.currency === currency)
    if (filtered.length === 0) return undefined

    const toBalance = (acc: LedgerAccount): Balance => ({
      creditsPending: acc.creditsPending,
      creditsPosted: acc.creditsPosted,
      debitsPending: acc.debitsPending,
      debitsPosted: acc.debitsPosted,
      creditsPendingNet: Number(acc.creditsPending - acc.debitsPending),
      creditsPostedNet: Number(acc.creditsPosted - acc.debitsPosted),
      debitsPendingNet: Number(acc.debitsPending - acc.creditsPending),
      debitsPostedNet: Number(acc.debitsPosted - acc.creditsPosted),
      accountCode: acc.code,
    })

    const findAccount = (code: AccountCode): LedgerAccount => {
      const account = filtered.find(acc => acc.code === code)
      assert(account, `Account not found for code: ${code}.`)

      return account
    }

    const deposit = findAccount(AccountCode.Deposit)
    const unrestricted = findAccount(AccountCode.Unrestricted)
    const unrestrictedLock = findAccount(AccountCode.Unrestricted_Lock)
    const restricted = findAccount(AccountCode.Restricted)
    const reserved = findAccount(AccountCode.Reserved)
    const commitedOutgoing = findAccount(AccountCode.Committed_Outgoing)
    const clearingCredit = findAccount(AccountCode.Clearing_Credit)
    const clearingSetup = findAccount(AccountCode.Clearing_Setup)
    const clearingLimit = findAccount(AccountCode.Clearing_Limit)

    return {
      deposit: toBalance(deposit),
      unrestricted: toBalance(unrestricted),
      unrestrictedLock: toBalance(unrestrictedLock),
      restricted: toBalance(restricted),
      reserved: toBalance(reserved),
      commitedOutgoing: toBalance(commitedOutgoing),
      clearingCredit: toBalance(clearingCredit),
      clearingSetup: toBalance(clearingSetup),
      clearingLimit: toBalance(clearingLimit),
    }
  }
}

/**
 * Utility for generating reports by executing queries on the Ledger.
 */
export class Reporter {
  private readonly ledger: Ledger

  constructor(deps: DepsReporter) {
    assert(deps.ledger)
    assert(deps.config)

    this.ledger = deps.ledger
  }

  public async balanceSheet(now: Date): Promise<BalanceSheet> {
    // TODO: Optimize me!
    const dfspsResult = await this.ledger.getAllDfsps({})
    const dfspAccounts: Record<string, Array<LegacyLedgerAccount>> = {}
    
    // TODO: Optimize me!
    const netDebitCaps: Record<string, Array<LegacyLimitItem>> = {}

    assert(dfspsResult.type === 'SUCCESS')
    const dfsps = dfspsResult.result.dfsps
    for (const dfsp of dfsps) {
      const accountsResponse = await this.ledger.getAllDfspAccounts({ dfspId: dfsp.name })
      assert(accountsResponse.type === 'SUCCESS')
      dfspAccounts[dfsp.name] = accountsResponse.accounts

      // We may not always have a net debit cap.
      const netDebitCap = await this.ledger.getNetDebitCaps({dfspId: dfsp.name})
      if (netDebitCap.type !== 'SUCCESS') continue
      netDebitCaps[dfsp.name] = netDebitCap.result
    }

    // LedgerTigerBeetle supports detailed account balances.
    let dfspAccountsExtended: undefined | Record<string, Array<LedgerAccount>>
    let currencyConfigs: undefined | Array<CurrencyConfig>
    if (this.ledger instanceof LedgerTigerBeetle) {
      dfspAccountsExtended = await this.ledger.getAllDfspAccountsExtended()
      currencyConfigs = await this.ledger.getCurrencyConfigs()
    }

    // Get all of the dfsp accounts, across all currencies.
    const balanceSheet = new BalanceSheet({
      generatedAt: now,
      dfspAccounts,
      netDebitCaps,
      dfspAccountsExtended,
      currencyConfigs,
    })

    return balanceSheet
  }
}
