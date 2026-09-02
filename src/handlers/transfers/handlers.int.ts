import { after, before, describe, it } from "node:test"
import assert from "node:assert"

import Harness from '../../testing/harness'
import { Snapshot } from "../../testing/snapshot"
import * as ApiHelpers from '../../testing/api-helpers'

import TimeoutHandler from '../timeouts/handler'
import TransferFacade from "../../models/transfer/facade"
import { assertPositionDiff, sleepSeconds } from "../../testing/util"

const harness = Harness.getInstance()

describe('handlers/tranfers/handlers', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()

    // Create the hub accounts + settlement model.
    const createHubPayload: ApiHelpers.CreateHubPayload = {
      currencies: ['USD'],
      settlementModels: [{
        name: `DEFERRED_MULTILATERAL_NET_USD`,
        settlementGranularity: "NET",
        settlementInterchange: "MULTILATERAL",
        settlementDelay: "DEFERRED",
        currency: 'USD',
        requireLiquidityCheck: true,
        ledgerAccountType: "POSITION",
        settlementAccountType: "SETTLEMENT",
        autoPositionReset: true
      }]
    }
    await ApiHelpers.createHub(harness, createHubPayload)
    // Create 2 test dfsps to transfer between.
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_a',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [
        {
          initialPosition: 0,
          value: 100000
        }
      ],
      deposits: [10000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_b',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [
        {
          initialPosition: 0,
          value: 100000
        }
      ],
      deposits: [10000]
    })
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })
  
  it('prepare() prepares a payment from dfsp_a -> dfsp_b.', async () => {
    const positionPayerStart = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    const positionPayeeStart = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    await ApiHelpers.buildPayment()
      .deps(harness, harness.messageBus)
      .parties('dfsp_a', 'dfsp_b')
      .transferId('1000001')
      .build()
      .prepare()

    // Get the transfer:
    const transfer = await TransferFacade.getById('1000001')
    Snapshot.from(`{
      "transferId": "1000001",
      "amount": "100.0000",
      "currencyId": "USD",
      "ilpCondition": :ignore
      "expirationDate": :ignore
      "createdDate": :ignore
      "currency": "USD",
      "payerParticipantCurrencyId": 3,
      "payerAmount": "100.0000",
      "payerParticipantId": 2,
      "payerFsp": "dfsp_a",
      "payerIsProxy": 0,
      "payeeParticipantCurrencyId": null,
      "payeeAmount": "-100.0000",
      "payeeParticipantId": 3,
      "payeeFsp": "dfsp_b",
      "payeeIsProxy": 0,
      "transferStateChangeId": 10,
      "transferState": "RESERVED",
      "reason": null,
      "completedTimestamp": :ignore
      "transferStateEnumeration": "RESERVED",
      "transferStateDescription": "The switch has reserved the transfer.",
      "ilpPacket": :ignore
      "condition": :ignore
      "fulfilment": null,
      "errorCode": null,
      "errorDescription": null,
      "externalPayerName": null,
      "externalPayeeName": null,
      "extensionList": [],
      "isTransferReadModel": true
    }`).checkUnwrap(transfer)

    // Check the position changes.
    let positionPayerEnd = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    let positionPayeeEnd = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    assertPositionDiff('payer', positionPayerStart, positionPayerEnd, { pending: 0, posted: 100 })
    assertPositionDiff('payee', positionPayeeStart, positionPayeeEnd, { pending: 0, posted: 0 })

    harness.expect.topicsPaymentPrepareOrFulfil()
  })

  it('prepare() + fulfil() + COMMIT  completes a payment.', async () => {
    const transferId = '1000002'
    const positionPayerStart = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    const positionPayeeStart = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')

    const payment = await ApiHelpers.buildPayment()
      .deps(harness, harness.messageBus)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .build()
      .prepare()

    let positionPayerEnd = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    let positionPayeeEnd = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    assertPositionDiff('payer', positionPayerStart, positionPayerEnd, { pending: 0, posted: 100 })
    assertPositionDiff('payee', positionPayeeStart, positionPayeeEnd, { pending: 0, posted: 0 })

    await payment.fulfil()

    positionPayerEnd = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    positionPayeeEnd = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    assertPositionDiff('payer', positionPayerStart, positionPayerEnd, { posted: 100 })
    assertPositionDiff('payee', positionPayeeStart, positionPayeeEnd, { posted: -100 })

    // Get the transfer:
    const transfer = await TransferFacade.getById(transferId)
    Snapshot.from(`{
      "transferId": "1000002",
      "amount": "100.0000",
      "currencyId": "USD",
      "ilpCondition": :ignore
      "expirationDate": :ignore
      "createdDate": :ignore
      "currency": "USD",
      "payerParticipantCurrencyId": 3,
      "payerAmount": "100.0000",
      "payerParticipantId": 2,
      "payerFsp": "dfsp_a",
      "payerIsProxy": 0,
      "payeeParticipantCurrencyId": null,
      "payeeAmount": "-100.0000",
      "payeeParticipantId": 3,
      "payeeFsp": "dfsp_b",
      "payeeIsProxy": 0,
      "transferStateChangeId": :ignore,
      "transferState": "COMMITTED",
      "reason": null,
      "completedTimestamp": :ignore
      "transferStateEnumeration": "COMMITTED",
      "transferStateDescription": "The switch has successfully performed the transfer.",
      "ilpPacket": :ignore
      "condition": :ignore
      "fulfilment": ":ignore",
      "errorCode": null,
      "errorDescription": null,
      "externalPayerName": null,
      "externalPayeeName": null,
      "extensionList": [],
      "isTransferReadModel": true
    }`).checkUnwrap(transfer)

    harness.expect.topicsPaymentPrepareOrFulfil()
  })

  it('fulfil() + ABORT   rejects   a payment.', async () => {
    //  B -> A
    const transferId = '1000003'
    const payment = ApiHelpers.buildPayment()
      .deps(harness, harness.messageBus)
      .parties('dfsp_b', 'dfsp_a')
      .transferId(transferId)
      .amount('50.00')
      .build()
    const positionPayerStart = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    const positionPayeeStart = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')

    await payment.prepare()

    let positionPayerEnd = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    let positionPayeeEnd = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    assertPositionDiff('payer', positionPayerStart, positionPayerEnd, { posted: 50 })
    assertPositionDiff('payee', positionPayeeStart, positionPayeeEnd, { posted: 0 })

    await payment.abort()

    // Get the transfer:
    const transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'ABORTED_ERROR')

    // Position should have reverted.
    positionPayerEnd = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    positionPayeeEnd = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    assertPositionDiff('payer', positionPayerStart, positionPayerEnd, { pending: 0, posted: 0 })
    assertPositionDiff('payee', positionPayeeStart, positionPayeeEnd, { pending: 0, posted: 0 })

    harness.expect.topicsPaymentPrepareOrFulfil()
  })

  it('prepare() handles a reused transferId (different body)', async () => {
    const transferId = '1000004'
    const now = new Date()
    const paymentA = ApiHelpers.buildPayment()
      .deps(harness, harness.messageBus)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount('10.00')
      .date(now)
      .build()
    const paymentB = ApiHelpers.buildPayment()
      .deps(harness, harness.messageBus)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount('12.00') // Changed amount.
      .date(now)
      .build()

    // Prepare the first payment.
    await paymentA.prepare()

    // Manually prepare the second payment - it will fail.
    await harness.messageBus.prepare(null, [paymentB.buildMessagePrepare()])
    await harness.redpandaDrainSmart(1, transferId)

    const messages = harness.spoolLastPayload(1)
    Snapshot.from(`[
      {
        "errorInformation": {
          "errorCode": "3106",
          "errorDescription": "Modified request",
          "extensionList": {
            "extension": [
              {
                "key": "cause",
                "value": :ignore
              }
            ]
          }
        }
      }
    ]`).checkUnwrap(messages)
  })

  it('fulfil() + RESERVE completes a payment.', async () => {
    const transferId = '1000005'
    const payment = ApiHelpers.buildPayment()
      .deps(harness, harness.messageBus)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount('14.00')
      .build()

    const positionPayerStart = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    const positionPayeeStart = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')

    await payment.prepare()
    await payment.fulfil('RESERVED')

    // Get the transfer:
    const transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'COMMITTED')

    // Check the position.
    const positionPayerEnd = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    const positionPayeeEnd = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    assertPositionDiff('payer', positionPayerStart, positionPayerEnd, { pending: 0, posted: 14 })
    assertPositionDiff('payee', positionPayeeStart, positionPayeeEnd, { pending: 0, posted: -14 })

    // Check the last messages.
    harness.expect.topicsPaymentPrepareOrFulfil()
  })

  it('fulfil() + COMMIT  with an invalid fulfilment.', async () => {
    const transferId = '1000006'
    const amount = '14.00'
    let now = new Date();
    const payment = ApiHelpers.buildPayment()
      .deps(harness, harness.messageBus)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount(amount)
      .build()

    const positionPayerStart = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    const positionPayeeStart = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')

    await payment.prepare()

    const putTransfer = ApiHelpers.buildMojaloopPutTransfer({
      payerFsp: 'dfsp_a',
      payeeFsp: 'dfsp_b',
      transferId,
      amountComplex: {
        amount,
        currency: 'KES' // This will cause the fulfilment to be invalid.
      },
      date: now,
      expirySeconds: 100,
      transferState: "RESERVED"
    })

    await harness.messageBus.fulfil(
      null, [ApiHelpers.buildMessageFulfil(harness, putTransfer, transferId)]
    )
    await harness.redpandaDrainSmart(harness.expect.messagesPayment(), transferId)

    // Get the transfer:
    const transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'ABORTED_ERROR')

    // Check the position.
    const positionPayerEnd = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    const positionPayeeEnd = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    assertPositionDiff('payer', positionPayerStart, positionPayerEnd, { pending: 0, posted: 0 })
    assertPositionDiff('payee', positionPayeeStart, positionPayeeEnd, { pending: 0, posted: 0 })

    // Check the last messages.
    harness.expect.topicsPaymentPrepareOrFulfil()
  })

  it('Payer dfsp cannot fulfill their own payment.', async () => {
    const transferId = '1000007'
    const payment = await ApiHelpers.buildPayment()
      .deps(harness, harness.messageBus)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .expiry(100)
      .build()
      .prepare()

    // Flip the headers, so it comes from the payer.
    const putTransfer = payment.buildMessageFulfil('COMMITTED')
    putTransfer.value.content.headers['fspiop-source'] = 'dfsp_a'
    putTransfer.value.content.headers['destination-source'] = 'dfsp_b'

    await harness.messageBus.fulfil(null, [putTransfer])
    await harness.redpandaDrainSmart(harness.expect.messagesPayment(), transferId)

    harness.expect.topicsPaymentPrepareOrFulfil()

    // Get the transfer:
    const transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'ABORTED_ERROR')
    assert.equal(
      transfer.reason, 
      'Generic validation error - caller fsp does not match payment.payeeFsp.'
    )
  })

  it('3rd dfsp cannot fulfill a payment.', async () => {
    const transferId = '1000017'
    const payment = await ApiHelpers.buildPayment()
      .deps(harness, harness.messageBus)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .expiry(100)
      .build()
      .prepare()
    
    // Make the callback come from a 3rd dfsp.
    const putTransfer = payment.buildMessageFulfil('COMMITTED')
    putTransfer.value.content.headers['fspiop-source'] = 'dfsp_x'

    await harness.messageBus.fulfil(null, [putTransfer])
    await harness.redpandaDrainSmart(harness.expect.messagesPayment(), transferId)

    // Check the last messages.
    harness.expect.topicsPaymentPrepareOrFulfil()

    // Get the transfer:
    const transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'ABORTED_ERROR')
    assert.equal(
      transfer.reason, 
      'Generic validation error - caller fsp does not match payment.payeeFsp.'
    )
  })

  it('prepare() handles payment which exceeds Payer position.', async () => {
    const transferId = '1000009'
    const payment = ApiHelpers.buildPayment()
      .deps(harness, harness.messageBus)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount('10000000.00')
      .build()

    const positionPayerStart = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    const positionPayeeStart = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')

    await payment.prepare()

    // Check the position changes.
    let positionPayerEnd = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    let positionPayeeEnd = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    assertPositionDiff('payer', positionPayerStart, positionPayerEnd, { pending: 0, posted: 0 })
    assertPositionDiff('payee', positionPayeeStart, positionPayeeEnd, { pending: 0, posted: 0 })

    // Check the transfer state.
    const transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'ABORTED_REJECTED')
    assert.equal(transfer.reason, 'Payer FSP insufficient liquidity')
  })
})
