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
const ParticipantCurrencyModel = require('../../../../../src/settlement/models/settlement/participantCurrency')
const Db = require('../../../../../src/settlement/lib/db')

Test('ParticipantCurrencyModel', async (participantCurrencyModelTest) => {
  let sandbox

  participantCurrencyModelTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    Db.from = (table) => {
      return Db[table]
    }
    test.end()
  })

  participantCurrencyModelTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await participantCurrencyModelTest.test('participantCurrencyModel should', async checkParticipantAccountExistsTest => {
    try {
      await checkParticipantAccountExistsTest.test('return participant currency id if matched', async test => {
        try {
          const participantId = 1
          const accountId = 1
          const params = { participantId, accountId }
          const enums = {
            ledgerAccountTypes: {
              POSITION: 1
            }
          }
          const participantCurrencyIdMock = 1

          const builderStub = sandbox.stub()
          Db.participantCurrency = {
            query: sandbox.stub()
          }
          Db.participantCurrency.query.callsArgWith(0, builderStub)
          const whereStub = sandbox.stub()
          const andWhereStub1 = sandbox.stub()
          const andWhereStub2 = sandbox.stub()
          builderStub.select = sandbox.stub().returns({
            where: whereStub.returns({
              andWhere: andWhereStub1.returns({
                andWhere: andWhereStub2.returns({
                  first: sandbox.stub().returns(participantCurrencyIdMock)
                })
              })
            })
          })

          const result = await ParticipantCurrencyModel.checkParticipantAccountExists(params, enums)
          test.ok(result, 'Result returned')
          test.ok(builderStub.select.withArgs('participantCurrencyId').calledOnce, 'select with args ... called once')
          test.ok(whereStub.withArgs({ participantId }).calledOnce, 'where with args ... called once')
          test.ok(andWhereStub1.withArgs('participantCurrencyId', accountId).calledOnce, 'where with args ... called once')
          test.ok(andWhereStub2.withArgs('ledgerAccountTypeId', enums.ledgerAccountTypes.POSITION).calledOnce, 'where with args ... called once')
          test.equal(result, participantCurrencyIdMock, 'Result matched')

          Db.participantCurrency.query = sandbox.stub().throws(new Error('Error occurred'))
          try {
            await ParticipantCurrencyModel.checkParticipantAccountExists(params)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.equal(err.message, 'Error occurred', `Error "${err.message}" thrown as expected`)
          }
          test.end()
        } catch (err) {
          logger.error(`checkParticipantAccountExistsTest failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await checkParticipantAccountExistsTest.end()
    } catch (err) {
      logger.error(`participantCurrencyModelTest failed with error - ${err}`)
      checkParticipantAccountExistsTest.fail()
      checkParticipantAccountExistsTest.end()
    }
  })

  await participantCurrencyModelTest.end()
})
