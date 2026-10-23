import assert from "node:assert"
import { ApplicationConfig } from "../../../lib/config"
import { Ledger, LegacyLedgerAccount } from "./types"

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
}

interface DfspBalance {
  id: string,
  currency: string,
  dfspAccountsLegacy: {
    balancePosition: number
    balanceSettlement: number,
  },
  dfspAccounts: {

  }
}

interface CurrencyBalance {
  currency: string,
  dfsps: Record<string, DfspBalance>
}

class BalanceSheet {
  private generatedAt: Date
  private dfspAccounts: Record<string, Array<LegacyLedgerAccount>>
  private currencies: Array<string>
  private dfspIds: Array<string>
  private currencyBalances: Array<CurrencyBalance>

  constructor(private options: OptionsBalanceSheet) {
    assert(options.generatedAt)
    assert(options.dfspAccounts)

    this.generatedAt = options.generatedAt
    this.dfspAccounts = options.dfspAccounts
    this.currencies = [...new Set(
      Object.values(this.dfspAccounts).flat().map(acc => acc.currency)
    )].sort()

    this.currencyBalances = []
    this.dfspIds = Object.keys(this.dfspAccounts).sort()
    for (const currency of this.currencies) {
      const dfspBalances: Record<string, DfspBalance> = {}
      for (const dfspId of this.dfspIds) {
        const accounts = this.dfspAccounts[dfspId].filter(acc => acc.currency === currency)
        const position = accounts.find(acc => acc.ledgerAccountType === 'POSITION')
        const settlement = accounts.find(acc => acc.ledgerAccountType === 'SETTLEMENT')
        
        // This is fine, not every dfsp will have an account for every currency.
        if (!position) continue
        if (!settlement) continue

        // TODO: also handle TigerBeetle extended balances!
        const dfspBalance: DfspBalance = {
          id: dfspId,
          currency,
          dfspAccountsLegacy: {
            balancePosition: position.value,
            balanceSettlement: settlement.value,
          },
          dfspAccounts: {}
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
    const width = COL_DFSP + 3 + COL_VAL + 3 + COL_VAL + 1
    builder += `┌${'─'.repeat(width - 1)}┐\n`
    builder += `│ ${currency.padEnd(width - 4)}  │\n`
    builder += `├${'─'.repeat(COL_DFSP)}┬${'─'.repeat(COL_VAL + 2)}┬${'─'.repeat(COL_VAL + 2)}┤\n`
    builder += `│${' DFSP'.padEnd(COL_DFSP)}│${'Position'.padStart(COL_VAL)}  │${'Settlement'.padStart(COL_VAL)}  │\n`
    builder += `├${'─'.repeat(COL_DFSP)}┼${'─'.repeat(COL_VAL + 2)}┼${'─'.repeat(COL_VAL + 2)}┤\n`

    for (const dfspId of this.dfspIds) {
      const dfspBalance = dfspBalances.dfsps[dfspId]
      if (!dfspBalance) {
        // Print empty columns.
        builder += `│ ${dfspId.padEnd(COL_DFSP - 1)}│${'-'.padStart(COL_VAL)}  │${'-'.padStart(COL_VAL)}  │\n`
        continue
      }
      const valuePosition = dfspBalance.dfspAccountsLegacy.balancePosition.toString().padStart(COL_VAL)
      const valueSettlement = dfspBalance.dfspAccountsLegacy.balanceSettlement.toString().padStart(COL_VAL)
      builder += `│ ${dfspId.padEnd(COL_DFSP - 1)}│${valuePosition}  │${valueSettlement}  │\n`
    }

    builder += `└${'─'.repeat(COL_DFSP)}┴${'─'.repeat(COL_VAL + 2)}┴${'─'.repeat(COL_VAL + 2)}┘\n`

    return builder
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

    assert(dfspsResult.type === 'SUCCESS')
    const dfsps = dfspsResult.result.dfsps
    for (const dfsp of dfsps) {
      const accountsResponse = await this.ledger.getAllDfspAccounts({ dfspId: dfsp.name })
      assert(accountsResponse.type === 'SUCCESS')
      dfspAccounts[dfsp.name] = accountsResponse.accounts
    }

    // Get all of the dfsp accounts, across all currencies.
    const balanceSheet = new BalanceSheet({
      generatedAt: now,
      dfspAccounts,
    })

    return balanceSheet
  }
}
