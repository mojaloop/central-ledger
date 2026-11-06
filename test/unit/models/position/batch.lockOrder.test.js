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
 * Regression tests for the batch position model (design: position-idempotency-duplicate-prepare.md, Change 3):
 *   - the position transaction runs at READ COMMITTED, so a read after the lock sees the previous lock holder's commit
 *   - position rows are locked in a fixed order (participantCurrencyId)
 *
 * These tests fail on v20.3.1 and are expected to pass once the design is implemented.
 */

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Model = require('../../../../src/models/position/batch')

// A chainable, awaitable stand-in for a knex query builder that records every call
const fakeQueryBuilder = (rows) => {
  const calls = []
  const builder = {}
  for (const method of ['transacting', 'where', 'whereIn', 'forUpdate', 'forShare', 'orderBy', 'select']) {
    builder[method] = (...args) => {
      calls.push([method, ...args])
      return builder
    }
  }
  builder.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject)
  return { builder, calls }
}

Test('Batch position model: lock order and isolation (position-idempotency-duplicate-prepare)', batchTest => {
  let sandbox

  batchTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Db, 'getKnex')
    test.end()
  })

  batchTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  batchTest.test('startDbTransaction opens the transaction at READ COMMITTED', async (test) => {
    const knexStub = sandbox.stub()
    knexStub.transaction = sandbox.stub().resolves({})
    Db.getKnex.returns(knexStub)

    await Model.startDbTransaction()

    test.ok(knexStub.transaction.calledOnce, 'knex.transaction called once')
    test.ok(
      knexStub.transaction.calledWithMatch({ isolationLevel: 'read committed' }),
      'knex.transaction called with { isolationLevel: \'read committed\' }'
    )
    test.end()
  })

  batchTest.test('getPositionsByAccountIdsForUpdate locks the rows FOR UPDATE ordered by participantCurrencyId', async (test) => {
    const { builder, calls } = fakeQueryBuilder([
      { participantCurrencyId: 2, value: 0 },
      { participantCurrencyId: 1, value: 0 }
    ])
    const knexStub = sandbox.stub().returns(builder)
    Db.getKnex.returns(knexStub)

    const positions = await Model.getPositionsByAccountIdsForUpdate({}, [2, 1])

    test.ok(knexStub.calledWith('participantPosition'), 'queries participantPosition')
    test.ok(calls.some(([method]) => method === 'forUpdate'), 'locks the rows FOR UPDATE')
    test.ok(
      calls.some(([method, column, direction]) =>
        method === 'orderBy' &&
        /(^|\.)participantCurrencyId$/.test(column) &&
        (direction === undefined || String(direction).toLowerCase() === 'asc')),
      'orders the lock by participantCurrencyId ascending'
    )
    test.deepEqual(Object.keys(positions).sort(), ['1', '2'], 'still returns positions keyed by participantCurrencyId')
    test.end()
  })

  batchTest.end()
})
