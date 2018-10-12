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

 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>

 --------------
 ******/
'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const TimeoutHandler = require('../../../../src/handlers/timeouts/handler')
const CronJob = require('cron').CronJob
const TimeoutService = require('../../../../src/domain/timeout')
const Config = require('../../../../src/lib/config')

Test('Timeout handler', TimeoutHandlerTest => {
  let sandbox

  TimeoutHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(TimeoutService)
    sandbox.stub(CronJob.prototype, 'constructor').returns(P.resolve())
    sandbox.stub(CronJob.prototype, 'start').returns(P.resolve(true))
    sandbox.stub(CronJob.prototype, 'stop').returns(P.resolve(true))
    Config.HANDLERS_TIMEOUT_DISABLED = false
    test.end()
  })

  TimeoutHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  TimeoutHandlerTest.test('registerAllHandlers should', registerHandlersTest => {
    registerHandlersTest.test('register timeout handler', async (test) => {
      const result = await TimeoutHandler.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.test('do not start the handler when its diabled in config', async (test) => {
      Config.HANDLERS_TIMEOUT_DISABLED = true
      const result = await TimeoutHandler.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.end()
  })

  TimeoutHandlerTest.test('registerTimeoutHandler should', registerTimeoutHandlerTest => {
    registerTimeoutHandlerTest.test('register timeout handler', async (test) => {
      const result = await TimeoutHandler.registerAllHandlers()
      test.equal(result, true)
      await TimeoutHandler.stop()
      test.end()
    })

    registerTimeoutHandlerTest.test('tear down the handler', async (test) => {
      await TimeoutHandler.stop()
      test.pass('reched stop')
      test.end()
    })

    registerTimeoutHandlerTest.test('isRunning', async (test) => {
      await TimeoutHandler.registerAllHandlers()
      const result = await TimeoutHandler.isRunning()
      test.equal(result, true)
      test.end()
    })

    registerTimeoutHandlerTest.test('should throw error', async (test) => {
      CronJob.prototype.start.throws(new Error())
      try {
        await TimeoutHandler.registerAllHandlers()
        test.fail('should throw')
        test.end()
      } catch (e) {
        test.ok(e instanceof Error)
        test.end()
      }
    })

    registerTimeoutHandlerTest.end()
  })

  TimeoutHandlerTest.test('stop should', stopTest => {
    stopTest.test('to reach else branch', async (test) => {
      await TimeoutHandler.stop()
      test.pass('reched stop')
      test.end()
    })

    stopTest.end()
  })

  TimeoutHandlerTest.end()
})
