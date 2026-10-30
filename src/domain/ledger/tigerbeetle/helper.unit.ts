import { describe, it } from "node:test";
import Helper from "./helper";
import assert from "node:assert";
import { CreatePaymentDto } from "../../../handlers/payment-prepare";
import { CommitPaymentDto } from "../../../handlers/payment-fulfil";

describe('Helper', () => {
  it('hashPrepare', () => {
    const prepare: CreatePaymentDto = {
      amount: {
        amount: '19.00',
        currency: 'KES',
      },
      expiration: (new Date('2025-01-01')).toISOString(),
      payerFsp: 'dfsp_c',
      payeeFsp: 'dfsp_a',
      condition: 'PjQdcYPsJoveKWnWGhJnea6MWeaxtIRIrRGCcyrc06w',
      ilpPacket: 'AYIB6gAAAAAADWydFWcuZGZzcF9oLm1zaXNkbi4xMjM0NoIByGV5SmhiVzkxYm5RaU9uc',
      // Transfer gets ignored by hashPrepare.
      transferId: "1234"
    }

    const hash = Helper.hashPrepare(prepare)
    assert.equal(hash, 1628457006)
  })

  it('hashFulfil with aborted payload', () => {
    const payload: CommitPaymentDto = {
      transferState: 'ABORTED',
      completedTimestamp: (new Date('2025-01-01')).toISOString(),
      errorInformation: {
        errorCode: '3006',
        errorDescription: 'Test Error.'
      }
    }
    const hash = Helper.hashFulfil('1ccc03a8-b36c-4854-bc37-0208cff8e692', payload)
    assert.equal(hash, 4070242986)


    const payload2 = structuredClone(payload)
    const hash2 = Helper.hashFulfil('1ccc03a8-b36c-4854-bc37-0208cff8e692', payload2)
    assert.equal(hash, hash2)
  })

  it('hashFulfil with fulfiled payload', () => {
    const payload: CommitPaymentDto = {
      transferState: 'COMMITTED',
      completedTimestamp: (new Date('2025-01-01')).toISOString(),
      fulfilment: 'wg1mQp9bzjarF8bpZx0hcMYbf_3vPjAHvZo3_Ptw_PE'
    }
    const hash = Helper.hashFulfil('1ccc03a8-b36c-4854-bc37-0208cff8e692', payload)
    assert.equal(hash, 1084647829)
  })
})