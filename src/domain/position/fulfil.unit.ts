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
import { processPositionFulfilBin } from './fulfil'

const Action = Enum.Events.Event.Action
const PAYER = 'dfsp_payer'
const PAYEE = 'dfsp_payee'
const AMOUNT = 100

/** A regular (non-FX) commit or reserve position message, as the fulfil handler sends it. */
const buildFulfilBinItem = (transferId: string, action: string): any => ({
  message: {
    value: {
      id: transferId,
      from: PAYEE,
      to: PAYER,
      content: {
        uriParams: { id: transferId },
        headers: { 'fspiop-source': PAYEE, 'fspiop-destination': PAYER },
        payload: {}
      },
      metadata: { event: { type: 'position', action } }
    }
  },
  decodedPayload: { transferState: 'COMMITTED', fulfilment: 'fulfilment', completedTimestamp: '2026-11-12T00:00:00.000Z' }
})

/** A separate copy of a message, as a second Kafka delivery would be. */
const copyOf = (binItem: any) => structuredClone(binItem)

const reservedActionTransfer = (transferId: string) => ({
  transferId,
  amount: AMOUNT,
  currencyId: 'USD',
  ilpCondition: 'condition',
  expirationDate: '2026-11-12T00:00:00.000Z',
  createdDate: '2026-11-12T00:00:00.000Z',
  completedTimestamp: '2026-11-12T00:00:00.000Z',
  transferStateEnumeration: 'RESERVED',
  fulfilment: 'fulfilment',
  extensionList: []
})

const processFulfil = (binItems: Array<any>, action: string, states: Record<string, string>) => {
  const transferIds = [...new Set(binItems.map(item => item.message.value.content.uriParams.id))]
  return processPositionFulfilBin(
    action === Action.RESERVE ? [[], binItems] : [binItems, []],
    {
      accumulatedPositionValue: 0,
      accumulatedPositionReservedValue: 0,
      accumulatedTransferStates: states,
      accumulatedFxTransferStates: {},
      transferInfoList: Object.fromEntries(transferIds.map(id => [id, { transferId: id, amount: AMOUNT }])),
      reservedActionTransfers: Object.fromEntries(transferIds.map(id => [id, reservedActionTransfer(id)])),
      changePositions: true
    }
  )
}

describe('domain/position/fulfil: duplicate commit and reserve messages', () => {
  for (const action of [Action.COMMIT, Action.RESERVE]) {
    it(`${action}: credits the payee once when the same message is in the bin twice`, async () => {
      const transferId = randomUUID()
      const original = buildFulfilBinItem(transferId, action)

      const result = await processFulfil([original, copyOf(original)], action, { [transferId]: 'RECEIVED_FULFIL' })

      assert.deepStrictEqual(result.accumulatedTransferStateChanges.map((change: any) => change.transferStateId), ['COMMITTED'], 'one COMMITTED')
      assert.strictEqual(result.accumulatedPositionChanges.length, 1, 'one position change')
      assert.strictEqual(result.accumulatedPositionValue, AMOUNT, 'credited once')
      assert.strictEqual(result.notifyMessages.length, 1, 'one notification')
      assert.strictEqual(result.accumulatedTransferStates[transferId], 'COMMITTED')
    })
  }

  it('commits a different transfer in the same bin as a duplicate', async () => {
    const [transferId, otherTransferId] = [randomUUID(), randomUUID()]
    const original = buildFulfilBinItem(transferId, Action.COMMIT)

    const result = await processFulfil(
      [original, copyOf(original), buildFulfilBinItem(otherTransferId, Action.COMMIT)],
      Action.COMMIT,
      { [transferId]: 'RECEIVED_FULFIL', [otherTransferId]: 'RECEIVED_FULFIL' }
    )

    assert.deepStrictEqual(
      result.accumulatedTransferStateChanges.map((change: any) => change.transferId),
      [transferId, otherTransferId],
      'each transfer committed once'
    )
    assert.strictEqual(result.accumulatedPositionValue, 2 * AMOUNT)
  })

  for (const state of ['COMMITTED', 'SETTLED']) {
    it(`sends nothing for a copy that finds ${state}`, async () => {
      const transferId = randomUUID()
      const binItem = buildFulfilBinItem(transferId, Action.COMMIT)

      const result = await processFulfil([binItem], Action.COMMIT, { [transferId]: state })

      assert.strictEqual(result.accumulatedTransferStateChanges.length, 0, 'no state change')
      assert.strictEqual(result.accumulatedPositionChanges.length, 0, 'no position change')
      assert.strictEqual(result.notifyMessages.length, 0, 'nothing sent to the payee')
      assert.deepStrictEqual(binItem.result, { success: true }, 'counted as processed')
    })
  }

  // already_decided, then unexpected states: the payee's fulfil was not applied, so it still gets an error
  for (const state of ['RESERVED_TIMEOUT', 'EXPIRED_RESERVED', 'RECEIVED_ERROR', 'ABORTED_ERROR', 'ABORTED_REJECTED', 'RESERVED', 'INVALID']) {
    it(`keeps the error to the payee, without a state or position change, when the transfer is ${state}`, async () => {
      const transferId = randomUUID()
      const binItem = buildFulfilBinItem(transferId, Action.COMMIT)

      const result = await processFulfil([binItem], Action.COMMIT, { [transferId]: state })

      assert.strictEqual(result.accumulatedTransferStateChanges.length, 0, 'no state change')
      assert.strictEqual(result.accumulatedPositionChanges.length, 0, 'no position change')
      assert.strictEqual(result.notifyMessages.length, 1, 'one error')
      const message = result.notifyMessages[0].message
      assert.strictEqual(message.to, PAYEE, 'sent to the payee')
      assert.strictEqual(message.content.payload.errorInformation.errorCode, '2001')
      assert.strictEqual(binItem.result, undefined, 'result left as before')
    })
  }

  it('keeps the error to the payee when the transfer has no state', async () => {
    const transferId = randomUUID()
    const result = await processFulfil([buildFulfilBinItem(transferId, Action.COMMIT)], Action.COMMIT, {})

    assert.strictEqual(result.notifyMessages.length, 1)
    assert.strictEqual(result.notifyMessages[0].message.content.payload.errorInformation.errorCode, '2001')
    assert.strictEqual(result.accumulatedTransferStateChanges.length, 0)
  })
})

const FXP_ACCOUNT = 21
const PAYEE_ACCOUNT = 31

/**
 * An FX commit position message: a chain of steps (cyrilResult.positionChanges), one per message.
 * Payer-side conversion: [credit the FXP (fxTransfer step), credit the payee (transfer step)].
 * Payee-side conversion: [credit the payee (transfer step), credit the FXP (fxTransfer step)].
 */
const buildFxCommitBinItem = (transferId: string, commitRequestId: string, side: 'payer' | 'payee'): any => {
  const fxStep = { isFxTransferStateChange: true, commitRequestId, participantCurrencyId: FXP_ACCOUNT, amount: -AMOUNT }
  const transferStep = { isFxTransferStateChange: false, transferId, participantCurrencyId: PAYEE_ACCOUNT, amount: -10 }
  const binItem = buildFulfilBinItem(transferId, Action.COMMIT)
  binItem.message.value.content.context = {
    cyrilResult: {
      isFx: true,
      positionChanges: side === 'payer' ? [fxStep, transferStep] : [transferStep, fxStep],
      patchNotifications: [],
      transferStateChanges: []
    }
  }
  return binItem
}

/** Marks the first n steps done, as in a follow-up message for step n + 1. */
const atStep = (binItem: any, n: number) => {
  binItem.message.value.content.context.cyrilResult.positionChanges.slice(0, n).forEach((step: any) => { step.isDone = true })
  return binItem
}

const processFxCommit = (binItems: Array<any>, transferStates: Record<string, string>, fxTransferStates: Record<string, string>) =>
  processPositionFulfilBin([binItems, []], {
    accumulatedPositionValue: 0,
    accumulatedPositionReservedValue: 0,
    accumulatedTransferStates: transferStates,
    accumulatedFxTransferStates: fxTransferStates,
    transferInfoList: {},
    reservedActionTransfers: {},
    changePositions: true
  })

describe('domain/position/fulfil: FX commit chains', () => {
  it('applies a payer-side step 1 once when it is in the bin twice (one follow-up)', async () => {
    const [transferId, commitRequestId] = [randomUUID(), randomUUID()]
    const original = buildFxCommitBinItem(transferId, commitRequestId, 'payer')

    const result = await processFxCommit([original, copyOf(original)], { [transferId]: 'RECEIVED_FULFIL' }, { [commitRequestId]: 'RECEIVED_FULFIL_DEPENDENT' })

    assert.deepStrictEqual(result.accumulatedFxTransferStateChanges.map((change: any) => change.transferStateId), ['COMMITTED'], 'one fxTransfer COMMITTED')
    assert.strictEqual(result.accumulatedPositionChanges.length, 1, 'the FXP credited once')
    assert.strictEqual(result.followupMessages.length, 1, 'one follow-up for step 2')
    assert.strictEqual(result.followupMessages[0].messageKey, String(PAYEE_ACCOUNT))
  })

  it('sends nothing for a copy of step 1 when the fxTransfer is already COMMITTED', async () => {
    const [transferId, commitRequestId] = [randomUUID(), randomUUID()]
    const binItem = buildFxCommitBinItem(transferId, commitRequestId, 'payer')

    const result = await processFxCommit([binItem], { [transferId]: 'RECEIVED_FULFIL' }, { [commitRequestId]: 'COMMITTED' })

    assert.strictEqual(result.accumulatedPositionChanges.length, 0, 'no position change')
    assert.strictEqual(result.followupMessages.length, 0, 'no follow-up')
    assert.strictEqual(result.notifyMessages.length, 0, 'nothing sent')
    assert.deepStrictEqual(binItem.result, { success: true })
  })

  it('sends nothing for a copy of the last step when the transfer is already COMMITTED', async () => {
    const [transferId, commitRequestId] = [randomUUID(), randomUUID()]
    const binItem = atStep(buildFxCommitBinItem(transferId, commitRequestId, 'payer'), 1)

    const result = await processFxCommit([binItem], { [transferId]: 'COMMITTED' }, { [commitRequestId]: 'COMMITTED' })

    assert.strictEqual(result.accumulatedPositionChanges.length, 0, 'no position change')
    assert.strictEqual(result.notifyMessages.length, 0, 'nothing sent')
  })

  for (const state of ['ABORTED_ERROR', 'EXPIRED_RESERVED', 'RESERVED_TIMEOUT', 'RECEIVED_ERROR']) {
    it(`stops with today's error to the payee when the transfer (starting part) is ${state}`, async () => {
      const [transferId, commitRequestId] = [randomUUID(), randomUUID()]
      const binItem = buildFxCommitBinItem(transferId, commitRequestId, 'payer')

      const result = await processFxCommit([binItem], { [transferId]: state }, { [commitRequestId]: 'RECEIVED_FULFIL_DEPENDENT' })

      assert.strictEqual(result.accumulatedPositionChanges.length, 0, 'no position change')
      assert.strictEqual(result.followupMessages.length, 0, 'no follow-up')
      assert.strictEqual(result.notifyMessages.length, 1, 'one error')
      assert.strictEqual(result.notifyMessages[0].message.content.payload.errorInformation.errorCode, '2001')
    })
  }

  it('applies the FX step of a payee-side commit after the transfer step committed the transfer (F2)', async () => {
    const [transferId, commitRequestId] = [randomUUID(), randomUUID()]
    const binItem = atStep(buildFxCommitBinItem(transferId, commitRequestId, 'payee'), 1)

    const result = await processFxCommit([binItem], { [transferId]: 'COMMITTED' }, { [commitRequestId]: 'RECEIVED_FULFIL_DEPENDENT' })

    assert.deepStrictEqual(result.accumulatedFxTransferStateChanges.map((change: any) => change.transferStateId), ['COMMITTED'], 'the conversion committed')
    assert.strictEqual(result.accumulatedPositionValue, -AMOUNT, 'the FXP credited')
    assert.strictEqual(result.notifyMessages.length, 1, 'the final result')
    assert.strictEqual(result.notifyMessages[0].message.content.payload.errorInformation, undefined, 'not an error')
  })

  it('applies a step whose linked part was decided otherwise, as today (decision 1 open)', async () => {
    const [transferId, commitRequestId] = [randomUUID(), randomUUID()]
    const binItem = buildFxCommitBinItem(transferId, commitRequestId, 'payer')

    const result = await processFxCommit([binItem], { [transferId]: 'RECEIVED_FULFIL' }, { [commitRequestId]: 'EXPIRED_RESERVED' })

    assert.strictEqual(result.accumulatedPositionChanges.length, 1, 'applied anyway')
    assert.strictEqual(result.followupMessages.length, 1)
  })
})
