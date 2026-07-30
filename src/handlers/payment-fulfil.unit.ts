import { describe, it } from "node:test";
import { PaymentFulfilHandler } from "./payment-fulfil";
import { generateQuoteILPResponse, MockQuoteILPResponse } from '../testing/api-helpers'
import { Snapshot } from "../testing/snapshot";
import assert from "node:assert";

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

    const actual = PaymentFulfilHandler._fulfilmentToCondition(quoteResponse.fulfilment)
    assert.equal(actual, quoteResponse.condition)
  })

  it('_fulfilmentToCondition handles invalid input', {
    expectFailure: '[FSPIOPError]: Interledger preimages must be exactly 32 bytes'
  }, () => {
    PaymentFulfilHandler._fulfilmentToCondition("balbalbaI am a bad input")
  })

  it('_fulfilmentToCondition handles invalid input', {
    expectFailure: '[FSPIOPError]: Interledger preimages must be exactly 32 bytes'
  }, () => {
    PaymentFulfilHandler._fulfilmentToCondition(undefined as unknown as string)
  })
})