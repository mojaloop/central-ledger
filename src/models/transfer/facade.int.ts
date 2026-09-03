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

const harness = Harness.getInstance()
import TransferFacade from "./facade"

describe('models/tranfer/facade', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()

    // Create the hub accounts + settlement model.
    await ApiHelpers.buildHub()
      .deps(harness)
      .currency('USD')
      .build()
      .create()
      
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

    // Create payment of $100.00 USD from dfsp_a to dfsp_b with id 1000001.
    await ApiHelpers.buildPayment()
      .deps(harness, harness.messageBus)
      .parties('dfsp_a', 'dfsp_b')
      .transferId('1000001')
      .build()
      .prepareAndFulfil()
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  it('getById() - gets one transfer.', async () => {
    const transfer = await TransferFacade.getById('1000001')
    Snapshot.from(`{
      "transferId": "1000001",
      "amount": "100.0000",
      "currencyId": "USD",
      "ilpCondition": :ignore
      "expirationDate": :ignore
      "createdDate": :ignore
      "currency": "USD",
      "payerParticipantCurrencyId": 3,
      "payerAmount": "100.0000",
      "payerParticipantId": 2,
      "payerFsp": "dfsp_a",
      "payerIsProxy": 0,
      "payeeParticipantCurrencyId": null,
      "payeeAmount": "-100.0000",
      "payeeParticipantId": 3,
      "payeeFsp": "dfsp_b",
      "payeeIsProxy": 0,
      "transferStateChangeId": 12,
      "transferState": "COMMITTED",
      "reason": null,
      "completedTimestamp": :ignore
      "transferStateEnumeration": "COMMITTED",
      "transferStateDescription": "The switch has successfully performed the transfer.",
      "ilpPacket": :ignore
      "condition": :ignore
      "fulfilment": :ignore
      "errorCode": null,
      "errorDescription": null,
      "externalPayerName": null,
      "externalPayeeName": null,
      "extensionList": [],
      "isTransferReadModel": true
    }`).checkUnwrap(transfer)
  })
})
