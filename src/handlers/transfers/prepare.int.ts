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

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------
 ******/

import { after, before, describe, it } from "node:test"
import Harness from '../../testing/harness'
import { Snapshot } from "../../testing/snapshot"
import * as ApiHelpers from '../../testing/api-helpers'
import assert from "node:assert"
import { assertPositionDiff, sleepSeconds } from "../../testing/util"
import TimeoutHandler from '../timeouts/handler'
import { DispatchTransferHandler } from "../../testing/dispatch-transfer-handler"

const harness = Harness.getInstance()
let dispatchHandler: DispatchTransferHandler
let PrepareHandler: any
let PositionBatchHandler: any
let ExternalParticipantCached: any
let TransferFacade: any
let FxTransferService: any
let proxyCache: any

describe('handlers/prepare', () => {
  before(async () => {
    await harness.up('BATCH')
    await harness.setupGlobals()

    dispatchHandler = new DispatchTransferHandler(harness.config, 'SPLIT')
    await dispatchHandler.init()

    // Import after bringing up the harness, so the global config is overriden.
    PositionBatchHandler = require('../positions/handlerBatch')
    TransferFacade = require('../../models/transfer/facade')
    FxTransferService = require('../../domain/fx/index')
    ExternalParticipantCached = require('../../models/participant/externalParticipantCached')
    proxyCache = require('../../lib/proxyCache')
    await proxyCache.connect()

    // Create the hub accounts + settlement model.
    const createHubPayload: ApiHelpers.CreateHubPayload = {
      currencies: ['BWP', 'USD'],
      settlementModels: [
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
        {
          name: `DEFERRED_MULTILATERAL_NET_USD`,
          settlementGranularity: "NET",
          settlementInterchange: "MULTILATERAL",
          settlementDelay: "DEFERRED",
          currency: 'USD',
          requireLiquidityCheck: true,
          ledgerAccountType: "POSITION",
          settlementAccountType: "SETTLEMENT",
          autoPositionReset: true
        }
      ]
    }
    await ApiHelpers.createHub(harness, createHubPayload)
    // Create 2 test dfsps to transfer between.
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_a',
      currencies: ['BWP'],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
      deposits: [10000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_b',
      currencies: ['BWP', 'USD'],
      isProxy: false,
      initialPostionsAndLimits: [
        { initialPosition: 0, value: 100000 },
        { initialPosition: 0, value: 100000 }
      ],
      deposits: [10000, 10000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_a_proxy',
      currencies: ['BWP', 'USD'],
      isProxy: true,
      initialPostionsAndLimits: [
        { initialPosition: 0, value: 100000 },
        { initialPosition: 0, value: 100000 }
      ],
      deposits: [10000, 10000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_b_proxy',
      currencies: ['BWP', 'USD'],
      isProxy: true,
      initialPostionsAndLimits: [
        { initialPosition: 0, value: 100000 },
        { initialPosition: 0, value: 100000 }
      ],
      deposits: [10000, 10000]
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

    // Set up the proxy1 currencies.
    await proxyCache.getCache().addDfspIdToProxyMapping('external_dfsp_a', 'dfsp_a_proxy')
    await proxyCache.getCache().addDfspIdToProxyMapping('external_dfsp_b', 'dfsp_b_proxy')

    // Create payment of $100.00 USD from dfsp_a to dfsp_b with id 1000001.
    await ApiHelpers.buildPayment()
      .deps(harness, dispatchHandler)
      .parties('dfsp_a', 'dfsp_b')
      .transferId('1000001')
      .amount('1.00', 'BWP')
      .build()
      .prepareAndFulfil()
  })

  after(async () => {
    await proxyCache.disconnect()
    await harness.teardownGlobals()
    await harness.down()
  })

  /**
   * fxTransfers
   */
  // 
  // TODO: Skipping for now - since we removed "PrepareHandler.calculateProxyObligation".
  it.skip('Calculates the obligation between initating and counterparty DFSP.', async () => {
    const payload = {
      commitRequestId: '200001',
      determiningTransferId: '300001',
      initiatingFsp: 'external_dfsp_a',
      counterPartyFsp: 'external_dfsp_b',
      amountType: 'SEND',
      sourceAmount: { currency: 'BWP', amount: '300.33' },
      targetAmount: { currency: 'TZS', amount: '48000' },
      // Mock condition.
      condition: '8x04dj-RKEtfjStajaKXKJ5eL1mWm9iG2ltEKvEDOHc',
      expiration: new Date(Date.now() + (24 * 60 * 60 * 1000))
    }

    const obligation = await PrepareHandler.calculateProxyObligation({
      payload,
      isFx: true,
      params: {},
      functionality: 'functionality',
      action: 'action'
    })

    Snapshot.from(`{
        "isFx": true,
        "payloadClone": {
          "commitRequestId": "200001",
          "determiningTransferId": "300001",
          "initiatingFsp": "dfsp_a_proxy",
          "counterPartyFsp": "dfsp_b_proxy",
          "amountType": "SEND",
          "sourceAmount": {
            "currency": "BWP",
            "amount": "300.33"
          },
          "targetAmount": {
            "currency": "TZS",
            "amount": "48000"
          },
          "condition": "8x04dj-RKEtfjStajaKXKJ5eL1mWm9iG2ltEKvEDOHc",
          "expiration": :ignore
        },
        "isInitiatingFspProxy": true,
        "isCounterPartyFspProxy": true,
        "initiatingFspProxyOrParticipantId": {
          "inScheme": false,
          "proxyId": "dfsp_a_proxy",
          "name": "external_dfsp_a"
        },
        "counterPartyFspProxyOrParticipantId": {
          "inScheme": false,
          "proxyId": "dfsp_b_proxy",
          "name": "external_dfsp_b"
        }
      }`).checkUnwrap(obligation)
  })

  it('Lazy creates external participants.', async () => {
    let payerExternal = await ExternalParticipantCached.getByName('external_dfsp_a')
    let payeeExternal = await ExternalParticipantCached.getByName('external_dfsp_b')
    assert(payerExternal === undefined)
    assert(payeeExternal === undefined)

    await ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId('2000001')
      .determiningTransferId('3000001')
      .parties('external_dfsp_a', 'external_dfsp_b')
      .amountSource('100.00', 'BWP')
      .amountTarget('1.00', 'USD')
      .build()
      .prepareAndFulfil()

    const payment = ApiHelpers.buildPayment()
      .deps(harness, dispatchHandler)
      .parties('external_dfsp_a', 'external_dfsp_b')
      .transferId('3000001')
      .amount('1.00', 'USD')
      .fx()
      .build()

    await payment.prepare()

    // Assert that the've been created?
    payerExternal = await ExternalParticipantCached.getByName('external_dfsp_a')
    payeeExternal = await ExternalParticipantCached.getByName('external_dfsp_b')
    assert(payerExternal)
    assert(payeeExternal)

    const [participant] = await TransferFacade.getTransferParticipant('dfsp_a_proxy', '3000001')
    Snapshot.from(`{
        "transferParticipantId": :ignore,
        "transferId": "3000001",
        "participantCurrencyId": :ignore,
        "transferParticipantRoleTypeId": 1,
        "ledgerEntryTypeId": 1,
        "amount": "1.0000",
        "createdDate": :ignore
        "participantId": 4,
        "externalParticipantId": 1
      }`).checkUnwrap(participant)

    // Fulfil the payment so it doesn't time out later.
    await payment.fulfil()
  })

  it('Ignores non COMMITTED/ABORTED fxTransfer on duplicate request.', async () => {
    const forex = ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId('2000002')
      .determiningTransferId('3000002')
      .parties('external_dfsp_a', 'external_dfsp_b')
      .amountSource('100.00', 'BWP')
      .amountTarget('1.00', 'USD')
      .build()

    await forex.prepare()

    // Manually prepare again.
    const mark = harness.redpandaMark()
    await dispatchHandler.prepare(null, forex.buildMessagePrepare())
    await harness.redpandaDrain(mark, 1)

    const lastTopics = harness.spoolLastTopic(3)
    Snapshot.from(`[
      "topic-transfer-position-batch",
      "topic-notification-event",
      "topic-notification-event"
    ]`).checkUnwrap(lastTopics)
  })

  it('Duplicate fxTransfers callback when in `RECEIVED_FULFIL_DEPENDENT` state.', async () => {
    const forex = ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId('2000003')
      .determiningTransferId('3000003')
      .parties('external_dfsp_a', 'external_dfsp_b')
      .amountSource('100.00', 'BWP')
      .amountTarget('1.00', 'USD')
      .build()

    await forex.prepareAndFulfil()

    // Now send the first message again.
    // await forex.prepare()
    const mark = harness.redpandaMark()
    await dispatchHandler.prepare(null, forex.buildMessagePrepare())
    await harness.redpandaDrain(mark, 1)

    const lastTopics = harness.spoolLastTopic(1)
    Snapshot.from(`[
      "topic-notification-event"
    ]`).checkUnwrap(lastTopics)

    Snapshot.from(`{
      "completedTimestamp": :ignore,
      "conversionState": "RESERVED",
      "fulfilment": "uz0FAeutW6o8Mz7OmJh8ALX6mmsZCcIDOqtE01eo4uI"
    }`).checkUnwrap(harness.spoolLastPayload(1)[0])
  })

  it('Duplicate fxTransfers callback when in `COMMITTED` state.', async () => {
    const forex = ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId('2000004')
      .determiningTransferId('3000004')
      .parties('external_dfsp_a', 'external_dfsp_b')
      .amountSource('100.00', 'BWP')
      .amountTarget('1.00', 'USD')
      .build()

    await forex.prepareAndFulfil()

    // Make the payment.
    await ApiHelpers.buildPayment()
      .deps(harness, dispatchHandler)
      .parties('external_dfsp_a', 'external_dfsp_b')
      .transferId('3000004')
      .amount('1.00', 'USD')
      .fx()
      .build()
      .prepareAndFulfil()

    // Now send the first message again.
    const mark = harness.redpandaMark()
    await dispatchHandler.prepare(null, forex.buildMessagePrepare())
    await harness.redpandaDrain(mark, 1)

    const lastTopics = harness.spoolLastTopic(1)
    Snapshot.from(`[
      "topic-notification-event"
    ]`).checkUnwrap(lastTopics)

    Snapshot.from(`{
      "completedTimestamp": :ignore,
      "conversionState": "COMMITTED",
      "fulfilment": "uz0FAeutW6o8Mz7OmJh8ALX6mmsZCcIDOqtE01eo4uI"
    }`).checkUnwrap(harness.spoolLastPayload(1)[0])
  })

  it('Duplicate fxTransfers callback when in `ABORTED` state.', async () => {
    const forex = ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId('2000005')
      .determiningTransferId('3000005')
      .parties('external_dfsp_a', 'external_dfsp_b')
      .amountSource('100.00', 'BWP')
      .amountTarget('1.00', 'USD')
      .build()

    await forex.prepare()
    await forex.abort()

    // Now send the first message again.
    const mark = harness.redpandaMark()
    await dispatchHandler.prepare(null, forex.buildMessagePrepare())
    await harness.redpandaDrain(mark, 1)

    const lastTopics = harness.spoolLastTopic(1)
    Snapshot.from(`[
      "topic-notification-event"
    ]`).checkUnwrap(lastTopics)

    Snapshot.from(`{
      "completedTimestamp": :ignore,
      "conversionState": "ABORTED"
    }`).checkUnwrap(harness.spoolLastPayload(1)[0])
  })

  /**
   * Proxy
   */
  it('Updates the transfer state on prepare forwarded action.', async () => {
    const transferId = '3000006'
    const payment = ApiHelpers.buildPayment()
      .deps(harness, dispatchHandler)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount('45.67', 'BWP')
      .build()

    await payment.prepare()

    const forwardedMsg = ApiHelpers.buildMessageForwarded(harness, {
      transferId,
      proxyId: 'dfsp_a_proxy'
    })
    await dispatchHandler.prepare(null, forwardedMsg)

    const transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'RESERVED_FORWARDED')

    // Fulfil the payment so it doesn't time out later.
    await payment.fulfil()
  })

  it('Should not time out the prepared payment in RESERVED_FORWARDED state.', async () => {
    const transferId = '3000007'
    const payment = ApiHelpers.buildPayment()
      .deps(harness, dispatchHandler)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount('100.00', 'BWP')
      .expiry(1)
      .build()

    const [positionPayerA] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'BWP')
    await payment.prepare()
    const forwardedMsg = ApiHelpers.buildMessageForwarded(harness, {
      transferId: transferId,
      proxyId: 'dfsp_a_proxy'
    })
    await dispatchHandler.prepare(null, forwardedMsg)

    const [positionPayerB] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'BWP')
    assertPositionDiff('payer', positionPayerA, positionPayerB, {
      pending: 0,
      posted: 100
    })

    const transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'RESERVED_FORWARDED')

    await sleepSeconds(10)
    // We don't run the timeout handler in these tests, but instead just call timeout()
    // directly. This makes the tests more predictable and deterministic.
    const mark = harness.redpandaMark()
    await TimeoutHandler.timeout()
    await harness.redpandaDrain(mark, 1)
    const [positionPayerC] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'BWP')
    assertPositionDiff('payer', positionPayerB, positionPayerC, {
      pending: 0,
      posted: 0
    })
    await payment.abort()
  })

  it('Completes a forwarded payment.', async () => {
    const transferId = '3000008'
    const payment = ApiHelpers.buildPayment()
      .deps(harness, dispatchHandler)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount('100.00', 'BWP')
      .expiry(120)
      .build()

    const [positionPayerA] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'BWP')
    await payment.prepare()
    const forwardedMsg = ApiHelpers.buildMessageForwarded(harness, {
      transferId: transferId,
      proxyId: 'dfsp_a_proxy'
    })
    await dispatchHandler.prepare(null, forwardedMsg)

    const [positionPayerB, positionPayeeB] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'BWP')
    assertPositionDiff('payer', positionPayerA, positionPayerB, {
      pending: 0,
      posted: 100
    })

    let transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'RESERVED_FORWARDED')

    await payment.fulfil()
    transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'COMMITTED')

    const [positionPayerC, positionPayeeC] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'BWP')
    assertPositionDiff('payer', positionPayerB, positionPayerC, {
      pending: 0,
      posted: 0
    })
    assertPositionDiff('payee', positionPayeeB, positionPayeeC, {
      pending: 0,
      posted: -100
    })
  })

  it('Aborts a forwarded payment.', async () => {
    const transferId = '3000010'
    const payment = ApiHelpers.buildPayment()
      .deps(harness, dispatchHandler)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount('100.00', 'BWP')
      .expiry(120)
      .build()

    const [positionPayerA, positionPayeeA] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'BWP')
    await payment.prepare()
    const forwardedMsg = ApiHelpers.buildMessageForwarded(harness, {
      transferId: transferId,
      proxyId: 'dfsp_a_proxy'
    })
    await dispatchHandler.prepare(null, forwardedMsg)

    const [positionPayerB, positionPayeeB] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'BWP')
    assertPositionDiff('payer', positionPayerA, positionPayerB, {
      pending: 0,
      posted: 100
    })

    let transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'RESERVED_FORWARDED')

    await payment.abort()
    transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'ABORTED_ERROR')

    const [positionPayerC, positionPayeeC] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'BWP')
    // A --> C is the same (Payment was aborted).
    assertPositionDiff('payer', positionPayerA, positionPayerC, {
      pending: 0,
      posted: 0
    })
    assertPositionDiff('payee', positionPayeeB, positionPayeeC, {
      pending: 0,
      posted: 0
    })
  })

  it('Notifies when the forwarded payment cannot be found.', async () => {
    const transferId = '3000011'

    const forwardedMsg = ApiHelpers.buildMessageForwarded(harness, {
      transferId: transferId,
      proxyId: 'dfsp_a_proxy'
    })
    let mark = harness.redpandaMark();
    await dispatchHandler.prepare(null, forwardedMsg)
    await harness.redpandaDrain(mark, 1)

    const lastPayload = harness.spoolLastPayload(1)
    Snapshot.from(`[
      {
        "errorInformation": {
          "errorCode": "3200",
          "errorDescription": "Generic ID not found - Forwarded transfer could not be found.",
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
    ]`).checkUnwrap(lastPayload)
  })

  it('Notifies if the transfer is in an invalid state.', async () => {
    const transferId = '3000012'
    const paymentA = ApiHelpers.buildPayment()
      .deps(harness, dispatchHandler)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount('100.00', 'BWP')
      .expiry(1)
      .build()

    // Prepare and timeout.
    await paymentA.prepare()
    const transferBefore = await TransferFacade.getById(transferId)
    assert.equal(transferBefore.transferState, 'RESERVED')
    await sleepSeconds(10)

    let mark = harness.redpandaMark()
    await TimeoutHandler.timeout()
    await harness.redpandaDrain(mark, 2)

    const transferExpired = await TransferFacade.getById(transferId)
    assert.equal(transferExpired.transferState, 'EXPIRED_RESERVED')

    const forwardedMsg = ApiHelpers.buildMessageForwarded(harness, {
      transferId: transferId,
      proxyId: 'dfsp_a_proxy'
    })
    mark = harness.redpandaMark()
    await dispatchHandler.prepare(null, forwardedMsg)
    await harness.redpandaDrain(mark, 1)

    Snapshot.from(`[
      {
        "errorInformation": {
          "errorCode": "2001",
          "errorDescription": "Internal server error - Invalid State: EXPIRED_RESERVED - expected: RESERVED",
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
    ]`).checkUnwrap(harness.spoolLastPayload(1))
  })

  it('Notifies with GET on timeout if the transfer is RESERVED_FORWARDED', async () => {
    const transferId = '3000013'
    const payment = ApiHelpers.buildPayment()
      .deps(harness, dispatchHandler)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount('100.00', 'BWP')
      .expiry(1)
      .build()

    // Prepare and forward.
    await payment.prepare()
    let transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'RESERVED')

    const forwardedMsg = ApiHelpers.buildMessageForwarded(harness, {
      transferId: transferId,
      proxyId: 'dfsp_a_proxy'
    })
    await dispatchHandler.prepare(null, forwardedMsg)
    transfer = await TransferFacade.getById(transferId)
    assert.equal(transfer.transferState, 'RESERVED_FORWARDED')

    // Time out to trigger notification.
    await sleepSeconds(10)
    const mark = harness.redpandaMark()
    const resultTimeout = await TimeoutHandler.timeout()
    await harness.redpandaDrain(mark, 1)
    
    assert(resultTimeout)
    // Annoyingly the timeout handler still includes aborted transfers in timeouts.
    const reservedForwardedTimedout = resultTimeout.transferForwardedList
        .filter((transfer: any) => transfer.transferStateId === 'RESERVED_FORWARDED')
    Snapshot.from(`[
      {
        "transferForwardedId": :ignore
        "transferId": "3000013",
        "expirationDate": :ignore
        "attemptCount": 0,
        "createdDate": :ignore
        "transferStateId": "RESERVED_FORWARDED",
        "payerParticipantCurrencyId": 5,
        "payerFsp": "dfsp_a",
        "payeeFsp": "dfsp_b",
        "payeeParticipantCurrencyId": null,
        "bulkTransferId": null,
        "effectedParticipantCurrencyId": 5,
        "externalPayerName": null,
        "externalPayeeName": null
      }
    ]`).checkUnwrap(reservedForwardedTimedout)
    assert(reservedForwardedTimedout.length === 1)
    // Get has no payload.
    Snapshot.from(`[
      {}
    ]`).checkUnwrap(harness.spoolLastPayload(1))
    Snapshot.from(`[
      "topic-notification-event"
    ]`).checkUnwrap(harness.spoolLastTopic(1))

    await payment.abort()
  })

  /**
   * FX + Proxy.
   */

  it('should update fxTransfer internal state on prepare event fx-forwarded action', async () => {
    const forex = ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId('2000010')
      .determiningTransferId('3000010')
      .parties('external_dfsp_a', 'external_dfsp_b')
      .amountSource('100.00', 'BWP')
      .amountTarget('1.00', 'USD')
      .build()

    await forex.prepare()

    // Forward the fxPrepare to the proxy.
    const forwardedMsg = ApiHelpers.buildMessageForwardedFx(harness, {
      commitRequestId: '2000010',
      proxyId: 'dfsp_a_proxy'
    })
    await dispatchHandler.prepare(null, forwardedMsg)

    // Check the result.
    const transfer = await FxTransferService.getByIdLight('2000010')
    assert.equal(transfer.fxTransferState, 'RESERVED_FORWARDED')
  })

  it('not timeout fxTransfer in RESERVED_FORWARDED internal transfer state', async () => {
    const forex = ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId('2000011')
      .determiningTransferId('3000011')
      .parties('external_dfsp_a', 'external_dfsp_b')
      .amountSource('100.00', 'BWP')
      .amountTarget('1.00', 'USD')
      .expiry(5)
      .build()

    await forex.prepare()
    const forwardedMsg = ApiHelpers.buildMessageForwardedFx(harness, {
      commitRequestId: '2000011',
      proxyId: 'dfsp_a_proxy'
    })
    await dispatchHandler.prepare(null, forwardedMsg)
    let transfer = await FxTransferService.getByIdLight('2000011')
    assert.equal(transfer.fxTransferState, 'RESERVED_FORWARDED')

    // Now time it out - no message should be produced.
    await sleepSeconds(10)
    const mark = harness.redpandaMark()
    await TimeoutHandler.timeout()
    await harness.redpandaDrain(mark, 0)

    // Check the result.
    transfer = await FxTransferService.getByIdLight('2000011')
    assert.equal(transfer.fxTransferState, 'RESERVED_FORWARDED')
  })

  // // This test is broken, there is currently no notification produced.
  // // See note on `test/integration-override/handlers/transfers/handlers.test.js`.
  // it.skip('produces a get notification if fx transfer stuck in RESERVED_FORWARDED', async () => {
  //   const forex = ApiHelpers.buildForex()
  //     .deps(harness, dispatchHandler)
  //     .commitRequestId('2000012')
  //     .determiningTransferId('3000012')
  //     .parties('external_dfsp_a', 'external_dfsp_b')
  //     .amountSource('100.00', 'BWP')
  //     .amountTarget('1.00', 'USD')
  //     .expiry(5)
  //     .build()

  //   await forex.prepare()
  //   const forwardedMsg = ApiHelpers.buildMessageForwardedFx(harness, {
  //     commitRequestId: '2000012',
  //     proxyId: 'dfsp_a_proxy'
  //   })
  //   await dispatchHandler.prepare(null, forwardedMsg)
  //   let transfer = await FxTransferService.getByIdLight('2000012')
  //   assert.equal(transfer.fxTransferState, 'RESERVED_FORWARDED')

  //   // Now time it out - no message should be produced.
  //   await sleepSeconds(10)
  //   const mark = harness.redpandaMark()
  //   await TimeoutHandler.timeout()
  //   await harness.redpandaDrain(mark, 0)

  //   // Check the result.
  //   transfer = await FxTransferService.getByIdLight('2000012')
  //   assert.equal(transfer.fxTransferState, 'RESERVED_FORWARDED')
  // })

  it('transitions RESERVED_FORWARDED -> RECEIVED_FULFIL_DEPENDENT on fx-fulfil', async () => {
    const forex = ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId('2000012')
      .determiningTransferId('3000012')
      .parties('external_dfsp_a', 'external_dfsp_b')
      .amountSource('100.00', 'BWP')
      .amountTarget('1.00', 'USD')
      .expiry(5)
      .build()
    await forex.prepare()

    // Forward the message.
    const forwardedMsg = ApiHelpers.buildMessageForwardedFx(harness, {
      commitRequestId: '2000012',
      proxyId: 'dfsp_a_proxy'
    })
    await dispatchHandler.prepare(null, forwardedMsg)
    let transfer = await FxTransferService.getByIdLight('2000012')
    assert.equal(transfer.fxTransferState, 'RESERVED_FORWARDED')

    await forex.fulfil()
    transfer = await FxTransferService.getByIdLight('2000012')
    assert.equal(transfer.fxTransferState, 'RECEIVED_FULFIL_DEPENDENT')
  })

  it('transitions RESERVED_FORWARDED -> ABORTED_ERROR on fx-fulfil-error', async () => {
    const forex = ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId('2000013')
      .determiningTransferId('3000013')
      .parties('external_dfsp_a', 'external_dfsp_b')
      .amountSource('100.00', 'BWP')
      .amountTarget('1.00', 'USD')
      .expiry(5)
      .build()
    await forex.prepare()

    // Forward the message.
    const forwardedMsg = ApiHelpers.buildMessageForwardedFx(harness, {
      commitRequestId: '2000013',
      proxyId: 'dfsp_a_proxy'
    })
    await dispatchHandler.prepare(null, forwardedMsg)
    let transfer = await FxTransferService.getByIdLight('2000013')
    assert.equal(transfer.fxTransferState, 'RESERVED_FORWARDED')

    await forex.abort()
    transfer = await FxTransferService.getByIdLight('2000013')
    assert.equal(transfer.fxTransferState, 'ABORTED_ERROR')
  })

  it('notifies if fxTransfer is not found', async () => {
    // Forward the message.
    const forwardedMsg = ApiHelpers.buildMessageForwardedFx(harness, {
      commitRequestId: '2000014',
      proxyId: 'dfsp_a_proxy'
    })
    const mark = harness.redpandaMark()
    await dispatchHandler.prepare(null, forwardedMsg)
    await harness.redpandaDrain(mark, 1)

    Snapshot.from(`[
      {
        "errorInformation": {
          "errorCode": "3200",
          "errorDescription": "Generic ID not found - Forwarded fxTransfer could not be found.",
          "extensionList": {
            "extension": [
              {
                "key": "cause",
                "value": "FSPIOPError: Forwarded fxTransfer could not be found.:ignore
              }
            ]
          }
        }
      }
    ]`).checkUnwrap(harness.spoolLastPayload(1))
    Snapshot.from(`[
      "topic-notification-event"
    ]`).checkUnwrap(harness.spoolLastTopic(1))
  })

  // // TODO: I'm not sure how to get the timeouts to emit the position change messages.
  // // I think this was actually broken in the original tests.
  // it.skip('notifies if the transfer is in an invalid state', async () => {
  //   // Create a forex, time it out, but the problem is the timeouts are broken?
  //   const forex = ApiHelpers.buildForex()
  //     .deps(harness, dispatchHandler)
  //     .commitRequestId('2000015')
  //     .determiningTransferId('3000015')
  //     .parties('external_dfsp_a', 'external_dfsp_b')
  //     .amountSource('100.00', 'BWP')
  //     .amountTarget('1.00', 'USD')
  //     .expiry(1)
  //     .build()
  //   await forex.prepare()

  //   await sleepSeconds(5)

  //   const knex = Db.getKnex()
  //   await knex('segment')
  //     .where({ tableName: 'fxTransferStateChange', segmentType: 'timeout' })
  //     .update({ value: 0 })

  //   const mark = harness.redpandaMark()
  //   // For some reason, timeout isn't producing any messages.
  //   const timeoutResult = await TimeoutHandler.timeout()
  //   await harness.redpandaDrain(mark, 1)

  //   let fxTransfer = await FxTransferService.getByIdLight('2000015')
  //   assert.equal(fxTransfer.fxTransferState, 'EXPIRED_RESERVED')
  // })

  it(
    `Scheme A: POST /fxTransfer call I.e. Debtor: Payer DFSP → Creditor: Proxy AR
    Payer DFSP position account must be updated (reserved)`,
    async () => {
      const externalFxp = 'external_fxp'
      await proxyCache.getCache().addDfspIdToProxyMapping(externalFxp, 'fxp_proxy')

      const positionPayerPre = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
      const forex = ApiHelpers.buildForex()
        .deps(harness, dispatchHandler)
        .commitRequestId('2000017')
        .determiningTransferId('3000017')
        .parties('dfsp_a', 'external_dfsp_b')
        .amountSource('100.00', 'BWP')
        .amountTarget('1.00', 'USD')
        .build()

      await forex.prepare()
      const fxTransfer = await FxTransferService.getByIdLight('2000017')
      assert.equal(fxTransfer.fxTransferState, 'RESERVED')

      const positionPayerPost = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
      assertPositionDiff('payer', positionPayerPre, positionPayerPost, {
        pending: 0,
        posted: 100
      })
    })

  it(
    `Scheme A: POST /Transfer call I.e. Debtor: Proxy AR → Creditor: Proxy AR
      Do nothing (produce message with key 0)`,
    async () => {
      const externalFxp = 'external_fxp'
      const externalPayee = 'external_payee'
      await proxyCache.getCache().addDfspIdToProxyMapping(externalFxp, 'dfsp_a_proxy')
      await proxyCache.getCache().addDfspIdToProxyMapping(externalPayee, 'dfsp_a_proxy')

      const positionPayerPre = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
      const forex = ApiHelpers.buildForex()
        .deps(harness, dispatchHandler)
        .commitRequestId('2000018')
        .determiningTransferId('3000018')
        .parties('dfsp_a', externalFxp)
        .amountSource('100.00', 'BWP')
        .amountTarget('10.00', 'USD')
        .build()
      await forex.prepareAndFulfil()

      const positionPayerAfterFx = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
      assertPositionDiff('payer', positionPayerPre, positionPayerAfterFx, {
        pending: 0,
        posted: 100
      })

      // Send the transfer through.
      const payment = ApiHelpers.buildPayment()
        .deps(harness, dispatchHandler)
        .parties(externalFxp, externalPayee)
        .transferId('3000018')
        .amount('10.00', 'USD')
        .fx()
        .build()
      await payment.prepare()

      const positionPayerAfterTransfer = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
      // Ensure position doesn't change.
      assertPositionDiff('payer', positionPayerAfterFx, positionPayerAfterTransfer, {
        pending: 0,
        posted: 0
      })
    })

  it(
    `Scheme R: POST /fxTransfer call I.e. Debtor: Proxy AR → Creditor: FXP
     Proxy AR position account in source currency must be updated (reserved)`,
    async () => {
      const externalPayer = 'external_payer_r'
      await proxyCache.getCache().addDfspIdToProxyMapping(externalPayer, 'dfsp_a_proxy')

      const positionProxyPre = await ApiHelpers.getPositionAccount('dfsp_a_proxy', 'BWP')
      const forex = ApiHelpers.buildForex()
        .deps(harness, dispatchHandler)
        .commitRequestId('2000019')
        .determiningTransferId('3000019')
        .parties(externalPayer, 'dfsp_b')
        .amountSource('100.00', 'BWP')
        .amountTarget('10.00', 'USD')
        .build()
      await forex.prepare()
      const positionProxyPost = await ApiHelpers.getPositionAccount('dfsp_a_proxy', 'BWP')
      assertPositionDiff('payer', positionProxyPre, positionProxyPost, {
        pending: 0,
        posted: 100
      })
    })

  it(
    `Scheme R: POST /transfer call I.e. Debtor: FXP → Creditor: Proxy RB
     FXP position account in targeted currency must be updated (reserved)`,
    async () => {
      const externalPayer = 'external_payer_r'
      const externalPayee = 'external_payee_r'
      await proxyCache.getCache().addDfspIdToProxyMapping(externalPayer, 'dfsp_a_proxy')
      await proxyCache.getCache().addDfspIdToProxyMapping(externalPayee, 'dfsp_b_proxy')

      await ApiHelpers.buildForex()
        .deps(harness, dispatchHandler)
        .commitRequestId('2000020')
        .determiningTransferId('3000020')
        .parties(externalPayer, 'fxp_a')
        .amountSource('100.00', 'BWP')
        .amountTarget('10.00', 'USD')
        .build()
        .prepareAndFulfil()

      const positionFxpPre = await ApiHelpers.getPositionAccount('fxp_a', 'USD')
      const payment = ApiHelpers.buildPayment()
        .deps(harness, dispatchHandler)
        .parties(externalPayer, externalPayee)
        .transferId('3000020')
        .amount('10.00', 'USD')
        .fx()
        .build()

      await payment.prepare()

      const positionFxpPost = await ApiHelpers.getPositionAccount('fxp_a', 'USD')
      assertPositionDiff('payer', positionFxpPre, positionFxpPost, {
        pending: 0,
        posted: 10
      })
    })

  it(
    `Scheme B: POST /transfer call I.e. Debtor: Proxy RB → Creditor: Payee DFSP
      Proxy RB position account must be updated (reserved)`,
    async () => {
      const externalPayer = 'external_payer_scheme_b'
      await proxyCache.getCache().addDfspIdToProxyMapping(externalPayer, 'dfsp_a_proxy')

      const positionProxyPre = await ApiHelpers.getPositionAccount('dfsp_a_proxy', 'BWP')
      const payment = ApiHelpers.buildPayment()
        .deps(harness, dispatchHandler)
        .parties(externalPayer, 'dfsp_b')
        .transferId('3000021')
        .amount('93.00', 'BWP')
        .build()

      await payment.prepare()

      const positionProxyPost = await ApiHelpers.getPositionAccount('dfsp_a_proxy', 'BWP')
      assertPositionDiff('payer', positionProxyPre, positionProxyPost, {
        pending: 0,
        posted: 93
      })
    })

  it(
    `Scheme B: PUT /transfers call I.e. From: Payee DFSP → To: Proxy RB
      Payee DFSP position account must be updated`,
    async () => {
      const externalPayer = 'external_payer_scheme'
      await proxyCache.getCache().addDfspIdToProxyMapping(externalPayer, 'dfsp_b_proxy')

      const [positionProxyPre, positionPayeePre] = await ApiHelpers.getPositions(
        'dfsp_b_proxy', 'dfsp_a', 'BWP'
      )
      const payment = ApiHelpers.buildPayment()
        .deps(harness, dispatchHandler)
        .parties(externalPayer, 'dfsp_a')
        .transferId('3000022')
        .amount('38.92', 'BWP')
        .build()
      await payment.prepare()
      const [positionProxyAfterPrepare, positionPayeeAfterPrepare] = await ApiHelpers.getPositions(
        'dfsp_b_proxy', 'dfsp_a', 'BWP'
      )
      assertPositionDiff('payer', positionProxyPre, positionProxyAfterPrepare, {
        posted: 38.92
      })

      await payment.fulfil()
      const [positionProxyAfterFulfil, positionPayeeAfterFulfil] = await ApiHelpers.getPositions(
        'dfsp_b_proxy', 'dfsp_a', 'BWP'
      )
      assertPositionDiff('payee', positionPayeeAfterPrepare, positionPayeeAfterFulfil, {
        posted: -38.92
      })
    })

  it(
    `Scheme R: PUT /transfers call I.e. From: Proxy RB → To: Proxy AR
      If it is a normal transfer without currency conversion
      ProxyRB account must be updated`,
    async () => {
      const externalPayer = 'external_payer_scheme_r'
      const externalPayee = 'external_payee_scheme_r'
      await proxyCache.getCache().addDfspIdToProxyMapping(externalPayer, 'dfsp_a_proxy')
      await proxyCache.getCache().addDfspIdToProxyMapping(externalPayee, 'dfsp_b_proxy')
      const [positionProxyAPre, positionProxyBPre] = await ApiHelpers.getPositions(
        'dfsp_a_proxy', 'dfsp_b_proxy', 'BWP'
      )

      // Both parties are external.
      const payment = ApiHelpers.buildPayment()
        .deps(harness, dispatchHandler)
        .parties(externalPayer, externalPayee)
        .transferId('3000023')
        .amount('12.05', 'BWP')
        .build()
      await payment.prepare()
      const [positionProxyAPostPrepare] = await ApiHelpers.getPositions(
        'dfsp_a_proxy', 'dfsp_b_proxy', 'BWP'
      )
      assertPositionDiff('payer', positionProxyAPre, positionProxyAPostPrepare, {
        posted: 12.05
      })

      await payment.fulfil()
      const [_, positionProxyBPostFulfil] = await ApiHelpers.getPositions(
        'dfsp_a_proxy', 'dfsp_b_proxy', 'BWP'
      )
      assertPositionDiff('payee', positionProxyBPre, positionProxyBPostFulfil, {
        posted: -12.05
      })
    })

  it(
    `Scheme R: PUT /fxTransfer call I.e. From: FXP → To: Proxy AR
      No position changes should happen`,
    async () => {
      const externalPayer = 'external_payer_scheme_r'
      await proxyCache.getCache().addDfspIdToProxyMapping(externalPayer, 'dfsp_a_proxy')
      const positionProxyPre = await ApiHelpers.getPositionAccount('dfsp_a_proxy', 'BWP')
      const positionFxpPreBWP = await ApiHelpers.getPositionAccount('fxp_a', 'BWP')
      const positionFxpPreUSD = await ApiHelpers.getPositionAccount('fxp_a', 'USD')

      const forex = ApiHelpers.buildForex()
        .deps(harness, dispatchHandler)
        .commitRequestId('2000030')
        .determiningTransferId('3000030')
        .parties(externalPayer, 'fxp_a')
        .amountSource('100.00', 'BWP')
        .amountTarget('10.00', 'USD')
        .build()

      await forex.prepare()
      const positionProxyAfterPrepare = await ApiHelpers.getPositionAccount('dfsp_a_proxy', 'BWP')

      assertPositionDiff('payer', positionProxyPre, positionProxyAfterPrepare, {
        posted: 100
      })

      await forex.fulfil()

      // Fxp positions don't change until the payment gets processed.
      const positionFxpAfterFulfilBWP = await ApiHelpers.getPositionAccount('fxp_a', 'BWP')
      const positionFxpAfterFulfilUSD = await ApiHelpers.getPositionAccount('fxp_a', 'USD')
      assertPositionDiff('payer', positionFxpPreBWP, positionFxpAfterFulfilBWP, { posted: 0 })
      assertPositionDiff('payee', positionFxpPreUSD, positionFxpAfterFulfilUSD, { posted: 0 })
    })

  it(
    `Scheme R: PUT /fxTransfer call I.e. From: FXP → To: Proxy AR
      with wrong headers - ABORT VALIDATION`,
    async () => {
      const externalPayer = 'external_payer_scheme_r'
      await proxyCache.getCache().addDfspIdToProxyMapping(externalPayer, 'dfsp_a_proxy')
      const positionProxyPre = await ApiHelpers.getPositionAccount('dfsp_a_proxy', 'BWP')

      const forex = ApiHelpers.buildForex()
        .deps(harness, dispatchHandler)
        .commitRequestId('2000121')
        .determiningTransferId('3000121')
        .parties(externalPayer, 'fxp_a')
        .amountSource('100.00', 'BWP')
        .amountTarget('10.00', 'USD')
        .build()

      await forex.prepare()
      const positionProxyAfterPrepare = await ApiHelpers.getPositionAccount('dfsp_a_proxy', 'BWP')

      assertPositionDiff('payer', positionProxyPre, positionProxyAfterPrepare, {
        posted: 100
      })

      // Manually fulfil with bad headers.
      const messageFulfil = forex.buildMessageFulfil()
      messageFulfil.value.content.headers['fspiop-source'] = 'wrongfsp'
      const mark = harness.redpandaMark()
      await dispatchHandler.fulfil(null, messageFulfil)
      await harness.redpandaDrain(mark, 2) // maybe 1?

      const fxTransfer = await FxTransferService.getByIdLight('2000121')
      assert.equal(fxTransfer.fxTransferState, 'ABORTED_ERROR')

      // Position is reverted.
      const positionProxyAfterAbort = await ApiHelpers.getPositionAccount('dfsp_a_proxy', 'BWP')
      assertPositionDiff('payer', positionProxyPre, positionProxyAfterAbort, {
        posted: 0
      })
    })

  it(
    `Scheme R: PUT /transfers call I.e. From: Proxy RB → To: Proxy AR
      If it is a FX transfer with currency conversion
      FXP and ProxyRB account must be updated`,
    async () => {
      const externalPayer = 'external_payer_scheme_r2'
      const externalPayee = 'external_payee_scheme_r2'
      await proxyCache.getCache().addDfspIdToProxyMapping(externalPayer, 'dfsp_a_proxy')
      await proxyCache.getCache().addDfspIdToProxyMapping(externalPayee, 'dfsp_b_proxy')

      const positionProxyPayerPre = await ApiHelpers.getPositionAccount('dfsp_a_proxy', 'BWP')
      const positionFxpPreBWP = await ApiHelpers.getPositionAccount('fxp_a', 'BWP')
      const positionFxpPreUSD = await ApiHelpers.getPositionAccount('fxp_a', 'USD')
      const positionProxyPayeePre = await ApiHelpers.getPositionAccount('dfsp_b_proxy', 'USD')

      const forex = ApiHelpers.buildForex()
        .deps(harness, dispatchHandler)
        .commitRequestId('2000022')
        .determiningTransferId('3000222')
        .parties(externalPayer, 'fxp_a')
        .amountSource('100.00', 'BWP')
        .amountTarget('10.00', 'USD')
        .build()
      await forex.prepare()
      await forex.fulfil()

      const payment = ApiHelpers.buildPayment()
        .deps(harness, dispatchHandler)
        .parties(externalPayer, externalPayee)
        .transferId('3000222')
        .amount('10.00', 'USD')
        .fx()
        .build()
      await payment.prepareAndFulfil()

      const positionProxyPayerPost = await ApiHelpers.getPositionAccount('dfsp_a_proxy', 'BWP')
      const positionFxpPostBWP = await ApiHelpers.getPositionAccount('fxp_a', 'BWP')
      const positionFxpPostUSD = await ApiHelpers.getPositionAccount('fxp_a', 'USD')
      const positionProxyPayeePost = await ApiHelpers.getPositionAccount('dfsp_b_proxy', 'USD')

      assertPositionDiff('payer', positionProxyPayerPre, positionProxyPayerPost, { posted: 100 })
      assertPositionDiff('payer', positionFxpPreBWP, positionFxpPostBWP, { posted: -100 })
      assertPositionDiff('payer', positionFxpPreUSD, positionFxpPostUSD, { posted: 10 })
      assertPositionDiff('payee', positionProxyPayeePre, positionProxyPayeePost, { posted: -10 })
    }
  )

  it(
    `Scheme A: PUT /transfers call I.e. From: Proxy AR → To: Payer FSP
      If it is a FX transfer with currency conversion
      PayerFSP and ProxyAR account must be updated`,
    async () => {
      const externalFxp = 'external_fxp_schema_a'
      const externalPayee = 'external_payee_scheme_a'
      await proxyCache.getCache().addDfspIdToProxyMapping(externalFxp, 'dfsp_a_proxy')
      await proxyCache.getCache().addDfspIdToProxyMapping(externalPayee, 'dfsp_a_proxy')

      const positionPayerPre = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
      const positionProxyPre = await ApiHelpers.getPositionAccount('dfsp_a_proxy', 'BWP')

      // Set up Forex from in scheme payer to external Fxp.
      const forex = ApiHelpers.buildForex()
        .deps(harness, dispatchHandler)
        .commitRequestId('2000033')
        .determiningTransferId('3000033')
        .parties('dfsp_a', externalFxp)
        .amountSource('100.00', 'BWP')
        .amountTarget('10.00', 'USD')
        .build()
      await forex.prepare()

      const positionPayerPostFxPrepare = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
      assertPositionDiff('payer', positionPayerPre, positionPayerPostFxPrepare, { posted: 100 })

      await forex.fulfil()

      const payment = ApiHelpers.buildPayment()
        .deps(harness, dispatchHandler)
        .parties('dfsp_a', externalPayee)
        .transferId('3000033')
        .amount('10.00', 'USD')
        .fx()
        .build()
      await payment.prepareAndFulfil()

      const positionProxyPost = await ApiHelpers.getPositionAccount('dfsp_a_proxy', 'BWP')
      assertPositionDiff('payee', positionProxyPre, positionProxyPost, { posted: -100 })
    }
  )
})
