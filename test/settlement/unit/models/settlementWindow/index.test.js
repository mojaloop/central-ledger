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
const Proxyquire = require('proxyquire')

Test('Settlement Window Model Index', async (settlementWindowIndexTest) => {
  let sandbox

  settlementWindowIndexTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    test.end()
  })

  settlementWindowIndexTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await settlementWindowIndexTest.test('getById should', async getByIdTest => {
    try {
      const SettlementWindowModelProxy = Proxyquire('../../../../../src/settlement/models/settlementWindow', {
        './facade': {
          getById: sandbox.stub()
        }
      })

      await getByIdTest.test('be called', async test => {
        try {
          const settlementWindowId = 1
          await SettlementWindowModelProxy.getById({ settlementWindowId })
          test.ok(SettlementWindowModelProxy.getById.withArgs({ settlementWindowId }).calledOnce, 'once with settlement window model getById proxy')
          test.end()
        } catch (err) {
          logger.error(`getById failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getByIdTest.end()
    } catch (err) {
      logger.error(`settlementWindowIndexTest failed with error - ${err}`)
      getByIdTest.fail()
      getByIdTest.end()
    }
  })

  await settlementWindowIndexTest.end()
})
