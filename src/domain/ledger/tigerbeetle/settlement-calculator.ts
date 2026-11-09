import assert from "node:assert";
import { ledgerAccountList } from "../../../seeds/ledgerAccountType";
import { Payment, PaymentFulfilled, TransferCode } from "../shared/types";
import { CurrencyConfig, SettlementLegMeta, SettlementWindowMeta, SettlementWindowMetaClosed } from "./meta-store";
import { id, Transfer } from "tigerbeetle-node";
import Helper from "./helper";

/**
 * Helper to set up TigerBeetle Accounts and Transfers for Settlements.
 */
export default class SettlementCalculator {

  constructor(
    private settlementId: number,
    private payments: Array<PaymentFulfilled>,
    private settlementLegMetas: Array<SettlementLegMeta>,
    private windowMetas: Array<SettlementWindowMetaClosed>,
    private currencyConfigs: Array<CurrencyConfig>
  ) { }

  public run(): Array<Transfer> {
    const windowIds = [...new Set(this.settlementLegMetas.map(legMeta => legMeta.windowId))].sort()
    const currencies = [...new Set(this.payments.map(payment => payment.currency))].sort()

    const makeKey = (payment: Payment) => `${payment.payer}:${payment.payee}`
    const transfers: Array<Transfer> = []
    windowIds.forEach(windowId => {
      const window = this.windowMetas.find(windowMeta => windowMeta.id === windowId)
      assert(window)

      currencies.forEach(currency => {
        const paymentMatrix: Record<string, bigint> = {}

        // TODO: break down the payments better than this - too many loops!
        const windowPayments = this.payments
          .filter(payment => payment.fulfiledAt >= window.openDate &&
            payment.fulfiledAt <= window.closeDate)
          .filter(payment => payment.currency === currency)

        // Initialize the payment Matrix.
        windowPayments.forEach(payment => paymentMatrix[makeKey(payment)] = 0n)

        // Accumulate the amount.
        windowPayments.forEach(payment => {
          const key = makeKey(payment)
          let current = paymentMatrix[key]
          current += payment.amount
          paymentMatrix[key] = current
        })

        // Now transform into TigerBeetle Transfers.
        transfers.push(...this.buildTransfersSettlement(paymentMatrix, windowId, currency))
      })
    })

    return transfers
  }

  // Given the total amounts between each dfsp for a currency + window, create the TigerBeetle
  // transfers to reflect the net settlement amounts.
  private buildTransfersSettlement(
    paymentMatrix: Record<string, bigint>,
    windowId: number,
    currency: string
  ): Array<Transfer> {
    const currencyConfig = this.currencyConfigs.find(config => config.currency === currency)
    assert(currencyConfig)
    const transfers: Array<Transfer> = []
    Object.entries(paymentMatrix).forEach(([key, amount]) => {
      const [payer, payee] = key.split(':')
      assert(payer)
      assert(payee)
      
      const legDebit = this.settlementLegMetas
      .find(leg => leg.dfspId === payee && leg.currency === currency && leg.windowId === windowId)
      const legCredit = this.settlementLegMetas
      .find(leg => leg.dfspId === payer && leg.currency === currency && leg.windowId === windowId)
      assert(legDebit)
      assert(legCredit)
      
      transfers.push({
        ...Helper.createTransferTemplate,
        id: id(),
        debit_account_id: legDebit.staging,
        credit_account_id: legCredit.staging,
        // Allows us to query all TigerBeetle transfers related to a Settlement.
        user_data_64: BigInt(this.settlementId),
        amount,
        ledger: currencyConfig.idOperation,
        code: TransferCode.Settlement_Record,
        flags: 0
      })
    })

    return transfers
  }
}
