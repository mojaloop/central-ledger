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
 -
 * Modusbox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Deon Botha <deon.botha@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Handlers = require('../../../../src/settlement/handlers/register')
const Proxyquire = require('proxyquire')

const SettlementWindowHandlers = require('../../../../src/settlement/handlers/deferredSettlement/handler')
const TransferFulfilHandlers = require('../../../../src/settlement/handlers/grossSettlement/handler')
const RulesHandlers = require('../../../../src/settlement/handlers/rules/handler')

Test('handlers', handlersTest => {
  let sandbox

  handlersTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(SettlementWindowHandlers, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(TransferFulfilHandlers, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(RulesHandlers, 'registerAllHandlers').returns(Promise.resolve(true))
    test.end()
  })

  handlersTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  handlersTest.test('handlers test should', registerAllTest => {
    registerAllTest.test('register all handlers', async (test) => {
      const result = await Handlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerAllTest.test('throw error on Handlers.registerAllHandlers', async (test) => {
      const errorMessage = 'require-glob Stub ERROR'
      const HandlersStub = Proxyquire('../../../../src/settlement/handlers/register', {
        'require-glob': sandbox.stub().throws(new Error(errorMessage))
      })

      try {
        await HandlersStub.registerAllHandlers()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.equal(e.message, errorMessage)
        test.pass('Error thrown')
        test.end()
      }
    })

    registerAllTest.test('Register without correct "handler" module', async (test) => {
      const HandlersStub = Proxyquire('../../../../src/settlement/handlers/register', {
        'require-glob': sandbox.stub().resolves([{
          settlementWindow: {
            handler: {
              test1: {}
            }
          }
        }])
      })

      try {
        await HandlersStub.registerAllHandlers()
        test.fail('Error thrown')
        test.end()
      } catch (e) {
        test.pass()
        test.end()
      }
    })

    registerAllTest.test('throw error when transfer handler throws error', async (test) => {
      try {
        sandbox.stub(SettlementWindowHandlers, 'registerAllHandlers').throws(new Error())
        await Handlers.registerAllHandlers()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    registerAllTest.end()
  })

  handlersTest.end()
})
