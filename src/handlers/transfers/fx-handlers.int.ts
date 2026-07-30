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
import { Snapshot } from "../../testing/snapshot"
import * as ApiHelpers from '../../testing/api-helpers'
import { DispatchTransferHandler } from "../../testing/dispatch-transfer-handler"

const harness = Harness.getInstance()
// let TransferHandler: any
let FxTransferService: any
let dispatchHandler: DispatchTransferHandler

describe('handlers/fx', () => {
  before(async () => {
    await harness.up('BATCH')
    await harness.setupGlobals()
    dispatchHandler = new DispatchTransferHandler(harness.config, 'SPLIT')
    await dispatchHandler.init()

    // Import after bringing up the harness, so that global config is overriden.
    // TransferHandler = require('./handler')
    FxTransferService = require('../../domain/fx/index')
    // await TransferHandler.registerPrepareHandler()
    // await TransferHandler.registerFulfilHandler()

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
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  it(`should publish a message to send error callback if fxTransfer does not exist`, async () => {
    const forex = ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId('4000001')
      .determiningTransferId('5000001')
      .parties('dfsp_b', 'dfsp_a')
      .amountSource('100.00', 'BWP')
      .amountTarget('10.00', 'USD')
      .build()

    const mark = harness.redpandaMark()
    await dispatchHandler.fulfil(null, forex.buildMessageFulfil())
    await harness.redpandaDrain(mark, 1)

    Snapshot.from(`[
      {
        "errorInformation": {
          "errorCode": "3208",
          "errorDescription": "Transfer ID not found - fxTransfer not found",
          "extensionList": {
            "extension": [
              {
                "key": "cause",
                "value": "FSPIOPError: fxTransfer not found:ignore
              }
            ]
          }
        }
      }
    ]`).checkUnwrap(harness.spoolLastPayload(1))
  })

  it(`should process fxFulfil message (happy path)`, async () => {
    const forex = ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId('4000002')
      .determiningTransferId('5000002')
      .parties('dfsp_a', 'dfsp_b')
      .amountSource('100.00', 'BWP')
      .amountTarget('10.00', 'USD')
      .build()

    await forex.prepare()
    let fxTransfer = await FxTransferService.getByIdLight('4000002')

    Snapshot.from(`{
      "commitRequestId": "4000002",
      "determiningTransferId": "5000002",
      "sourceAmount": "100.0000",
      "targetAmount": "10.0000",
      "sourceCurrency": "BWP",
      "targetCurrency": "USD",
      "ilpCondition": :ignore
      "expirationDate": :ignore
      "createdDate": :ignore
      "fxTransferStateChangeId": :ignore
      "fxTransferState": "RESERVED",
      "fxTransferStateEnumeration": "RESERVED",
      "fxTransferStateDescription": "The switch has reserved the transfer.",
      "reason": null,
      "completedTimestamp": :ignore
      "condition": :ignore
      "fulfilment": null
    }`).checkUnwrap(fxTransfer)

    await forex.fulfil()
    fxTransfer = await FxTransferService.getByIdLight('4000002')

    Snapshot.from(`{
      "commitRequestId": "4000002",
      "determiningTransferId": "5000002",
      "sourceAmount": "100.0000",
      "targetAmount": "10.0000",
      "sourceCurrency": "BWP",
      "targetCurrency": "USD",
      "ilpCondition": :ignore
      "expirationDate": :ignore
      "createdDate": :ignore
      "fxTransferStateChangeId": 3,
      "fxTransferState": "RECEIVED_FULFIL_DEPENDENT",
      "fxTransferStateEnumeration": "RESERVED",
      "fxTransferStateDescription": "The switch has reserved the fxTransfer fulfilment.",
      "reason": null,
      "completedTimestamp": :ignore
      "condition": :ignore
      "fulfilment": :ignore
    }`).checkUnwrap(fxTransfer)

  })

  it(`should check duplicates, and detect modified request`, async () => {
    const fxId = '4000003'
    const forexA = ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId(fxId)
      .determiningTransferId('5000003')
      .parties('dfsp_a', 'dfsp_b')
      .amountSource('100.00', 'BWP')
      .amountTarget('10.00', 'USD')
      .build()

    const forexB = ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId(fxId)
      .determiningTransferId('5000003')
      .parties('dfsp_b', 'dfsp_a')
      .amountSource('100.00', 'BWP')
      .amountTarget('10.00', 'USD')
      .build()

    // Prepare the first.
    await forexA.prepare()

    // Manually prepare the 2nd.
    const mark = harness.redpandaMark()
    await dispatchHandler.prepare(null, forexB.buildMessagePrepare())
    await harness.redpandaDrain(mark, 1)

    Snapshot.from(`[
      {
        "errorInformation": {
          "errorCode": "3106",
          "errorDescription": "Modified request",
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

  it(`should detect an invalid fulfilment`, async () => {
    const forex = ApiHelpers.buildForex()
      .deps(harness, dispatchHandler)
      .commitRequestId('4000004')
      .determiningTransferId('5000004')
      .parties('dfsp_a', 'dfsp_b')
      .amountSource('100.00', 'BWP')
      .amountTarget('10.00', 'USD')
      .build()

    await forex.prepare()

    // Manually override the fulfilment.
    const messageFulfil = forex.buildMessageFulfil()
    assert(messageFulfil.value.content.payload)
    messageFulfil.value.content.payload.fulfilment = 'invalid-fulfilment'
    const mark = harness.redpandaMark()
    await dispatchHandler.fulfil(null, messageFulfil)
    await harness.redpandaDrain(mark, 1)

    Snapshot.from(`[
      {
        "errorInformation": {
          "errorCode": "3100",
          "errorDescription": "Generic validation error - Invalid FX fulfilment",
          "extensionList": {
            "extension": [
              {
                "key": "cause",
                "value": "FSPIOPError: Invalid FX:ignore
              }
            ]
          }
        }
      }
    ]`).checkUnwrap(harness.spoolLastPayload(1))
  })
})
