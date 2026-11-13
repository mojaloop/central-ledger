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

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { randomUUID } from 'node:crypto'
import { processPositionFxFulfilBin } from './fx-fulfil'

const REQUESTER = 'dfsp_requester'
const FXP = 'fxp'

/** The FXP's fulfil of a conversion (FX_RESERVE), as the fx fulfil handler sends it. */
const buildFxReserveBinItem = (commitRequestId: string): any => ({
  message: {
    value: {
      id: commitRequestId,
      from: FXP,
      to: REQUESTER,
      content: {
        uriParams: { id: commitRequestId },
        headers: { 'fspiop-source': FXP, 'fspiop-destination': REQUESTER },
        payload: {}
      },
      metadata: { event: { type: 'position', action: 'fx-reserve' } }
    }
  },
  decodedPayload: { conversionState: 'RESERVED', fulfilment: 'fulfilment', completedTimestamp: '2026-11-12T00:00:00.000Z' }
})

describe('domain/position/fx-fulfil: FX_RESERVE by conversion state', () => {
  it('forwards the fulfil to the requesting DFSP when RECEIVED_FULFIL_DEPENDENT, with no state change', async () => {
    const commitRequestId = randomUUID()
    const binItem = buildFxReserveBinItem(commitRequestId)

    const result = await processPositionFxFulfilBin([binItem], { accumulatedFxTransferStates: { [commitRequestId]: 'RECEIVED_FULFIL_DEPENDENT' } })

    assert.strictEqual(result.notifyMessages.length, 1)
    assert.strictEqual(result.notifyMessages[0].message.to, REQUESTER)
    assert.strictEqual(result.accumulatedFxTransferStateChanges.length, 0)
    assert.deepStrictEqual(binItem.result, { success: true })
  })

  for (const state of ['COMMITTED', 'SETTLED']) {
    it(`sends nothing for a copy that finds ${state}, and doesn't relabel it`, async () => {
      const commitRequestId = randomUUID()
      const binItem = buildFxReserveBinItem(commitRequestId)

      const result = await processPositionFxFulfilBin([binItem], { accumulatedFxTransferStates: { [commitRequestId]: state } })

      assert.strictEqual(result.notifyMessages.length, 0, 'nothing sent')
      assert.strictEqual(result.accumulatedFxTransferStateChanges.length, 0, 'no relabel to ABORTED_REJECTED')
      assert.strictEqual(result.accumulatedFxTransferStates[commitRequestId], state)
      assert.deepStrictEqual(binItem.result, { success: true }, 'counted as processed')
    })
  }

  for (const state of ['RECEIVED_ERROR', 'ABORTED_ERROR', 'ABORTED_REJECTED', 'RESERVED_TIMEOUT', 'EXPIRED_RESERVED', 'RESERVED']) {
    it(`keeps the error to the FXP, without relabelling the conversion, when it is ${state}`, async () => {
      const commitRequestId = randomUUID()
      const binItem = buildFxReserveBinItem(commitRequestId)

      const result = await processPositionFxFulfilBin([binItem], { accumulatedFxTransferStates: { [commitRequestId]: state } })

      assert.strictEqual(result.notifyMessages.length, 1, 'one error')
      assert.strictEqual(result.notifyMessages[0].message.to, FXP, 'sent to the FXP')
      assert.strictEqual(result.notifyMessages[0].message.content.payload.errorInformation.errorCode, '2001')
      assert.strictEqual(result.accumulatedFxTransferStateChanges.length, 0, 'no relabel to ABORTED_REJECTED')
      assert.strictEqual(result.accumulatedFxTransferStates[commitRequestId], state, 'state unchanged')
    })
  }
})
