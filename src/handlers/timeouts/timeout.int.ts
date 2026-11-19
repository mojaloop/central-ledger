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
 - Shashikant Hirugade <shirugade@mojaloop.io>

 --------------
 ******/

/**
 * Transfer timeouts, end to end: the real prepare handler, the real timeout sweep and the batch
 * position handler, against a real database and Kafka.
 *
 * Design: position-idempotency-timeout.md
 *   - Change A: a transfer (or fxTransfer) that expires before it is reserved is notified
 *   - Change B: a timeout-reserved (or fx-timeout-reserved) position message releases once, and a
 *     copy or a late message is a no-op that doesn't fail the batch
 *
 * The sweep expires every overdue transfer in the database, and the harness counts messages
 * exactly, so these tests have their own file: each test expires only the transfers it creates.
 * Transfers that must not expire are given a long expiry.
 */

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert'

import Harness, { MojaloopKafkaMessage } from '../../testing/harness'
import * as ApiHelpers from '../../testing/api-helpers'
import { assertPositionDiff, sleepSeconds } from '../../testing/util'
import { overrideForTesting } from '../../lib/config'
import Db from '../../lib/db'
import Metrics from '@mojaloop/central-services-metrics'
import { Enum } from '@mojaloop/central-services-shared'

import handlerAll from '../transfers/handler'
import handlerPrepare from '../transfers/prepare'
import PositionBatchHandler from '../positions/handlerBatch'
import TimeoutHandler from './handler'

const harness = Harness.getInstance()

const TOPIC_POSITION_BATCH = 'topic-transfer-position-batch'
// No position consumer is registered on this topic when the harness runs in BATCH mode.
const TOPIC_POSITION_UNCONSUMED = 'topic-transfer-position'
const TOPIC_NOTIFICATION = 'topic-notification-event'
const TOPIC_BULK_PROCESSING = 'topic-bulk-processing'

const PAYER = 'dfsp_to_payer'
const PAYEE = 'dfsp_to_payee'
const FX_PAYER = 'dfsp_to_fx'
const FXP = 'fxp_to'

// expiry(1) gives an expiration 5 seconds after the request (api-helpers); wait a little longer.
const EXPIRES_SOON = 1
const WAIT_FOR_EXPIRY_SECONDS = 7
// Long enough not to expire while this file runs.
const NEVER_EXPIRES = 10000

const buildPayment = (transferId: string, expirySeconds: number) => ApiHelpers.buildPayment()
  .deps(harness, handlerAll)
  .parties(PAYER, PAYEE)
  .transferId(transferId)
  .amount('100.00', 'USD')
  .expiry(expirySeconds)
  .build()

const buildForex = (commitRequestId: string, expirySeconds: number) => ApiHelpers.buildForex()
  .deps(harness, handlerAll)
  .commitRequestId(commitRequestId)
  .determiningTransferId(`${commitRequestId}9`)
  .parties(FX_PAYER, FXP)
  .amountSource('100.00', 'BWP')
  .amountTarget('10.00', 'USD')
  .expiry(expirySeconds)
  .build()

/** Points the given position actions at a topic with no consumer, runs fn, then points them back. */
const withPositionTopicUnconsumed = async <T>(topicMapKeys: Array<string>, fn: () => Promise<T>): Promise<T> => {
  const route = (topic: string) => overrideForTesting({
    KAFKA_CONFIG: { EVENT_TYPE_ACTION_TOPIC_MAP: { POSITION: Object.fromEntries(topicMapKeys.map(key => [key, topic])) } }
  } as any)
  route(TOPIC_POSITION_UNCONSUMED)
  try {
    return await fn()
  } finally {
    route(TOPIC_POSITION_BATCH)
  }
}

/**
 * Prepares with the real prepare handler, and returns the position message it produced, without
 * letting the registered batch consumer pick it up.
 */
const prepareWithoutPositionProcessing = (
  prepare: ApiHelpers.Payment | ApiHelpers.Forex,
  { topicMapKey, action }: { topicMapKey: 'PREPARE' | 'FX_PREPARE', action: string } = { topicMapKey: 'PREPARE', action: 'prepare' }
): Promise<MojaloopKafkaMessage> => withPositionTopicUnconsumed([topicMapKey], async () => {
  const mark = harness.redpandaMark()
  await handlerPrepare.prepare(null, [prepare.buildMessagePrepare()])
  await harness.redpandaDrain(mark, 1)
  const [positionMessage] = harness.spoolLast(1)
  assert.equal(positionMessage.topic, TOPIC_POSITION_UNCONSUMED)
  assert.equal(positionMessage.valueParsed.metadata.event.action, action)
  return positionMessage
})

const prepareFxWithoutPositionProcessing = (forex: ApiHelpers.Forex) =>
  prepareWithoutPositionProcessing(forex, { topicMapKey: 'FX_PREPARE', action: 'fx-prepare' })

/**
 * Runs the real timeout sweep, and returns the messages it produced. Its timeout-reserved and
 * fx-timeout-reserved position messages are not picked up by the batch consumer, so the test can
 * process them, and copies of them, as it chooses.
 */
const sweepWithoutPositionProcessing = (expectedMessages: number): Promise<Array<MojaloopKafkaMessage>> =>
  withPositionTopicUnconsumed(['TIMEOUT_RESERVED', 'FX_TIMEOUT_RESERVED'], async () => {
    const mark = harness.redpandaMark()
    await TimeoutHandler.timeout()
    await harness.redpandaDrain(mark, expectedMessages)
    if (expectedMessages === 0) {
      await assertNothingMoreProduced(mark)
      return []
    }
    return harness.spoolLast(expectedMessages)
  })

/** Waits a moment, then checks that no message was produced since the mark. */
const assertNothingMoreProduced = async (mark: number) => {
  await sleepSeconds(2)
  assert.equal(harness.redpandaMark(), mark, 'no message produced')
}

/**
 * Builds a batch as the batch consumer would deliver it. Each delivery gets its own copy of the
 * value, as from Kafka.
 */
const toBatch = (positionMessages: Array<MojaloopKafkaMessage>) => positionMessages.map(message => ({
  ...message,
  topic: TOPIC_POSITION_BATCH,
  value: structuredClone(message.valueParsed)
}))

/** Processes the position messages as a single batch, and returns the notifications it produced. */
const processAsOneBatch = async (positionMessages: Array<MojaloopKafkaMessage>, expectedNotifications: number): Promise<Array<MojaloopKafkaMessage>> => {
  const mark = harness.redpandaMark()
  await PositionBatchHandler.positions(null, toBatch(positionMessages))
  await harness.redpandaDrain(mark, expectedNotifications)
  if (expectedNotifications === 0) {
    await assertNothingMoreProduced(mark)
    return []
  }
  return harness.spoolLast(expectedNotifications)
}

const getStateHistory = async (transferId: string): Promise<Array<string>> => {
  const rows = await Db.getKnex()('transferStateChange').where({ transferId }).orderBy('transferStateChangeId', 'asc').select('transferStateId')
  return rows.map((row: { transferStateId: string }) => row.transferStateId)
}

const countPositionChanges = async (transferId: string): Promise<number> => {
  const [row] = await Db.getKnex()('participantPositionChange AS ppc')
    .join('transferStateChange AS tsc', 'tsc.transferStateChangeId', 'ppc.transferStateChangeId')
    .where('tsc.transferId', transferId)
    .count({ count: '*' })
  return Number(row.count)
}

const getFxStateHistory = async (commitRequestId: string): Promise<Array<string>> => {
  const rows = await Db.getKnex()('fxTransferStateChange').where({ commitRequestId }).orderBy('fxTransferStateChangeId', 'asc').select('transferStateId')
  return rows.map((row: { transferStateId: string }) => row.transferStateId)
}

const countFxPositionChanges = async (commitRequestId: string): Promise<number> => {
  const [row] = await Db.getKnex()('participantPositionChange AS ppc')
    .join('fxTransferStateChange AS ftsc', 'ftsc.fxTransferStateChangeId', 'ppc.fxTransferStateChangeId')
    .where('ftsc.commitRequestId', commitRequestId)
    .count({ count: '*' })
  return Number(row.count)
}

/** The number of batches the batch position handler has failed and rolled back. */
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

/** Prepares and reserves a transfer that expires soon, waits for it to expire, and sweeps it. */
const reserveAndExpire = async (transferId: string): Promise<MojaloopKafkaMessage> => {
  const prepareMessage = await prepareWithoutPositionProcessing(buildPayment(transferId, EXPIRES_SOON))
  await processAsOneBatch([prepareMessage], 1)
  await sleepSeconds(WAIT_FOR_EXPIRY_SECONDS)

  const [timeoutReservedMessage] = await sweepWithoutPositionProcessing(1)
  assert.equal(timeoutReservedMessage.topic, TOPIC_POSITION_UNCONSUMED)
  assert.equal(timeoutReservedMessage.valueParsed.metadata.event.action, 'timeout-reserved')
  assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RESERVED_TIMEOUT'])
  return timeoutReservedMessage
}

/**
 * Makes a prepared transfer an individual transfer of a bulk, as the bulk prepare handler would.
 * The bulk prepare path needs the bulk API adapter and its object store, which this harness doesn't
 * run, so the bulk rows are written directly.
 */
const associateWithBulk = async (transferId: string, bulkTransferId: string) => {
  const knex = Db.getKnex()
  const participantId = async (name: string) => (await knex('participant').where({ name }).first('participantId')).participantId
  await knex('bulkTransferDuplicateCheck').insert({ bulkTransferId, hash: `hash-${bulkTransferId}` })
  await knex('bulkTransfer').insert({
    bulkTransferId,
    payerParticipantId: await participantId(PAYER),
    payeeParticipantId: await participantId(PAYEE),
    expirationDate: new Date(Date.now() + 5000)
  })
  await knex('bulkTransferAssociation').insert({
    transferId,
    bulkTransferId,
    bulkProcessingStateId: Enum.Transfers.BulkProcessingState.RECEIVED
  })
}

const assertReleasedOnce = async (transferId: string) => {
  assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RESERVED_TIMEOUT', 'EXPIRED_RESERVED'], `${transferId}: one EXPIRED_RESERVED state change`)
  assert.equal(await countPositionChanges(transferId), 2, `${transferId}: a reservation and one release`)
}

describe('handlers/timeouts: transfer timeouts with the batch position handler', () => {
  before(async () => {
    await harness.up('BATCH')
    await harness.setupGlobals()

    // The prepare and fulfil handlers commit their kafka offsets, so their consumers must be connected.
    await handlerAll.registerPrepareHandler()
    await handlerAll.registerFulfilHandler()

    await ApiHelpers.createHub(harness, {
      currencies: ['USD', 'BWP'],
      settlementModels: ['USD', 'BWP'].map(currency => ({
        name: `DEFERRED_MULTILATERAL_NET_${currency}`,
        settlementGranularity: 'NET',
        settlementInterchange: 'MULTILATERAL',
        settlementDelay: 'DEFERRED',
        currency,
        requireLiquidityCheck: true,
        ledgerAccountType: 'POSITION',
        settlementAccountType: 'SETTLEMENT',
        autoPositionReset: true
      }))
    })
    for (const name of [PAYER, PAYEE]) {
      await ApiHelpers.createDfsp(harness, {
        name,
        currencies: ['USD'],
        isProxy: false,
        initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
        deposits: [10000]
      })
    }
    await ApiHelpers.createDfsp(harness, {
      name: FX_PAYER,
      currencies: ['BWP'],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
      deposits: [10000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: FXP,
      currencies: ['BWP', 'USD'],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }, { initialPosition: 0, value: 100000 }],
      deposits: [10000, 10000]
    })
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  describe('Change A: a transfer that expires before it is reserved', () => {
    it('notifies the payer once, and the late prepare position message changes nothing.', async () => {
      const transferId = '7000001'
      const positionStart = await ApiHelpers.getPositionAccount(PAYER, 'USD')
      const prepareMessage = await prepareWithoutPositionProcessing(buildPayment(transferId, EXPIRES_SOON))
      await sleepSeconds(WAIT_FOR_EXPIRY_SECONDS)

      const [notification] = await sweepWithoutPositionProcessing(1)
      assert.equal(notification.topic, TOPIC_NOTIFICATION, 'sent as a notification')
      assert.equal(notification.valueParsed.metadata.event.action, 'timeout-received')
      assert.equal(notification.valueParsed.to, PAYER, 'to the payer')
      assert.equal(notification.valueParsed.content.payload.errorInformation.errorCode, '3303', 'transfer expired')
      assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'EXPIRED_PREPARED'])

      await sweepWithoutPositionProcessing(0)

      await processAsOneBatch([prepareMessage], 0)
      assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'EXPIRED_PREPARED'], 'not reserved, not relabelled')
      assert.equal(await countPositionChanges(transferId), 0, 'no position change')
      assertPositionDiff('payer', positionStart, await ApiHelpers.getPositionAccount(PAYER, 'USD'), { posted: 0 })
    })

    it('sends bulk-timeout-received once for an individual transfer of a bulk.', async () => {
      const [transferId, bulkTransferId] = ['7000041', 'bulk-7000041']
      await prepareWithoutPositionProcessing(buildPayment(transferId, EXPIRES_SOON))
      await associateWithBulk(transferId, bulkTransferId)
      await sleepSeconds(WAIT_FOR_EXPIRY_SECONDS)

      const [notification] = await sweepWithoutPositionProcessing(1)
      assert.equal(notification.topic, TOPIC_BULK_PROCESSING, 'sent to the bulk processing handler')
      assert.equal(notification.valueParsed.metadata.event.type, 'bulk-processing')
      assert.equal(notification.valueParsed.metadata.event.action, 'bulk-timeout-received')
      assert.equal(notification.valueParsed.to, PAYER, 'to the payer')
      assert.equal(notification.valueParsed.content.payload.errorInformation.errorCode, '3303', 'transfer expired')
      assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'EXPIRED_PREPARED'])
      assert.equal(await countPositionChanges(transferId), 0, 'no position change')

      await sweepWithoutPositionProcessing(0)
    })

    it('notifies the initiating FSP of an fxTransfer once, and the late fx-prepare position message changes nothing.', async () => {
      const commitRequestId = '7100001'
      const positionStart = await ApiHelpers.getPositionAccount(FX_PAYER, 'BWP')
      const fxPrepareMessage = await prepareFxWithoutPositionProcessing(buildForex(commitRequestId, EXPIRES_SOON))
      await sleepSeconds(WAIT_FOR_EXPIRY_SECONDS)

      const [notification] = await sweepWithoutPositionProcessing(1)
      assert.equal(notification.topic, TOPIC_NOTIFICATION, 'sent as a notification')
      assert.equal(notification.valueParsed.metadata.event.action, 'fx-timeout-received')
      assert.equal(notification.valueParsed.to, FX_PAYER, 'to the initiating FSP')
      assert.deepEqual(await getFxStateHistory(commitRequestId), ['RECEIVED_PREPARE', 'EXPIRED_PREPARED'])

      await sweepWithoutPositionProcessing(0)

      await processAsOneBatch([fxPrepareMessage], 0)
      assert.deepEqual(await getFxStateHistory(commitRequestId), ['RECEIVED_PREPARE', 'EXPIRED_PREPARED'], 'not reserved, not relabelled')
      assert.equal(await countFxPositionChanges(commitRequestId), 0, 'no position change')
      assertPositionDiff('payer', positionStart, await ApiHelpers.getPositionAccount(FX_PAYER, 'BWP'), { posted: 0 })
    })
  })

  describe('Change B: duplicate and late timeout-reserved position messages', () => {
    it('releases the payer once for two copies in one batch, and a replay next to another prepare changes nothing.', async () => {
      const [transferId, otherTransferId, laterTransferId] = ['7000011', '7000012', '7000013']
      const positionStart = await ApiHelpers.getPositionAccount(PAYER, 'USD')
      const timeoutReservedMessage = await reserveAndExpire(transferId)

      // Two copies of the timeout message, next to another transfer's prepare. The copy sends nothing.
      const otherPrepareMessage = await prepareWithoutPositionProcessing(buildPayment(otherTransferId, NEVER_EXPIRES))
      await processAsOneBatch([timeoutReservedMessage, timeoutReservedMessage, otherPrepareMessage], 2)

      await assertReleasedOnce(transferId)
      assert.deepEqual(await getStateHistory(otherTransferId), ['RECEIVED_PREPARE', 'RESERVED'], 'the other transfer is reserved')

      // A replay after the release, in a batch with another prepare: the batch is not lost.
      const failedBatchesStart = await countFailedBatches()
      const laterPrepareMessage = await prepareWithoutPositionProcessing(buildPayment(laterTransferId, NEVER_EXPIRES))
      await processAsOneBatch([timeoutReservedMessage, laterPrepareMessage], 1)

      assert.equal(await countFailedBatches(), failedBatchesStart, 'the batch did not fail')
      await assertReleasedOnce(transferId)
      assert.deepEqual(await getStateHistory(laterTransferId), ['RECEIVED_PREPARE', 'RESERVED'], 'the later transfer is reserved')
      assertPositionDiff('payer', positionStart, await ApiHelpers.getPositionAccount(PAYER, 'USD'), { posted: 200 })
    })

    it('releases the payer once when two batches with the same timeout-reserved run at the same time.', async () => {
      const transferId = '7000021'
      const positionStart = await ApiHelpers.getPositionAccount(PAYER, 'USD')
      const timeoutReservedMessage = await reserveAndExpire(transferId)

      // The second batch waits on the payer's position lock, then reads EXPIRED_RESERVED: it must skip
      // the message rather than throw and fail the batch.
      const failedBatchesStart = await countFailedBatches()
      const mark = harness.redpandaMark()
      await Promise.all([
        PositionBatchHandler.positions(null, toBatch([timeoutReservedMessage])),
        PositionBatchHandler.positions(null, toBatch([timeoutReservedMessage]))
      ])
      await harness.redpandaDrain(mark, 1)
      await assertNothingMoreProduced(mark + 1)

      assert.equal(await countFailedBatches(), failedBatchesStart, 'neither batch failed')
      await assertReleasedOnce(transferId)
      assertPositionDiff('payer', positionStart, await ApiHelpers.getPositionAccount(PAYER, 'USD'), { posted: 0 })
    })

    it('changes nothing when a fulfil was written after the sweep, and the rest of the batch is processed.', async () => {
      const [transferId, otherTransferId] = ['7000031', '7000032']
      const positionStart = await ApiHelpers.getPositionAccount(PAYER, 'USD')
      const timeoutReservedMessage = await reserveAndExpire(transferId)

      // The payee's fulfil was accepted just after the sweep read RESERVED: its RECEIVED_FULFIL is the
      // latest state, and its commit message completes the transfer.
      await Db.getKnex()('transferStateChange').insert({ transferId, transferStateId: 'RECEIVED_FULFIL', reason: 'fulfil written after the timeout sweep' })

      const failedBatchesStart = await countFailedBatches()
      const otherPrepareMessage = await prepareWithoutPositionProcessing(buildPayment(otherTransferId, NEVER_EXPIRES))
      await processAsOneBatch([timeoutReservedMessage, otherPrepareMessage], 1)

      assert.equal(await countFailedBatches(), failedBatchesStart, 'the batch did not fail')
      assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RESERVED_TIMEOUT', 'RECEIVED_FULFIL'], 'not released')
      assert.equal(await countPositionChanges(transferId), 1, 'only the reservation')
      assert.deepEqual(await getStateHistory(otherTransferId), ['RECEIVED_PREPARE', 'RESERVED'], 'the other transfer is reserved')
      assertPositionDiff('payer', positionStart, await ApiHelpers.getPositionAccount(PAYER, 'USD'), { posted: 200 })
    })

    it('releases an fxTransfer once for two copies of fx-timeout-reserved in one batch, and a replay changes nothing.', async () => {
      const commitRequestId = '7100011'
      const positionStart = await ApiHelpers.getPositionAccount(FX_PAYER, 'BWP')
      const fxPrepareMessage = await prepareFxWithoutPositionProcessing(buildForex(commitRequestId, EXPIRES_SOON))
      await processAsOneBatch([fxPrepareMessage], 1)
      await sleepSeconds(WAIT_FOR_EXPIRY_SECONDS)

      const [fxTimeoutReservedMessage] = await sweepWithoutPositionProcessing(1)
      assert.equal(fxTimeoutReservedMessage.topic, TOPIC_POSITION_UNCONSUMED)
      assert.equal(fxTimeoutReservedMessage.valueParsed.metadata.event.action, 'fx-timeout-reserved')

      await processAsOneBatch([fxTimeoutReservedMessage, fxTimeoutReservedMessage], 1)

      const releasedOnce = ['RECEIVED_PREPARE', 'RESERVED', 'RESERVED_TIMEOUT', 'EXPIRED_RESERVED']
      assert.deepEqual(await getFxStateHistory(commitRequestId), releasedOnce, 'one EXPIRED_RESERVED state change')
      assert.equal(await countFxPositionChanges(commitRequestId), 2, 'a reservation and one release')

      const failedBatchesStart = await countFailedBatches()
      await processAsOneBatch([fxTimeoutReservedMessage], 0)

      assert.equal(await countFailedBatches(), failedBatchesStart, 'the replay did not fail its batch')
      assert.deepEqual(await getFxStateHistory(commitRequestId), releasedOnce)
      assert.equal(await countFxPositionChanges(commitRequestId), 2)
      assertPositionDiff('payer', positionStart, await ApiHelpers.getPositionAccount(FX_PAYER, 'BWP'), { posted: 0 })
    })
  })
})
