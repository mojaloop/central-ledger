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

import TransferHandler from '../../handlers/transfers/handler'
const harness = Harness.getInstance()
const TransferExtension = require('./transferExtension')

describe('models/tranfer/transferExtension', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()

    await TransferHandler.registerPrepareHandler()
    await TransferHandler.registerFulfilHandler()

    // Create the hub accounts + settlement model.
    const createHubPayload: ApiHelpers.CreateHubPayload = {
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
    }
    await ApiHelpers.createHub(harness, createHubPayload)
    // Create 2 test dfsps to transfer between.
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_a',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [
        {
          initialPosition: 0,
          value: 100000
        }
      ],
      deposits: [10000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_b',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [
        {
          initialPosition: 0,
          value: 100000
        }
      ],
      deposits: [10000]
    })

    await ApiHelpers.buildPayment()
      .deps(harness, TransferHandler)
      .parties('dfsp_a', 'dfsp_b')
      .transferId('5000001')
      .amount('1.50')
      .build()
      .prepareAndFulfil()
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  it('saveTransferExtension() and getByTransferId()', async () => {
    await TransferExtension.saveTransferExtension({
      transferId: '5000001',
      key: 'key_1',
      value: 'value_1',
      createdDate: new Date(),
    })

    const result = await TransferExtension.getByTransferId('5000001')
    Snapshot.from(`[
        {
          "transferExtensionId": 3,
          "transferId": "5000001",
          "key": "key_1",
          "value": "value_1",
          "isFulfilment": 0,
          "isError": 0,
          "createdDate": :ignore
        }
      ]`).checkUnwrap(result)
  })

  it('saveTransferExtension() without a transferId fails', { expectFailure: true }, async () => {
    await TransferExtension.saveTransferExtension({
      key: 'key_1',
      value: 'value_1',
      createdDate: new Date(),
    })
  })

  it('saveTransferExtension() without a value fails', { expectFailure: true }, async () => {
    await TransferExtension.saveTransferExtension({
      transferId: '5000001',
      key: 'key_1',
      createdDate: new Date(),
    })
  })
})
