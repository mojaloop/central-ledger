/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
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

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------
 ******/


import { after, before, describe, it } from 'node:test'
import Harness from '../testing/harness'
import * as ApiHelpers from '../testing/api-helpers'
import { assertPositionDiff } from '../testing/util'
import { DispatchTransferHandler } from './dispatch-transfer-handler'
import { MessageBus } from '../messaging/message-bus'
import { PositionHandlerV2 } from './position-v2'

const harness = Harness.getInstance()
let PositionBatchHandler: any
let ExternalParticipantCached: any
let TransferFacade: any
let FxTransferService: any
let proxyCache: any
let dispatchHandler: DispatchTransferHandler
let messageBus: MessageBus

describe('handlers/payment', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()
    // Import after bringing up the harness, so that global config is overriden.
    PositionBatchHandler = require('./positions/handlerBatch')
    TransferFacade = require('../models/transfer/facade')
    FxTransferService = require('../domain/fx/index')
    ExternalParticipantCached = require('../models/participant/externalParticipantCached')
    const SettlementModelCached = require('../models/settlement/settlementModelCached')
    await SettlementModelCached.initialize()
    proxyCache = require('../lib/proxyCache')
    await proxyCache.connect()

    dispatchHandler = new DispatchTransferHandler(harness.config)
    const positionHandlerV2 = new PositionHandlerV2(harness.config)
    messageBus = new MessageBus({
      config: harness.config,
      handlers: {
        dispatchTransferHandler: dispatchHandler,
        positionBatchHandler: positionHandlerV2
      }
    })
    await messageBus.init()

    // Create the hub accounts + settlement model.
    const createHubPayload: ApiHelpers.CreateHubPayload = {
      currencies: ['USD'],
      settlementModels: [
        {
          name: `DEFERRED_MULTILATERAL_NET_USD`,
          settlementGranularity: 'NET',
          settlementInterchange: 'MULTILATERAL',
          settlementDelay: 'DEFERRED',
          currency: 'USD',
          requireLiquidityCheck: true,
          ledgerAccountType: 'POSITION',
          settlementAccountType: 'SETTLEMENT',
          autoPositionReset: true
        }
      ]
    }
    await ApiHelpers.createHub(harness, createHubPayload)
    // Create 2 test dfsps to transfer between.
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_a',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
      deposits: [10000]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_b',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [
        { initialPosition: 0, value: 100000 }
      ],
      deposits: [10000]
    })
  })

  after(async () => {
    await messageBus.deinit()
    await proxyCache.disconnect()
    await harness.teardownGlobals()
    await harness.down()
  })

  it('prepares and fulfils a payment (dispatchHandler)', async () => {
    const [positionPayer1, positionPayee1] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'USD')
    
    // Create payment of $100.00 USD from dfsp_a to dfsp_b with id 1000001.
    const payment = await ApiHelpers.buildPayment()
      .deps(harness, dispatchHandler)
      .parties('dfsp_a', 'dfsp_b')
      .transferId('1000001')
      .expiry(100)
      .build()
      .prepare()

    const [positionPayer2, positionPayee2] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'USD')
    assertPositionDiff('payer', positionPayer1, positionPayer2, {
      pending: 0,
      posted: 100
    })
    assertPositionDiff('payee', positionPayee1, positionPayee2, {
      pending: 0,
      posted: 0
    })

    await payment.fulfil()
    const [positionPayer3, positionPayee3] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'USD')
    assertPositionDiff('payer', positionPayer2, positionPayer3, {
      posted: 0
    })
    assertPositionDiff('payee', positionPayee2, positionPayee3, {
      posted: -100
    })
  })

  it.only('prepares and fulfils a payment (MessageBus)', async () => {
    const [positionPayer1, positionPayee1] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'USD')
    
    // Create payment of $100.00 USD from dfsp_a to dfsp_b with id 1000001.
    const payment = await ApiHelpers.buildPayment()
      .deps(harness, messageBus)
      .parties('dfsp_a', 'dfsp_b')
      .transferId('1000001')
      .expiry(100)
      .build()
      .prepare()

    const [positionPayer2, positionPayee2] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'USD')
    assertPositionDiff('payer', positionPayer1, positionPayer2, {
      pending: 0,
      posted: 100
    })
    assertPositionDiff('payee', positionPayee1, positionPayee2, {
      pending: 0,
      posted: 0
    })

    await payment.fulfil()
    const [positionPayer3, positionPayee3] = await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', 'USD')
    assertPositionDiff('payer', positionPayer2, positionPayer3, {
      posted: 0
    })
    assertPositionDiff('payee', positionPayee2, positionPayee3, {
      posted: -100
    })
  })
})
