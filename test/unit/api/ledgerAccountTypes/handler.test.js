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
 - Claudio Viola <claudio.viola@modusbox.com>
 --------------
 ******/
'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Logger = require('@mojaloop/central-services-logger')
const Handler = require('../../../../src/api/ledgerAccountTypes/handler')
const Sidecar = require('../../../../src/lib/sidecar')
const LedgerAccountTypeService = require('../../../../src/domain/ledgerAccountTypes')

Test('LedgerAccountTypes', ledgerAccountTypesHandlerTest => {
  let sandbox

  ledgerAccountTypesHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Sidecar)
    sandbox.stub(Logger)
    sandbox.stub(LedgerAccountTypeService)
    test.end()
  })

  ledgerAccountTypesHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  ledgerAccountTypesHandlerTest.test('Handler Test', async handlerTest => {
    handlerTest.test('create should create a new ledgerAccountType model', async function (test) {
      const payload = {
        name: 'INTERCHANGE_FEE_SETTLEMENT',
        description: 'settlement account type for interchange fees',
        isActive: true,
        isSettleable: true
      }
      LedgerAccountTypeService.getByName.returns(Promise.resolve(false))
      const reply = {
        response: () => {
          return {
            code: statusCode => {
              test.equal(statusCode, 201, 'should return a 201')
              test.end()
            }
          }
        }
      }
      await Handler.create({ payload }, reply)
    })

    handlerTest.test('create should fail if the ledger Account type model exists', async function (test) {
      const payload = {
        name: 'INTERCHANGE_FEE_SETTLEMENT',
        description: 'settlement account type for interchange fees',
        isActive: true,
        isSettleable: true
      }
      LedgerAccountTypeService.getByName.returns(Promise.resolve(true))
      try {
        await Handler.create({ payload })
        test.fail('An error should have been thrown')
      } catch (e) {
        test.ok(e instanceof Error, 'should return an error')
        test.equal(e.message, 'This Ledger Account Type already exists', 'should return an error with the message This Ledger Account Type already exists')
        test.end()
      }
    })

    handlerTest.test('create should fail if some error occurs', async function (test) {
      const payload = {
        name: 'INTERCHANGE_FEE_SETTLEMENT',
        description: 'settlement account type for interchange fees',
        isActive: true,
        isSettleable: true
      }
      LedgerAccountTypeService.getByName.rejects(new Error('Something happened'))

      try {
        await Handler.create({ payload })
        test.fail('Error not thrown')
      } catch (e) {
        test.ok(e instanceof Error, 'should return an instance of an error')
        test.equal(e.message, 'Something happened', 'should return the error message thrown')
        test.end()
      }
    })

    handlerTest.test('getAll should return all the ledgerAccount Types models', async function (test) {
      const ledgerAccountTypes = [
        {
          name: 'INTERCHANGE_FEE_SETTLEMENT',
          description: 'settlement account type for interchange fees',
          isActive: true,
          isSettleable: true
        }
      ]
      LedgerAccountTypeService.getAll.returns(Promise.resolve(ledgerAccountTypes))
      const result = await Handler.getAll()
      test.deepEqual(result, ledgerAccountTypes, 'should return an array of ledger account types')
      test.end()
    })

    handlerTest.end()
  })

  ledgerAccountTypesHandlerTest.end()
})
