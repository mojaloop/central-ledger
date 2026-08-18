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

  * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const { logger } = require('../../../../../src/settlement/shared/logger')
const SettlementModel = require('../../../../../src/settlement/models/settlement/settlement')
const Db = require('../../../../../src/settlement/lib/db')

Test('SettlementModel', async (settlementModelTest) => {
  let sandbox

  settlementModelTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    Db.from = (table) => {
      return Db[table]
    }
    test.end()
  })

  settlementModelTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await settlementModelTest.test('settlementModel should', async createTest => {
    try {
      await createTest.test('return insert settlement into database', async test => {
        try {
          const settlement = {
            reason: 'reason text',
            createdDate: new Date()
          }
          const enums = {}

          Db.settlement = {
            insert: sandbox.stub().returns(true)
          }

          const result = await SettlementModel.create(settlement, enums)
          test.ok(result, 'Result returned and matched')
          test.ok(Db.settlement.insert.withArgs({
            reason: settlement.reason,
            createdDate: settlement.createdDate
          }).calledOnce, 'insert with args ... called once')

          Db.settlement.insert = sandbox.stub().throws(new Error('Error occurred'))
          try {
            await SettlementModel.create(settlement)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.equal(err.message, 'Error occurred', `Error "${err.message}" thrown as expected`)
          }
          test.end()
        } catch (err) {
          logger.error(`createTest failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await createTest.end()
    } catch (err) {
      logger.error(`settlementModelTest failed with error - ${err}`)
      createTest.fail()
      createTest.end()
    }
  })

  await settlementModelTest.test('settlementModel should', async getByIdTest => {
    try {
      await getByIdTest.test('throw error if Database unavailable', async test => {
        try {
          const settlementId = 1
          Db.settlement = {
            findOne: sandbox.stub()
          }
          Db.settlement.findOne = sandbox.stub().throws(new Error('Error occurred'))
          try {
            await SettlementModel.getById(settlementId)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.ok(err.message, 'Error thrown')
            test.end()
          }
        } catch (err) {
          test.end()
        }
      })

      await getByIdTest.test('get settlement by id', async test => {
        try {
          const settlementId = 1
          const settlement = {
            settlementId,
            reason: 'reason',
            createdDate: '2019-02-18T15:44:28.000Z',
            currentStateChangeId: 36
          }
          Db.settlement = {
            findOne: sandbox.stub().returns(settlement)
          }
          const result = await SettlementModel.getById(settlementId)
          test.deepEqual(result, settlement, 'results match')
          test.end()
        } catch (err) {
          logger.error(`getByIdTest failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByIdTest.end()
    } catch (err) {
      logger.error(`settlementModelTest failed with error - ${err}`)
      getByIdTest.fail()
      getByIdTest.end()
    }
  })

  await settlementModelTest.end()
})
