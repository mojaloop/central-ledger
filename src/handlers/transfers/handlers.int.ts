import { after, before, describe, it } from "node:test"
import assert from "node:assert"

import Harness from '../../testing/harness'
import { Snapshot } from "../../testing/snapshot"
import * as ApiHelpers from '../../testing/api-helpers'

import TimeoutHandler from '../timeouts/handler'
import TransferFacade from "../../models/transfer/facade"
import handlerAll from './handler'
import handlerPrepare from './prepare'
import { assertPositionDiff, sleepSeconds } from "../../testing/util"
import { DispatchTransferHandler } from "../dispatch-transfer-handler"

const harness = Harness.getInstance()
let dispatchHandler: DispatchTransferHandler
describe('handlers/tranfers/handlers', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()

    dispatchHandler = new DispatchTransferHandler(harness.config)
    await dispatchHandler.init()

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
      .deps(harness, dispatchHandler)
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

    // Check the last 2 message types.
    const topics = harness.spoolLastTopic(2)
    Snapshot.from(`[
      "topic-transfer-position",
      "topic-notification-event"
    ]`).checkUnwrap(topics)
  })

  it('prepare() + fulfil() + COMMIT  completes a payment.', async () => {
    const transferId = '1000002'
    const positionPayerStart = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    const positionPayeeStart = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')

    const payment = await ApiHelpers.buildPayment()
      .deps(harness, handlerAll)
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

    // Check the last 2 topics.
    const topics = harness.spoolLastTopic(2)
    Snapshot.from(`[
      "topic-transfer-position",
      "topic-notification-event"
    ]`).checkUnwrap(topics)
  })

  it('fulfil() + ABORT   rejects   a payment.', async () => {
    //  B -> A
    const transferId = '1000003'
    const payment = await ApiHelpers.buildPayment()
      .deps(harness, handlerAll)
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

    // Check the last 2 message types.
    const topics = harness.spoolLastTopic(2)
    Snapshot.from(`[
      "topic-transfer-position",
      "topic-notification-event"
    ]`).checkUnwrap(topics)
  })

  it('prepare() handles a reused transferId (different body)', async () => {
    const transferId = '1000004'
    const now = new Date()
    const paymentA = await ApiHelpers.buildPayment()
      .deps(harness, handlerAll)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount('10.00')
      .date(now)
      .build()
    const paymentB = await ApiHelpers.buildPayment()
      .deps(harness, handlerAll)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount('12.00') // Changed amount.
      .date(now)
      .build()

    // Prepare the first payment.
    await paymentA.prepare()

    // Manually prepare the second payment - it will fail.
    const mark = harness.redpandaMark()
    await handlerPrepare.prepare(null, [paymentB.buildMessagePrepare()])
    await harness.redpandaDrain(mark, 1)

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
      .deps(harness, handlerAll)
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
    const topics = harness.spoolLastTopic(2)
    Snapshot.from(`[
      "topic-transfer-position",
      "topic-notification-event"
    ]`).checkUnwrap(topics)
  })

  it('fulfil() + COMMIT  with an invalid fulfilment.', async () => {
    const transferId = '1000006'
    const amount = '14.00'
    let now = new Date();
    const payment = ApiHelpers.buildPayment()
      .deps(harness, handlerAll)
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

    const mark = harness.redpandaMark()
    await handlerAll.fulfil(null, [ApiHelpers.buildMessageFulfil(harness, putTransfer, transferId)])
    await harness.redpandaDrain(mark, 2)

    // Get the transfer:
    const transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'ABORTED_ERROR')

    // Check the position.
    const positionPayerEnd = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    const positionPayeeEnd = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    assertPositionDiff('payer', positionPayerStart, positionPayerEnd, { pending: 0, posted: 0 })
    assertPositionDiff('payee', positionPayeeStart, positionPayeeEnd, { pending: 0, posted: 0 })

    // Check the last messages.
    const topics = harness.spoolLastTopic(2)
    Snapshot.from(`[
      "topic-transfer-position",
      "topic-notification-event"
    ]`).checkUnwrap(topics)
  })

  it('Payer dfsp cannot fulfill their own payment.', async () => {
    const transferId = '1000007'
    const amount = '14.00'
    let now = new Date();
    const payment = ApiHelpers.buildPayment()
      .deps(harness, handlerAll)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount(amount)
      .build()

    await payment.prepare()

    const putTransfer = ApiHelpers.buildMojaloopPutTransfer({
      payerFsp: 'dfsp_a',
      payeeFsp: 'dfsp_b',
      transferId,
      amountComplex: {
        amount,
        currency: 'USD'
      },
      date: now,
      expirySeconds: 100,
      transferState: "RESERVED"
    })

    // Flip the headers, so it comes from the payer.
    putTransfer.headers['fspiop-source'] = 'dfsp_a'
    putTransfer.headers['fspiop-destination'] = 'dfsp_b'

    const mark = harness.redpandaMark()
    await handlerAll.fulfil(null, [ApiHelpers.buildMessageFulfil(harness, putTransfer, transferId)])
    await harness.redpandaDrain(mark, 2)

    // Get the transfer:
    const transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'ABORTED_ERROR')
    assert.equal(
      transfer.reason, 
      'Generic validation error - fspiop-destination does not match payer fsp on the Fulfil callback response'
    )
  })

  it('3rd dfsp cannot fulfill a payment.', async () => {
    const transferId = '1000017'
    const amount = '14.00'
    let now = new Date();
    const postTransfer = ApiHelpers.buildMojaloopPostTransfer({
      payerFsp: 'dfsp_a',
      payeeFsp: 'dfsp_b',
      transferId,
      amountComplex: {
        amount,
        currency: 'USD'
      },
      date: now,
      expirySeconds: 100
    })

    let mark = harness.redpandaMark()
    await handlerPrepare.prepare(null, [ApiHelpers.buildMessagePrepare(harness, postTransfer)])
    await harness.redpandaDrain(mark, 2)

    const putTransfer = ApiHelpers.buildMojaloopPutTransfer({
      payerFsp: 'dfsp_a',
      payeeFsp: 'dfsp_b',
      transferId,
      amountComplex: {
        amount,
        currency: 'USD'
      },
      date: now,
      expirySeconds: 100,
      transferState: "RESERVED"
    })

    // Make the callback come from a 3rd dfsp.
    putTransfer.headers['fspiop-source'] = 'dfsp_x'

    mark = harness.redpandaMark()
    await handlerAll.fulfil(null, [ApiHelpers.buildMessageFulfil(harness, putTransfer, transferId)])
    await harness.redpandaDrain(mark, 2)

    // Check the last messages.
    const topics = harness.spoolLastTopic(2)
    Snapshot.from(`[
      "topic-transfer-position",
      "topic-notification-event"
    ]`).checkUnwrap(topics)

    // Get the transfer:
    const transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'ABORTED_ERROR')
    assert.equal(
      transfer.reason, 
      'Generic validation error - fspiop-source does not match payee fsp on the Fulfil callback response'
    )
  })

  it('prepare() + wait times out a transfer.', async () => {
    const transferId = '1000008'
    const payment = ApiHelpers.buildPayment()
      .deps(harness, handlerAll)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount('14.00')
      .expiry(1)
      .build()

    const positionPayerStart = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    const positionPayeeStart = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')

    await payment.prepare()
    await sleepSeconds(10)
    // We don't run the timeout handler in these tests, but instead just call timeout()
    // directly. This makes the tests more predictable and deterministic.
    const mark = harness.redpandaMark()
    const timeoutResult = (await TimeoutHandler.timeout()) as unknown as {transferTimeoutList: Array<unknown>}
    assert(timeoutResult.transferTimeoutList.length === 1)
    await harness.redpandaDrain(mark, 2)

    const lastTopics = harness.spoolLastTopic(2)
    Snapshot.from(`[
      "topic-transfer-position",
      "topic-notification-event"
    ]`).checkUnwrap(lastTopics)

    // Positions should have reset with timeout.
    const positionPayerEnd = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    const positionPayeeEnd = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    assertPositionDiff('payer', positionPayerStart, positionPayerEnd, { pending: 0, posted: 0 })
    assertPositionDiff('payee', positionPayeeStart, positionPayeeEnd, { pending: 0, posted: 0 })

    // Check the transfer.
    const transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'EXPIRED_RESERVED')
    assert.equal(transfer.reason, 'Transfer expired')
  })

  it('prepare() handles payment which exceeds Payer position.', async () => {
    const transferId = '1000009'
    const payment = ApiHelpers.buildPayment()
      .deps(harness, handlerAll)
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
