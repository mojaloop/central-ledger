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
import { assertPositionDiff, futureDate } from "../../testing/util"

const harness = Harness.getInstance()
let ExternalParticipantCached: any
let TransferFacade: any
let FxTransferService: any
let proxyCache: any

describe('handlers/tx-timeout', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()

    // Import after bringing up the harness, so the global config is overriden.
    TransferFacade = require('../../models/transfer/facade')
    FxTransferService = require('../../domain/fx/index')
    ExternalParticipantCached = require('../../models/participant/externalParticipantCached')
    proxyCache = require('../../lib/proxyCache')
    await proxyCache.connect()

    // Create the hub accounts + settlement model.
    await ApiHelpers.buildHub()
      .deps(harness)
      .currency('BWP')
      .currency('USD')
      .build()
      .create()

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
      .deps(harness, harness.messageBus)
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

  it('FX Transfer expires without dependent transfer, then resets the position', async () => {
    const positionPayerPre = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
    const forex = ApiHelpers.buildForex()
      .deps(harness, harness.messageBus)
      .commitRequestId('8000001')
      .determiningTransferId('9000001')
      .parties('dfsp_a', 'fxp_a')
      .amountSource('100.00', 'BWP')
      .amountTarget('10.00', 'USD')
      .expiry(1)
      .build()

    await forex.prepare()

    const positionPayerPostPrepare = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
    assertPositionDiff('payer', positionPayerPre, positionPayerPostPrepare, { posted: 100 })

    let fxTransfer = await FxTransferService.getByIdLight('8000001')
    assert.equal(fxTransfer.fxTransferState, 'RESERVED')

    await harness.messageBus.timeout(futureDate(10, 'm'))
    await harness.redpandaDrainSmart(harness.expect.messagesForexTimeout(), '8000001')

    fxTransfer = await FxTransferService.getByIdLight('8000001')
    assert.equal(fxTransfer.fxTransferState, 'EXPIRED_RESERVED')
    const positionPayerPostTimeout = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
    assertPositionDiff('payer', positionPayerPre, positionPayerPostTimeout, { posted: 0 })
  })

  it('FX + dependent transfer timeout resets both payer and FXP target currency positions.', async () => {
    const positionPayerPre = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
    const positionFxpUsdPre = await ApiHelpers.getPositionAccount('fxp_a', 'USD')

    const forex = ApiHelpers.buildForex()
      .deps(harness, harness.messageBus)
      .commitRequestId('8000002')
      .determiningTransferId('9000002')
      .parties('dfsp_a', 'fxp_a')
      .amountSource('100.00', 'BWP')
      .amountTarget('10.00', 'USD')
      .expiry(30)
      .build()

    await forex.prepare()

    const positionPayerPostFxPrepare = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
    assertPositionDiff('payer', positionPayerPre, positionPayerPostFxPrepare, { posted: 100 })

    await forex.fulfil()

    let fxTransfer = await FxTransferService.getByIdLight('8000002')
    assert.equal(fxTransfer.fxTransferState, 'RECEIVED_FULFIL_DEPENDENT')

    const payment = ApiHelpers.buildPayment()
      .deps(harness, harness.messageBus)
      .parties('fxp_a', 'dfsp_b')
      .transferId('9000002')
      .amount('10.00', 'USD')
      .expiry(1)
      .fx('8000002')
      .build()

    await payment.prepare()

    // Now time out the payment.
    await harness.messageBus.timeout(futureDate(10, 'm'))
    await harness.redpandaDrainSmart(harness.expect.messagesForexTimeout(), '8000002')
    await harness.redpandaDrainSmart(harness.expect.messagesPaymentTimeout(), '9000002')

    const transfer = await TransferFacade.getById('9000002')
    assert.equal(transfer.transferState, 'EXPIRED_RESERVED')

    const positionPayerPostTimeout = await ApiHelpers.getPositionAccount('dfsp_a', 'BWP')
    assertPositionDiff('payer', positionPayerPre, positionPayerPostTimeout, { posted: 0 })

    const positionFxpUsdPostTimeout = await ApiHelpers.getPositionAccount('fxp_a', 'USD')
    assertPositionDiff('payer', positionFxpUsdPre, positionFxpUsdPostTimeout, { posted: 0 })
  })
})
