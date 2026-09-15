import assert from "node:assert"
import { after, before, describe, it } from "node:test"
import Harness from '../../testing/harness'
import { Snapshot } from "../../testing/snapshot"
import * as ApiHelpers from '../../testing/api-helpers'


import { envOrDefaultString, unwrapResponse, unwrapResponseWithError } from "../../testing/util"
import PRNG from "../../testing/prng"
import { logger } from "../../shared/logger"
import HandlerV2, { RequestGetById } from "./handler-v2"

const harness = Harness.getInstance()
const prng = new PRNG(123)
Harness.injectPrngAndPatchDateGlobal(prng)
let handler: HandlerV2

describe('api/transactions/handler-v2', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()

    handler = new HandlerV2({
      config: harness.config,
      ledger: harness.ledger
    })

    const apiModeAdmin = envOrDefaultString('API_MODE_ADMIN', 'NONE') as 'NONE' | 'LEDGER'
    harness.configOverride({
      API_MODE_ADMIN: apiModeAdmin
    })

    await ApiHelpers.buildHub().deps(harness).currency('AUD').build().create()
    await ApiHelpers.buildHub().deps(harness).currency('USD').build().create()
    await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .currency('USD')
      .name('dfsp_a')
      .build()
      .create()
    await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .currency('USD')
      .name('dfsp_b')
      .build()
      .create()
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  it('gets a completed transfer', async () => {
    await ApiHelpers
      .buildPayment()
      .transferId('1000001')
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .amount('10', 'AUD')
      .build()
      .prepareAndFulfil()

    const request: RequestGetById = {
      params: {
        id: '1000001'
      }
    } as RequestGetById
    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.getById(request, reply))

    assert.equal(responseCode, 200)
    Snapshot.from(`{
      "amount": {
        "amount": "10",
        "currency": "AUD"
      },
      "expiration": "2026-02-01T00:02:30.000Z",
      "payee": {
        "partyIdInfo": {
          "fspId": "dfsp_b",
          "partyIdType": "MSISDN",
          "partyIdentifier": "12346"
        }
      },
      "payer": {
        "partyIdInfo": {
          "fspId": "dfsp_a",
          "partyIdType": "MSISDN",
          "partyIdentifier": "78901"
        }
      },
      "quoteId": "00001",
      "transactionId": "00001",
      "transactionType": "unknown"
    }`).checkUnwrap(responseBody)
  })

  it('fails to get a transfer which does not exist', async () => {
    const request: RequestGetById = {
      params: {
        id: '1000002'
      }
    } as RequestGetById
    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.getById(request, reply))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": :ignore
      }
    }`).checkUnwrap(responseBody)
  })

  it('does not get anything for a forex', async () => {
    await ApiHelpers
      .buildForex()
      .deps(harness, harness.messageBus)
      .commitRequestId('2000003')
      .determiningTransferId('1000003')
      .parties('dfsp_a', 'dfsp_b')
      .amountSource('10', 'AUD')
      .amountTarget('10.5', 'USD')
      .build()
      .prepareAndFulfil()

    const request: RequestGetById = {
      params: {
        id: '2000003'
      }
    } as RequestGetById
    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.getById(request, reply))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": :ignore
      }
    }`).checkUnwrap(responseBody)
  })
})
