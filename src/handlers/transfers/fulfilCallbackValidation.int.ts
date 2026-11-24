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
 * Fulfil callback validation, end to end: the real fulfil handler, the single-message position
 * handler and the timeout sweep, against a real database and Kafka.
 *
 * A fulfil callback may change a transfer only if it comes from the transfer's payee (addressed to
 * its payer), and only while the transfer is still reserved and not expired. Any other callback gets
 * an error sent back to its sender, and nothing else changes: no state change, no position message.
 *
 * The harness runs the single-message position handler, which is where the default routing sends
 * ABORT and ABORT_VALIDATION.
 */

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert'

import Harness, { MojaloopKafkaMessage } from '../../testing/harness'
import * as ApiHelpers from '../../testing/api-helpers'
import { assertPositionDiff, sleepSeconds } from '../../testing/util'
import { overrideForTesting } from '../../lib/config'
import Db from '../../lib/db'

import handlerAll from './handler'
import TimeoutHandler from '../timeouts/handler'

const harness = Harness.getInstance()

const TOPIC_NOTIFICATION = 'topic-notification-event'

const PAYER = 'dfsp_cv_payer'
const PAYEE = 'dfsp_cv_payee'
const OTHER_DFSP = 'dfsp_cv_other'

// expiry(1) gives an expiration 5 seconds after the request (api-helpers); wait a little longer.
const EXPIRES_SOON = 1
const WAIT_FOR_EXPIRY_SECONDS = 7
// Long enough not to expire while this file runs.
const NEVER_EXPIRES = 10000

// A well-formed fulfilment (32 bytes, base64url) that doesn't match any transfer's condition.
const WRONG_FULFILMENT = 'A'.repeat(43)

const buildPayment = (transferId: string, { payer = PAYER, payee = PAYEE, expirySeconds = NEVER_EXPIRES } = {}) =>
  ApiHelpers.buildPayment()
    .deps(harness, handlerAll)
    .parties(payer, payee)
    .transferId(transferId)
    .amount('100.00', 'USD')
    .expiry(expirySeconds)
    .build()

/**
 * Sends a fulfil callback for the payment to the fulfil handler, as ml-api-adapter would deliver it
 * from `source`, addressed to `destination`. Returns the messages the handler produced.
 */
const sendFulfil = async (
  payment: ApiHelpers.Payment,
  { source, destination, fulfilment }: { source: string, destination: string, fulfilment?: string },
  expectedMessages: number
): Promise<Array<MojaloopKafkaMessage>> => {
  const message: any = payment.buildMessageFulfil('COMMITTED')
  message.value.content.headers['fspiop-source'] = source
  message.value.content.headers['fspiop-destination'] = destination
  message.value.from = source
  message.value.to = destination
  message.value.content.payload.completedTimestamp = new Date().toISOString()
  if (fulfilment !== undefined) {
    message.value.content.payload.fulfilment = fulfilment
  }

  const mark = harness.redpandaMark()
  await handlerAll.fulfil(null, [message])
  await harness.redpandaDrain(mark, expectedMessages)
  await assertNothingMoreProduced(mark + expectedMessages)
  return harness.spoolLast(expectedMessages)
}

/** Waits a moment, then checks that no message was produced since the mark. */
const assertNothingMoreProduced = async (mark: number) => {
  await sleepSeconds(2)
  assert.equal(harness.redpandaMark(), mark, 'no other message produced')
}

/** The single message is the validation error, sent back to its sender only. */
const assertErrorToSenderOnly = (messages: Array<MojaloopKafkaMessage>, sender: string, errorDescription: string) => {
  assert.equal(messages.length, 1, 'one message: the error')
  const [error] = messages
  assert.equal(error.topic, TOPIC_NOTIFICATION, 'a notification, not a position message')
  assert.equal(error.valueParsed.to, sender, 'sent back to the sender')
  assert.equal(error.valueParsed.content.payload.errorInformation.errorCode, '3100')
  assert.equal(error.valueParsed.content.payload.errorInformation.errorDescription, errorDescription)
}

const getStateHistory = async (transferId: string): Promise<Array<string>> => {
  const rows = await Db.getKnex()('transferStateChange').where({ transferId }).orderBy('transferStateChangeId', 'asc').select('transferStateId')
  return rows.map((row: { transferStateId: string }) => row.transferStateId)
}

const waitForState = async (transferId: string, state: string) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const history = await getStateHistory(transferId)
    if (history[history.length - 1] === state) return
    await sleepSeconds(0.5)
  }
  assert.fail(`${transferId} did not reach ${state}: ${(await getStateHistory(transferId)).join(' -> ')}`)
}

describe('handlers/transfers: fulfil callbacks may only change a transfer they are allowed to', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()

    // The prepare and fulfil handlers commit their kafka offsets, so their consumers must be connected.
    await handlerAll.registerPrepareHandler()
    await handlerAll.registerFulfilHandler()

    await ApiHelpers.createHub(harness, {
      currencies: ['USD'],
      settlementModels: [{
        name: 'DEFERRED_MULTILATERAL_NET_USD',
        settlementGranularity: 'NET',
        settlementInterchange: 'MULTILATERAL',
        settlementDelay: 'DEFERRED',
        currency: 'USD',
        requireLiquidityCheck: true,
        ledgerAccountType: 'POSITION',
        settlementAccountType: 'SETTLEMENT',
        autoPositionReset: true
      }]
    })
    for (const name of [PAYER, PAYEE, OTHER_DFSP]) {
      await ApiHelpers.createDfsp(harness, {
        name,
        currencies: ['USD'],
        isProxy: false,
        initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
        deposits: [10000]
      })
    }
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  it('the payer cannot abort its own committed transfer: the error goes back to it, and positions are unchanged.', async () => {
    const transferId = '8100001'
    const payment = await buildPayment(transferId).prepareAndFulfil()
    assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_FULFIL', 'COMMITTED'])
    const [payerStart, payeeStart] = [await ApiHelpers.getPositionAccount(PAYER, 'USD'), await ApiHelpers.getPositionAccount(PAYEE, 'USD')]

    // The payer sends PUT /transfers/{id} for its own committed transfer, with its own identity. Neither
    // header matches; the handler reports the destination one.
    const messages = await sendFulfil(payment, { source: PAYER, destination: PAYEE }, 1)

    assertErrorToSenderOnly(messages, PAYER, 'Generic validation error - fspiop-destination does not match payer fsp on the Fulfil callback response')
    assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_FULFIL', 'COMMITTED'], 'still committed')
    assertPositionDiff('payer', payerStart, await ApiHelpers.getPositionAccount(PAYER, 'USD'), { posted: 0 })
    assertPositionDiff('payee', payeeStart, await ApiHelpers.getPositionAccount(PAYEE, 'USD'), { posted: 0 })
  })

  it('another DFSP cannot abort a transfer in flight, and the payee can still commit it.', async () => {
    const transferId = '8100002'
    const [payerStart, payeeStart] = [await ApiHelpers.getPositionAccount(PAYER, 'USD'), await ApiHelpers.getPositionAccount(PAYEE, 'USD')]
    const payment = await buildPayment(transferId).prepare()

    const messages = await sendFulfil(payment, { source: OTHER_DFSP, destination: PAYER }, 1)

    assertErrorToSenderOnly(messages, OTHER_DFSP, 'Generic validation error - fspiop-source does not match payee fsp on the Fulfil callback response')
    assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED'], 'still reserved')

    await payment.fulfil()
    assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_FULFIL', 'COMMITTED'], 'committed by the payee')
    assertPositionDiff('payer', payerStart, await ApiHelpers.getPositionAccount(PAYER, 'USD'), { posted: 100 })
    assertPositionDiff('payee', payeeStart, await ApiHelpers.getPositionAccount(PAYEE, 'USD'), { posted: -100 })
  })

  it('a fulfil addressed to another DFSP cannot abort the transfer.', async () => {
    const transferId = '8100003'
    const payment = await buildPayment(transferId).prepare()

    const messages = await sendFulfil(payment, { source: PAYEE, destination: OTHER_DFSP }, 1)

    assertErrorToSenderOnly(messages, PAYEE, 'Generic validation error - fspiop-destination does not match payer fsp on the Fulfil callback response')
    assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED'], 'still reserved')
    await payment.fulfil()
    assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_FULFIL', 'COMMITTED'])
  })

  it('the payee cannot release an expired transfer a second time with an invalid fulfilment.', async () => {
    const transferId = '8100004'
    const payerStart = await ApiHelpers.getPositionAccount(PAYER, 'USD')
    const payment = await buildPayment(transferId, { expirySeconds: EXPIRES_SOON }).prepare()
    await sleepSeconds(WAIT_FOR_EXPIRY_SECONDS)

    // The sweep expires the transfer, and the single-message position handler releases the payer.
    await TimeoutHandler.timeout()
    await waitForState(transferId, 'EXPIRED_RESERVED')
    await sleepSeconds(2)
    assertPositionDiff('payer', payerStart, await ApiHelpers.getPositionAccount(PAYER, 'USD'), { posted: 0 })

    // The payee's first fulfil arrives late, with an invalid fulfilment.
    const messages = await sendFulfil(payment, { source: PAYEE, destination: PAYER, fulfilment: WRONG_FULFILMENT }, 1)

    assertErrorToSenderOnly(messages, PAYEE, 'Generic validation error - non-RESERVED transfer state')
    assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RESERVED_TIMEOUT', 'EXPIRED_RESERVED'], 'released once, not aborted')
    assertPositionDiff('payer', payerStart, await ApiHelpers.getPositionAccount(PAYER, 'USD'), { posted: 0 })
  })

  it('a reserved transfer whose fulfilment is invalid is still aborted, as before.', async () => {
    const transferId = '8100005'
    const payerStart = await ApiHelpers.getPositionAccount(PAYER, 'USD')
    const payment = await buildPayment(transferId).prepare()

    // The error to the payee, and the abort to the position handler, which releases the payer and notifies.
    const mark = harness.redpandaMark()
    const message: any = payment.buildMessageFulfil('COMMITTED')
    message.value.from = PAYEE
    message.value.to = PAYER
    message.value.content.payload.fulfilment = WRONG_FULFILMENT
    await handlerAll.fulfil(null, [message])
    await harness.redpandaDrain(mark, 2)
    const [abortMessage] = harness.spoolLast(2)
    assert.equal(abortMessage.topic, 'topic-transfer-position', 'the abort goes to the position handler')
    assert.equal(abortMessage.valueParsed.metadata.event.action, 'abort-validation')
    await waitForState(transferId, 'ABORTED_ERROR')

    assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_ERROR', 'ABORTED_ERROR'])
    assertPositionDiff('payer', payerStart, await ApiHelpers.getPositionAccount(PAYER, 'USD'), { posted: 0 })
  })

  describe('on-us transfers (payer and payee are the same DFSP)', () => {
    before(() => overrideForTesting({ ENABLE_ON_US_TRANSFERS: true } as any))
    after(() => overrideForTesting({ ENABLE_ON_US_TRANSFERS: false } as any))

    it('the DFSP\'s own fulfil commits the transfer, as before.', async () => {
      const transferId = '8100011'
      const start = await ApiHelpers.getPositionAccount(PAYER, 'USD')
      await buildPayment(transferId, { payer: PAYER, payee: PAYER }).prepareAndFulfil()

      assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_FULFIL', 'COMMITTED'])
      assertPositionDiff('payer', start, await ApiHelpers.getPositionAccount(PAYER, 'USD'), { posted: 0 })
    })

    it('another DFSP cannot abort the on-us transfer, and the DFSP can still commit it.', async () => {
      const transferId = '8100012'
      const payment = await buildPayment(transferId, { payer: PAYER, payee: PAYER }).prepare()

      const messages = await sendFulfil(payment, { source: OTHER_DFSP, destination: PAYER }, 1)

      assertErrorToSenderOnly(messages, OTHER_DFSP, 'Generic validation error - fspiop-source does not match payee fsp on the Fulfil callback response')
      assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED'], 'still reserved')
      await payment.fulfil()
      assert.deepEqual(await getStateHistory(transferId), ['RECEIVED_PREPARE', 'RESERVED', 'RECEIVED_FULFIL', 'COMMITTED'])
    })
  })
})
