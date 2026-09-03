import { describe, it } from "node:test";
import { TransferHelper } from "./transfer-helper";
import * as ApiHelpers from '../testing/api-helpers'

describe('TransferHelper', () => {

  it('fulfilmentMatchesCondition happy cases', () => {
    // Grabbed these from the ttk.
    test(
      'VFhBCqP17O5VolemGmeVeVn_ZByepYwtqBDe2F675kA',
      'L9ZUmT5NJj-SKP5127Dvc1JkF4p74yW4RsLKnOd6QEY',
      true
    )

    const date = new Date()
    const prepare = ApiHelpers.buildMojaloopPostTransfer({
      payerFsp: "dfsp_a",
      payeeFsp: "dfsp_b",
      transferId: "12345",
      amountComplex: {
        amount: "10.00",
        currency: "USD"
      },
      date,
      expirySeconds: 10
    })
    const fulfil = ApiHelpers.buildMojaloopPutTransfer({
      payerFsp: "dfsp_a",
      payeeFsp: "dfsp_b",
      transferId: "12345",
      date,
      transferState: "COMMITTED",
      amountComplex: {
        amount: "10.00",
        currency: "USD"
      },
      expirySeconds: 10
    })
    test(
      fulfil.payload.fulfilment,
      prepare.payload.condition,
      true
    )
    
  })

  it('fulfilmentMatchesCondition failure cases', () => {
    test('12123', '123124124', false)
    test(
      '_3cco-YN5OGpRKVWV3n6x6uNpBTH9tYUdOYmHA-----', 
      'GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf00-Tn6kESAfM', 
      false
    )
  })

  const test = (fulfilment: string, condition: string, pass: boolean) => {
    const match = TransferHelper.fulfilmentMatchesCondition(fulfilment, condition)
    if (pass !== match) {
      const message = `Test fail, fulfilmentMatchesCondition expected: ${pass}, but got: ${match}\n`
       + `for fulfilment: ${fulfilment} and condition: ${condition}.`
      throw new Error(message)
    }
  }
})