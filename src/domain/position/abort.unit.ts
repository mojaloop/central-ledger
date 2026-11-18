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
import { Enum } from '@mojaloop/central-services-shared'
import { processPositionAbortBin } from './abort'

const Action = Enum.Events.Event.Action
const PAYER = 'dfsp_payer'
const PAYEE = 'dfsp_payee'
const PAYER_ACCOUNT = 11
const RESERVED_AMOUNT = 100

/**
 * A regular (non-FX) abort position message, as the fulfil handler sends it: one step that releases
 * the payer's reservation, and no transferStateChanges (what Cyril returns for a transfer with no fxTransfer).
 */
const buildAbortBinItem = (transferId: string, action: string): any => ({
  message: {
    value: {
      id: transferId,
      from: PAYEE,
      to: PAYER,
      content: {
        uriParams: { id: transferId },
        headers: { 'fspiop-source': PAYEE, 'fspiop-destination': PAYER },
        payload: {},
        context: {
          cyrilResult: {
            positionChanges: [{
              isFxTransferStateChange: false,
              transferId,
              isOriginalId: true,
              notifyTo: PAYER,
              participantCurrencyId: PAYER_ACCOUNT,
              amount: -RESERVED_AMOUNT
            }],
            transferStateChanges: [],
            patchNotifications: []
          }
        }
      },
      metadata: { event: { type: 'position', action } }
    }
  },
  decodedPayload: { errorInformation: { errorCode: '5100', errorDescription: 'Payee FSP rejected the transfer' } }
})

/** A separate copy of a message, as a second Kafka delivery would be: abort.js marks steps done in place. */
const copyOf = (binItem: any) => structuredClone(binItem)

const processAbort = (binItems: Array<any>, states: Record<string, string>) =>
  processPositionAbortBin(binItems, {
    accumulatedPositionValue: RESERVED_AMOUNT,
    accumulatedPositionReservedValue: 0,
    accumulatedTransferStates: states,
    accumulatedFxTransferStates: {},
    isFx: false,
    changePositions: true
  })

describe('domain/position/abort: duplicate abort messages', () => {
  for (const action of [Action.ABORT, Action.ABORT_VALIDATION]) {
    it(`${action}: releases the payer once when the same message is in the bin twice`, async () => {
      const transferId = randomUUID()
      const original = buildAbortBinItem(transferId, action)

      const result = await processAbort([original, copyOf(original)], { [transferId]: 'RECEIVED_ERROR' })

      assert.deepStrictEqual(result.accumulatedTransferStateChanges.map((change: any) => change.transferStateId), ['ABORTED_ERROR'], 'one ABORTED_ERROR')
      assert.strictEqual(result.accumulatedPositionChanges.length, 1, 'one position change')
      assert.strictEqual(result.accumulatedPositionValue, 0, 'released once')
      assert.strictEqual(result.notifyMessages.length, 1, 'one notification')
      assert.strictEqual(result.followupMessages.length, 0)
    })
  }

  // already_done, already_decided and unexpected states: nothing changes, nothing is sent, nothing throws
  for (const state of ['ABORTED_ERROR', 'EXPIRED_RESERVED', 'RESERVED_TIMEOUT', 'RECEIVED_FULFIL', 'COMMITTED', 'SETTLED', 'RESERVED', 'ABORTED_REJECTED', 'INVALID']) {
    it(`skips without throwing when the transfer is ${state}`, async () => {
      const transferId = randomUUID()
      const binItem = buildAbortBinItem(transferId, Action.ABORT)

      const result = await processAbort([binItem], { [transferId]: state })

      assert.strictEqual(result.accumulatedTransferStateChanges.length, 0, 'no state change')
      assert.strictEqual(result.accumulatedPositionChanges.length, 0, 'no position change')
      assert.strictEqual(result.accumulatedPositionValue, RESERVED_AMOUNT, 'nothing released')
      assert.strictEqual(result.notifyMessages.length, 0, 'nothing sent')
      assert.deepStrictEqual(binItem.result, { success: true }, 'counted as processed')
    })
  }

  it('skips without throwing when the transfer has no state', async () => {
    const result = await processAbort([buildAbortBinItem(randomUUID(), Action.ABORT)], {})
    assert.strictEqual(result.accumulatedPositionChanges.length, 0)
    assert.strictEqual(result.notifyMessages.length, 0)
  })

  it('releases a different transfer in the same bin as a skipped duplicate', async () => {
    const [transferId, otherTransferId] = [randomUUID(), randomUUID()]
    const result = await processAbort(
      [buildAbortBinItem(transferId, Action.ABORT), buildAbortBinItem(otherTransferId, Action.ABORT)],
      { [transferId]: 'ABORTED_ERROR', [otherTransferId]: 'RECEIVED_ERROR' }
    )

    assert.deepStrictEqual(result.accumulatedTransferStateChanges.map((change: any) => change.transferId), [otherTransferId])
    assert.strictEqual(result.accumulatedPositionValue, 0)
  })

})

const FXP_ACCOUNT = 21

const fxReleaseStep = (commitRequestId: string, isOriginalId: boolean) => ({
  isFxTransferStateChange: true,
  commitRequestId,
  isOriginalId,
  notifyTo: PAYER,
  participantCurrencyId: FXP_ACCOUNT,
  amount: -RESERVED_AMOUNT
})

const transferReleaseStep = (transferId: string, isOriginalId: boolean) => ({
  isFxTransferStateChange: false,
  transferId,
  isOriginalId,
  notifyTo: PAYER,
  participantCurrencyId: PAYER_ACCOUNT,
  amount: -RESERVED_AMOUNT
})

/**
 * An FX-linked abort (the payee's error on a transfer with a conversion, keyed like ABORT) or an
 * FX abort (the FXP's error on the conversion). Both are chains: the conversion's steps, then the
 * transfer's.
 */
const buildChainBinItem = (id: string, action: string, steps: Array<any>): any => {
  const binItem = buildAbortBinItem(id, action)
  binItem.message.value.content.context.cyrilResult = { positionChanges: steps, transferStateChanges: [], patchNotifications: [] }
  return binItem
}

/** Marks the first n steps done, as in a follow-up message for step n + 1. */
const atStep = (binItem: any, n: number) => {
  binItem.message.value.content.context.cyrilResult.positionChanges.slice(0, n).forEach((step: any) => { step.isDone = true })
  return binItem
}

const processChain = (binItems: Array<any>, isFx: boolean, transferStates: Record<string, string>, fxTransferStates: Record<string, string>) =>
  processPositionAbortBin(binItems, {
    accumulatedPositionValue: 2 * RESERVED_AMOUNT,
    accumulatedPositionReservedValue: 0,
    accumulatedTransferStates: transferStates,
    accumulatedFxTransferStates: fxTransferStates,
    isFx,
    changePositions: true
  })

describe('domain/position/abort: FX abort chains', () => {
  it('FX-linked abort: releases step 1 once when it is in the bin twice (one follow-up)', async () => {
    const [transferId, commitRequestId] = [randomUUID(), randomUUID()]
    const original = buildChainBinItem(transferId, Action.ABORT, [fxReleaseStep(commitRequestId, false), transferReleaseStep(transferId, true)])

    const result = await processChain([original, copyOf(original)], false, { [transferId]: 'RECEIVED_ERROR' }, { [commitRequestId]: 'RECEIVED_FULFIL_DEPENDENT' })

    assert.deepStrictEqual(result.accumulatedFxTransferStateChanges.map((change: any) => change.transferStateId), ['ABORTED_ERROR'], 'the conversion released once')
    assert.strictEqual(result.accumulatedPositionChanges.length, 1)
    assert.strictEqual(result.followupMessages.length, 1, 'one follow-up for step 2')
  })

  it('FX-linked abort: a copy of the last step (transfer already released) is a no-op, without throwing', async () => {
    const [transferId, commitRequestId] = [randomUUID(), randomUUID()]
    const binItem = atStep(buildChainBinItem(transferId, Action.ABORT, [fxReleaseStep(commitRequestId, false), transferReleaseStep(transferId, true)]), 1)

    const result = await processChain([binItem], false, { [transferId]: 'ABORTED_ERROR' }, { [commitRequestId]: 'ABORTED_ERROR' })

    assert.strictEqual(result.accumulatedPositionChanges.length, 0, 'no position change')
    assert.strictEqual(result.notifyMessages.length, 0, 'nothing sent')
    assert.deepStrictEqual(binItem.result, { success: true })
  })

  it('FX abort: step 2 releases the transfer after step 1 released the aborted fxTransfer (F1)', async () => {
    const [transferId, commitRequestId] = [randomUUID(), randomUUID()]
    const binItem = atStep(buildChainBinItem(commitRequestId, Action.FX_ABORT, [fxReleaseStep(commitRequestId, true), transferReleaseStep(transferId, false)]), 1)

    const result = await processChain([binItem], true, { [transferId]: 'RESERVED' }, { [commitRequestId]: 'ABORTED_ERROR' })

    assert.deepStrictEqual(result.accumulatedTransferStateChanges.map((change: any) => change.transferStateId), ['ABORTED_ERROR'], 'the transfer released')
    assert.strictEqual(result.accumulatedPositionValue, RESERVED_AMOUNT, 'the payer released')
    assert.ok(result.notifyMessages.length > 0, 'the parties are notified')
  })

  it('FX abort: stops without throwing when the aborted fxTransfer (starting part) is COMMITTED', async () => {
    const [transferId, commitRequestId] = [randomUUID(), randomUUID()]
    const binItem = buildChainBinItem(commitRequestId, Action.FX_ABORT, [fxReleaseStep(commitRequestId, true), transferReleaseStep(transferId, false)])

    const result = await processChain([binItem], true, { [transferId]: 'COMMITTED' }, { [commitRequestId]: 'COMMITTED' })

    assert.strictEqual(result.accumulatedPositionChanges.length, 0, 'no position change')
    assert.strictEqual(result.notifyMessages.length, 0, 'nothing sent')
    assert.strictEqual(result.followupMessages.length, 0, 'no follow-up')
  })

  it('a second step for a part with two reservations goes on; a copy of the first step stops', async () => {
    const [transferId, commitRequestId] = [randomUUID(), randomUUID()]
    const steps = () => [fxReleaseStep(commitRequestId, false), fxReleaseStep(commitRequestId, false), transferReleaseStep(transferId, true)]
    const states = { transfers: { [transferId]: 'RECEIVED_ERROR' }, fx: { [commitRequestId]: 'ABORTED_ERROR' } }

    const secondStep = await processChain([atStep(buildChainBinItem(transferId, Action.ABORT, steps()), 1)], false, states.transfers, states.fx)
    assert.strictEqual(secondStep.accumulatedPositionChanges.length, 0, 'nothing left to release for the part')
    assert.strictEqual(secondStep.followupMessages.length, 1, 'goes on to the transfer step')

    const copyOfFirstStep = await processChain([buildChainBinItem(transferId, Action.ABORT, steps())], false, states.transfers, states.fx)
    assert.strictEqual(copyOfFirstStep.followupMessages.length, 0, 'a copy stops')
    assert.strictEqual(copyOfFirstStep.notifyMessages.length, 0)
  })

  it('applies a release step whose linked part was decided otherwise, as today (decision 1 open)', async () => {
    const [transferId, commitRequestId] = [randomUUID(), randomUUID()]
    const binItem = buildChainBinItem(transferId, Action.ABORT, [fxReleaseStep(commitRequestId, false), transferReleaseStep(transferId, true)])

    const result = await processChain([binItem], false, { [transferId]: 'RECEIVED_ERROR' }, { [commitRequestId]: 'COMMITTED' })

    assert.strictEqual(result.accumulatedPositionChanges.length, 1, 'applied anyway')
    assert.strictEqual(result.followupMessages.length, 1)
  })
})
