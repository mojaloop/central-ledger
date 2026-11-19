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
 * A timeout-reserved position message must release the payer's reservation once, whatever copies
 * of it arrive, and must not fail the batch for a transfer in another state.
 *
 * Design: position-idempotency-timeout.md, Change B
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { randomUUID } from 'node:crypto'
import { processPositionTimeoutReservedBin } from './timeout-reserved'

const PAYER = 'dfsp1'
const PAYEE = 'dfsp2'
// The amount is read from the payee's transferParticipant row, so it is negative
const PAYEE_AMOUNT = -2

/** A timeout-reserved position message, as the timeout handler sends it. A new object for each copy. */
const buildTimeoutReservedBinItem = (transferId: string): any => ({
  message: {
    value: {
      id: transferId,
      from: PAYER,
      to: PAYEE,
      content: {
        uriParams: { id: transferId },
        headers: { 'fspiop-source': 'Hub', 'fspiop-destination': PAYER },
        payload: {},
        context: {}
      },
      metadata: { event: { type: 'position', action: 'timeout-reserved' } }
    }
  }
})

const runTimeoutReserved = (binItems: Array<any>, accumulatedTransferStates: Record<string, string | undefined>) =>
  processPositionTimeoutReservedBin(binItems, {
    accumulatedPositionValue: 0,
    accumulatedPositionReservedValue: 0,
    accumulatedTransferStates,
    transferInfoList: Object.fromEntries(Object.keys(accumulatedTransferStates).map(id => [id, { amount: PAYEE_AMOUNT }]))
  })

describe('domain/position/timeout-reserved: duplicate and late timeout-reserved messages', () => {
  it('releases a RESERVED_TIMEOUT transfer once and notifies once', async () => {
    const transferId = randomUUID()
    const binItem = buildTimeoutReservedBinItem(transferId)

    const result = await runTimeoutReserved([binItem], { [transferId]: 'RESERVED_TIMEOUT' })

    assert.strictEqual(result.accumulatedPositionValue, PAYEE_AMOUNT, 'payer position goes down by the amount')
    assert.strictEqual(result.accumulatedPositionChanges.length, 1)
    assert.deepStrictEqual(result.accumulatedTransferStateChanges.map((change: any) => change.transferStateId), ['EXPIRED_RESERVED'])
    assert.strictEqual(result.notifyMessages.length, 1)
    assert.strictEqual(result.accumulatedTransferStates[transferId], 'EXPIRED_RESERVED')
    assert.deepStrictEqual(binItem.result, { success: true })
  })

  it('releases once for two copies in one bin', async () => {
    const transferId = randomUUID()
    const copies = [buildTimeoutReservedBinItem(transferId), buildTimeoutReservedBinItem(transferId)]

    const result = await runTimeoutReserved(copies, { [transferId]: 'RESERVED_TIMEOUT' })

    assert.strictEqual(result.accumulatedPositionValue, PAYEE_AMOUNT, 'payer position goes down by the amount once')
    assert.strictEqual(result.accumulatedPositionChanges.length, 1, 'one participantPositionChange')
    assert.strictEqual(result.accumulatedTransferStateChanges.length, 1, 'one EXPIRED_RESERVED')
    assert.strictEqual(result.notifyMessages.length, 1, 'one notification')
    assert.deepStrictEqual(copies.map(copy => copy.result), [{ success: true }, { success: true }], 'both counted as processed')
  })

  it('releases a duplicate\'s neighbour as usual', async () => {
    const transferId = randomUUID()
    const otherTransferId = randomUUID()

    const result = await runTimeoutReserved(
      [buildTimeoutReservedBinItem(transferId), buildTimeoutReservedBinItem(transferId), buildTimeoutReservedBinItem(otherTransferId)],
      { [transferId]: 'RESERVED_TIMEOUT', [otherTransferId]: 'RESERVED_TIMEOUT' }
    )

    assert.strictEqual(result.accumulatedPositionValue, 2 * PAYEE_AMOUNT, 'each transfer released once')
    assert.deepStrictEqual(
      result.accumulatedTransferStateChanges.map((change: any) => change.transferId),
      [transferId, otherTransferId]
    )
    assert.strictEqual(result.notifyMessages.length, 2)
  })

  const SKIPPED_STATES: Array<[string, string | undefined]> = [
    ['already_done', 'EXPIRED_RESERVED'],
    ['already_decided', 'RECEIVED_FULFIL'],
    ['already_decided', 'COMMITTED'],
    ['already_decided', 'SETTLED'],
    ['already_decided', 'RECEIVED_ERROR'],
    ['already_decided', 'ABORTED_ERROR'],
    ['unexpected', 'RESERVED'],
    ['unexpected', 'EXPIRED_PREPARED'],
    ['unexpected', undefined]
  ]

  for (const [outcome, state] of SKIPPED_STATES) {
    it(`is a no-op, without throwing, for a transfer in ${state} (${outcome})`, async () => {
      const transferId = randomUUID()
      const binItem = buildTimeoutReservedBinItem(transferId)

      const result = await runTimeoutReserved([binItem], { [transferId]: state })

      assert.strictEqual(result.accumulatedPositionValue, 0, 'position unchanged')
      assert.strictEqual(result.accumulatedPositionChanges.length, 0, 'no position change')
      assert.strictEqual(result.accumulatedTransferStateChanges.length, 0, 'no state change')
      assert.strictEqual(result.notifyMessages.length, 0, 'nothing sent')
      assert.strictEqual(result.accumulatedTransferStates[transferId], state, 'state unchanged')
      assert.deepStrictEqual(binItem.result, { success: true }, 'counted as processed')
    })
  }

  it('skips a late copy and still releases a transfer next to it', async () => {
    const committedTransferId = randomUUID()
    const transferId = randomUUID()

    const result = await runTimeoutReserved(
      [buildTimeoutReservedBinItem(committedTransferId), buildTimeoutReservedBinItem(transferId)],
      { [committedTransferId]: 'COMMITTED', [transferId]: 'RESERVED_TIMEOUT' }
    )

    assert.strictEqual(result.accumulatedPositionValue, PAYEE_AMOUNT, 'only the RESERVED_TIMEOUT transfer is released')
    assert.deepStrictEqual(
      result.accumulatedTransferStateChanges.map((change: any) => [change.transferId, change.transferStateId]),
      [[transferId, 'EXPIRED_RESERVED']]
    )
    assert.strictEqual(result.accumulatedTransferStates[committedTransferId], 'COMMITTED')
  })
})
