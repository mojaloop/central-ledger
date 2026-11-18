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
 * Prepares the given transfers (or fxTransfers) with the real prepare handler, and returns the
 * position messages it produced, without letting the registered batch consumer pick them up.
 *
 * The prepare handler publishes to EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.PREPARE (FX_PREPARE for an
 * fxTransfer). While these are prepared, that is pointed at a topic with no position consumer, so
 * the test can then process all of the position messages as one batch.
 */
const prepareWithoutPositionProcessing = async (
  prepares: Array<ApiHelpers.Payment | ApiHelpers.Forex>,
  { topicMapKey, action }: { topicMapKey: 'PREPARE' | 'FX_PREPARE', action: string } = { topicMapKey: 'PREPARE', action: 'prepare' }
): Promise<Array<MojaloopKafkaMessage>> => {
  overrideForTesting({
    KAFKA_CONFIG: { EVENT_TYPE_ACTION_TOPIC_MAP: { POSITION: { [topicMapKey]: TOPIC_POSITION_UNCONSUMED } } }
  } as any)

  try {
    const positionMessages: Array<MojaloopKafkaMessage> = []
    for (const prepare of prepares) {
      const mark = harness.redpandaMark()
      await handlerPrepare.prepare(null, [prepare.buildMessagePrepare()])
      await harness.redpandaDrain(mark, 1)

      const [positionMessage] = harness.spoolLast(1)
      assert.equal(positionMessage.topic, TOPIC_POSITION_UNCONSUMED)
      assert.equal(positionMessage.valueParsed.metadata.event.action, action)
      positionMessages.push(positionMessage)
    }
    return positionMessages
  } finally {
    overrideForTesting({
      KAFKA_CONFIG: { EVENT_TYPE_ACTION_TOPIC_MAP: { POSITION: { [topicMapKey]: TOPIC_POSITION_BATCH } } }
    } as any)
  }
}

const prepareFxWithoutPositionProcessing = (forexes: Array<ApiHelpers.Forex>) =>
  prepareWithoutPositionProcessing(forexes, { topicMapKey: 'FX_PREPARE', action: 'fx-prepare' })

/**
 * Sends the given fulfil or error callbacks to the real fulfil handler, and returns the position
 * messages it produced, without letting the registered batch consumer pick them up. Works like
 * prepareWithoutPositionProcessing, for EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.COMMIT, .RESERVE or .ABORT.
 */
const fulfilWithoutPositionProcessing = async (
  fulfilMessages: Array<any>,
  { topicMapKey, action }: { topicMapKey: 'COMMIT' | 'RESERVE' | 'ABORT' | 'FX_ABORT', action: string }
): Promise<Array<MojaloopKafkaMessage>> => {
  overrideForTesting({
    KAFKA_CONFIG: { EVENT_TYPE_ACTION_TOPIC_MAP: { POSITION: { [topicMapKey]: TOPIC_POSITION_UNCONSUMED } } }
  } as any)

  try {
    const positionMessages: Array<MojaloopKafkaMessage> = []
    for (const fulfilMessage of fulfilMessages) {
      const mark = harness.redpandaMark()
      await handlerAll.fulfil(null, [fulfilMessage])
      await harness.redpandaDrain(mark, 1)

      const [positionMessage] = harness.spoolLast(1)
      assert.equal(positionMessage.topic, TOPIC_POSITION_UNCONSUMED)
      assert.equal(positionMessage.valueParsed.metadata.event.action, action)
      positionMessages.push(positionMessage)
    }
    return positionMessages
  } finally {
    overrideForTesting({
      KAFKA_CONFIG: { EVENT_TYPE_ACTION_TOPIC_MAP: { POSITION: { [topicMapKey]: TOPIC_POSITION_BATCH } } }
    } as any)
  }
}

/** Prepares and reserves the payments, processing their prepare position messages as one batch. */
const prepareAndReserve = async (payments: Array<ApiHelpers.Payment>) => {
  await processAsOneBatch(await prepareWithoutPositionProcessing(payments))
}

/** A fulfil whose fulfilment doesn't match the condition, so the fulfil handler sends ABORT_VALIDATION. */
const buildInvalidFulfilMessage = (payerFsp: string, transferId: string, amount: string) => {
  const putTransfer = ApiHelpers.buildMojaloopPutTransfer({
    payerFsp,
    payeeFsp: 'dfsp_b',
    transferId,
    amountComplex: { amount, currency: 'KES' }, // a different currency gives a different fulfilment
    date: new Date(),
    expirySeconds: 100,
    transferState: 'COMMITTED'
  })
  return ApiHelpers.buildMessageFulfil(harness, putTransfer, transferId)
}

const assertCommittedOnce = async (transferId: string) => {
  assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_FULFIL', 'COMMITTED'], `${transferId}: one COMMITTED state change`)
  assert.equal(await countPositionChanges(transferId), 2, `${transferId}: a reservation and one commit`)
}

const assertAbortedOnce = async (transferId: string) => {
  assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_ERROR', 'ABORTED_ERROR'], `${transferId}: one ABORTED_ERROR state change`)
  assert.equal(await countPositionChanges(transferId), 2, `${transferId}: a reservation and one release`)
}

const assertPayeePositionMoved = async (positionStart: any, posted: number) => {
  const positionEnd = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
  assertPositionDiff('payee', positionStart, positionEnd, { posted })
}

// FX fulfil-side tests: a payer DFSP, an FXP and a payee DFSP, each with BWP and USD accounts.
const FX_PAYER = 'dfsp_fxc_payer'
const FX_FXP = 'fxp_fxc'
const FX_PAYEE = 'dfsp_fxc_payee'

/** Reads the positions the FX tests check, so a test can compare them before and after. */
const getFxPositions = async () => ({
  payerBwp: await ApiHelpers.getPositionAccount(FX_PAYER, 'BWP'),
  fxpBwp: await ApiHelpers.getPositionAccount(FX_FXP, 'BWP'),
  fxpUsd: await ApiHelpers.getPositionAccount(FX_FXP, 'USD'),
  payeeUsd: await ApiHelpers.getPositionAccount(FX_PAYEE, 'USD')
})

/** Checks how much each account's posted position moved; the label only names the account in a failure. */
const assertFxPositionsMoved = async (start: Awaited<ReturnType<typeof getFxPositions>>, posted: { payerBwp: number, fxpBwp: number, fxpUsd: number, payeeUsd: number }) => {
  const end = await getFxPositions()
  for (const account of ['payerBwp', 'fxpBwp', 'fxpUsd', 'payeeUsd'] as const) {
    assert.equal(Number(end[account].value) - Number(start[account].value), posted[account], `${account} posted change`)
  }
}

/**
 * A payer-side conversion (FX_PAYER converts 100 BWP into 10 USD with FX_FXP), fulfilled by the FXP,
 * then its determining transfer of 10 USD from FX_FXP to FX_PAYEE, prepared. Reserves FX_PAYER's
 * 100 BWP (conversion) and FX_FXP's 10 USD (transfer).
 */
const buildPayerSideFxPayment = (transferId: string, commitRequestId: string) => ({
  forex: ApiHelpers.buildForex()
    .deps(harness, handlerAll)
    .commitRequestId(commitRequestId)
    .determiningTransferId(transferId)
    .parties(FX_PAYER, FX_FXP)
    .amountSource('100.00', 'BWP')
    .amountTarget('10.00', 'USD')
    .build(),
  payment: ApiHelpers.buildPayment()
    .deps(harness, handlerAll)
    .parties(FX_FXP, FX_PAYEE)
    .transferId(transferId)
    .amount('10.00', 'USD')
    .fx()
    .build()
})

const preparePayerSideFxPayment = async (transferId: string, commitRequestId: string) => {
  const { forex, payment } = buildPayerSideFxPayment(transferId, commitRequestId)
  await forex.prepare()
  await forex.fulfil()
  await payment.prepare()
  return { forex, payment }
}

/**
 * A transfer of 100 BWP from FX_PAYER to FX_PAYEE, then a payee-side conversion: FX_PAYEE asks FX_FXP to
 * convert the 100 BWP into 10 USD. Reserves FX_PAYER's 100 BWP (transfer) and FX_FXP's 10 USD (conversion).
 */
const preparePayeeSideFxPayment = async (transferId: string, commitRequestId: string) => {
  const payment = ApiHelpers.buildPayment()
    .deps(harness, handlerAll)
    .parties(FX_PAYER, FX_PAYEE)
    .transferId(transferId)
    .amount('100.00', 'BWP')
    .build()
  await payment.prepare()

  const forex = ApiHelpers.buildForex()
    .deps(harness, handlerAll)
    .commitRequestId(commitRequestId)
    .determiningTransferId(transferId)
    .parties(FX_PAYEE, FX_FXP)
    .amountSource('100.00', 'BWP')
    .amountTarget('10.00', 'USD')
    .build()
  await forex.prepare()
  return { payment, forex }
}

const buildFxAbortMessage = (initiatingFsp: string, commitRequestId: string) => ApiHelpers.buildMessageAbortFx(
  harness,
  ApiHelpers.buildMojaloopAbortFxTransfer({ initiatingFsp, counterPartyFsp: FX_FXP, date: new Date() }),
  commitRequestId
)

/**
 * Builds a batch as the batch consumer would deliver it (parsed JSON value, same key). The topic
 * is set to the batch topic so the offset commit uses the registered batch consumer.
 * Each delivery gets its own copy of the value, as from Kafka: abort processing marks steps done in place.
 */
const toBatch = (positionMessages: Array<MojaloopKafkaMessage>) => positionMessages.map(message => ({
  ...message,
  topic: TOPIC_POSITION_BATCH,
  value: structuredClone(message.valueParsed)
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

/** The fxTransfer's state history, oldest first. */
const getFxStateHistory = async (commitRequestId: string): Promise<Array<string>> => {
  const rows = await Db.getKnex()('fxTransferStateChange')
    .where({ commitRequestId })
    .orderBy('fxTransferStateChangeId', 'asc')
    .select('transferStateId')
  return rows.map((row: { transferStateId: string }) => row.transferStateId)
}

/** The number of position changes recorded against the fxTransfer. */
const countFxPositionChanges = async (commitRequestId: string): Promise<number> => {
  const [row] = await Db.getKnex()('participantPositionChange AS ppc')
    .join('fxTransferStateChange AS ftsc', 'ftsc.fxTransferStateChangeId', 'ppc.fxTransferStateChangeId')
    .where('ftsc.commitRequestId', commitRequestId)
    .count({ count: '*' })
  return Number(row.count)
}

/** Checks that the fxTransfer was reserved exactly once: one RESERVED state change and one position change. */
const assertFxReservedOnce = async (commitRequestId: string) => {
  assert.deepEqual(await getFxStateHistory(commitRequestId), ['RECEIVED_PREPARE', 'RESERVED'], `${commitRequestId}: one RESERVED state change`)
  assert.equal(await countFxPositionChanges(commitRequestId), 1, `${commitRequestId}: one position change`)
}

const assertFxPayerPositionMoved = async (positionStart: any, posted: number) => {
  const positionEnd = await ApiHelpers.getPositionAccount('dfsp_fx', 'BWP')
  assertPositionDiff('payer', positionStart, positionEnd, { posted })
}

/** Payer-side conversions of 100 BWP to 10 USD from dfsp_fx with fxp_dup; dfsp_fx's BWP account is reserved. */
const buildForexes = (commitRequestIds: Array<string>) =>
  commitRequestIds.map(commitRequestId => ApiHelpers.buildForex()
    .deps(harness, handlerAll)
    .commitRequestId(commitRequestId)
    .determiningTransferId(`${commitRequestId}9`)
    .parties('dfsp_fx', 'fxp_dup')
    .amountSource('100.00', 'BWP')
    .amountTarget('10.00', 'USD')
    .build())

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

    // The prepare and fulfil handlers commit their kafka offsets, so their consumers must be connected.
    await handlerAll.registerPrepareHandler()
    await handlerAll.registerFulfilHandler()

    await ApiHelpers.createHub(harness, {
      currencies: ['USD', 'BWP'],
      settlementModels: ['USD', 'BWP'].map(currency => ({
        name: `DEFERRED_MULTILATERAL_NET_${currency}`,
        settlementGranularity: "NET",
        settlementInterchange: "MULTILATERAL",
        settlementDelay: "DEFERRED",
        currency,
        requireLiquidityCheck: true,
        ledgerAccountType: "POSITION",
        settlementAccountType: "SETTLEMENT",
        autoPositionReset: true
      }))
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
    // For the FX fulfil-side tests: a payer DFSP, an FXP and a payee DFSP, each with BWP and USD.
    for (const name of [FX_PAYER, FX_FXP, FX_PAYEE]) {
      await ApiHelpers.createDfsp(harness, {
        name,
        currencies: ['BWP', 'USD'],
        isProxy: false,
        initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }, { initialPosition: 0, value: 100000 }],
        deposits: [10000, 10000]
      })
    }
    // For the duplicate FX prepare tests: the payer of a payer-side conversion, and the FXP.
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_fx',
      currencies: ['BWP'],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
      deposits: [10000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'fxp_dup',
      currencies: ['BWP', 'USD'],
      isProxy: false,
      initialPostionsAndLimits: [
        { initialPosition: 0, value: 100000 },
        { initialPosition: 0, value: 100000 }
      ],
      deposits: [10000, 10000]
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

  describe('duplicate fx prepare position messages', () => {
    it('reserves once when two copies are in one batch, without affecting another fx transfer.', async () => {
      const [commitRequestId, otherCommitRequestId] = ['3100021', '3100022']
      const positionStart = await ApiHelpers.getPositionAccount('dfsp_fx', 'BWP')
      const [positionMessage, otherPositionMessage] = await prepareFxWithoutPositionProcessing(
        buildForexes([commitRequestId, otherCommitRequestId])
      )

      // The duplicate copy produces no notification; each fx prepare is forwarded to the FXP.
      const notifications = await processAsOneBatch([positionMessage, positionMessage, otherPositionMessage], 2)

      assert.deepEqual(errorCodesOf(notifications), [], 'no error sent to the payer')
      await assertFxReservedOnce(commitRequestId)
      await assertFxReservedOnce(otherCommitRequestId)
      await assertFxPayerPositionMoved(positionStart, 200)
    })

    it('reserves once, without relabelling the fx transfer, when two batches with the same message run at the same time.', async () => {
      const commitRequestId = '3100041'
      const positionStart = await ApiHelpers.getPositionAccount('dfsp_fx', 'BWP')
      const [positionMessage] = await prepareFxWithoutPositionProcessing(buildForexes([commitRequestId]))

      // The second batch waits on the payer's position lock, then reads RESERVED. It must skip the
      // message, not mark the fx transfer ABORTED_REJECTED and send the payer an error.
      const failedBatchesStart = await countFailedBatches()
      const mark = harness.redpandaMark()
      await Promise.all([
        PositionBatchHandler.positions(null, toBatch([positionMessage])),
        PositionBatchHandler.positions(null, toBatch([positionMessage]))
      ])
      await harness.redpandaDrain(mark, 1)

      assert.equal(await countFailedBatches(), failedBatchesStart, 'neither batch failed')
      assert.deepEqual(errorCodesOf(harness.spoolLastPayload(1)), [], 'no error sent to the payer')
      await assertFxReservedOnce(commitRequestId)
      await assertFxPayerPositionMoved(positionStart, 100)
    })
  })

  describe('duplicate commit and reserve position messages', () => {
    it('credits the payee once when two copies of a commit are in one batch, without affecting another transfer.', async () => {
      const [transferId, otherTransferId] = ['3000101', '3000102']
      const payments = buildPayments('dfsp_dup', [transferId, otherTransferId], '100.00')
      await prepareAndReserve(payments)
      const payeeStart = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
      const [commitMessage, otherCommitMessage] = await fulfilWithoutPositionProcessing(
        payments.map(payment => payment.buildMessageFulfil('COMMITTED')),
        { topicMapKey: 'COMMIT', action: 'commit' }
      )

      // The duplicate copy produces no notification; each transfer's fulfil is forwarded to the payer.
      const notifications = await processAsOneBatch([commitMessage, commitMessage, otherCommitMessage], 2)

      assert.deepEqual(errorCodesOf(notifications), [], 'no error sent to the payee')
      await assertCommittedOnce(transferId)
      await assertCommittedOnce(otherTransferId)
      await assertPayeePositionMoved(payeeStart, -200)
    })

    it('does nothing, and sends the payee no error, when a commit is replayed after the first was committed.', async () => {
      const transferId = '3000111'
      const payments = buildPayments('dfsp_dup', [transferId], '100.00')
      await prepareAndReserve(payments)
      const payeeStart = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
      const [commitMessage] = await fulfilWithoutPositionProcessing(
        [payments[0].buildMessageFulfil('COMMITTED')],
        { topicMapKey: 'COMMIT', action: 'commit' }
      )

      await processAsOneBatch([commitMessage], 1)
      const notifications = await processAsOneBatch([commitMessage], 0)

      assert.deepEqual(notifications, [], 'the replay sends nothing')
      await assertCommittedOnce(transferId)
      await assertPayeePositionMoved(payeeStart, -100)
    })

    it('credits the payee once when two batches with the same commit run at the same time.', async () => {
      const transferId = '3000121'
      const payments = buildPayments('dfsp_dup', [transferId], '100.00')
      await prepareAndReserve(payments)
      const payeeStart = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
      const [commitMessage] = await fulfilWithoutPositionProcessing(
        [payments[0].buildMessageFulfil('COMMITTED')],
        { topicMapKey: 'COMMIT', action: 'commit' }
      )

      // The second batch waits on the payee's position lock, then reads COMMITTED and skips the message.
      const failedBatchesStart = await countFailedBatches()
      const mark = harness.redpandaMark()
      await Promise.all([
        PositionBatchHandler.positions(null, toBatch([commitMessage])),
        PositionBatchHandler.positions(null, toBatch([commitMessage]))
      ])
      await harness.redpandaDrain(mark, 1)

      assert.equal(await countFailedBatches(), failedBatchesStart, 'neither batch failed')
      assert.deepEqual(errorCodesOf(harness.spoolLastPayload(1)), [], 'no error sent to the payee')
      await assertCommittedOnce(transferId)
      await assertPayeePositionMoved(payeeStart, -100)
    })

    it('credits the payee once when two copies of a reserve are in one batch.', async () => {
      const transferId = '3000131'
      const payments = buildPayments('dfsp_dup', [transferId], '100.00')
      await prepareAndReserve(payments)
      const payeeStart = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
      // ml-api-adapter sends a fulfil with transferState RESERVED as action RESERVE.
      const reserveFulfilMessage = payments[0].buildMessageFulfil('RESERVED')
      ;(reserveFulfilMessage.value.metadata.event as { action: string }).action = 'reserve'
      const [reserveMessage] = await fulfilWithoutPositionProcessing(
        [reserveFulfilMessage],
        { topicMapKey: 'RESERVE', action: 'reserve' }
      )

      const notifications = await processAsOneBatch([reserveMessage, reserveMessage], 1)

      assert.deepEqual(errorCodesOf(notifications), [], 'no error sent to the payee')
      await assertCommittedOnce(transferId)
      await assertPayeePositionMoved(payeeStart, -100)
    })
  })

  describe('duplicate abort position messages', () => {
    it('releases the payer once when two copies of an abort are in one batch.', async () => {
      const transferId = '3000201'
      const payments = buildPayments('dfsp_dup', [transferId], '100.00')
      const payerStart = await ApiHelpers.getPositionAccount('dfsp_dup', 'USD')
      await prepareAndReserve(payments)
      const [abortMessage] = await fulfilWithoutPositionProcessing(
        [payments[0].buildMessageAbort()],
        { topicMapKey: 'ABORT', action: 'abort' }
      )

      await processAsOneBatch([abortMessage, abortMessage], 1)

      await assertAbortedOnce(transferId)
      await assertPayerPositionMoved(payerStart, 0)
    })

    it('does nothing when an abort is replayed after the first was committed, and the rest of the batch is processed.', async () => {
      const [transferId, otherTransferId] = ['3000211', '3000212']
      const [payment, otherPayment] = buildPayments('dfsp_dup', [transferId, otherTransferId], '100.00')
      const payerStart = await ApiHelpers.getPositionAccount('dfsp_dup', 'USD')
      await prepareAndReserve([payment])
      const [abortMessage] = await fulfilWithoutPositionProcessing(
        [payment.buildMessageAbort()],
        { topicMapKey: 'ABORT', action: 'abort' }
      )
      await processAsOneBatch([abortMessage], 1)
      const [otherPrepareMessage] = await prepareWithoutPositionProcessing([otherPayment])

      // The replayed abort used to throw and fail the batch, losing the other transfer's prepare.
      const failedBatchesStart = await countFailedBatches()
      const notifications = await processAsOneBatch([abortMessage, otherPrepareMessage], 1)

      assert.equal(await countFailedBatches(), failedBatchesStart, 'the batch did not fail')
      assert.deepEqual(errorCodesOf(notifications), [], 'only the other prepare, forwarded to the payee')
      await assertAbortedOnce(transferId)
      await assertReservedOnce(otherTransferId)
      await assertPayerPositionMoved(payerStart, 100)
    })

    it('releases the payer once when two batches with the same abort run at the same time.', async () => {
      const transferId = '3000221'
      const payments = buildPayments('dfsp_dup', [transferId], '100.00')
      const payerStart = await ApiHelpers.getPositionAccount('dfsp_dup', 'USD')
      await prepareAndReserve(payments)
      const [abortMessage] = await fulfilWithoutPositionProcessing(
        [payments[0].buildMessageAbort()],
        { topicMapKey: 'ABORT', action: 'abort' }
      )

      // The second batch waits on the payer's position lock, then reads ABORTED_ERROR and skips the message.
      const failedBatchesStart = await countFailedBatches()
      const mark = harness.redpandaMark()
      await Promise.all([
        PositionBatchHandler.positions(null, toBatch([abortMessage])),
        PositionBatchHandler.positions(null, toBatch([abortMessage]))
      ])
      await harness.redpandaDrain(mark, 1)

      assert.equal(await countFailedBatches(), failedBatchesStart, 'neither batch failed')
      await assertAbortedOnce(transferId)
      await assertPayerPositionMoved(payerStart, 0)
    })

    it('does nothing when an abort-validation is replayed after the first was committed.', async () => {
      const transferId = '3000231'
      const payments = buildPayments('dfsp_dup', [transferId], '100.00')
      const payerStart = await ApiHelpers.getPositionAccount('dfsp_dup', 'USD')
      await prepareAndReserve(payments)
      const [abortValidationMessage] = await fulfilWithoutPositionProcessing(
        [buildInvalidFulfilMessage('dfsp_dup', transferId, '100.00')],
        { topicMapKey: 'ABORT', action: 'abort-validation' }
      )

      await processAsOneBatch([abortValidationMessage], 1)
      const failedBatchesStart = await countFailedBatches()
      const notifications = await processAsOneBatch([abortValidationMessage], 0)

      assert.equal(await countFailedBatches(), failedBatchesStart, 'the replay did not fail the batch')
      assert.deepEqual(notifications, [], 'the replay sends nothing')
      await assertAbortedOnce(transferId)
      await assertPayerPositionMoved(payerStart, 0)
    })
  })

  describe('FX commit and abort chains', () => {
    // Before the FX fulfil-side change, a payee-side conversion could complete in neither direction:
    // see position-idempotency-duplicate-fx-prepare.md §12.6 (F1, F2).
    it('F1: the FXP aborts a payee-side conversion; both reservations are released and no batch fails.', async () => {
      const [transferId, commitRequestId] = ['3300011', '3300012']
      const start = await getFxPositions()
      await preparePayeeSideFxPayment(transferId, commitRequestId)
      const failedBatchesStart = await countFailedBatches()

      // Steps: [conversion: release the FXP's USD] then [transfer: release the payer's BWP]. The FX_ABORT
      // position message, the follow-up for step 2, then one notification for each part.
      const mark = harness.redpandaMark()
      await handlerAll.fulfil(null, buildFxAbortMessage(FX_PAYEE, commitRequestId))
      await harness.redpandaDrain(mark, 4)

      assert.equal(await countFailedBatches(), failedBatchesStart, 'no batch failed')
      assert.deepEqual((await getFxStateHistory(commitRequestId)).slice(-1), ['ABORTED_ERROR'])
      assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'ABORTED_ERROR'], 'the transfer released')
      await assertFxPositionsMoved(start, { payerBwp: 0, fxpBwp: 0, fxpUsd: 0, payeeUsd: 0 })
    })

    it('F2: the payee fulfils a transfer with a payee-side conversion; the FXP is credited and the payee gets no error.', async () => {
      const [transferId, commitRequestId] = ['3300021', '3300022']
      const start = await getFxPositions()
      const { payment, forex } = await preparePayeeSideFxPayment(transferId, commitRequestId)
      await forex.fulfil()

      // Steps: [transfer: credit the payee's USD] then [conversion: credit the FXP's BWP]. The COMMIT
      // position message, the follow-up for step 2, then the result.
      const mark = harness.redpandaMark()
      await handlerAll.fulfil(null, payment.buildMessageFulfil('COMMITTED'))
      await harness.redpandaDrain(mark, 3)

      assert.deepEqual(errorCodesOf(harness.spoolLastPayload(1)), [], 'no error to the payee')
      assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_FULFIL', 'COMMITTED'])
      assert.deepEqual((await getFxStateHistory(commitRequestId)).slice(-1), ['COMMITTED'], 'the conversion committed')
      // The payer's 100 BWP is now owed to the FXP; the FXP's 10 USD went to the payee.
      await assertFxPositionsMoved(start, { payerBwp: 100, fxpBwp: -100, fxpUsd: 10, payeeUsd: -10 })
    })

    it('credits the FXP once when step 1 of a payer-side commit is replayed after the chain completed.', async () => {
      const [transferId, commitRequestId] = ['3300031', '3300032']
      const start = await getFxPositions()
      const { payment } = await preparePayerSideFxPayment(transferId, commitRequestId)
      const [commitMessage] = await fulfilWithoutPositionProcessing(
        [payment.buildMessageFulfil('COMMITTED')],
        { topicMapKey: 'COMMIT', action: 'commit' }
      )

      // Step 1 (credit the FXP's BWP) sends a PATCH to the FXP and a follow-up; step 2 (credit the payee's
      // USD) is processed by the registered consumer and sends the result.
      await processAsOneBatch([commitMessage], 3)
      const notifications = await processAsOneBatch([commitMessage], 0)

      assert.deepEqual(notifications, [], 'the replay sends nothing')
      assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_FULFIL', 'COMMITTED'])
      assert.deepEqual(await getFxStateHistory(commitRequestId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_FULFIL_DEPENDENT', 'COMMITTED'], 'one COMMITTED')
      await assertFxPositionsMoved(start, { payerBwp: 100, fxpBwp: -100, fxpUsd: 10, payeeUsd: -10 })
    })

    it('credits the FXP once when two batches with step 1 of a payer-side commit run at the same time.', async () => {
      const [transferId, commitRequestId] = ['3300041', '3300042']
      const start = await getFxPositions()
      const { payment } = await preparePayerSideFxPayment(transferId, commitRequestId)
      const [commitMessage] = await fulfilWithoutPositionProcessing(
        [payment.buildMessageFulfil('COMMITTED')],
        { topicMapKey: 'COMMIT', action: 'commit' }
      )

      const failedBatchesStart = await countFailedBatches()
      const mark = harness.redpandaMark()
      await Promise.all([
        PositionBatchHandler.positions(null, toBatch([commitMessage])),
        PositionBatchHandler.positions(null, toBatch([commitMessage]))
      ])
      await harness.redpandaDrain(mark, 3)

      assert.equal(await countFailedBatches(), failedBatchesStart, 'neither batch failed')
      assert.deepEqual(await getFxStateHistory(commitRequestId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_FULFIL_DEPENDENT', 'COMMITTED'], 'one COMMITTED')
      await assertFxPositionsMoved(start, { payerBwp: 100, fxpBwp: -100, fxpUsd: 10, payeeUsd: -10 })
    })

    it('leaves a committed conversion COMMITTED, and sends the FXP no error, when its FX_RESERVE is replayed.', async () => {
      const [transferId, commitRequestId] = ['3300051', '3300052']
      const { forex, payment } = buildPayerSideFxPayment(transferId, commitRequestId)
      await forex.prepare()
      // FX_RESERVE is published with the COMMIT topic mapping.
      const [fxReserveMessage] = await fulfilWithoutPositionProcessing(
        [forex.buildMessageFulfil()],
        { topicMapKey: 'COMMIT', action: 'fx-reserve' }
      )
      await processAsOneBatch([fxReserveMessage], 1)
      await payment.prepare()
      await payment.fulfil()
      assert.deepEqual((await getFxStateHistory(commitRequestId)).slice(-1), ['COMMITTED'])

      const notifications = await processAsOneBatch([fxReserveMessage], 0)

      assert.deepEqual(notifications, [], 'no 2001 to the FXP')
      assert.deepEqual(await getFxStateHistory(commitRequestId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_FULFIL_DEPENDENT', 'COMMITTED'], 'not relabelled ABORTED_REJECTED')
    })

    it('releases the payer once when two copies of the FXP\'s abort of a payer-side conversion are in one batch.', async () => {
      const [transferId, commitRequestId] = ['3300061', '3300062']
      const start = await getFxPositions()
      const { forex } = buildPayerSideFxPayment(transferId, commitRequestId)
      await forex.prepare()
      const [fxAbortMessage] = await fulfilWithoutPositionProcessing(
        [buildFxAbortMessage(FX_PAYER, commitRequestId)],
        { topicMapKey: 'FX_ABORT', action: 'fx-abort' }
      )

      // One step (the determining transfer doesn't exist yet): release the payer's BWP, notify the payer.
      const failedBatchesStart = await countFailedBatches()
      await processAsOneBatch([fxAbortMessage, fxAbortMessage], 1)

      assert.equal(await countFailedBatches(), failedBatchesStart, 'the batch did not fail')
      assert.deepEqual(await getFxStateHistory(commitRequestId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_ERROR', 'ABORTED_ERROR'], 'released once')
      await assertFxPositionsMoved(start, { payerBwp: 0, fxpBwp: 0, fxpUsd: 0, payeeUsd: 0 })
    })

    it('releases both reservations once when two copies of the payee\'s abort of a payer-side FX payment are in one batch.', async () => {
      const [transferId, commitRequestId] = ['3300071', '3300072']
      const start = await getFxPositions()
      const { payment } = await preparePayerSideFxPayment(transferId, commitRequestId)
      const [abortMessage] = await fulfilWithoutPositionProcessing(
        [payment.buildMessageAbort()],
        { topicMapKey: 'ABORT', action: 'abort' }
      )

      // Step 1 (release the payer's BWP) sends a PATCH to the FXP and a follow-up; step 2 (release the
      // FXP's USD) is processed by the registered consumer and notifies the payer.
      const failedBatchesStart = await countFailedBatches()
      await processAsOneBatch([abortMessage, abortMessage], 3)

      assert.equal(await countFailedBatches(), failedBatchesStart, 'no batch failed')
      assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_ERROR', 'ABORTED_ERROR'], 'the transfer released once')
      assert.deepEqual(await getFxStateHistory(commitRequestId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_FULFIL_DEPENDENT', 'ABORTED_ERROR'], 'the conversion released once')
      await assertFxPositionsMoved(start, { payerBwp: 0, fxpBwp: 0, fxpUsd: 0, payeeUsd: 0 })
    })
  })
})
