/*****
 Test that integrated enumsCached.js and cache.js work together as expected.

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

 * Roman Pietrzak <roman.pietrzak@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const ConfigValidator = require('../../../src/lib/configValidator')

const Config = require('../../../src/lib/config')

Test('ConfigValidator', async (configValidatorTest) => {
  let sandbox

  configValidatorTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    t.end()
  })

  configValidatorTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await configValidatorTest.test('initializeSeedData when valid settlement model is passed', async (assert) => {
    try {
      Config.SETTLEMENT_MODELS = ['DEFERREDNET']

      await ConfigValidator.validateConfig()
      assert.pass('Should pass')
      assert.end()
    } catch (err) {
      assert.fail(`Error thrown ${err}`, 'should have not thrown an error')
      assert.end()
    }
  })

  await configValidatorTest.test('initializeSeedData when correct combinaion is passed', async (assert) => {
    try {
      Config.SETTLEMENT_MODELS = ['DEFERREDNET', 'INTERCHANGEFEE']

      await ConfigValidator.validateConfig()
      assert.pass('Should pass')
      assert.end()
    } catch (err) {
      assert.fail(`Error thrown ${err}`, 'should have not thrown an error')
      assert.end()
    }
  })

  await configValidatorTest.test('initializeSeedData should throw for invalid settlementModels combinations', async (assert) => {
    try {
      Config.SETTLEMENT_MODELS = ['CGS', 'DEFERREDNET']
      await ConfigValidator.validateConfig()
      assert.fail()
    } catch (err) {
      assert.equal(err.message, 'The settlement models: \'CGS\' and \'DEFERREDNET\' can\'t be used together', 'should thrown a validation error')
      assert.end()
    }
  })

  await configValidatorTest.end()
})
