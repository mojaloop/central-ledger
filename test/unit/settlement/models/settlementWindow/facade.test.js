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
 * Valentin Genev <valentin.genev@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../../src/settlement/lib/db')
const { logger } = require('../../../../../src/settlement/shared/logger')
const SettlementWindowFacade = require('../../../../../src/settlement/models/settlementWindow/facade')
const SettlementModel = require('../../../../../src/settlement/models/settlement/settlementModel')

logger.error('this is error')

Test('Settlement Window facade', async (settlementWindowFacadeTest) => {
  let sandbox
  let clock
  const now = new Date()
  let builderStub
  let selectStub
  let firstStub
  let whereStub
  let whereRawStub
  let orderByStub
  let distinctStub
  let selectStubResult
  let leftJoin2Stub
  let leftJoin3Stub
  let leftJoin4Stub
  let join2Stub

  settlementWindowFacadeTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    clock = Sinon.useFakeTimers(now.getTime())
    Db.from = (table) => {
      return Db[table]
    }
    Db.settlementWindow = {
      query: sandbox.stub()
    }
    Db.transferFulfilment = {
      query: sandbox.stub()
    }
    Db.settlementSettlementWindow = {
      query: sandbox.stub()
    }
    builderStub = sandbox.stub()
    Db.settlementWindow.query.callsArgWith(0, builderStub)
    Db.settlementSettlementWindow.query.callsArgWith(0, builderStub)
    Db.transferFulfilment.query.callsArgWith(0, builderStub)
    builderStub.leftJoin = sandbox.stub()
    builderStub.join = sandbox.stub()
    selectStub = sandbox.stub()
    firstStub = sandbox.stub()
    whereStub = sandbox.stub()
    whereRawStub = sandbox.stub()
    orderByStub = sandbox.stub()
    distinctStub = sandbox.stub()

    selectStubResult = {
      first: firstStub.returns({
        where: whereStub
      }),
      whereRaw: whereRawStub.returns({
        orderBy: orderByStub
      }),
      orderBy: orderByStub.returns({
        distinct: distinctStub.returns({
          where: whereStub.returns({
            where: whereStub.returns({
              where: whereStub
            })
          })
        })
      })
    }
    leftJoin2Stub = sandbox.stub()
    leftJoin3Stub = sandbox.stub()
    leftJoin4Stub = sandbox.stub()
    builderStub.leftJoin.returns({
      select: selectStub.returns(selectStubResult),
      leftJoin: leftJoin2Stub.returns({
        leftJoin: leftJoin3Stub.returns({
          leftJoin: leftJoin4Stub.returns({
            select: selectStub.returns(selectStubResult)
          })
        })
      })
    })
    builderStub.join.returns({
      join: sandbox.stub().returns({
        join: sandbox.stub().returns({
          whereRaw: sandbox.stub().returns({
            where: sandbox.stub().returns({
              where: sandbox.stub().returns({
                whereIn: sandbox.stub().returns({
                  whereIn: sandbox.stub().returns({
                    distinct: selectStub.returns(selectStubResult)
                  })
                })
              })
            })
          })
        })
      })
    })
    test.end()
  })

  settlementWindowFacadeTest.afterEach(test => {
    sandbox.restore()
    clock.restore()
    test.end()
  })

  await settlementWindowFacadeTest.test('getById should', async getByIdTest => {
    try {
      const settlementWindowId = 1
      const enums = {}
      const settlementWindowResultStub = { settlementWindowId: 1, state: 'SETTLED' }
      let e

      await getByIdTest.test('retrieve settlement window data by id', async test => {
        try {
          Db.settlementWindow.query.returns(Promise.resolve(settlementWindowResultStub))

          const result = await SettlementWindowFacade.getById({ settlementWindowId }, enums)
          test.ok(result, 'Result returned')
          test.ok(builderStub.leftJoin.withArgs('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId').calledOnce)
          test.ok(selectStub.withArgs('settlementWindow.settlementWindowId',
            'swsc.settlementWindowStateId as state',
            'swsc.reason as reason',
            'settlementWindow.createdDate as createdDate',
            'swsc.createdDate as changedDate').calledOnce)
          test.ok(firstStub.calledOnce)
          test.ok(whereStub.withArgs('settlementWindow.settlementWindowId', settlementWindowId).calledOnce)
          test.end()
        } catch (err) {
          logger.error(`getById failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByIdTest.test('throw error if database is unavailable', async test => {
        try {
          e = new Error('Database unavailable')
          Db.settlementWindow.query.throws(e)

          await SettlementWindowFacade.getById({ settlementWindowId })
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`getById failed with error - ${err}`)
          test.equal(err.message, e.message, `Error "${err.message}" thrown as expected`)
          test.end()
        }
      })

      await getByIdTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      getByIdTest.fail()
      getByIdTest.end()
    }
  })

  await settlementWindowFacadeTest.test('getByListOfIds should', async getByListOfIdsTest => {
    try {
      const listOfIds = [1, 2]
      const enums = {}
      const settlementModelMock = {
        currencyId: 'USD',
        isActive: 1,
        ledgerAccountTypeId: 1,
        name: 'DEFERRED_NET_USD',
        requireLiquidityCheck: 1,
        settlementDelayId: 2,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementModelId: 2
      }
      const settlementWindowResultStub = [{
        settlementWindowId: 1,
        state: 'SETTLED'
      }, {
        settlementWindowId: 2,
        state: 'ABORTED'
      }]
      let e

      await getByListOfIdsTest.test('retrieve settlement windows data by list of ids', async test => {
        try {
          const knexStub = sandbox.stub()
          Db.getKnex = sandbox.stub().returns(knexStub)
          knexStub.raw = sandbox.stub()
          Db.settlementWindow.query.returns(Promise.resolve(settlementWindowResultStub))

          const result = await SettlementWindowFacade.getByListOfIds(listOfIds, settlementModelMock, enums)
          test.ok(result, 'Result returned')
          test.ok(builderStub.join.withArgs('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId').calledOnce)
          test.end()
        } catch (err) {
          logger.error(`getByListOfIds failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByListOfIdsTest.test('throw error if database is unavailable', async test => {
        try {
          e = new Error('Database unavailable')
          const knexStub = sandbox.stub()
          Db.getKnex = sandbox.stub().returns(knexStub)
          knexStub.raw = sandbox.stub()
          Db.settlementWindow.query.throws(e)
          await SettlementWindowFacade.getByListOfIds(listOfIds, settlementModelMock, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`getByListOfIds failed with error - ${err}`)
          test.equal(err.message, e.message, `Error "${err.message}" thrown as expected`)
          test.end()
        }
      })

      await getByListOfIdsTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      getByListOfIdsTest.fail()
      getByListOfIdsTest.end()
    }
  })

  await settlementWindowFacadeTest.test('getByParams should', async getByParamsTest => {
    try {
      const participantId = 1
      const state = 'PENDING_SETTLEMENT'
      const fromDateTime = new Date('01-01-1970').toISOString()
      const toDateTime = new Date().toISOString()
      const currency = 'USD'
      let query = { participantId, state, fromDateTime, toDateTime, currency }
      const settlementWindowResultStub = [{
        settlementWindowId: 1,
        state: 'PENDING_SETTLEMENT'
      }, {
        settlementWindowId: 2,
        state: 'PENDING_SETTLEMENT'
      }]
      const enums = {}
      let e

      await getByParamsTest.test('retrieve settlement windows by params', async test => {
        try {
          Db.settlementWindow.query.returns(Promise.resolve(settlementWindowResultStub))

          const result = await SettlementWindowFacade.getByParams({ query }, enums)
          test.ok(result, 'Result returned')
          test.ok(builderStub.leftJoin.withArgs('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId').calledOnce)
          test.ok(leftJoin2Stub.withArgs('transferFulfilment AS tf', 'tf.settlementWindowId', 'settlementWindow.settlementWindowId').calledOnce)
          test.ok(leftJoin3Stub.withArgs('transferParticipant AS tp', 'tp.transferId', 'tf.transferId').calledOnce)
          test.ok(leftJoin4Stub.withArgs('participantCurrency AS pc', 'pc.participantCurrencyId', 'tp.participantCurrencyId').calledOnce)
          test.ok(selectStub.withArgs('settlementWindow.settlementWindowId',
            'swsc.settlementWindowStateId as state',
            'swsc.reason as reason',
            'settlementWindow.createdDate as createdDate',
            'swsc.createdDate as changedDate').calledOnce)
          test.ok(orderByStub.withArgs('changedDate', 'desc').calledOnce)
          test.ok(distinctStub.calledOnce)
          test.ok(whereStub.withArgs('pc.participantId', participantId).calledOnce)
          test.ok(whereStub.withArgs('swsc.settlementWindowStateId', state).calledOnce)
          test.ok(whereStub.withArgs('settlementWindow.createdDate', '>=', fromDateTime).calledOnce)
          test.ok(whereStub.withArgs('settlementWindow.createdDate', '<=', toDateTime).calledOnce)
          test.ok(whereStub.withArgs('pc.currencyId', currency).calledOnce)
          test.end()
        } catch (err) {
          logger.error(`getByParams failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByParamsTest.test('retrieve settlement windows by params', async test => {
        try {
          Db.settlementWindow.query.returns(Promise.resolve(settlementWindowResultStub))

          query = { participantId }
          const result = await SettlementWindowFacade.getByParams({ query }, enums)
          test.ok(result, 'Result returned')
          test.ok(builderStub.leftJoin.withArgs('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId').calledOnce)
          test.ok(leftJoin2Stub.withArgs('transferFulfilment AS tf', 'tf.settlementWindowId', 'settlementWindow.settlementWindowId').calledOnce)
          test.ok(leftJoin3Stub.withArgs('transferParticipant AS tp', 'tp.transferId', 'tf.transferId').calledOnce)
          test.ok(leftJoin4Stub.withArgs('participantCurrency AS pc', 'pc.participantCurrencyId', 'tp.participantCurrencyId').calledOnce)
          test.ok(selectStub.withArgs('settlementWindow.settlementWindowId',
            'swsc.settlementWindowStateId as state',
            'swsc.reason as reason',
            'settlementWindow.createdDate as createdDate',
            'swsc.createdDate as changedDate').calledOnce)
          test.ok(orderByStub.withArgs('changedDate', 'desc').calledOnce)
          test.ok(distinctStub.calledOnce)
          test.ok(whereStub.withArgs('pc.participantId', participantId).calledOnce)
          test.ok(whereStub.withArgs('swsc.settlementWindowStateId', state).notCalled)
          test.ok(whereStub.withArgs('settlementWindow.createdDate', '>=', fromDateTime).notCalled)
          test.ok(whereStub.withArgs('settlementWindow.createdDate', '<=', toDateTime).notCalled)
          test.end()
        } catch (err) {
          logger.error(`getByParams failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByParamsTest.test('retrieve settlement windows by params', async test => {
        try {
          Db.settlementWindow.query.returns(Promise.resolve(settlementWindowResultStub))

          query = { state, fromDateTime, toDateTime, currency }
          const result = await SettlementWindowFacade.getByParams({ query }, enums)
          test.ok(result, 'Result returned')
          test.ok(builderStub.leftJoin.withArgs('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId').calledOnce)
          test.ok(leftJoin2Stub.withArgs('transferFulfilment AS tf', 'tf.settlementWindowId', 'settlementWindow.settlementWindowId').calledOnce)
          test.ok(leftJoin3Stub.withArgs('transferParticipant AS tp', 'tp.transferId', 'tf.transferId').calledOnce)
          test.ok(leftJoin4Stub.withArgs('participantCurrency AS pc', 'pc.participantCurrencyId', 'tp.participantCurrencyId').calledOnce)
          test.ok(selectStub.withArgs('settlementWindow.settlementWindowId',
            'swsc.settlementWindowStateId as state',
            'swsc.reason as reason',
            'settlementWindow.createdDate as createdDate',
            'swsc.createdDate as changedDate').calledOnce)
          test.ok(orderByStub.withArgs('changedDate', 'desc').calledOnce)
          test.ok(distinctStub.calledOnce)
          test.ok(whereStub.withArgs('swsc.settlementWindowStateId', state).calledOnce)
          test.ok(whereStub.withArgs('settlementWindow.createdDate', '>=', fromDateTime).calledOnce)
          test.ok(whereStub.withArgs('settlementWindow.createdDate', '<=', toDateTime).calledOnce)
          test.ok(whereStub.withArgs('pc.currencyId', currency).calledOnce)
          test.end()
        } catch (err) {
          logger.error(`getByParams failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByParamsTest.test('retrieve settlement windows by params', async test => {
        try {
          query = {}
          Db.settlementWindow.query.returns(Promise.resolve(settlementWindowResultStub))

          const result = await SettlementWindowFacade.getByParams({ query })
          test.ok(result, 'Result returned')
          test.ok(builderStub.leftJoin.withArgs('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId').calledOnce)
          test.ok(selectStub.withArgs('settlementWindow.settlementWindowId',
            'swsc.settlementWindowStateId as state',
            'swsc.reason as reason',
            'settlementWindow.createdDate as createdDate',
            'swsc.createdDate as changedDate').calledOnce)
          test.ok(orderByStub.withArgs('changedDate', 'desc').calledOnce)
          test.ok(distinctStub.calledOnce)
          test.ok(whereStub.withArgs('swsc.settlementWindowStateId', state).notCalled)
          test.ok(whereStub.withArgs('settlementWindow.createdDate', '>=', fromDateTime).notCalled)
          test.ok(whereStub.withArgs('settlementWindow.createdDate', '<=', toDateTime).notCalled)
          test.end()
        } catch (err) {
          logger.error(`getByParams failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByParamsTest.test('throw error if database is unavailable', async test => {
        try {
          e = new Error('Database unavailable')
          Db.settlementWindow.query.throws(e)
          await SettlementWindowFacade.getByParams({ query })
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`getByParams failed with error - ${err}`)
          test.equal(err.message, e.message, `Error "${err.message}" thrown as expected`)
          test.end()
        }
      })

      await getByParamsTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      getByParamsTest.fail()
      getByParamsTest.end()
    }
  })

  await settlementWindowFacadeTest.test('process should', async processTest => {
    try {
      let settlementWindowCurrentStateMock = { state: 'OPEN' }
      const transfersCountMock = { cnt: 1 }
      const settlementWindowId = 1
      const state = 'PROCESSING'
      const reason = 'close reason text'
      const params = { settlementWindowId, state, reason }
      const enums = { OPEN: 'OPEN' }

      await processTest.test('process the specified open window and open a new one', async test => {
        try {
          Db.getKnex = sandbox.stub()
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)
          const transactingStub = sandbox.stub()
          const settlementWindowStateChangeIdMock = 2
          const newSettlementWindowIdMock = [2]
          const newSettlementWindowStateChangeIdMock = 5
          const insertStub = sandbox.stub()
          insertStub.onCall(0).returns(settlementWindowStateChangeIdMock)
          insertStub.onCall(1).returns(newSettlementWindowIdMock)
          insertStub.onCall(2).returns(newSettlementWindowStateChangeIdMock)
          const whereStub = sandbox.stub()
          const updateStub = sandbox.stub()
          knexStub.returns({
            transacting: transactingStub.returns({
              insert: insertStub,
              where: whereStub.returns({
                update: updateStub
              })
            })
          })

          SettlementWindowFacade.getById = sandbox.stub().returns(settlementWindowCurrentStateMock)
          sandbox.stub(SettlementWindowFacade, 'getTransfersCount').returns(transfersCountMock)
          const result = await SettlementWindowFacade.process(params, enums)
          test.ok(result, 'Result returned')
          test.ok(SettlementWindowFacade.getById.withArgs({ settlementWindowId }).calledOnce)
          test.ok(SettlementWindowFacade.getTransfersCount.withArgs({ settlementWindowId }).calledOnce)
          test.ok(knexStub.withArgs('settlementWindowStateChange').calledTwice)
          test.equal(transactingStub.withArgs(trxStub).callCount, 5)
          test.ok(insertStub.withArgs({
            settlementWindowStateId: enums[state.toUpperCase()],
            reason,
            settlementWindowId,
            createdDate: now
          }).calledOnce)
          test.ok(knexStub.withArgs('settlementWindow').calledThrice)
          test.ok(whereStub.withArgs({ settlementWindowId }).calledOnce)
          test.ok(updateStub.withArgs({ currentStateChangeId: settlementWindowStateChangeIdMock }).calledOnce)
          test.ok(insertStub.withArgs({ reason, createdDate: now }).calledOnce)
          test.ok(insertStub.withArgs({
            settlementWindowId: newSettlementWindowIdMock[0],
            settlementWindowStateId: enums.OPEN,
            reason,
            createdDate: now
          }).calledOnce)
          test.ok(whereStub.withArgs({ settlementWindowId: newSettlementWindowIdMock[0] }).calledOnce)
          test.ok(updateStub.withArgs({ currentStateChangeId: newSettlementWindowStateChangeIdMock }).calledOnce)
          try {
            insertStub.onCall(3).throws(new Error('Insert into settlementWindowStateChange failed'))
            await SettlementWindowFacade.process(params, enums)
            test.fail('Error expected, but not thrown!')
            test.end()
          } catch (err) {
            test.pass(`Error "${err.message}" thrown as expected`)
            test.end()
          }
        } catch (err) {
          logger.error(`process failed with error - ${err}`)
          test.end()
        }
      })

      await processTest.test('throw error if the requested window is not open', async test => {
        try {
          const settlementWindowResultStub = () => { return { cnt: 1 } }
          Db.transferFulfilment = {
            query: settlementWindowResultStub
          }

          settlementWindowCurrentStateMock = { state: 'INVALID' }
          SettlementWindowFacade.getById = sandbox.stub().returns(settlementWindowCurrentStateMock)
          await SettlementWindowFacade.process(params)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`process failed with error - ${err}`)
          test.ok(err instanceof Error, `Error "${err.message}" thrown as expected`)
          test.end()
        }
      })

      await processTest.test('throw error if transfer count is 0', async test => {
        try {
          const settlementWindowResultStub = () => { return { cnt: 0 } }
          Db.transferFulfilment = {
            query: settlementWindowResultStub
          }

          settlementWindowCurrentStateMock = { state: 'OPEN' }
          SettlementWindowFacade.getById = sandbox.stub().returns(settlementWindowCurrentStateMock)
          await SettlementWindowFacade.process(params, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`process failed with error - ${err}`)
          test.ok(err instanceof Error, `Error "${err.message}" thrown as expected`)
          test.end()
        }
      })

      await processTest.test('roll back when critical error occurred', async test => {
        try {
          const settlementWindowResultStub = () => { return { cnt: 1 } }
          Db.transferFulfilment = {
            query: settlementWindowResultStub
          }

          settlementWindowCurrentStateMock = { state: 'OPEN' }
          SettlementWindowFacade.getById = sandbox.stub().returns(settlementWindowCurrentStateMock)
          await SettlementWindowFacade.process(params, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`process failed with error - ${err}`)
          test.ok(err instanceof Error, `Error "${err.message}" thrown as expected`)
          test.end()
        }
      })

      await processTest.test('throw error if the requested window state is undefined does not exist', async test => {
        try {
          const settlementWindowResultStub = () => { return { cnt: 1 } }

          Db.transferFulfilment = {
            query: settlementWindowResultStub
          }
          settlementWindowCurrentStateMock = undefined
          SettlementWindowFacade.getById = sandbox.stub().returns(settlementWindowCurrentStateMock)
          await SettlementWindowFacade.process(params)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`process failed with error - ${err}`)
          test.ok(err instanceof Error, `Error "${err.message}" thrown as expected`)
          test.end()
        }
      })
      await processTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      processTest.fail()
      processTest.end()
    }
  })

  await settlementWindowFacadeTest.test('getBySettlementId should', async getBySettlementIdTest => {
    try {
      const settlementId = 1
      const enums = {}
      const settlementWindowResultStub = [{ id: 1, state: 'PENDING_SETTLEMENT' }, { id: 2, state: 'SETTLED' }]
      let e

      await getBySettlementIdTest.test('retrieve settlement windows by settlement id', async test => {
        try {
          join2Stub = sandbox.stub()
          builderStub.join.returns({
            join: join2Stub.returns({
              select: selectStub.returns({
                where: whereStub
              })
            })
          })

          Db.settlementSettlementWindow.query.returns(Promise.resolve(settlementWindowResultStub))
          const result = await SettlementWindowFacade.getBySettlementId({ settlementId }, enums)
          test.ok(result, 'Result returned')
          test.ok(builderStub.join.withArgs('settlementWindow AS sw', 'sw.settlementWindowId', 'settlementSettlementWindow.settlementWindowId').calledOnce)
          test.ok(join2Stub.withArgs('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'sw.currentStateChangeId').calledOnce)
          test.ok(selectStub.withArgs('sw.settlementWindowId AS id',
            'swsc.settlementWindowStateId as state',
            'swsc.reason as reason',
            'sw.createdDate as createdDate',
            'swsc.createdDate as changedDate').calledOnce)
          test.ok(whereStub.withArgs('settlementSettlementWindow.settlementId', settlementId).calledOnce)
          test.end()
        } catch (err) {
          logger.error(`getBySettlementId failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getBySettlementIdTest.test('throw error if database is unavailable', async test => {
        try {
          e = new Error('Database unavailable')
          Db.settlementSettlementWindow.query = sandbox.stub().throws(e)

          await SettlementWindowFacade.getBySettlementId({ settlementId })
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`getBySettlementId failed with error - ${err}`)
          test.equal(err.message, e.message, `Error "${err.message}" thrown as expected`)
          test.end()
        }
      })

      await getBySettlementIdTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      getBySettlementIdTest.fail()
      getBySettlementIdTest.end()
    }
  })

  await settlementWindowFacadeTest.test('close should', async closeTest => {
    try {
      const settlementWindowId = 1
      const reason = 'close reason text'
      const params = { settlementWindowId, reason }
      const enums = { OPEN: 'OPEN' }

      await closeTest.test('close the specified open window will throw an error if the current state is undefined.', async test => {
        try {
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          SettlementWindowFacade.getById = sandbox.stub().returns(undefined)
          await SettlementWindowFacade.close(params, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error('Close settlementwindow failed with error : ' + err)
          test.pass('Error thrown as expected')
          test.end()
        }
      })

      await closeTest.test('close the specified open window will throw an error if the current state is not "PROCESSING".', async test => {
        try {
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          SettlementWindowFacade.getById = sandbox.stub().returns('INVALID STATE')
          await SettlementWindowFacade.close(params, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error('Close settlementwindow failed with error : ' + err)
          test.pass('Error thrown as expected')
          test.end()
        }
      })

      await closeTest.test('close the specified open window should throw an error.', async test => {
        try {
          sandbox.stub(SettlementModel, 'getAll').resolves([
            {
              settlementModelId: 1,
              name: 'DEFERREDNETUSD',
              isActive: true,
              settlementGranularity: 'NET',
              settlementInterchange: 'MULTILATERAL',
              settlementDelay: 'DEFERRED',
              currencyId: 'USD',
              requireLiquidityCheck: true,
              ledgerAccountTypeId: 'POSITION',
              autoPositionReset: true
            },
            {
              settlementModelId: 2,
              name: 'DEFAULTDEFERREDNETUSD',
              isActive: true,
              settlementGranularity: 'NET',
              settlementInterchange: 'MULTILATERAL',
              settlementDelay: 'DEFERRED',
              currencyId: null,
              requireLiquidityCheck: true,
              ledgerAccountTypeId: 'POSITION',
              autoPositionReset: true
            }
          ])

          const knexProps = {
            select: sandbox.stub().returnsThis(),
            from: sandbox.stub().returnsThis(),
            where: sandbox.stub().returnsThis(),
            join: sandbox.stub().returnsThis(),
            update: sandbox.stub().returnsThis(),
            insert: sandbox.stub().returnsThis(),
            unionAll: sandbox.stub().returnsThis(),
            as: sandbox.stub().returnsThis(),
            distinct: sandbox.stub().returnsThis(),
            raw: sandbox.stub().returnsThis(),
            transaction: sandbox.stub().returnsThis(),
            transacting: sandbox.stub().returns([])
          }
          const settlementWindowResult = [
            {
              settlementWindowId: 31,
              ledgerAccountTypeId: 1,
              currencyId: 'USD',
              settlementModelId: 2
            },
            {
              settlementWindowId: 31,
              ledgerAccountTypeId: 1,
              currencyId: 'USD',
              settlementModelId: 1
            }
          ]
          knexProps.transacting.onCall(0).returns(settlementWindowResult)

          const knexStub = sandbox.stub().returns(knexProps)
          Object.assign(knexStub, knexProps)

          knexStub.withArgs('settlementWindow').returns({}) // This should cause an error

          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          const settlementWindowCurrentStateMock = { state: 'PROCESSING' }

          Db.getKnex.returns(knexStub)

          SettlementWindowFacade.getById = sandbox.stub().returns(settlementWindowCurrentStateMock)
          await SettlementWindowFacade.close(params, enums)

          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error('Close settlementwindow failed with error : ' + err)
          test.ok('Error thrown as expected')
          test.end()
        }
      })

      await closeTest.test('close the specified open window successfully.', async test => {
        try {
          const knexStub = sandbox.stub()
          knexStub.raw = sandbox.stub()
          knexStub.from = sandbox.stub()
          const trxStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          const settlementWindowCurrentStateMock = { state: 'PROCESSING' }
          const context = sandbox.stub()
          const context2 = sandbox.stub()

          sandbox.stub(SettlementModel, 'getAll').resolves([
            {
              settlementModelId: 1,
              name: 'DEFERREDNETUSD',
              isActive: true,
              settlementGranularity: 'NET',
              settlementInterchange: 'MULTILATERAL',
              settlementDelay: 'DEFERRED',
              currency: 'USD',
              requireLiquidityCheck: true,
              ledgerAccountTypeId: 'POSITION',
              autoPositionReset: true
            },
            {
              settlementModelId: 2,
              name: 'DEFAULTDEFERREDNETUSD',
              isActive: true,
              settlementGranularity: 'NET',
              settlementInterchange: 'MULTILATERAL',
              settlementDelay: 'DEFERRED',
              currency: null,
              requireLiquidityCheck: true,
              ledgerAccountTypeId: 'POSITION',
              autoPositionReset: true
            }
          ])

          Db.transferParticipant = {
            join: sandbox.stub()
          }

          Db.participantCurrency = {
            join: sandbox.stub()
          }

          Db.settlementWindowContent = {
            join: sandbox.stub()
          }

          Db.transferParticipant.join.callsArgWith(0, builderStub)
          Db.participantCurrency.join.callsArgWith(0, builderStub)
          Db.settlementWindowContent.join.callsArgWith(0, builderStub)
          // Db.transferFulfilment.join.callsArgWith(0, builderStub)

          const infoDataStub = {
            settlementWindowContentId: 4,
            settlementWindowContentStateChangeId: 4
          }

          Db.getKnex.returns(knexStub)

          // Insert settlementContentAggregation
          context2.on = sandbox.stub().returns({
            on: sandbox.stub().returns({
              on: sandbox.stub()
            })
          })
          context.from = sandbox.stub().returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                join: sandbox.stub().callsArgOn(1, context2).returns({
                  join: sandbox.stub().returns({
                    where: sandbox.stub().returns({
                      andWhere: sandbox.stub().returns({
                        groupBy: sandbox.stub().returns({
                          select: sandbox.stub().returns({
                            sum: sandbox.stub()
                          })
                        })
                      })
                    })
                  })
                }),
                where: sandbox.stub().returns({
                  distinct: sandbox.stub()
                })
              })
            }),
            where: sandbox.stub().returns({
              select: sandbox.stub()
            })
          })

          knexStub.from = sandbox.stub().returns({
            insert: sandbox.stub().callsArgOn(0, context).returns({ transacting: sandbox.stub() })
          })

          // Update settlementWindowContent pointers to current states, inserted by previous command
          knexStub.withArgs('settlementWindowContentStateChange AS swcsc').returns({
            join: sandbox.stub().returns({
              select: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  transacting: sandbox.stub().returns(Promise.resolve(infoDataStub))
                })
              })
            })
          })
          knexStub.withArgs('settlementWindowContent').returns({
            where: sandbox.stub().returns({
              update: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })

          knexStub.withArgs('settlementWindowStateChange').returns({
            transacting: sandbox.stub().returns({
              insert: sandbox.stub().returns(1)
            })
          })
          knexStub.withArgs('settlementWindow').returns({
            transacting: sandbox.stub().returns({
              where: sandbox.stub().returns({
                update: sandbox.stub().returns(1)
              })
            })
          })

          knexStub.from.withArgs('transferFulfilment AS tf').returns({
            join: sandbox.stub().returns({
              join: sandbox.stub().returns({
                join: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    andWhere: sandbox.stub().returns({
                      distinct: sandbox.stub().returns({
                        transacting: sandbox.stub().resolves([
                          {
                            settlementWindowId: 31,
                            ledgerAccountTypeId: 1,
                            currencyId: 'USD',
                            settlementModelId: 2
                          },
                          {
                            settlementWindowId: 31,
                            ledgerAccountTypeId: 1,
                            currencyId: 'USD',
                            settlementModelId: 1
                          }
                        ])
                      })
                    })
                  })
                })
              })
            })
          })

          SettlementWindowFacade.getById = sandbox.stub().returns(settlementWindowCurrentStateMock)
          const result = await SettlementWindowFacade.close(params, enums)
          test.ok(result, true)
          test.end()
        } catch (err) {
          logger.error('Close settlementwindow failed with error : ' + err)
          test.pass('Error thrown incorrectly')
          test.end()
        }
      })
      await closeTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      closeTest.fail()
      closeTest.end()
    }
  })

  await settlementWindowFacadeTest.test('getTransfersCount should', async closeTest => {
    try {
      await closeTest.test('should return the number of transfers in a window.', async test => {
        try {
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          const firstStub = sandbox.stub()
          const whereStub = sandbox.stub()
          const builderStub = sandbox.stub()
          builderStub.count = sandbox.stub()
          builderStub.count.returns({
            first: firstStub.returns({
              where: whereStub.returns(1)
            })
          })
          Db.transferFulfilment.query.callsArgWith(0, builderStub)

          const result = await SettlementWindowFacade.getTransfersCount({ settlementWindowId: 1 })
          test.ok(result, 'Result returned')
          test.end()
        } catch (err) {
          logger.error('getTransferCount failed with error : ' + err)
          test.pass('Error thrown as expected')
          test.end()
        }
      })

      await closeTest.end()
    } catch (err) {
      logger.error(`settlementFacadeTest failed with error - ${err}`)
      closeTest.fail()
      closeTest.end()
    }
  })

  settlementWindowFacadeTest.end()
})
