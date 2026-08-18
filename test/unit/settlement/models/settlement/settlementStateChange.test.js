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
const SettlementStateChangeModel = require('../../../../../src/settlement/models/settlement/settlementStateChange.js')
const Db = require('../../../../../src/settlement/lib/db')

Test('SettlementStateChangeModel', async (SettlementStateChangeModelTest) => {
  let sandbox

  SettlementStateChangeModelTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    Db.from = (table) => {
      return Db[table]
    }
    test.end()
  })

  SettlementStateChangeModelTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await SettlementStateChangeModelTest.test('settlementStateChangeModel should', async getBySettlementIdTest => {
    try {
      await getBySettlementIdTest.test('throw error', async test => {
        try {
          const settlementId = 1
          Db.getKnex = sandbox.stub()
          const knexStub = sandbox.stub().throws(new Error('Database not available'))
          Db.getKnex.returns(knexStub)
          try {
            await SettlementStateChangeModel.getBySettlementId(settlementId)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.ok('Error thrown')
          }
          test.end()
        } catch (err) {
          test.pass('Error thrown')
          test.end()
        }
      })

      await getBySettlementIdTest.test('return settlement windows state change record', async test => {
        try {
          const settlementId = 1
          const settlementState = {
            settlementStateChangeId: 35,
            settlementId: 7,
            settlementStateId: 'PENDING_SETTLEMENT',
            reason: 'reason',
            createdDate: '2019-02-18T15:23:28.000Z'
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
                  first: firstStub.returns(settlementState)
                })
              })
            })
          })
          const result = await SettlementStateChangeModel.getBySettlementId(settlementId)
          test.ok(result, 'Result returned')
          test.ok(whereStub.withArgs('settlementId', settlementId).calledOnce, 'where with args ... called once')
          test.ok(orderByStub.withArgs('settlementStateChangeId', 'desc').calledOnce, 'orderBy with args ... called once')
          test.ok(selectStub.withArgs('*').calledOnce, 'select with args ... called once')
          test.deepEqual(result, settlementState, 'results match')
          test.end()
        } catch (err) {
          logger.error(`getBySettlementIdTest failed with error - ${err}`)
          test.fail('Error thrown')
          test.end()
        }
      })

      await getBySettlementIdTest.end()
    } catch (err) {
      logger.error(`SettlementStateChangeModelTest failed with error - ${err}`)
      getBySettlementIdTest.fail()
      getBySettlementIdTest.end()
    }
  })

  await SettlementStateChangeModelTest.end()
})
