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
 * Processes the position messages as a single batch, as the batch consumer would deliver them
 * (parsed JSON value, same key). The topic is set to the batch topic so the offset commit uses the
 * registered batch consumer.
 */
const processAsOneBatch = async (positionMessages: Array<MojaloopKafkaMessage>): Promise<Array<any>> => {
  const batch = positionMessages.map(message => ({
    ...message,
    topic: TOPIC_POSITION_BATCH,
    value: message.valueParsed
  }))

  const mark = harness.redpandaMark()
  await PositionBatchHandler.positions(null, batch)
  // One notification per position message.
  await harness.redpandaDrain(mark, positionMessages.length)
  return harness.spoolLastPayload(positionMessages.length)
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
})
