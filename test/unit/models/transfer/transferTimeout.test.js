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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const Model = require('../../../../src/models/transfer/transferTimeout')

Test('Transfer Timeout', async (transferTimeoutTest) => {
  let sandbox

  transferTimeoutTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Logger, 'isErrorEnabled').value(true)
    sandbox.stub(Logger, 'isDebugEnabled').value(true)
    Db.transferTimeout = {
      query: sandbox.stub()
    }
    Db.from = (table) => {
      return Db[table]
    }
    t.end()
  })

  transferTimeoutTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await transferTimeoutTest.test('cleanup', async (test) => {
    try {
      const ttIdListMock = [{ transferTimeoutId: 1 }]
      sandbox.stub(Db, 'getKnex')

      const knexStub = sandbox.stub()
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        select: sandbox.stub().returns({
          max: sandbox.stub().returns({
            innerJoin: sandbox.stub().returns({
              groupBy: sandbox.stub().returns({
                as: sandbox.stub()
              })
            })
          })
        })
      })

      const builderStub = sandbox.stub()
      builderStub.whereIn = sandbox.stub().returns({
        innerJoin: sandbox.stub().returns({
          innerJoin: sandbox.stub().returns({
            select: sandbox.stub().returns(ttIdListMock)
          })
        }),
        del: sandbox.stub().returns(true)
      })

      Db.transferTimeout.query.callsArgWith(0, builderStub)

      const result = await Model.cleanup()
      test.deepEqual(result, ttIdListMock)
      test.end()
    } catch (err) {
      console.log(err)
      test.fail()
      test.end()
    }
  })

  await transferTimeoutTest.test('cleanup should throw error', async (test) => {
    try {
      Db.transferTimeout.query.throws(new Error('message'))
      await Model.cleanup()
      test.fail(' should throw')
      test.end()
    } catch (err) {
      test.pass('Error thrown')
      test.end()
    }
  })

  await transferTimeoutTest.end()
})
