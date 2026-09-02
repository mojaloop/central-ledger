import { describe, it, before, after } from 'node:test'
import Harness from '../testing/harness'
import * as ApiHelpers from '../testing/api-helpers'
import assert from 'node:assert'
import { assertPositionDiff, futureDate } from '../testing/util'
import TransferService from '../domain/transfer'
import { Snapshot } from '../testing/snapshot'
import TransferFacade from '../models/transfer/facade'
import { logger } from '../shared/logger'

const harness = Harness.getInstance()
let FxTransferService: any
let proxyCache: any

describe('handlers/timeout-v2', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()

    FxTransferService = require('../domain/fx/index')
    proxyCache = require('../lib/proxyCache')

    // Create the hub accounts + settlement model.
    const createHubPayload: ApiHelpers.CreateHubPayload = {
      currencies: ['USD', 'BWP'],
      settlementModels: [
        {
          name: `DEFERRED_MULTILATERAL_NET_USD`,
          settlementGranularity: 'NET',
          settlementInterchange: 'MULTILATERAL',
          settlementDelay: 'DEFERRED',
          currency: 'USD',
          requireLiquidityCheck: true,
          ledgerAccountType: 'POSITION',
          settlementAccountType: 'SETTLEMENT',
          autoPositionReset: true
        },
        {
          name: `DEFERRED_MULTILATERAL_NET_BWP`,
          settlementGranularity: "NET",
          settlementInterchange: "MULTILATERAL",
          settlementDelay: "DEFERRED",
          currency: 'BWP',
          requireLiquidityCheck: true,
          ledgerAccountType: "POSITION",
          settlementAccountType: "SETTLEMENT",
          autoPositionReset: true
        },
      ]
    }
    await ApiHelpers.createHub(harness, createHubPayload)
    // Create 2 test dfsps to transfer between.
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_a',
      currencies: ['USD', 'BWP'],
      isProxy: false,
      initialPostionsAndLimits: [
        { initialPosition: 0, value: 100000 },
        { initialPosition: 0, value: 100000 },
      ],
      deposits: [10000, 10000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_b',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [
        { initialPosition: 0, value: 100000 }
      ],
      deposits: [10000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'fxp_a',
      currencies: ['BWP', 'USD'],
      isProxy: false,
      initialPostionsAndLimits: [
        { initialPosition: 0, value: 100000 },
        { initialPosition: 0, value: 100000 }
      ],
      deposits: [10000, 10000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'proxy',
      currencies: ['BWP', 'USD'],
      isProxy: true,
      initialPostionsAndLimits: [
        { initialPosition: 0, value: 100000 },
        { initialPosition: 0, value: 100000 }
      ],
      deposits: [10000, 10000]
    })
    // await proxyCache.getCache().addDfspIdToProxyMapping('external_dfsp_a', 'dfsp_a_proxy')

  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  it('messageBus.timeout() times out expired payments', async () => {
    const transferId = '1000001'
    const positionPayerStart = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    const positionPayeeStart = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    
    await ApiHelpers.buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .expiry(1)
      .build()
      .prepare()

    await harness.messageBus.timeout(futureDate(10, 'm'))
    await harness.redpandaDrainSmart(harness.expect.messagesPaymentTimeout(), transferId)

    // Positions should have reset with timeout.
    const positionPayerEnd = await ApiHelpers.getPositionAccount('dfsp_a', 'USD')
    const positionPayeeEnd = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    assertPositionDiff('payer', positionPayerStart, positionPayerEnd, { pending: 0, posted: 0 })
    assertPositionDiff('payee', positionPayeeStart, positionPayeeEnd, { pending: 0, posted: 0 })
  

    // Look up payment.
    const paymentUpdated = await TransferService.getByIdLight(transferId)
    assert.equal(paymentUpdated.transferState, 'EXPIRED_RESERVED')
  })

  it('messageBus.timeout() expires a payment only once', async () => {
    const transferId = '1000002'
    await ApiHelpers.buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .expiry(1)
      .build()
      .prepare()

    await harness.messageBus.timeout(futureDate(10, 'm'))
    await harness.redpandaDrainSmart(harness.expect.messagesPaymentTimeout(), transferId)

    // Look up payment.
    const paymentUpdated = await TransferService.getByIdLight(transferId)
    assert.equal(paymentUpdated.transferState, 'EXPIRED_RESERVED')

    // Call the timeout directly, and check that there are no effects.
    await harness.timeoutHandler.run(futureDate(12, 'm'))
  })

  it('messageBus.timeout() does not time out not expired payments', async () => {
    const transferId = '1000003'
    const payment = await ApiHelpers.buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .expiry(100)
      .build()
      .prepare()

    await harness.messageBus.timeout(futureDate(10, 's'))
    await harness.redpandaDrainSmart(0, transferId)

    // Look up payment.
    const paymentUpdated = await TransferService.getByIdLight(transferId)
    assert.equal(paymentUpdated.transferState, 'RESERVED')

    await payment.abort()
  })

  it('messageBus.timeout() times out expired forex', async () => {
    const transferId = '1000004'
    const commitRequestId = '2000004'
    const forex = ApiHelpers.buildForex()
      .deps(harness, harness.messageBus)
      .commitRequestId(commitRequestId)
      .determiningTransferId(transferId)
      .parties('dfsp_a', 'fxp_a')
      .amountSource('100.00', 'BWP')
      .amountTarget('10.00', 'USD')
      .expiry(1)
      .build()

    await forex.prepare()
    await harness.messageBus.timeout(futureDate(1, 'h'))
    await harness.redpandaDrainSmart(harness.expect.messagesForexTimeout(), commitRequestId)

    let fxTransfer = await FxTransferService.getByIdLight(commitRequestId)
    assert.equal(fxTransfer.fxTransferState, 'EXPIRED_RESERVED')
  })

  it('messageBus.timeout() handles a forwarded payment message', async () => {
    const transferId = '1000005'
    const payment = await ApiHelpers.buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .expiry(10)
      .build()
      .prepare()

    // Forward to the proxy.
    const msgForwarded = ApiHelpers.buildMessageForwarded(harness, {
      transferId, proxyId: 'proxy'
    })
    await harness.messageBus.prepare(null, [msgForwarded])
    await harness.redpandaDrainSmart(0, transferId)

    // Now run the timeout. Payment shouldn't be timed out.
    await harness.messageBus.timeout(futureDate(1, 'h'))
    // We should see a Notification GET!
    const emitted = await harness.redpandaDrainSmart(1, transferId)
    Snapshot.from(`{
      "action": "get",
      "createdAt": :ignore
      "id": :ignore
      "state": {
        "code": 999,
        "description": "action failed",
        "status": "error"
      },
      "type": "notification"
    }`).checkUnwrap(emitted[0].valueParsed.metadata.event)

    const transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'RESERVED_FORWARDED')
  })

  it('messageBus.timeout() handles a forwarded forex message', async () => {
    const transferId = '1000006'
    const commitRequestId = '2000006'
    await ApiHelpers.buildForex()
      .deps(harness, harness.messageBus)
      .commitRequestId(commitRequestId)
      .determiningTransferId(transferId)
      .parties('dfsp_a', 'fxp_a')
      .amountSource('100.00', 'BWP')
      .amountTarget('10.00', 'USD')
      .expiry(1)
      .build()
      .prepare()

    // Forward to the proxy.
    const msgForwarded = ApiHelpers.buildMessageForwardedFx(harness, {
      commitRequestId, proxyId: 'proxy'
    })
    await harness.messageBus.prepare(null, [msgForwarded])
    await harness.redpandaDrainSmart(0, commitRequestId)

    // Now run the timeout. Payment shouldn't be timed out.
    await harness.messageBus.timeout(futureDate(1, 'h'))
    // We should see a Notification GET!
    const emitted = await harness.redpandaDrainSmart(1, commitRequestId)
    Snapshot.from(`{
      "action": "get",
      "createdAt": :ignore
      "id": :ignore
      "state": {
        "code": 999,
        "description": "action failed",
        "status": "error"
      },
      "type": "notification"
    }`).checkUnwrap(emitted[0].valueParsed.metadata.event)

    const fxTransfer = await FxTransferService.getByIdLight(commitRequestId)
    assert.equal(fxTransfer.fxTransferState, 'RESERVED_FORWARDED')
  })

  it('only one timeout can run at a time', async () => {
    let transferId = 1100000
    let commitRequestId = 2100000

    const nextTransferId = (): string => {
      const str = transferId.toString()
      transferId += 1
      return str
    }
    const nextCommitRequestId = (): string => {
      const str = commitRequestId.toString()
      commitRequestId += 1
      return str
    }

    await ApiHelpers.buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(nextTransferId())
      .expiry(1)
      .build()
      .prepare()

    await ApiHelpers.buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(nextTransferId())
      .expiry(1)
      .build()
      .prepare()

    await ApiHelpers.buildForex()
      .deps(harness, harness.messageBus)
      .commitRequestId(nextCommitRequestId())
      .determiningTransferId(nextTransferId())
      .parties('dfsp_a', 'fxp_a')
      .amountSource('100.00', 'BWP')
      .amountTarget('10.00', 'USD')
      .expiry(1)
      .build()
      .prepare()

    await ApiHelpers.buildForex()
      .deps(harness, harness.messageBus)
      .commitRequestId(nextCommitRequestId())
      .determiningTransferId(nextTransferId())
      .parties('dfsp_a', 'fxp_a')
      .amountSource('100.00', 'BWP')
      .amountTarget('10.00', 'USD')
      .expiry(1)
      .build()
      .prepare()

    const [resultsA, resultsB] = await Promise.all([
      harness.timeoutHandler.run(futureDate(5, 'm')),
      harness.timeoutHandler.run(futureDate(5, 'm'))
    ])

    // Intervals shouldn't overlap.
    const assertContiguousIntervals = (a: [number, number], b: [number, number]) =>{
      const joined = [...a, ...b]
      const sorted = joined.toSorted((a, b) => a - b)
      assert.equal(joined.length, 4)
      assert.equal(sorted[1], sorted[2])
      assert(sorted[0] < sorted[3])
    }
    assertContiguousIntervals(resultsA.intervalPayment, resultsB.intervalPayment)
    assertContiguousIntervals(resultsA.intervalForex, resultsB.intervalForex)
  })
})
