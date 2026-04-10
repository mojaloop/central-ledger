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
const SettlementTransferParticipantModel = require('../../../../../src/settlement/models/settlement/settlementTransferParticipant')
const Db = require('../../../../../src/settlement/lib/db')

Test('SettlementTransferParticipantModel', async (settlementTransferParticipantModelTest) => {
  let sandbox

  settlementTransferParticipantModelTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    Db.from = (table) => {
      return Db[table]
    }
    test.end()
  })

  settlementTransferParticipantModelTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await settlementTransferParticipantModelTest.test('settlementTransferParticipantModel should', async getBySettlementIdTest => {
    try {
      await getBySettlementIdTest.test('return distinct settlementWindowId and participantCurrencyId by settlementId', async test => {
        try {
          const settlementId = 1
          const params = { settlementId }
          const enums = {}
          const settlementTransferParticipantMock = [{
            settlementWindowId: 1,
            participantCurrencyId: 1
          }, {
            settlementWindowId: 1,
            participantCurrencyId: 2
          }]

          const builderStub = sandbox.stub()
          Db.settlementTransferParticipant = {
            query: sandbox.stub()
          }
          Db.settlementTransferParticipant.query.callsArgWith(0, builderStub)
          const distinctStub = sandbox.stub()
          const whereStub = sandbox.stub()
          builderStub.select = sandbox.stub().returns({
            distinct: distinctStub.returns({
              where: whereStub.returns(settlementTransferParticipantMock)
            })
          })

          const result = await SettlementTransferParticipantModel.getBySettlementId(params, enums)
          test.ok(result, 'Result returned')
          test.ok(builderStub.select.withArgs().calledOnce, 'select with args ... called once')
          test.ok(distinctStub.withArgs('settlementWindowId', 'participantCurrencyId').calledOnce, 'distinct with args ... called once')
          test.ok(whereStub.withArgs(params).calledOnce, 'where with args ... called once')
          test.deepEqual(result, settlementTransferParticipantMock, 'Result matched')

          Db.settlementTransferParticipant.query = sandbox.stub().throws(new Error('Error occurred'))
          try {
            await SettlementTransferParticipantModel.getBySettlementId(params)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.equal(err.message, 'Error occurred', `Error "${err.message}" thrown as expected`)
          }
          test.end()
        } catch (err) {
          logger.error(`getBySettlementIdTest failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getBySettlementIdTest.end()
    } catch (err) {
      logger.error(`settlementTransferParticipantModelTest failed with error - ${err}`)
      getBySettlementIdTest.fail()
      getBySettlementIdTest.end()
    }
  })

  await settlementTransferParticipantModelTest.end()
})
