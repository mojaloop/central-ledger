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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/
'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const { logger } = require('../../../../../src/settlement/shared/logger')
const SettlementWindowContentStateChangeModel = require('../../../../../src/settlement/models/settlementWindowContent/settlementWindowContentStateChange')
const Db = require('../../../../../src/settlement/lib/db')

Test('SettlementModel', async (settlementWindowContentStateChangeModelTest) => {
  let sandbox

  settlementWindowContentStateChangeModelTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    Db.from = (table) => {
      return Db[table]
    }
    test.end()
  })

  settlementWindowContentStateChangeModelTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await settlementWindowContentStateChangeModelTest.test('settlementWindowContentStateChangeModel should', async createTest => {
    try {
      await createTest.test('return insert state to database', async test => {
        try {
          const settlementWindowContentId = 1
          const state = 'PENDING_SETTLEMENT'
          const reason = 'reason text'
          const enums = {
            PENDING_SETTLEMENT: 'PENDING_SETTLEMENT'
          }

          Db.settlementWindowContentStateChange = {
            insert: sandbox.stub().returns(true)
          }

          const result = await SettlementWindowContentStateChangeModel.create({ settlementWindowContentId, state, reason }, enums)
          test.ok(result, 'Result returned and matched')
          test.ok(Db.settlementWindowContentStateChange.insert.withArgs({
            settlementWindowContentId,
            settlementWindowStateId: enums[state.toUpperCase()],
            reason
          }).calledOnce, 'insert with args ... called once')

          Db.settlementWindowContentStateChange.insert = sandbox.stub().throws(new Error('Error occurred'))
          try {
            await SettlementWindowContentStateChangeModel.create({ settlementWindowContentId, state, reason })
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
      logger.error(`settlementWindowContentStateChangeModelTest failed with error - ${err}`)
      createTest.fail()
      createTest.end()
    }
  })

  await settlementWindowContentStateChangeModelTest.test('getBySettlementWindowContentId should', async getBySettlementWindowContentIdTest => {
    try {
      await getBySettlementWindowContentIdTest.test('return settlement windows state change record', async test => {
        try {
          const settlementWindowContentId = 1
          const settlementWindowContentStateChange = {
            settlementWindowContentStateChangeId: 25,
            settlementWindowContentId,
            settlementWindowStateId: 'CLOSED',
            reason: 'text',
            createdDate: '2019-02-18T16:47:35.000Z'
          }
          Db.getKnex = sandbox.stub()
          const knexStub = sandbox.stub()
          Db.getKnex.returns(knexStub)
          const whereStub = sandbox.stub()
          const orderByStub = sandbox.stub()
          const selectStub = sandbox.stub()
          const firstStub = sandbox.stub()
          knexStub.returns({
            where: whereStub.returns({
              orderBy: orderByStub.returns({
                select: selectStub.returns({
                  first: firstStub.returns(settlementWindowContentStateChange)
                })
              })
            })
          })
          const result = await SettlementWindowContentStateChangeModel.getBySettlementWindowContentId(settlementWindowContentId)
          test.deepEqual(result, settlementWindowContentStateChange, 'results match')
          test.end()
        } catch (err) {
          test.pass('Error thrown')
          test.end()
        }
      })

      await getBySettlementWindowContentIdTest.end()
    } catch (err) {
      logger.error(`getBySettlementWindowContentIdTest failed with error - ${err}`)
      getBySettlementWindowContentIdTest.fail()
      getBySettlementWindowContentIdTest.end()
    }
  })

  await settlementWindowContentStateChangeModelTest.end()
})
