import { describe, it } from "node:test";
import Harness from "../harness";
import { DispatchTransferHandler } from "../../handlers/dispatch-transfer-handler";
import { PositionHandlerV2 } from "../../handlers/position-v2";
import { MessageBus } from "../../messaging/message-bus";
import * as ApiHelpers from '../../testing/api-helpers'
import { logger } from "../../shared/logger";
import { sleepSeconds } from "../util";
import PRNG from "../prng";
import { TimeoutHandlerV2 } from "../../handlers/timeout-v2";

/**
 * Microbenchmark to test difference between FUSE and UNFUSE prepare handling.
 */
describe('FUSE vs UNFUSE prepares', () => {

  it('runs the benchmark', async () => {
    try {
      await benchmark('FUSE', 2000, 100)
      await benchmark('UNFUSE', 2000, 200)
    } catch (err: any) {
      logger.error(`failed with error: ${err.message}\n${err.stack}.`)
      throw err
    }
  })

  const benchmark = async (
    fuseOrUnfuse: 'FUSE' | 'UNFUSE',
    prepares: number,
    goalTps: number
  ) => {
    const harness = new Harness({id: Harness.randomRunId()})
    await harness.up()
    await harness.setupGlobals()

    harness.configOverride({
      HANDLERS_TRANSFER_POSITION_FUSE: fuseOrUnfuse
    })

    // Import after bringing up the harness, so that global config is overriden.
    const SettlementModelCached = require('../../models/settlement/settlementModelCached')
    await SettlementModelCached.initialize()
    const proxyCache = require('../../lib/proxyCache')
    await proxyCache.connect()

    const dispatchHandler = new DispatchTransferHandler(harness.config)
    const positionHandler = new PositionHandlerV2(harness.config)
    const timeoutHandler = new TimeoutHandlerV2(harness.config)
    const messageBus = new MessageBus({
      config: harness.config,
      handlers: {
        dispatchTransferHandler: dispatchHandler,
        positionBatchHandler: positionHandler,
        timeoutHandler
      }
    })
    await messageBus.init()

    // Configure the hub.
    const createHubPayload: ApiHelpers.CreateHubPayload = {
      currencies: ['USD'],
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
        }
      ]
    }
    await ApiHelpers.createHub(harness, createHubPayload)
    const prng = new PRNG(1001)
    // Create 4 test dfsps to transfer between.
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_a',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: 1000000 }],
      deposits: [100000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_b',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [
        { initialPosition: 0, value: 1000000 }
      ],
      deposits: [100000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_c',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [
        { initialPosition: 0, value: 1000000 }
      ],
      deposits: [100000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_d',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [
        { initialPosition: 0, value: 1000000 }
      ],
      deposits: [100000]
    })
    const dfsps = ['dfsp_a', 'dfsp_b', 'dfsp_c', 'dfsp_d']

    // Send in prepares and time.
    const start = performance.now()
    let countSuccess = 0
    let countFail = 0
    const payments = Array.from({ length: prepares }, (_, idx) => {
      const [payer, payee] = prng.randomSampleFrom(dfsps, 2)
      return ApiHelpers.buildPayment()
        .deps(harness, messageBus)
        .parties(payer, payee)
        .transferId('100' + idx.toString())
        .expiry(100)
        .amount('1.00')
        .build()
    })

    const logProgress = () => {
      const now = performance.now()
      logger.info(`${countSuccess + countFail}/${prepares} after ${(now - start).toFixed(0).padStart(5)}ms.`)
    }

    // Submit the prepares async, rate limiting on input.
    const delayMs = 1000 / goalTps
    let lastSubmit = performance.now()
    let idx = 0
    const latencies: Array<number> = []
    for (const payment of payments) {
      const now = performance.now()
      const elapsed = now - lastSubmit
      if (elapsed < delayMs) {
        await new Promise(resolve => setTimeout(resolve, delayMs - elapsed))
      }
      const submitTime = performance.now()
      lastSubmit = submitTime

      payment.prepare()
        .then(() => {
          countSuccess += 1
          latencies.push(performance.now() - submitTime)
        })
        .catch(() => {
          countFail += 1
          latencies.push(performance.now() - submitTime)
        })
      idx += 1
    }

    while ((countSuccess + countFail) < prepares) {
      logProgress()
      await sleepSeconds(5)
    }

    const elapsed = performance.now() - start
    logger.warn(`[${fuseOrUnfuse}] completed ${prepares} prepares in ${(elapsed).toFixed(0).padStart(5)}ms.`)
    const avgTps = Math.floor(prepares / (elapsed / 1000))
    logger.warn(`  tps       ${avgTps}`)
    latencies.sort((a, b) => a - b)
    const percentile = (arr: number[], p: number) => arr[Math.ceil(arr.length * p) - 1].toFixed(2)
    const p50 = percentile(latencies, 0.50)
    const p95 = percentile(latencies, 0.95)
    const p99 = percentile(latencies, 0.99)
    const p100 = latencies[latencies.length - 1].toFixed(2)
    logger.warn(`  latencies (ms):`)
    logger.warn(`  - p50     ${p50}`)
    logger.warn(`  - p95     ${p95}`)
    logger.warn(`  - p99     ${p99}`)
    logger.warn(`  - p100    ${p100}`)
    logger.warn(`  success ${countSuccess}`)
    logger.warn(`  fail    ${countFail}`)

    // Wait for async cleanup (out of our control).
    await sleepSeconds(5)

    await messageBus.deinit()
    await harness.teardownGlobals()
    harness.configResetOverride()
    // Producers don't disconect cleanly still.
    await sleepSeconds(2)
    await harness.down()
  }
})
