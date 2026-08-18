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
const SettlementWindowContentFacade = require('../../../../../src/settlement/models/settlementWindowContent/facade')
const Db = require('../../../../../src/settlement/lib/db')

Test('SettlementWindowContentFacade', async (settlementWindowContentModelTest) => {
  let sandbox

  settlementWindowContentModelTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    Db.from = (table) => {
      return Db[table]
    }
    test.end()
  })

  settlementWindowContentModelTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await settlementWindowContentModelTest.test('settlementWindowContentModel should', async getApplicableByWindowIdListTest => {
    try {
      await getApplicableByWindowIdListTest.test('return applicable content by windows id list', async test => {
        try {
          const idList = [1, 2]
          const settlementModel = {
            ledgerAccountTypeId: 1,
            currencyId: 'USD'
          }
          const winStateEnum = {
            CLOSED: 'CLOSED',
            ABORTED: 'ABORTED',
            PENDING_SETTLEMENT: 'PENDING_SETTLEMENT'
          }
          const applicableContentMock = [{
            settlementWindowContentId: 1
          }, {
            settlementWindowContentId: 2
          }, {
            settlementWindowContentId: 3
          }]

          Db.getKnex = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.raw = sandbox.stub()
          Db.getKnex.returns(knexStub)

          const builderStub = sandbox.stub()
          Db.settlementWindow = {
            query: sandbox.stub()
          }
          Db.settlementWindow.query.callsArgWith(0, builderStub)
          const whereRawStub = sandbox.stub()
          const where1Stub = sandbox.stub()
          const where2Stub = sandbox.stub()
          const whereIn1Stub = sandbox.stub()
          const whereIn2Stub = sandbox.stub()
          builderStub.join = sandbox.stub().returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                whereRaw: whereRawStub.returns({
                  where: where1Stub.returns({
                    where: where2Stub.returns({
                      whereIn: whereIn1Stub.returns({
                        whereIn: whereIn2Stub.returns({
                          distinct: sandbox.stub().returns(applicableContentMock)
                        })
                      })
                    })
                  })
                })
              })
            })
          })

          const result = await SettlementWindowContentFacade.getApplicableByWindowIdList(idList, settlementModel, winStateEnum)
          test.ok(result, 'Result returned')
          test.ok(builderStub.join.withArgs('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId').calledOnce, 'join with args ... called once')
          test.ok(whereRawStub.withArgs(`settlementWindow.settlementWindowId IN (${idList})`).calledOnce, 'whereRaw with args ... called once')
          test.ok(where1Stub.withArgs('swc.ledgerAccountTypeId', settlementModel.ledgerAccountTypeId).calledOnce, 'where with args ... called once')
          test.equal(result, applicableContentMock, 'Result matched')

          test.end()
        } catch (err) {
          logger.error(`getApplicableByWindowIdListTest failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getApplicableByWindowIdListTest.end()
    } catch (err) {
      logger.error(`settlementWindowContentModelTest failed with error - ${err}`)
      getApplicableByWindowIdListTest.fail()
      getApplicableByWindowIdListTest.end()
    }
  })

  await settlementWindowContentModelTest.test('getBySettlementWindowContentId should', async getBySettlementWindowContentIdTest => {
    try {
      await getBySettlementWindowContentIdTest.test('return content by settlement id', async test => {
        try {
          const settlementId = 1
          const settlementWindowContent = [{
            id: 1,
            settlementWindowId: 1,
            state: 'PENDING_SETTLEMENT',
            ledgerAccountType: 1,
            currencyId: 'USD',
            createdDate: 'date',
            changedDate: 'date'
          }, {
            id: 2,
            settlementWindowId: 1,
            state: 'SETTLED',
            ledgerAccountType: 6,
            currencyId: 'USD',
            createdDate: 'date',
            changedDate: 'date'
          }]
          Db.getKnex = sandbox.stub()
          const knexStub = sandbox.stub()
          Db.getKnex.returns(knexStub)
          knexStub.returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  select: sandbox.stub().returns(settlementWindowContent)
                })
              })
            })
          })
          const result = await SettlementWindowContentFacade.getBySettlementId(settlementId)
          test.deepEqual(result, settlementWindowContent, 'results match')
          test.end()
        } catch (err) {
          test.pass('Error thrown')
          test.end()
        }
      })
      await getBySettlementWindowContentIdTest.test('return content by settlement window id', async test => {
        try {
          const settlementId = 1
          const settlementWindowContent = [{
            id: 1,
            settlementWindowId: 1,
            state: 'PENDING_SETTLEMENT',
            ledgerAccountType: 1,
            currencyId: 'USD',
            createdDate: 'date',
            changedDate: 'date'
          }, {
            id: 2,
            settlementWindowId: 1,
            state: 'SETTLED',
            ledgerAccountType: 6,
            currencyId: 'USD',
            createdDate: 'date',
            changedDate: 'date'
          }]
          Db.getKnex = sandbox.stub()
          const knexStub = sandbox.stub()
          Db.getKnex.returns(knexStub)
          knexStub.returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  select: sandbox.stub().returns(settlementWindowContent)
                })
              })
            })
          })
          const result = await SettlementWindowContentFacade.getBySettlementWindowId(settlementId)
          test.deepEqual(result, settlementWindowContent, 'results match')
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

  await settlementWindowContentModelTest.test('getBySettlementAndWindowId', async getBySettlementWindowContentIdTest => {
    try {
      await getBySettlementWindowContentIdTest.test('return content for a specific settlementId and windowId ', async test => {
        try {
          const settlementId = 1
          const settlementWindowId = 1
          const settlementWindowContent = [{
            id: 1,
            settlementWindowId: 1,
            state: 'PENDING_SETTLEMENT',
            ledgerAccountType: 1,
            currencyId: 'USD',
            createdDate: 'date',
            changedDate: 'date'
          }, {
            id: 2,
            settlementWindowId: 1,
            state: 'SETTLED',
            ledgerAccountType: 6,
            currencyId: 'USD',
            createdDate: 'date',
            changedDate: 'date'
          }]
          Db.getKnex = sandbox.stub()
          const knexStub = sandbox.stub()
          Db.getKnex.returns(knexStub)
          knexStub.returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  select: sandbox.stub().returns(settlementWindowContent)
                })
              })
            })
          })
          const result = await SettlementWindowContentFacade.getBySettlementAndWindowId(settlementId, settlementWindowId)
          test.deepEqual(result, settlementWindowContent, 'results match')
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
  await settlementWindowContentModelTest.end()
})
