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

'use strict'

/**
 * Regression tests: a duplicate position message from the prepare handler
 * must not reserve the payer's funds twice.
 *
 * Design: position-idempotency-duplicate-prepare.md
 *   - Change 1: a duplicate position message is a no-op
 *   - Change 2: the state check uses the running state of the batch
 *
 * These tests fail on v20.3.1 and are expected to pass once the design is implemented.
 */

const Test = require('tapes')(require('tape'))
const { Enum } = require('@mojaloop/central-services-shared')
const { processPositionPrepareBin } = require('../../../../src/domain/position/prepare')

const State = Enum.Transfers.TransferInternalState
const PAYER = 'dfsp1'
const PAYEE = 'dfsp2'
const AMOUNT = 2

const T1 = 'a1b2c3d4-0000-4000-8000-000000000001'
const T2 = 'a1b2c3d4-0000-4000-8000-000000000002'
const T3 = 'a1b2c3d4-0000-4000-8000-000000000003'

// A separate object for every call, as Kafka would deliver for each copy of a message
const positionMessage = (transferId) => ({
  message: {
    value: {
      from: PAYER,
      to: PAYEE,
      id: transferId,
      content: {
        uriParams: { id: transferId },
        headers: {
          accept: 'application/vnd.interoperability.transfers+json;version=1.1',
          'content-type': 'application/vnd.interoperability.transfers+json;version=1.1',
          'fspiop-source': PAYER,
          'fspiop-destination': PAYEE
        },
        payload: {},
        context: {}
      },
      type: 'application/json',
      metadata: {
        event: { type: 'position', action: Enum.Events.Event.Action.PREPARE }
      }
    }
  },
  span: {},
  decodedPayload: {
    transferId,
    payerFsp: PAYER,
    payeeFsp: PAYEE,
    amount: { amount: String(AMOUNT), currency: 'USD' },
    expiration: '2030-01-01T00:00:00.000Z',
    condition: '5m0gq_5dLQlTSSRKQmLpj0MZ1MtWLWgSu1oLGVTJyYs',
    ilpPacket: 'AYIDGQAAAAAAACcQ'
  },
  result: {}
})

// liquidity cover 1000, net debit cap 1000, current position 0
const runPrepare = (binItems, accumulatedTransferStates, { settlementParticipantPosition = -1000 } = {}) =>
  processPositionPrepareBin(binItems, {
    accumulatedPositionValue: 0,
    accumulatedPositionReservedValue: 0,
    accumulatedTransferStates,
    settlementParticipantPosition,
    participantLimit: {
      participantCurrencyId: 1,
      participantLimitTypeId: 1,
      value: 1000,
      isActive: 1,
      createdBy: 'unknown',
      participantLimitId: 1,
      thresholdAlarmPercentage: 0.5
    },
    changePositions: true
  })

const ALREADY_DONE_STATES = [
  State.RESERVED,
  State.RESERVED_FORWARDED,
  State.RECEIVED_FULFIL,
  State.RECEIVED_ERROR,
  State.RECEIVED_REJECT,
  State.RESERVED_TIMEOUT,
  State.COMMITTED,
  'SETTLED',
  State.ABORTED_ERROR,
  State.ABORTED_REJECTED,
  State.EXPIRED_RESERVED
]

const ALREADY_DECIDED_STATES = [State.EXPIRED_PREPARED]

const UNEXPECTED_STATES = [State.INVALID, State.FAILED, State.RECEIVED_FULFIL_DEPENDENT, undefined, 'SOME_UNKNOWN_STATE']

// A no-op writes nothing, sends nothing, leaves the state alone and does not throw
const assertNoOp = (test, result, binItem, state) => {
  const label = `state ${state}`
  test.equal(result.accumulatedPositionChanges.length, 0, `${label}: no position change`)
  test.equal(result.accumulatedTransferStateChanges.length, 0, `${label}: no state change`)
  test.equal(result.notifyMessages.length, 0, `${label}: no notification`)
  test.equal(result.accumulatedPositionValue, 0, `${label}: position unchanged`)
  test.equal(result.accumulatedTransferStates[T1], state, `${label}: transfer state unchanged`)
  // binItem.result is spread into a histogram with only `success` and `action` labels (handlerBatch.js)
  test.deepEqual(binItem.result, { success: true }, `${label}: binItem.result is { success: true }`)
}

Test('Prepare domain: duplicate position message (position-idempotency-duplicate-prepare)', duplicateTest => {
  duplicateTest.test('Change 2: two copies in one bin reserve the funds once', async (test) => {
    const result = await runPrepare(
      [positionMessage(T1), positionMessage(T1)],
      { [T1]: State.RECEIVED_PREPARE }
    )

    test.equal(result.accumulatedPositionValue, AMOUNT, 'payer position goes up by the amount once')
    test.equal(result.accumulatedPositionChanges.length, 1, 'one participantPositionChange')
    test.equal(result.accumulatedTransferStateChanges.length, 1, 'one transferStateChange')
    test.equal(result.accumulatedTransferStateChanges[0].transferStateId, State.RESERVED, 'the state change is RESERVED')
    test.equal(result.notifyMessages.length, 1, 'the payee receives the prepare request once')
    test.equal(result.accumulatedTransferStates[T1], State.RESERVED, 'running state is RESERVED')
    test.end()
  })

  duplicateTest.test('Change 2: three copies in one bin reserve the funds once', async (test) => {
    const result = await runPrepare(
      [positionMessage(T1), positionMessage(T1), positionMessage(T1)],
      { [T1]: State.RECEIVED_PREPARE }
    )

    test.equal(result.accumulatedPositionValue, AMOUNT, 'payer position goes up by the amount once')
    test.equal(result.accumulatedPositionChanges.length, 1, 'one participantPositionChange')
    test.equal(result.accumulatedTransferStateChanges.length, 1, 'one transferStateChange')
    test.equal(result.notifyMessages.length, 1, 'one notification')
    test.end()
  })

  duplicateTest.test('Change 2: two copies in one bin, payer short of liquidity, are rejected once', async (test) => {
    const result = await runPrepare(
      [positionMessage(T1), positionMessage(T1)],
      { [T1]: State.RECEIVED_PREPARE },
      { settlementParticipantPosition: 0 } // liquidity cover 0
    )

    test.equal(result.accumulatedPositionChanges.length, 0, 'no position change')
    test.equal(result.accumulatedTransferStateChanges.length, 1, 'one transferStateChange')
    test.equal(result.accumulatedTransferStateChanges[0].transferStateId, State.ABORTED_REJECTED, 'the state change is ABORTED_REJECTED')
    test.equal(result.notifyMessages.length, 1, 'the payer receives one error')
    test.equal(result.notifyMessages[0].message.content.payload.errorInformation.errorCode, '4001', 'the error is insufficient liquidity')
    test.end()
  })

  duplicateTest.test('Change 2: a duplicate next to other transfers does not affect them', async (test) => {
    const result = await runPrepare(
      [positionMessage(T1), positionMessage(T2), positionMessage(T1), positionMessage(T3)],
      { [T1]: State.RECEIVED_PREPARE, [T2]: State.RECEIVED_PREPARE, [T3]: State.RECEIVED_PREPARE }
    )

    test.equal(result.accumulatedPositionValue, 3 * AMOUNT, 'each transfer is reserved once')
    test.deepEqual(
      result.accumulatedPositionChanges.map(change => change.transferId),
      [T1, T2, T3],
      'one participantPositionChange per transfer'
    )
    test.deepEqual(
      result.accumulatedTransferStateChanges.map(change => [change.transferId, change.transferStateId]),
      [[T1, State.RESERVED], [T2, State.RESERVED], [T3, State.RESERVED]],
      'one RESERVED state change per transfer'
    )
    test.equal(result.notifyMessages.length, 3, 'one notification per transfer')
    test.end()
  })

  duplicateTest.test('Change 1: a position message for a transfer already past RECEIVED_PREPARE is a no-op (already_done)', async (test) => {
    for (const state of ALREADY_DONE_STATES) {
      const binItem = positionMessage(T1)
      const result = await runPrepare([binItem], { [T1]: state })
      assertNoOp(test, result, binItem, state)
    }
    test.end()
  })

  duplicateTest.test('Change 1: a position message for an EXPIRED_PREPARED transfer is a no-op (already_decided)', async (test) => {
    for (const state of ALREADY_DECIDED_STATES) {
      const binItem = positionMessage(T1)
      const result = await runPrepare([binItem], { [T1]: state })
      assertNoOp(test, result, binItem, state)
    }
    test.end()
  })

  duplicateTest.test('Change 1: a position message for a transfer in an unexpected state is a no-op (unexpected)', async (test) => {
    for (const state of UNEXPECTED_STATES) {
      const binItem = positionMessage(T1)
      const result = await runPrepare([binItem], { [T1]: state })
      assertNoOp(test, result, binItem, state)
    }
    test.end()
  })

  duplicateTest.test('Change 1: a duplicate of a COMMITTED transfer next to a new transfer only reserves the new one', async (test) => {
    const duplicate = positionMessage(T1)
    const result = await runPrepare(
      [duplicate, positionMessage(T2)],
      { [T1]: State.COMMITTED, [T2]: State.RECEIVED_PREPARE }
    )

    test.equal(result.accumulatedPositionValue, AMOUNT, 'only the new transfer is reserved')
    test.deepEqual(
      result.accumulatedTransferStateChanges.map(change => [change.transferId, change.transferStateId]),
      [[T2, State.RESERVED]],
      'no state change for the COMMITTED transfer'
    )
    test.equal(result.notifyMessages.length, 1, 'one notification, for the new transfer')
    test.equal(result.accumulatedTransferStates[T1], State.COMMITTED, 'COMMITTED transfer keeps its state')
    test.deepEqual(duplicate.result, { success: true }, 'duplicate binItem.result is { success: true }')
    test.end()
  })

  duplicateTest.end()
})
