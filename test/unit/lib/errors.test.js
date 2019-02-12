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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Logger = require('@mojaloop/central-services-shared').Logger
const Model = require('../../../src/lib/errors')

Test('Errors', (errorsTest) => {
  let sandbox

  errorsTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    t.end()
  })

  errorsTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  errorsTest.test('createErrorInformation should', async (test) => {
    try {
      const errorCode = 4001
      const extensionList = { key1: 'value1' }
      const result = await Model.createErrorInformation(errorCode, extensionList)
      test.equal(errorCode, result.errorCode, 'return result errorCode matching input')
      test.deepEqual(extensionList, result.extensionList, 'return result extensionList matching input')
      test.ok(result.errorDescription, 'return errorDescription for existing errorCode')
      test.end()
    } catch (err) {
      Logger.error(`createErrorInformation failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  errorsTest.test('getErrorDescription should', async (test) => {
    try {
      const errorCode = 4001
      const result = await Model.getErrorDescription(errorCode)
      test.ok(result, 'return errorDescription for existing errorCode')
      test.end()
    } catch (err) {
      Logger.error(`createErrorInformation failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  errorsTest.end()
})
