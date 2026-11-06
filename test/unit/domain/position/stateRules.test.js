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
 - Shashikant Hirugade

 --------------
 ******/

'use strict'

/**
 * Tests for src/domain/position/stateRules.js (design: position-idempotency-duplicate-prepare.md, Change 1).
 *
 * Expected interface:
 *   classify(action, state) => 'apply' | 'already_done' | 'already_decided' | 'unexpected'
 *
 * The module does not exist on v20.3.1, so these tests fail until it is implemented.
 */

const Test = require('tapes')(require('tape'))
const { Enum } = require('@mojaloop/central-services-shared')
const TransferStateSeed = require('../../../../src/seeds/transferState')

const PREPARE = Enum.Events.Event.Action.PREPARE

let StateRules
let loadError
try {
  StateRules = require('../../../../src/domain/position/stateRules')
} catch (err) {
  loadError = err
}

// Expected outcome for a PREPARE position message, for every state in src/seeds/transferState.js
const EXPECTED_PREPARE_OUTCOMES = {
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
const getSeedStates = async () => {
  const rows = []
  const fakeKnex = () => ({
    insert: (inserted) => {
      rows.push(...inserted)
      return { onConflict: () => ({ ignore: async () => inserted }) }
    }
  })
  await TransferStateSeed.seed(fakeKnex)
  return rows.map(row => row.transferStateId)
}

Test('Position state rules (position-idempotency-duplicate-prepare)', stateRulesTest => {
  stateRulesTest.test('module exists and exports classify', test => {
    test.notOk(loadError, `src/domain/position/stateRules.js loads${loadError ? ` (${loadError.code || loadError.message})` : ''}`)
    test.equal(typeof StateRules?.classify, 'function', 'classify is a function')
    test.end()
  })

  stateRulesTest.test('every transfer state in the seed has an expected PREPARE outcome', async test => {
    const seedStates = await getSeedStates()
    test.ok(seedStates.length > 0, 'seed lists transfer states')
    const missing = seedStates.filter(state => !(state in EXPECTED_PREPARE_OUTCOMES))
    test.deepEqual(missing, [], 'a new seed state needs a rule (add it to stateRules.js and to this test)')
    test.end()
  })

  stateRulesTest.test('classify(PREPARE, state) returns the outcome from the design table', test => {
    if (typeof StateRules?.classify !== 'function') {
      test.fail('stateRules.classify is not implemented')
      return test.end()
    }
    for (const [state, expected] of Object.entries(EXPECTED_PREPARE_OUTCOMES)) {
      test.equal(StateRules.classify(PREPARE, state), expected, `${state} -> ${expected}`)
    }
    test.end()
  })

  stateRulesTest.test('classify(PREPARE, state) returns unexpected for a missing or unknown state', test => {
    if (typeof StateRules?.classify !== 'function') {
      test.fail('stateRules.classify is not implemented')
      return test.end()
    }
    test.equal(StateRules.classify(PREPARE, undefined), 'unexpected', 'undefined -> unexpected')
    test.equal(StateRules.classify(PREPARE, null), 'unexpected', 'null -> unexpected')
    test.equal(StateRules.classify(PREPARE, 'SOME_UNKNOWN_STATE'), 'unexpected', 'unknown -> unexpected')
    test.end()
  })

  stateRulesTest.end()
})
