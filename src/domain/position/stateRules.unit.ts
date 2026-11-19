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
import { Enum } from '@mojaloop/central-services-shared'
import { seed as seedTransferStates } from '../../seeds/transferState'
import { classify, classifyStep, isChainStartingState, hasEarlierStepForSamePart, CHAIN, STEP, Outcome, Step } from './stateRules'

const Action = Enum.Events.Event.Action

// Expected outcome for a PREPARE position message, for every state in src/seeds/transferState.js
const EXPECTED_PREPARE_OUTCOMES: Record<string, Outcome> = {
  RECEIVED_PREPARE: 'apply',
  RESERVED: 'already_done',
  RESERVED_FORWARDED: 'already_done',
  RECEIVED_FULFIL: 'already_done',
  RECEIVED_ERROR: 'already_done',
  RECEIVED_REJECT: 'already_done',
  RESERVED_TIMEOUT: 'already_done',
  COMMITTED: 'already_done',
  SETTLED: 'already_done',
  ABORTED_ERROR: 'already_done',
  ABORTED_REJECTED: 'already_done',
  EXPIRED_RESERVED: 'already_done',
  EXPIRED_PREPARED: 'already_decided',
  INVALID: 'unexpected',
  FAILED: 'unexpected',
  RECEIVED_FULFIL_DEPENDENT: 'unexpected'
}

// Expected outcome for an FX_PREPARE position message: the same, except that an fxTransfer can be
// RECEIVED_FULFIL_DEPENDENT once the FXP has fulfilled it.
const EXPECTED_FX_PREPARE_OUTCOMES: Record<string, Outcome> = {
  ...EXPECTED_PREPARE_OUTCOMES,
  RECEIVED_FULFIL_DEPENDENT: 'already_done'
}

// Expected outcome for a COMMIT or RESERVE position message, which expects RECEIVED_FULFIL
const EXPECTED_COMMIT_OUTCOMES: Record<string, Outcome> = {
  RECEIVED_FULFIL: 'apply',
  COMMITTED: 'already_done',
  SETTLED: 'already_done',
  RESERVED_TIMEOUT: 'already_decided',
  EXPIRED_RESERVED: 'already_decided',
  RECEIVED_ERROR: 'already_decided',
  ABORTED_ERROR: 'already_decided',
  ABORTED_REJECTED: 'already_decided',
  RECEIVED_PREPARE: 'unexpected',
  RESERVED: 'unexpected',
  RESERVED_FORWARDED: 'unexpected',
  RECEIVED_REJECT: 'unexpected',
  EXPIRED_PREPARED: 'unexpected',
  INVALID: 'unexpected',
  FAILED: 'unexpected',
  RECEIVED_FULFIL_DEPENDENT: 'unexpected'
}

// Expected outcome for an ABORT or ABORT_VALIDATION position message, which expects RECEIVED_ERROR
const EXPECTED_ABORT_OUTCOMES: Record<string, Outcome> = {
  RECEIVED_ERROR: 'apply',
  ABORTED_ERROR: 'already_done',
  EXPIRED_RESERVED: 'already_done',
  RESERVED_TIMEOUT: 'already_decided',
  RECEIVED_FULFIL: 'already_decided',
  COMMITTED: 'already_decided',
  SETTLED: 'already_decided',
  RECEIVED_PREPARE: 'unexpected',
  RESERVED: 'unexpected',
  RESERVED_FORWARDED: 'unexpected',
  RECEIVED_REJECT: 'unexpected',
  ABORTED_REJECTED: 'unexpected',
  EXPIRED_PREPARED: 'unexpected',
  INVALID: 'unexpected',
  FAILED: 'unexpected',
  RECEIVED_FULFIL_DEPENDENT: 'unexpected'
}

// Expected outcome for an FX_RESERVE position message (the FXP's fulfil), which expects RECEIVED_FULFIL_DEPENDENT
const EXPECTED_FX_RESERVE_OUTCOMES: Record<string, Outcome> = {
  RECEIVED_FULFIL_DEPENDENT: 'apply',
  COMMITTED: 'already_done',
  SETTLED: 'already_done',
  RECEIVED_ERROR: 'already_decided',
  ABORTED_ERROR: 'already_decided',
  ABORTED_REJECTED: 'already_decided',
  RESERVED_TIMEOUT: 'already_decided',
  EXPIRED_RESERVED: 'already_decided',
  RECEIVED_PREPARE: 'unexpected',
  RESERVED: 'unexpected',
  RESERVED_FORWARDED: 'unexpected',
  RECEIVED_FULFIL: 'unexpected',
  RECEIVED_REJECT: 'unexpected',
  EXPIRED_PREPARED: 'unexpected',
  INVALID: 'unexpected',
  FAILED: 'unexpected'
}

const EXPECTED_OUTCOMES_BY_ACTION: Array<[string, Record<string, Outcome>]> = [
  [Action.PREPARE, EXPECTED_PREPARE_OUTCOMES],
  [Action.FX_PREPARE, EXPECTED_FX_PREPARE_OUTCOMES],
  [Action.COMMIT, EXPECTED_COMMIT_OUTCOMES],
  [Action.RESERVE, EXPECTED_COMMIT_OUTCOMES],
  [Action.ABORT, EXPECTED_ABORT_OUTCOMES],
  [Action.ABORT_VALIDATION, EXPECTED_ABORT_OUTCOMES],
  [Action.FX_RESERVE, EXPECTED_FX_RESERVE_OUTCOMES]
]

// Expected outcome for a commit step on an fxTransfer, which expects RECEIVED_FULFIL_DEPENDENT
const EXPECTED_FX_COMMIT_STEP_OUTCOMES: Record<string, Outcome> = {
  ...EXPECTED_FX_RESERVE_OUTCOMES
}

// Expected outcome for a release step, which expects its part to still hold a reservation
const EXPECTED_RELEASE_STEP_OUTCOMES: Record<string, Outcome> = {
  RECEIVED_ERROR: 'apply',
  RESERVED: 'apply',
  RESERVED_FORWARDED: 'apply',
  RECEIVED_FULFIL_DEPENDENT: 'apply',
  ABORTED_ERROR: 'already_done',
  EXPIRED_RESERVED: 'already_done',
  RECEIVED_FULFIL: 'already_decided',
  COMMITTED: 'already_decided',
  SETTLED: 'already_decided',
  RESERVED_TIMEOUT: 'already_decided',
  RECEIVED_PREPARE: 'unexpected',
  RECEIVED_REJECT: 'unexpected',
  ABORTED_REJECTED: 'unexpected',
  EXPIRED_PREPARED: 'unexpected',
  INVALID: 'unexpected',
  FAILED: 'unexpected'
}

const EXPECTED_OUTCOMES_BY_STEP: Array<[Step, Record<string, Outcome>]> = [
  [STEP.FX_COMMIT, EXPECTED_FX_COMMIT_STEP_OUTCOMES],
  [STEP.RELEASE, EXPECTED_RELEASE_STEP_OUTCOMES]
]

// Read the state list from the seed by running it against a fake knex
const getSeedStates = async (): Promise<string[]> => {
  const rows: Array<{ transferStateId: string }> = []
  const fakeKnex = () => ({
    insert: (inserted: Array<{ transferStateId: string }>) => {
      rows.push(...inserted)
      return { onConflict: () => ({ ignore: async () => inserted }) }
    }
  })
  await seedTransferStates(fakeKnex)
  return rows.map(row => row.transferStateId)
}

describe('domain/position/stateRules', () => {
  it('reads the transfer states from the seed', async () => {
    assert.ok((await getSeedStates()).length > 0, 'seed lists transfer states')
  })

  for (const [action, expectedOutcomes] of EXPECTED_OUTCOMES_BY_ACTION) {
    it(`has an expected ${action} outcome for every transfer state in the seed`, async () => {
      const missing = (await getSeedStates()).filter(state => !(state in expectedOutcomes))
      assert.deepStrictEqual(missing, [], 'a new seed state needs a rule (add it to stateRules.ts and to this test)')
    })

    it(`classifies each ${action} state`, () => {
      for (const [state, expected] of Object.entries(expectedOutcomes)) {
        assert.strictEqual(classify(action, state), expected, `${action}: ${state} -> ${expected}`)
      }
    })

    it(`classifies a missing or unknown ${action} state as unexpected`, () => {
      assert.strictEqual(classify(action, undefined), 'unexpected')
      assert.strictEqual(classify(action, null), 'unexpected')
      assert.strictEqual(classify(action, 'SOME_UNKNOWN_STATE'), 'unexpected')
    })
  }

  it('classifies any state for an action without rules as unexpected', () => {
    assert.strictEqual(classify(Action.TIMEOUT_RESERVED, 'RESERVED_TIMEOUT'), 'unexpected')
  })

  for (const [step, expectedOutcomes] of EXPECTED_OUTCOMES_BY_STEP) {
    it(`has an expected ${step} outcome for every transfer state in the seed`, async () => {
      const missing = (await getSeedStates()).filter(state => !(state in expectedOutcomes))
      assert.deepStrictEqual(missing, [], 'a new seed state needs a rule (add it to stateRules.ts and to this test)')
    })

    it(`classifies each ${step} state`, () => {
      for (const [state, expected] of Object.entries(expectedOutcomes)) {
        assert.strictEqual(classifyStep(step, state), expected, `${step}: ${state} -> ${expected}`)
      }
    })

    it(`classifies a missing ${step} state as unexpected`, () => {
      assert.strictEqual(classifyStep(step, undefined), 'unexpected')
      assert.strictEqual(classifyStep(step, null), 'unexpected')
    })
  }

  it('lets a commit chain go on only while its transfer is RECEIVED_FULFIL or COMMITTED', () => {
    assert.strictEqual(isChainStartingState(CHAIN.COMMIT, 'RECEIVED_FULFIL'), true)
    assert.strictEqual(isChainStartingState(CHAIN.COMMIT, 'COMMITTED'), true)
    for (const state of ['RECEIVED_ERROR', 'ABORTED_ERROR', 'RESERVED_TIMEOUT', 'EXPIRED_RESERVED', 'RESERVED']) {
      assert.strictEqual(isChainStartingState(CHAIN.COMMIT, state), false, state)
    }
    assert.strictEqual(isChainStartingState(CHAIN.COMMIT, undefined), false)
  })

  it('lets an abort chain go on only while its starting part is RECEIVED_ERROR or ABORTED_ERROR', () => {
    assert.strictEqual(isChainStartingState(CHAIN.ABORT, 'RECEIVED_ERROR'), true)
    assert.strictEqual(isChainStartingState(CHAIN.ABORT, 'ABORTED_ERROR'), true)
    for (const state of ['RECEIVED_FULFIL', 'COMMITTED', 'RESERVED_TIMEOUT', 'EXPIRED_RESERVED', 'RESERVED']) {
      assert.strictEqual(isChainStartingState(CHAIN.ABORT, state), false, state)
    }
    assert.strictEqual(isChainStartingState(CHAIN.ABORT, null), false)
  })

  it('finds an earlier step for the same part only for the same part', () => {
    const steps = [
      { isFxTransferStateChange: true, commitRequestId: 'fx1' },
      { isFxTransferStateChange: true, commitRequestId: 'fx1' },
      { isFxTransferStateChange: false, transferId: 'fx1' },
      { isFxTransferStateChange: false, transferId: 't1' }
    ]
    assert.strictEqual(hasEarlierStepForSamePart(steps, 0), false, 'the first step')
    assert.strictEqual(hasEarlierStepForSamePart(steps, 1), true, 'the second step for fx1')
    assert.strictEqual(hasEarlierStepForSamePart(steps, 2), false, 'a transfer with the same id is a different part')
    assert.strictEqual(hasEarlierStepForSamePart(steps, 3), false)
  })
})
