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
 * An fx-timeout-reserved position message must release the conversion's reservation once, whatever
 * copies of it arrive, and must not fail the batch for a conversion in another state.
 *
 * Design: position-idempotency-timeout.md, Change B (FX)
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { randomUUID } from 'node:crypto'
import { processPositionFxTimeoutReservedBin } from './fx-timeout-reserved'

const REQUESTER = 'dfsp_requester'
const FXP = 'fxp'
const ACCOUNT_ID = '7'
// The reserved participantPositionChange of the conversion, positive
const RESERVED_AMOUNT = 2

/** An fx-timeout-reserved position message, as the timeout handler sends it. A new object for each copy. */
const buildFxTimeoutReservedBinItem = (commitRequestId: string): any => ({
  message: {
    key: Buffer.from(ACCOUNT_ID),
    value: {
      id: commitRequestId,
      from: REQUESTER,
      to: FXP,
      content: {
        uriParams: { id: commitRequestId },
        headers: { 'fspiop-source': 'Hub', 'fspiop-destination': REQUESTER },
        payload: {},
        context: {}
      },
      metadata: { event: { type: 'position', action: 'fx-timeout-reserved' } }
    }
  }
})

const runFxTimeoutReserved = (binItems: Array<any>, accumulatedFxTransferStates: Record<string, string | undefined>) =>
  processPositionFxTimeoutReservedBin(binItems, {
    accumulatedPositionValue: 0,
    accumulatedPositionReservedValue: 0,
    accumulatedFxTransferStates,
    fetchedReservedPositionChangesByCommitRequestIds: Object.fromEntries(
      Object.keys(accumulatedFxTransferStates).map(id => [id, { [ACCOUNT_ID]: { change: RESERVED_AMOUNT } }])
    )
  })

describe('domain/position/fx-timeout-reserved: duplicate and late fx-timeout-reserved messages', () => {
  it('releases a RESERVED_TIMEOUT conversion once and notifies once', async () => {
    const commitRequestId = randomUUID()
    const binItem = buildFxTimeoutReservedBinItem(commitRequestId)

    const result = await runFxTimeoutReserved([binItem], { [commitRequestId]: 'RESERVED_TIMEOUT' })

    assert.strictEqual(result.accumulatedPositionValue, -RESERVED_AMOUNT, 'position goes down by the reserved amount')
    assert.strictEqual(result.accumulatedPositionChanges.length, 1)
    assert.deepStrictEqual(result.accumulatedFxTransferStateChanges.map((change: any) => change.transferStateId), ['EXPIRED_RESERVED'])
    assert.strictEqual(result.notifyMessages.length, 1)
    assert.strictEqual(result.accumulatedFxTransferStates[commitRequestId], 'EXPIRED_RESERVED')
    assert.deepStrictEqual(binItem.result, { success: true })
  })

  it('releases once for two copies in one bin', async () => {
    const commitRequestId = randomUUID()
    const copies = [buildFxTimeoutReservedBinItem(commitRequestId), buildFxTimeoutReservedBinItem(commitRequestId)]

    const result = await runFxTimeoutReserved(copies, { [commitRequestId]: 'RESERVED_TIMEOUT' })

    assert.strictEqual(result.accumulatedPositionValue, -RESERVED_AMOUNT, 'position goes down by the reserved amount once')
    assert.strictEqual(result.accumulatedPositionChanges.length, 1, 'one participantPositionChange')
    assert.strictEqual(result.accumulatedFxTransferStateChanges.length, 1, 'one EXPIRED_RESERVED')
    assert.strictEqual(result.notifyMessages.length, 1, 'one notification')
    assert.deepStrictEqual(copies.map(copy => copy.result), [{ success: true }, { success: true }], 'both counted as processed')
  })

  const SKIPPED_STATES: Array<[string, string | undefined]> = [
    ['already_done', 'EXPIRED_RESERVED'],
    ['already_decided', 'RECEIVED_FULFIL_DEPENDENT'],
    ['already_decided', 'COMMITTED'],
    ['already_decided', 'RECEIVED_ERROR'],
    ['already_decided', 'ABORTED_ERROR'],
    ['unexpected', 'RESERVED'],
    ['unexpected', 'EXPIRED_PREPARED'],
    ['unexpected', undefined]
  ]

  for (const [outcome, state] of SKIPPED_STATES) {
    it(`is a no-op, without throwing, for a conversion in ${state} (${outcome})`, async () => {
      const commitRequestId = randomUUID()
      const binItem = buildFxTimeoutReservedBinItem(commitRequestId)

      const result = await runFxTimeoutReserved([binItem], { [commitRequestId]: state })

      assert.strictEqual(result.accumulatedPositionValue, 0, 'position unchanged')
      assert.strictEqual(result.accumulatedPositionChanges.length, 0, 'no position change')
      assert.strictEqual(result.accumulatedFxTransferStateChanges.length, 0, 'no state change')
      assert.strictEqual(result.notifyMessages.length, 0, 'nothing sent')
      assert.strictEqual(result.accumulatedFxTransferStates[commitRequestId], state, 'state unchanged')
      assert.deepStrictEqual(binItem.result, { success: true }, 'counted as processed')
    })
  }
})
