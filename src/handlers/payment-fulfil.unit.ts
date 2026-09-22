import { describe, it } from "node:test"
import assert from "node:assert"

import { TransferHelper } from "./transfer-helper"
import { generateQuoteILPResponse, MockQuoteILPResponse } from '../testing/api-helpers'

describe('handlers/payment-fulfil', () => {
  it('_fulfilmentToCondition handles valid input', () => {
    const mockQuoteResponse: MockQuoteILPResponse = {
      quoteId: '00001',
      transactionId: '00001',
      transactionType: 'unknown',
      payerFsp: 'dfsp_a',
      payeeFsp: 'dfsp_b',
      transferId: '10000001',
      amountComplex: {
        amount: '100.00',
        currency: 'USD'
      },
      expiration: new Date('2026-01-01').toISOString()
    }
    const quoteResponse = generateQuoteILPResponse(mockQuoteResponse)

    const actual = TransferHelper.fulfilmentToCondition(quoteResponse.fulfilment)
    assert.equal(actual, quoteResponse.condition)
  })

  it('_fulfilmentToCondition handles invalid input', {
    expectFailure: '[FSPIOPError]: Interledger preimages must be exactly 32 bytes'
  }, () => {
    TransferHelper.fulfilmentToCondition("balbalbaI am a bad input")
  })

  it('_fulfilmentToCondition handles invalid input', {
    expectFailure: '[FSPIOPError]: Interledger preimages must be exactly 32 bytes'
  }, () => {
    TransferHelper.fulfilmentToCondition(undefined as unknown as string)
  })
})