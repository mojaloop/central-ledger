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
import assert from "node:assert"
import Harness from '../../testing/harness'
import * as ApiHelpers from '../../testing/api-helpers'
import { DispatchTransferHandler } from "../dispatch-transfer-handler"
import { assertPositionDiff } from "../../testing/util"
import { Snapshot } from "../../testing/snapshot"

const harness = Harness.getInstance()
let ExternalParticipantCached: any
let TransferFacade: any
let FxTransferService: any
let proxyCache: any
let dispatchHandler: DispatchTransferHandler

describe('handlers/fx-abort', () => {
  before(async () => {
    await harness.up('BATCH')
    await harness.setupGlobals()
    dispatchHandler = new DispatchTransferHandler(harness.config)
    await dispatchHandler.init()

    // Import after bringing up the harness, so that global config is overriden.
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

  it.only('Aborting a transfer also aborts linked fxTransfer, all positions revert.', async () => {
    const positionPayerPre = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
    const positionFxpBwpPre = await ApiHelpers.getPositionAccount('fxp_a', 'BWP')
    const positionFxpUsdPre = await ApiHelpers.getPositionAccount('fxp_a', 'USD')
    const positionPayeePre = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')

    const forex = ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId('5000001')
      .determiningTransferId('6000001')
      .parties('dfsp_a', 'fxp_a')
      .amountSource('100.00', 'BWP')
      .amountTarget('10.00', 'USD')
      .build()

    await forex.prepare()
    const positionPayerPostPrepare = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
    assertPositionDiff('payer', positionPayerPre, positionPayerPostPrepare, { posted: 100 })

    await forex.fulfil()
    const fxTransferAfterFulfil = await FxTransferService.getByIdLight('5000001')
    assert.equal(fxTransferAfterFulfil.fxTransferState, 'RECEIVED_FULFIL_DEPENDENT')

    const payment = ApiHelpers.buildPayment()
      .deps(harness, dispatchHandler)
      .parties('fxp_a', 'dfsp_b')
      .transferId('6000001')
      .amount('10.00', 'USD')
      .fx()
      .build()

    await payment.prepare()
    // Need to do a custom fulfil here, as we expect 4 messages due to FX.
    const mark = harness.redpandaMark()
    await dispatchHandler.fulfil(null, payment.buildMessageAbort())
    // UNFUSE: 4, FUSE: 2.
    await harness.redpandaDrain(mark, 3)

    Snapshot.from(`[
        "topic-notification-event",
        "topic-transfer-position-batch",
        "topic-notification-event"
      ]`).checkUnwrap(harness.spoolLastTopic(3))

    Snapshot.from(`[
        {
          "conversionState": "ABORTED"
        },
        {
          "errorInformation": {
            "errorCode": "5100",
            "errorDescription": "Payer rejected the transfer"
          }
        },
        {
          "errorInformation": {
            "errorCode": "5100",
            "errorDescription": "Payer rejected the transfer",
            "extensionList": {
              "extension": [
                {
                  "key": "cause",
                  "val:ignore
                }
              ]
            }
          }
        }
      ]`).checkUnwrap(harness.spoolLastPayload(3))

    const transfer = await TransferFacade.getById('6000001')
    assert.equal(transfer.transferState, 'ABORTED_ERROR')
    const fxTransferAfterAbort = await FxTransferService.getByIdLight('5000001')
    assert.equal(fxTransferAfterAbort.fxTransferState, 'ABORTED_ERROR')

    // All positions reset.
    const positionPayerPostAbort = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
    assertPositionDiff('payer', positionPayerPre, positionPayerPostAbort, { posted: 0 })
    const positionFxpUsdPostAbort = await ApiHelpers.getPositionAccount('fxp_a', 'USD')
    assertPositionDiff('payer', positionFxpUsdPre, positionFxpUsdPostAbort, { posted: 0 })
    const positionPayeePostAbort = await ApiHelpers.getPositionAccount('dfsp_b', 'USD')
    assertPositionDiff('payee', positionPayeePre, positionPayeePostAbort, { posted: 0 })
    const positionFxpBwpPostAbort = await ApiHelpers.getPositionAccount('fxp_a', 'BWP')
    assertPositionDiff('payer', positionFxpBwpPre, positionFxpBwpPostAbort, { posted: 0 })
  })
})
