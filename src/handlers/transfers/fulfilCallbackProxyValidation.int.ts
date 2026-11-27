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
 * Fulfil callback validation for a payee or FXP in another scheme, end to end: the real fulfil
 * handler and the batch position handler, against a real database, Kafka and proxy cache.
 *
 * The hub stores the proxy as the payee (or FXP) of such a transfer, and the callback's
 * FSPIOP-Source is the DFSP in the other scheme. The proxy forwards the callback and sets
 * FSPIOP-Proxy to its own id, which ml-api-adapter checks against the authenticated caller.
 * So a callback may change the transfer only if its FSPIOP-Proxy is the transfer's proxy. Any
 * other callback gets an error sent back to its sender, and nothing else changes.
 */

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert'

import Harness, { MojaloopKafkaMessage } from '../../testing/harness'
import * as ApiHelpers from '../../testing/api-helpers'
import { assertPositionDiff, sleepSeconds } from '../../testing/util'

const harness = Harness.getInstance()
let TransferHandler: any
let TransferFacade: any
let FxTransferService: any
let proxyCache: any

const TOPIC_NOTIFICATION = 'topic-notification-event'

const PAYER = 'dfsp_pv_payer'
const OTHER_DFSP = 'dfsp_pv_other'
const FXP = 'fxp_pv'
const PROXY = 'dfsp_pv_proxy'
const OTHER_PROXY = 'dfsp_pv_other_proxy'
// DFSPs in the other scheme, reached through PROXY.
const EXTERNAL_PAYEE = 'external_pv_payee'
const EXTERNAL_FXP = 'external_pv_fxp'

// A well-formed fulfilment (32 bytes, base64url) that doesn't match any condition.
const WRONG_FULFILMENT = 'A'.repeat(43)

const PROXY_ERROR = 'Generic validation error - fspiop-proxy does not match payee proxy on the Fulfil callback response'
const FX_PROXY_ERROR = 'Generic validation error - fspiop-proxy header does not match counterPartyFsp proxy on the fxFulfil callback response'

type Headers = { source: string, destination: string, proxy?: string }

/** Sets the callback's headers, as ml-api-adapter would deliver them from `source`. */
const withHeaders = (message: any, { source, destination, proxy }: Headers) => {
  const headers = message.value.content.headers
  headers['fspiop-source'] = source
  headers['fspiop-destination'] = destination
  if (proxy) {
    headers['fspiop-proxy'] = proxy
  } else {
    delete headers['fspiop-proxy']
  }
  message.value.from = source
  message.value.to = destination
  return message
}

/** Sends the callback to the fulfil handler and returns the messages it produced. */
const sendCallback = async (message: any, expectedMessages: number): Promise<Array<MojaloopKafkaMessage>> => {
  const mark = harness.redpandaMark()
  await TransferHandler.fulfil(null, message)
  await harness.redpandaDrain(mark, expectedMessages)
  // Wait a moment, then check that nothing else was produced (an accepted abort would be).
  await sleepSeconds(2)
  assert.equal(harness.redpandaMark(), mark + expectedMessages, 'no other message produced')
  return harness.spoolLast(expectedMessages)
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

const getTransferState = async (transferId: string) => (await TransferFacade.getById(transferId)).transferState
const getFxTransferState = async (commitRequestId: string) => (await FxTransferService.getByIdLight(commitRequestId)).fxTransferState

const buildPayment = (transferId: string, { payer = PAYER, payee = EXTERNAL_PAYEE, currency = 'BWP', fx = false } = {}) =>
  ApiHelpers.buildPayment()
    .deps(harness, TransferHandler)
    .parties(payer, payee)
    .payeeProxy(PROXY)
    .transferId(transferId)
    .amount('10.00', currency)
    .fx(fx)
    .build()

const buildForex = (commitRequestId: string, determiningTransferId: string, counterPartyFsp = EXTERNAL_FXP) => {
  const builder = ApiHelpers.buildForex()
    .deps(harness, TransferHandler)
    .commitRequestId(commitRequestId)
    .determiningTransferId(determiningTransferId)
    .parties(PAYER, counterPartyFsp)
    .amountSource('100.00', 'BWP')
    .amountTarget('10.00', 'USD')
  if (counterPartyFsp === EXTERNAL_FXP) builder.counterPartyProxy(PROXY)
  return builder.build()
}

/** An FX error callback for the conversion, as its FXP would send it. */
const buildFxAbortMessage = (commitRequestId: string) => ApiHelpers.buildMessageAbortFx(
  harness,
  ApiHelpers.buildMojaloopAbortFxTransfer({ initiatingFsp: PAYER, counterPartyFsp: EXTERNAL_FXP, date: new Date() }),
  commitRequestId
)

describe('handlers/transfers: fulfil callbacks for a payee or FXP in another scheme', () => {
  before(async () => {
    await harness.up('BATCH')
    await harness.setupGlobals()

    // Import after bringing up the harness, so that the global config is overridden.
    TransferHandler = require('./handler')
    TransferFacade = require('../../models/transfer/facade')
    FxTransferService = require('../../domain/fx/index')
    proxyCache = require('../../lib/proxyCache')
    await proxyCache.connect()
    await TransferHandler.registerPrepareHandler()
    await TransferHandler.registerFulfilHandler()

    await ApiHelpers.createHub(harness, {
      currencies: ['BWP', 'USD'],
      settlementModels: ['BWP', 'USD'].map(currency => ({
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
    for (const [name, isProxy] of [[PAYER, false], [OTHER_DFSP, false], [FXP, false], [PROXY, true], [OTHER_PROXY, true]] as const) {
      await ApiHelpers.createDfsp(harness, {
        name,
        currencies: ['BWP', 'USD'],
        isProxy,
        initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }, { initialPosition: 0, value: 100000 }],
        deposits: [10000, 10000]
      })
    }
    await proxyCache.getCache().addDfspIdToProxyMapping(EXTERNAL_PAYEE, PROXY)
    await proxyCache.getCache().addDfspIdToProxyMapping(EXTERNAL_FXP, PROXY)
  })

  after(async () => {
    await proxyCache.disconnect()
    await harness.teardownGlobals()
    await harness.down()
  })

  describe('a transfer whose payee is in another scheme', () => {
    it('the payer cannot abort its own transfer, and the payee can still commit it through its proxy.', async () => {
      const transferId = '8200001'
      const payerStart = await ApiHelpers.getPositionAccount(PAYER, 'BWP')
      const payment = await buildPayment(transferId).prepare()
      assert.equal(await getTransferState(transferId), 'RESERVED')

      const messages = await sendCallback(withHeaders(payment.buildMessageAbort(), { source: PAYER, destination: PAYER }), 1)

      assertErrorToSenderOnly(messages, PAYER, PROXY_ERROR)
      assert.equal(await getTransferState(transferId), 'RESERVED', 'still reserved')
      assertPositionDiff('payer', payerStart, await ApiHelpers.getPositionAccount(PAYER, 'BWP'), { posted: 10 })

      await payment.fulfil()
      assert.equal(await getTransferState(transferId), 'COMMITTED', 'committed by the payee, through its proxy')
    })

    it('another DFSP cannot abort the transfer.', async () => {
      const transferId = '8200002'
      const payment = await buildPayment(transferId).prepare()

      const messages = await sendCallback(withHeaders(payment.buildMessageAbort(), { source: OTHER_DFSP, destination: PAYER }), 1)

      assertErrorToSenderOnly(messages, OTHER_DFSP, PROXY_ERROR)
      assert.equal(await getTransferState(transferId), 'RESERVED', 'still reserved')
    })

    it('the payer cannot abort the transfer with an invalid fulfilment.', async () => {
      const transferId = '8200003'
      const payment = await buildPayment(transferId).prepare()
      const message: any = withHeaders(payment.buildMessageFulfil('COMMITTED'), { source: PAYER, destination: PAYER })
      message.value.content.payload.fulfilment = WRONG_FULFILMENT

      const messages = await sendCallback(message, 1)

      assertErrorToSenderOnly(messages, PAYER, PROXY_ERROR)
      assert.equal(await getTransferState(transferId), 'RESERVED', 'still reserved')
    })

    it('a callback naming the payee, but not forwarded by its proxy, cannot abort the transfer.', async () => {
      const transferId = '8200004'
      const payment = await buildPayment(transferId).prepare()

      const messages = await sendCallback(withHeaders(payment.buildMessageAbort(), { source: EXTERNAL_PAYEE, destination: PAYER }), 1)

      assertErrorToSenderOnly(messages, EXTERNAL_PAYEE, PROXY_ERROR)
      assert.equal(await getTransferState(transferId), 'RESERVED', 'still reserved')
    })

    it('a callback forwarded by another proxy cannot abort the transfer.', async () => {
      const transferId = '8200005'
      const payment = await buildPayment(transferId).prepare()

      const messages = await sendCallback(withHeaders(payment.buildMessageAbort(), { source: EXTERNAL_PAYEE, destination: PAYER, proxy: OTHER_PROXY }), 1)

      assertErrorToSenderOnly(messages, EXTERNAL_PAYEE, PROXY_ERROR)
      assert.equal(await getTransferState(transferId), 'RESERVED', 'still reserved')
    })

    it('the payee can still abort the transfer through its proxy, as before.', async () => {
      const transferId = '8200006'
      const payerStart = await ApiHelpers.getPositionAccount(PAYER, 'BWP')
      const payment = await buildPayment(transferId).prepare()

      await payment.abort()

      assert.equal(await getTransferState(transferId), 'ABORTED_ERROR')
      assertPositionDiff('payer', payerStart, await ApiHelpers.getPositionAccount(PAYER, 'BWP'), { posted: 0 })
    })
  })

  describe('a conversion whose FXP is in another scheme', () => {
    it('the payer cannot abort the conversion, and the FXP can still fulfil it through its proxy.', async () => {
      const commitRequestId = '8200101'
      const payerStart = await ApiHelpers.getPositionAccount(PAYER, 'BWP')
      const forex = await buildForex(commitRequestId, '8200102').prepare()
      assert.equal(await getFxTransferState(commitRequestId), 'RESERVED')

      const messages = await sendCallback(withHeaders(buildFxAbortMessage(commitRequestId), { source: PAYER, destination: PAYER }), 1)

      assertErrorToSenderOnly(messages, PAYER, FX_PROXY_ERROR)
      assert.equal(await getFxTransferState(commitRequestId), 'RESERVED', 'still reserved')
      assertPositionDiff('payer', payerStart, await ApiHelpers.getPositionAccount(PAYER, 'BWP'), { posted: 100 })

      await forex.fulfil()
      assert.equal(await getFxTransferState(commitRequestId), 'RECEIVED_FULFIL_DEPENDENT', 'fulfilled by the FXP, through its proxy')
    })

    it('the payer cannot abort the conversion after the FXP has fulfilled it.', async () => {
      const commitRequestId = '8200111'
      const forex = await buildForex(commitRequestId, '8200112').prepare()
      await forex.fulfil()
      assert.equal(await getFxTransferState(commitRequestId), 'RECEIVED_FULFIL_DEPENDENT')

      const messages = await sendCallback(withHeaders(buildFxAbortMessage(commitRequestId), { source: PAYER, destination: PAYER }), 1)

      assertErrorToSenderOnly(messages, PAYER, FX_PROXY_ERROR)
      assert.equal(await getFxTransferState(commitRequestId), 'RECEIVED_FULFIL_DEPENDENT', 'unchanged')
    })

    it('a conversion callback not forwarded by the FXP\'s proxy cannot abort it.', async () => {
      const commitRequestId = '8200121'
      await buildForex(commitRequestId, '8200122').prepare()

      for (const proxy of [undefined, OTHER_PROXY]) {
        const messages = await sendCallback(withHeaders(buildFxAbortMessage(commitRequestId), { source: EXTERNAL_FXP, destination: PAYER, proxy }), 1)
        assertErrorToSenderOnly(messages, EXTERNAL_FXP, FX_PROXY_ERROR)
      }
      assert.equal(await getFxTransferState(commitRequestId), 'RESERVED', 'still reserved')
    })
  })

  describe('an FX payment whose payee is in another scheme', () => {
    it('the payer cannot abort the payment, which would also abort its conversion, and the payee can still commit it.', async () => {
      const commitRequestId = '8200201'
      const transferId = '8200202'
      const payerStart = await ApiHelpers.getPositionAccount(PAYER, 'BWP')
      // The conversion is with an FXP in this scheme; the payee is in another.
      await buildForex(commitRequestId, transferId, FXP).prepareAndFulfil()
      const payment = await buildPayment(transferId, { payer: FXP, currency: 'USD', fx: true }).prepare()
      assert.equal(await getTransferState(transferId), 'RESERVED')

      const messages = await sendCallback(withHeaders(payment.buildMessageAbort(), { source: PAYER, destination: FXP }), 1)

      assertErrorToSenderOnly(messages, PAYER, PROXY_ERROR)
      assert.equal(await getTransferState(transferId), 'RESERVED', 'the payment is still reserved')
      assert.equal(await getFxTransferState(commitRequestId), 'RECEIVED_FULFIL_DEPENDENT', 'the conversion is unchanged')
      assertPositionDiff('payer', payerStart, await ApiHelpers.getPositionAccount(PAYER, 'BWP'), { posted: 100 })

      await payment.fulfil()
      assert.equal(await getTransferState(transferId), 'COMMITTED', 'committed by the payee, through its proxy')
      assert.equal(await getFxTransferState(commitRequestId), 'COMMITTED')
    })
  })
})
