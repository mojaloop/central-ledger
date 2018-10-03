/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Logger = require('@mojaloop/central-services-shared').Logger
const Model = require('../../../seeds/zzzDEVseed')

Test('Development seeds call to', async (zzzDEVseedTest) => {
  let sandbox

  zzzDEVseedTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    t.end()
  })

  zzzDEVseedTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await zzzDEVseedTest.test('seed should', async (test) => {
    const knexStub = sandbox.stub()
    knexStub.returns({
      insert: sandbox.stub()
    })

    try {
      const result = await Model.seed(knexStub)
      test.ok(knexStub.withArgs('participant').calledOnce, 'knex called with participant once')
      test.ok(knexStub.withArgs('participantCurrency').calledOnce, 'knex called with participantCurrency once')
      test.ok(knexStub.withArgs('participantLimit').calledOnce, 'knex called with participantLimit once')
      test.ok(knexStub.withArgs('participantPosition').calledOnce, 'knex called with participantPosition once')
      test.ok(result, true, 'call all inserts')
      test.end()
    } catch (err) {
      Logger.error(`zzzDEVseed seed failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await zzzDEVseedTest.test('seed should', async (test) => {
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
      Logger.error(`zzzDEVseed seed failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await zzzDEVseedTest.test('seed should', async (test) => {
    const knexStub = sandbox.stub()
    knexStub.returns({
      insert: sandbox.stub().throws(new Error())
    })
    try {
      const result = await Model.seed(knexStub)
      test.equal(result, -1000, 'Generic error intercepted and logged')
      test.end()
    } catch (err) {
      Logger.error(`zzzDEVseed seed failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await zzzDEVseedTest.end()
})
