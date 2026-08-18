/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
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
 - Name Surname <name.surname@mojaloop.io>

 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Logger = require('../../../src/shared/logger').logger
const Model = require('../../../src/seeds/settlementWindow2Open')

Test('Settlement Window2 Open seed should', async (settlementWindow2OpenTest) => {
  let sandbox

  settlementWindow2OpenTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    t.end()
  })

  settlementWindow2OpenTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await settlementWindow2OpenTest.test('create an "OPEN" settlementWindow', async (test) => {
    const knexStub = sandbox.stub()
    knexStub.returns({
      insert: sandbox.stub().returns([1]), // we return a single row id on a successful insert
      select: sandbox.stub().returns({
        leftJoin: sandbox.stub().returns({
          where: sandbox.stub().returns([])
        })
      }),
      where: sandbox.stub().returns({
        update: sandbox.stub()
      })
    })

    try {
      const result = await Model.seed(knexStub)
      test.equal(result, true, 'insert initial settlement window')
      test.ok(knexStub.withArgs('settlementWindow').calledTwice, 'knex called with settlementWindow twice')
      test.end()
    } catch (err) {
      Logger.error(`settlementWindow2Open seed failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementWindow2OpenTest.test('skip creating a new settlementWindow as an "OPEN" settlementWindow already exists', async (test) => {
    const knexStub = sandbox.stub()
    knexStub.returns({
      insert: sandbox.stub().returns([1]), // we return a single row id on a successful insert
      select: sandbox.stub().returns({
        leftJoin: sandbox.stub().returns({
          where: sandbox.stub().returns([1])
        })
      }),
      where: sandbox.stub().returns({
        update: sandbox.stub()
      })
    })

    try {
      const result = await Model.seed(knexStub)
      test.equal(result, true, 'return success but do not perform insert initial settlement window')
      test.equal(knexStub.withArgs('settlementWindow').callCount, 0, 'knex has not been called with settlementWindow')
      test.end()
    } catch (err) {
      Logger.error(`settlementWindow2Open seed failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementWindow2OpenTest.test('handle a DuplicateEntryError when creating a settlementWindow', async (test) => {
    function DuplicateEntryError (message) {
      this.name = 'DuplicateEntryError'
      this.message = message || ''
      this.code = 'ER_DUP_ENTRY'
    }
    DuplicateEntryError.prototype = Error.prototype

    const knexStub = sandbox.stub()
    knexStub.throws(new DuplicateEntryError())
    try {
      const result = await Model.seed(knexStub)
      test.equal(result, -1001, 'Duplicate error intercepted and ignored')
      test.end()
    } catch (err) {
      Logger.error(`settlementWindow2Open seed failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementWindow2OpenTest.test('fail completely if an unknown error is thrown', async (test) => {
    const knexStub = sandbox.stub()

    const errorMessage = 'test error'

    knexStub.returns({
      insert: sandbox.stub().throws(new Error(errorMessage)), // we return a single row id on a successful insert
      select: sandbox.stub().returns({
        leftJoin: sandbox.stub().returns({
          where: sandbox.stub().returns([])
        })
      }),
      where: sandbox.stub().returns({
        update: sandbox.stub()
      })
    })

    try {
      await Model.seed(knexStub)
      test.fail('an error should have been thrown')
    } catch (err) {
      Logger.error(`settlementWindow2Open seed failed with error - ${err}`)
      test.equal(err.message, errorMessage, 'Test error intercepted, logged and re-thrown')
      test.pass()
      test.end()
    }
  })

  await settlementWindow2OpenTest.test('fail completely if no result is returned on the first insert', async (test) => {
    const knexStub = sandbox.stub()

    knexStub.returns({
      insert: sandbox.stub().returns([]), // we return a single row id on a successful insert
      select: sandbox.stub().returns({
        leftJoin: sandbox.stub().returns({
          where: sandbox.stub().returns([])
        })
      }),
      where: sandbox.stub().returns({
        update: sandbox.stub()
      })
    })

    try {
      await Model.seed(knexStub)
      test.fail('an error should have been thrown')
    } catch (err) {
      Logger.error(`settlementWindow2Open seed failed with error - ${err}`)
      test.equal(err.message, 'insertInitialSettlementWindowResult undefined', 'Test error intercepted, logged and re-thrown')
      test.pass()
      test.end()
    }
  })

  await settlementWindow2OpenTest.end()
})
