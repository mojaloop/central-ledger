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
import { classify, Outcome } from './stateRules'

const PREPARE = Enum.Events.Event.Action.PREPARE

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
  it('has an expected PREPARE outcome for every transfer state in the seed', async () => {
    const seedStates = await getSeedStates()
    assert.ok(seedStates.length > 0, 'seed lists transfer states')
    const missing = seedStates.filter(state => !(state in EXPECTED_PREPARE_OUTCOMES))
    assert.deepStrictEqual(missing, [], 'a new seed state needs a rule (add it to stateRules.ts and to this test)')
  })

  it('classifies each PREPARE state', () => {
    for (const [state, expected] of Object.entries(EXPECTED_PREPARE_OUTCOMES)) {
      assert.strictEqual(classify(PREPARE, state), expected, `${state} -> ${expected}`)
    }
  })

  it('classifies a missing or unknown PREPARE state as unexpected', () => {
    assert.strictEqual(classify(PREPARE, undefined), 'unexpected')
    assert.strictEqual(classify(PREPARE, null), 'unexpected')
    assert.strictEqual(classify(PREPARE, 'SOME_UNKNOWN_STATE'), 'unexpected')
  })

  it('classifies any state for an action without rules as unexpected', () => {
    assert.strictEqual(classify(Enum.Events.Event.Action.COMMIT, 'RESERVED'), 'unexpected')
  })
})
