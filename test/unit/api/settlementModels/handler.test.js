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

Test('SettlementModel', settlementModelHandlerTest => {
  let sandbox
  const ledgerAccountType = {
    ledgerAccountTypeId: 2,
    name: 'SETTLEMENT',
    description: 'An account to which fees will be charged or collected',
    isActive: 1,
    createdDate: '2018-07-17T16:04:24.185Z'
  }

  settlementModelHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Sidecar)
    sandbox.stub(Logger)
    sandbox.stub(SettlementService)
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
      SettlementService.getLedgerAccountTypeName.returns(Promise.resolve(ledgerAccountType))
      SettlementService.getByName.returns(Promise.resolve(false))
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

    handlerTest.test('create should fail if the settlement model exists', async function (test) {
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
      SettlementService.getLedgerAccountTypeName.returns(Promise.resolve(ledgerAccountType))
      SettlementService.getByName.returns(Promise.resolve(true))
      try {
        await Handler.create({ payload })
        test.fail('Error not thrown')
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'This Settlement Model already exists')
        test.end()
      }
    })

    handlerTest.test('create should fail if account type does not exists', async function (test) {
      const payload = {
        name: 'DEFERRED_NET',
        settlementGranularity: 'NET',
        settlementInterchange: 'MULTILATERAL',
        settlementDelay: 'DEFERRED',
        settlementCurrency: 'USD',
        requireLiquidityCheck: true,
        type: 'POSITION',
        autoPositionReset: true
      }
      SettlementService.getLedgerAccountTypeName.returns(Promise.resolve(false))

      try {
        await Handler.create({ payload })
        test.fail('Error not thrown')
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Ledger account type was not found')
        test.end()
      }
    })

    handlerTest.end()
  })

  settlementModelHandlerTest.end()
})
