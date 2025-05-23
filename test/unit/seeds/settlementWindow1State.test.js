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
const Model = require('../../../seeds/settlementWindow1State')

Test('Settlement Window1 State', async (settlementWindow1StateTest) => {
  let sandbox

  settlementWindow1StateTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    t.end()
  })

  settlementWindow1StateTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await settlementWindow1StateTest.test('seed should', async (test) => {
    const knexStub = sandbox.stub()
    knexStub.returns({
      insert: sandbox.stub().returns({
        onConflict: sandbox.stub().returns({
          ignore: sandbox.stub().returns(true)
        })
      })
    })

    try {
      const result = await Model.seed(knexStub)
      test.equal(result, true, 'call insert')
      test.ok(knexStub.withArgs('settlementWindowState').calledOnce, 'knex called with settlementWindowState once')
      test.end()
    } catch (err) {
      Logger.error(`settlementWindowState seed failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementWindow1StateTest.test('seed should', async (test) => {
    const knexStub = sandbox.stub()
    knexStub.returns({
      insert: sandbox.stub().throws(new Error())
    })
    try {
      const result = await Model.seed(knexStub)
      test.equal(result, -1000, 'Generic error intercepted and logged')
      test.end()
    } catch (err) {
      Logger.error(`settlementWindow1State seed failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementWindow1StateTest.end()
})
