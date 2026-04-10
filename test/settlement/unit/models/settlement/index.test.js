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
const SettlementModel = require('../../../../../src/settlement/models/settlement')
const Proxyquire = require('proxyquire')

Test('Settlement Model Index', async (settlementIndexTest) => {
  let sandbox

  settlementIndexTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    test.end()
  })

  settlementIndexTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await settlementIndexTest.test('create should', async createTest => {
    try {
      SettlementModel.create = sandbox.stub()
      const SettlementModelProxy = Proxyquire('../../../../../src/settlement/models/settlement', {
        './settlement': {
          create: sandbox.stub()
        }
      })

      await createTest.test('be called', async test => {
        try {
          const settlement = {
            reason: 'Create new settlement',
            createdDate: new Date()
          }
          await SettlementModel.create(settlement)
          await SettlementModelProxy.create(settlement)
          test.ok(SettlementModel.create.withArgs(settlement).calledOnce, 'once with settlement service create stub')
          test.ok(SettlementModelProxy.create.withArgs(settlement).calledOnce, 'once with settlement model create proxy')
          test.end()
        } catch (err) {
          logger.error(`create failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await createTest.end()
    } catch (err) {
      logger.error(`settlementIndexTest failed with error - ${err}`)
      createTest.fail()
      createTest.end()
    }
  })

  await settlementIndexTest.end()
})
