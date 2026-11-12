/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>
 - Shashikant Hirugade <shashi.mojaloop@gmail.com>

 --------------
 ******/

import { after, before, describe, it } from "node:test"
import assert from "node:assert"

import Harness, { MojaloopKafkaMessage } from '../../testing/harness'
import * as ApiHelpers from '../../testing/api-helpers'
import { assertPositionDiff } from "../../testing/util"
import { overrideForTesting } from '../../lib/config'
import Db from '../../lib/db'
import Metrics from '@mojaloop/central-services-metrics'

import TransferFacade from "../../models/transfer/facade"
import handlerAll from '../transfers/handler'
import handlerPrepare from '../transfers/prepare'
import PositionBatchHandler from './handlerBatch'

const harness = Harness.getInstance()

const TOPIC_POSITION_BATCH = 'topic-transfer-position-batch'
// No position consumer is registered on this topic when the harness runs in BATCH mode.
const TOPIC_POSITION_UNCONSUMED = 'topic-transfer-position'

/**
 * Prepares the given transfers with the real prepare handler, and returns the position messages it
 * produced, without letting the registered batch consumer pick them up.
 *
 * The prepare handler publishes to EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.PREPARE. While these
 * transfers are prepared, that is pointed at a topic with no position consumer, so the test can
 * then process all of the position messages as one batch.
 */
const prepareWithoutPositionProcessing = async (
  payments: Array<ApiHelpers.Payment>
): Promise<Array<MojaloopKafkaMessage>> => {
  overrideForTesting({
    KAFKA_CONFIG: { EVENT_TYPE_ACTION_TOPIC_MAP: { POSITION: { PREPARE: TOPIC_POSITION_UNCONSUMED } } }
  } as any)

  try {
    const positionMessages: Array<MojaloopKafkaMessage> = []
    for (const payment of payments) {
      const mark = harness.redpandaMark()
      await handlerPrepare.prepare(null, [payment.buildMessagePrepare()])
      await harness.redpandaDrain(mark, 1)

      const [positionMessage] = harness.spoolLast(1)
      assert.equal(positionMessage.topic, TOPIC_POSITION_UNCONSUMED)
      assert.equal(positionMessage.valueParsed.metadata.event.action, 'prepare')
      positionMessages.push(positionMessage)
    }
    return positionMessages
  } finally {
    overrideForTesting({
      KAFKA_CONFIG: { EVENT_TYPE_ACTION_TOPIC_MAP: { POSITION: { PREPARE: TOPIC_POSITION_BATCH } } }
    } as any)
  }
}

/**
 * Builds a batch as the batch consumer would deliver it (parsed JSON value, same key). The topic
 * is set to the batch topic so the offset commit uses the registered batch consumer.
 */
const toBatch = (positionMessages: Array<MojaloopKafkaMessage>) => positionMessages.map(message => ({
  ...message,
  topic: TOPIC_POSITION_BATCH,
  value: message.valueParsed
}))

/**
 * Processes the position messages as a single batch, and returns the notifications it produced.
 * By default expects one notification per position message.
 */
const processAsOneBatch = async (
  positionMessages: Array<MojaloopKafkaMessage>,
  expectedNotifications: number = positionMessages.length
): Promise<Array<any>> => {
  const mark = harness.redpandaMark()
  await PositionBatchHandler.positions(null, toBatch(positionMessages))
  await harness.redpandaDrain(mark, expectedNotifications)
  return expectedNotifications > 0 ? harness.spoolLastPayload(expectedNotifications) : []
}

/** The transfer's state history, oldest first. */
const getStateHistory = async (transferId: string): Promise<Array<string>> => {
  const rows = await Db.getKnex()('transferStateChange')
    .where({ transferId })
    .orderBy('transferStateChangeId', 'asc')
    .select('transferStateId')
  return rows.map((row: { transferStateId: string }) => row.transferStateId)
}

/** The number of position changes recorded against the transfer. */
const countPositionChanges = async (transferId: string): Promise<number> => {
  const [row] = await Db.getKnex()('participantPositionChange AS ppc')
    .join('transferStateChange AS tsc', 'tsc.transferStateChangeId', 'ppc.transferStateChangeId')
    .where('tsc.transferId', transferId)
    .count({ count: '*' })
  return Number(row.count)
}

/**
 * The number of batches the handler has failed and rolled back, from its `transfer_position_batch`
 * histogram. A failed batch is not committed to Kafka, so it is redelivered and processed again.
 */
const countFailedBatches = async (): Promise<number> => {
  const histogram = Metrics.getHistogram(
    'transfer_position_batch',
    'Consume a batch of prepare transfer messages from the kafka topic and process them',
    ['success']
  )
  const { values } = await histogram.get()
  const failed = values.find((v: any) => v.metricName.endsWith('_count') && String(v.labels.success) === 'false')
  return failed?.value ?? 0
}

/** Checks that the transfer was reserved exactly once: one RESERVED state change and one position change. */
const assertReservedOnce = async (transferId: string) => {
  assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED'], `${transferId}: one RESERVED state change`)
  assert.equal(await countPositionChanges(transferId), 1, `${transferId}: one position change`)
}

const assertPayerPositionMoved = async (positionStart: any, posted: number) => {
  const positionEnd = await ApiHelpers.getPositionAccount('dfsp_dup', 'USD')
  assertPositionDiff('payer', positionStart, positionEnd, { posted })
}

const buildPayments = (payerFsp: string, transferIds: Array<string>, amount: string) =>
  transferIds.map(transferId => ApiHelpers.buildPayment()
    .deps(harness, handlerAll)
    .parties(payerFsp, 'dfsp_b')
    .transferId(transferId)
    .amount(amount)
    .build())

const errorCodesOf = (payloads: Array<any>) => payloads
  .map(payload => payload?.errorInformation?.errorCode)
  .filter(Boolean)
  .sort()

describe('handlers/positions/handlerBatch', () => {
  before(async () => {
    await harness.up('BATCH')
    await harness.setupGlobals()

    // The prepare handler commits its kafka offsets, so its consumer must be connected.
    await handlerAll.registerPrepareHandler()

    await ApiHelpers.createHub(harness, {
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
    })

    // Net debit cap 150, plenty of liquidity: room for one transfer of 100.
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_ndc',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: 150 }],
      deposits: [10000]
    })
    // Liquidity cover 150, high net debit cap: room for one transfer of 100.
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_liq',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
      deposits: [150]
    })
    // Plenty of liquidity and net debit cap, for the duplicate message tests.
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_dup',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
      deposits: [10000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_b',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
      deposits: [10000]
    })
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  it('applies the net debit cap to every prepare in one batch.', async () => {
    const transferIds = ['3000001', '3000002', '3000003']
    const positionStart = await ApiHelpers.getPositionAccount('dfsp_ndc', 'USD')

    const positionMessages = await prepareWithoutPositionProcessing(buildPayments('dfsp_ndc', transferIds, '100.00'))
    const notifications = await processAsOneBatch(positionMessages)

    const states = await Promise.all(transferIds.map(async id => (await TransferFacade.getById(id)).transferState))
    assert.deepEqual(states, ['RESERVED', 'ABORTED_REJECTED', 'ABORTED_REJECTED'], 'only the first transfer fits the net debit cap')
    assert.deepEqual(errorCodesOf(notifications), ['4200', '4200'], 'two payer limit errors')

    const positionEnd = await ApiHelpers.getPositionAccount('dfsp_ndc', 'USD')
    assertPositionDiff('payer', positionStart, positionEnd, { posted: 100 })
  })

  it('applies the liquidity cover to every prepare in one batch.', async () => {
    const transferIds = ['3000011', '3000012', '3000013']
    const positionStart = await ApiHelpers.getPositionAccount('dfsp_liq', 'USD')

    const positionMessages = await prepareWithoutPositionProcessing(buildPayments('dfsp_liq', transferIds, '100.00'))
    const notifications = await processAsOneBatch(positionMessages)

    const states = await Promise.all(transferIds.map(async id => (await TransferFacade.getById(id)).transferState))
    assert.deepEqual(states, ['RESERVED', 'ABORTED_REJECTED', 'ABORTED_REJECTED'], 'only the first transfer fits the liquidity cover')
    assert.deepEqual(errorCodesOf(notifications), ['4001', '4001'], 'two insufficient liquidity errors')

    const positionEnd = await ApiHelpers.getPositionAccount('dfsp_liq', 'USD')
    assertPositionDiff('payer', positionStart, positionEnd, { posted: 100 })
  })

  describe('duplicate prepare position messages', () => {
    it('reserves once when two copies are in one batch, without affecting another transfer.', async () => {
      const [transferId, otherTransferId] = ['3000021', '3000022']
      const positionStart = await ApiHelpers.getPositionAccount('dfsp_dup', 'USD')
      const [positionMessage, otherPositionMessage] = await prepareWithoutPositionProcessing(
        buildPayments('dfsp_dup', [transferId, otherTransferId], '100.00')
      )

      // The duplicate copy produces no notification; each transfer's prepare is forwarded to the payee.
      const notifications = await processAsOneBatch([positionMessage, positionMessage, otherPositionMessage], 2)

      assert.deepEqual(errorCodesOf(notifications), [], 'no error sent to the payer')
      await assertReservedOnce(transferId)
      await assertReservedOnce(otherTransferId)
      await assertPayerPositionMoved(positionStart, 200)
    })

    it('does nothing when a copy is replayed after the first was committed.', async () => {
      const transferId = '3000031'
      const positionStart = await ApiHelpers.getPositionAccount('dfsp_dup', 'USD')
      const [positionMessage] = await prepareWithoutPositionProcessing(buildPayments('dfsp_dup', [transferId], '100.00'))

      await processAsOneBatch([positionMessage], 1)
      const notifications = await processAsOneBatch([positionMessage], 0)

      assert.deepEqual(notifications, [], 'the replay sends no notification')
      await assertReservedOnce(transferId)
      await assertPayerPositionMoved(positionStart, 100)
    })

    it('reserves once when two batches with the same message run at the same time.', async () => {
      const transferId = '3000041'
      const positionStart = await ApiHelpers.getPositionAccount('dfsp_dup', 'USD')
      const [positionMessage] = await prepareWithoutPositionProcessing(buildPayments('dfsp_dup', [transferId], '100.00'))

      // Each batch has its own database transaction. The second waits on the payer's position lock
      // until the first commits, then must see the RESERVED state and skip the message. If it read
      // the state before the lock it would act on RECEIVED_PREPARE: MySQL 8.0 would reserve again,
      // and MariaDB (the harness) fails the batch, which Kafka would then redeliver.
      const failedBatchesStart = await countFailedBatches()
      const mark = harness.redpandaMark()
      await Promise.all([
        PositionBatchHandler.positions(null, toBatch([positionMessage])),
        PositionBatchHandler.positions(null, toBatch([positionMessage]))
      ])
      await harness.redpandaDrain(mark, 1)

      assert.equal(await countFailedBatches(), failedBatchesStart, 'neither batch failed')
      assert.deepEqual(errorCodesOf(harness.spoolLastPayload(1)), [], 'no error sent to the payer')
      await assertReservedOnce(transferId)
      await assertPayerPositionMoved(positionStart, 100)
    })
  })
})
