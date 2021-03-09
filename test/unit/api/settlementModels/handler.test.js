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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Lazola Lucas <lazola.lucas@modusbox.com>
 --------------
 ******/
'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Logger = require('@mojaloop/central-services-logger')
const Handler = require('../../../../src/api/settlementModels/handler')
const Sidecar = require('../../../../src/lib/sidecar')
const SettlementService = require('../../../../src/domain/settlement')
const EnumCached = require('../../../../src/lib/enumCached')
const FSPIOPError = require('@mojaloop/central-services-error-handling').Factory.FSPIOPError

const createRequest = ({ payload, params, query }) => {
  const sandbox = Sinon.createSandbox()
  const requestPayload = payload || {}
  const requestParams = params || {}
  const requestQuery = query || {}
  const enums = sandbox.stub()
  enums.withArgs('ledgerAccountType').returns({ POSITION: 1, SETTLEMENT: 2, HUB_RECONCILIATION: 3, HUB_MULTILATERAL_SETTLEMENT: 4, HUB_FEE: 5 })
  return {
    payload: requestPayload,
    params: requestParams,
    query: requestQuery,
    server: {
      log: () => { },
      methods: {
        enums
      }
    }
  }
}

Test('SettlementModel', settlementModelHandlerTest => {
  let sandbox
  const ledgerAccountType = {
    ledgerAccountTypeId: 2,
    name: 'SETTLEMENT',
    description: 'An account to which fees will be charged or collected',
    isActive: 1,
    createdDate: '2018-07-17T16:04:24.185Z'
  }
  const settlementModelService = [

    {
      settlementModelId: 106,
      name: 'DEFERRED_NET',
      isActive: 1,
      settlementGranularityId: 1,
      settlementInterchangeId: 1,
      settlementDelayId: 2,
      currencyId: null,
      requireLiquidityCheck: 1,
      ledgerAccountTypeId: 2,
      autoPositionReset: 1
    }
  ]
  const settlementModel = [

    {
      settlementModelId: 106,
      name: 'DEFERRED_NET',
      isActive: true,
      settlementGranularity: 'GROSS',
      settlementInterchange: 'BILATERAL',
      settlementDelay: 'DEFERRED',
      currency: null,
      requireLiquidityCheck: true,
      ledgerAccountTypeId: 'SETTLEMENT',
      autoPositionReset: true
    }
  ]
  settlementModelHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Sidecar)
    sandbox.stub(Logger)
    sandbox.stub(SettlementService)
    sandbox.stub(EnumCached)
    EnumCached.getEnums.returns(Promise.resolve({ POSITION: 1, SETTLEMENT: 2, HUB_RECONCILIATION: 3, HUB_MULTILATERAL_SETTLEMENT: 4, HUB_FEE: 5 }))
    test.end()
  })

  settlementModelHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })
  settlementModelHandlerTest.test('Handler Test', async handlerTest => {
    handlerTest.test('create should create a new settlement model and return a 201', async function (test) {
      const payload = {
        name: 'IMMEDIATE_GROSS',
        settlementGranularity: 'GROSS',
        settlementInterchange: 'BILATERAL',
        settlementDelay: 'IMMEDIATE',
        settlementCurrency: 'USD',
        requireLiquidityCheck: true,
        type: 'POSITION',
        autoPositionReset: true
      }
      SettlementService.createSettlementModel.resolves()
      const reply = {
        response: () => {
          return {
            code: statusCode => {
              test.equal(statusCode, 201)
              test.end()
            }
          }
        }
      }
      await Handler.create({ payload }, reply)
    })

    handlerTest.test('create should fail if the settlement model creation fails', async function (test) {
      const payload = {
        name: 'IMMEDIATE_GROSS',
        settlementGranularity: 'GROSS',
        settlementInterchange: 'BILATERAL',
        settlementDelay: 'IMMEDIATE',
        settlementCurrency: 'USD',
        requireLiquidityCheck: true,
        type: 'POSITION',
        autoPositionReset: true
      }
      SettlementService.createSettlementModel.throws()
      try {
        await Handler.create({ payload })
        test.fail('Error not thrown')
      } catch (e) {
        test.ok(e instanceof Error)
        test.end()
      }
    })

    handlerTest.test('getAll should return all the settlement models', async function (test) {
      SettlementService.getLedgerAccountTypeName.returns(Promise.resolve(ledgerAccountType))
      SettlementService.getAll.returns(Promise.resolve(settlementModelService))
      const result = await Handler.getAll()
      test.deepEqual(result, settlementModel, 'The results match')
      test.end()
    })

    handlerTest.test('getByName should return the settlement model', async function (test) {
      SettlementService.getByName.withArgs(settlementModel[0].name).returns(Promise.resolve(settlementModelService[0]))
      const result = await Handler.getByName(createRequest({ params: { name: settlementModel[0].name } }))
      test.deepEqual(result, settlementModel[0], 'The results match')
      test.end()
    })

    handlerTest.test('getByName should throw error', async function (test) {
      SettlementService.getByName.withArgs(settlementModel[0].name).returns(Promise.resolve(null))
      try {
        await Handler.getByName(createRequest({ params: { name: settlementModel[0].name } }))
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'The requested resource could not be found.')
        test.end()
      }
    })

    handlerTest.test('update should update, return settlement model and utilize logger', async function (test) {
      SettlementService.update.withArgs(settlementModel[0].name, { isActive: 1 }).returns(Promise.resolve(settlementModelService[0]))
      try {
        const result = await Handler.update(createRequest({
          params: { name: settlementModel[0].name },
          payload: { isActive: 1 }
        }))
        test.deepEqual(result, settlementModel[0], 'The results match')
        test.ok(Logger.info.withArgs('SettlementModel has been activated :: {"name":"DEFERRED_NET","isActive":1}'))
        test.end()
      } catch (err) {
        test.fail('Error thrown')
        test.end()
      }
    })

    handlerTest.test('update should update, return settlement model if settlement model when inactive and utilize', async function (test) {
      SettlementService.update.withArgs(settlementModel[0].name, { isActive: 0 }).returns(Promise.resolve(settlementModelService[0]))
      try {
        const result = await Handler.update(createRequest({
          params: { name: settlementModel[0].name },
          payload: { isActive: 0 }
        }))
        test.deepEqual(result, settlementModel[0], 'The results match')
        test.ok(Logger.info.withArgs('SettlementModel has been disabled :: {"name":"DEFERRED_NET","isActive":0}'))
        test.end()
      } catch (err) {
        test.fail('Error thrown')
        test.end()
      }
    })

    handlerTest.test('update should update, return settlement model if settlement model when inactive and utilize', async function (test) {
      SettlementService.update.withArgs(settlementModel[0].name, { }).returns(Promise.resolve(settlementModelService[0]))
      try {
        const result = await Handler.update(createRequest({
          params: { name: settlementModel[0].name },
          payload: { }
        }))
        test.deepEqual(result, settlementModel[0], 'The results match')
        test.end()
      } catch (err) {
        test.fail('Error thrown')
        test.end()
      }
    })

    handlerTest.test('update should throw error', async function (test) {
      SettlementService.update.withArgs(settlementModel[0].name, { isActive: 1 }).throws(new Error('Test error'))
      try {
        await Handler.update(createRequest({ params: { name: settlementModelService[0].name }, payload: { isActive: 1 } }))
      } catch (e) {
        test.ok(e instanceof FSPIOPError)
        test.equal(e.message, 'Test error')
        test.end()
      }
    })

    handlerTest.end()
  })

  settlementModelHandlerTest.end()
})
