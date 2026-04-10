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
 * Valentin Genev <valentin.genev@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const { logger } = require('../../../../../src/settlement/shared/logger')
const SettlementParticipantCurrencyModel = require('../../../../../src/settlement/models/settlement/settlementParticipantCurrency')
const Db = require('../../../../../src/settlement/lib/db')

Test('SettlementParticipantCurrencyModel', async (settlementParticipantCurrencyModelTest) => {
  let sandbox

  settlementParticipantCurrencyModelTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    Db.from = (table) => {
      return Db[table]
    }
    test.end()
  })

  settlementParticipantCurrencyModelTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await settlementParticipantCurrencyModelTest.test('settlementParticipantCurrencyModel should', async getAccountInSettlementTest => {
    try {
      await getAccountInSettlementTest.test('return settlement participant account id if matched', async test => {
        try {
          const settlementId = 1
          const accountId = 1
          const params = { settlementId, accountId }
          const enums = {}
          const settlementParticipantCurrencyIdMock = 1

          const builderStub = sandbox.stub()
          Db.settlementParticipantCurrency = {
            query: sandbox.stub()
          }
          Db.settlementParticipantCurrency.query.callsArgWith(0, builderStub)
          const whereStub = sandbox.stub()
          const andWhereStub = sandbox.stub()
          builderStub.select = sandbox.stub().returns({
            where: whereStub.returns({
              andWhere: andWhereStub.returns({
                first: sandbox.stub().returns(settlementParticipantCurrencyIdMock)
              })
            })
          })

          const result = await SettlementParticipantCurrencyModel.getAccountInSettlement(params, enums)
          test.ok(result, 'Result returned')
          test.ok(builderStub.select.withArgs('settlementParticipantCurrencyId').calledOnce, 'select with args ... called once')
          test.ok(whereStub.withArgs({ settlementId }).calledOnce, 'where with args ... called once')
          test.ok(andWhereStub.withArgs('participantCurrencyId', accountId).calledOnce, 'where with args ... called once')
          test.equal(result, settlementParticipantCurrencyIdMock, 'Result matched')

          Db.settlementParticipantCurrency.query = sandbox.stub().throws(new Error('Error occurred'))
          try {
            await SettlementParticipantCurrencyModel.getAccountInSettlement(params)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.equal(err.message, 'Error occurred', `Error "${err.message}" thrown as expected`)
          }
          test.end()
        } catch (err) {
          logger.error(`getAccountInSettlementTest failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getAccountInSettlementTest.end()
    } catch (err) {
      logger.error(`settlementParticipantCurrencyModelTest failed with error - ${err}`)
      getAccountInSettlementTest.fail()
      getAccountInSettlementTest.end()
    }
  })

  await settlementParticipantCurrencyModelTest.test('settlementParticipantCurrencyModel should', async getAccountInSettlementTest => {
    try {
      await getAccountInSettlementTest.test('return settlement participant currency record if matched', async test => {
        try {
          const settlementId = 1
          const accountId = 2
          const settlementParticipantCurrencyRecord = {
            settlementParticipantCurrencyId: 25,
            settlementId,
            participantCurrencyId: 39,
            netAmount: '81.42',
            createdDate: '2019-02-18T16:02:43.000Z',
            currentStateChangeId: 70,
            settlementTransferId: '8caf556a-523f-4008-aa32-37e4b6f644d3',
            settlementStateId: 'PS_TRANSFERS_RECORDED',
            reason: 'Transfers recorded for payer',
            externalReference: null
          }
          const builderStub = sandbox.stub()
          Db.settlementParticipantCurrency = {
            query: sandbox.stub()
          }
          Db.settlementParticipantCurrency.query.callsArgWith(0, builderStub)
          Db.getKnex = sandbox.stub()
          const selectStub = sandbox.stub()
          const whereStub = sandbox.stub()
          const andWhereStub = sandbox.stub()
          const firstStub = sandbox.stub()
          builderStub.innerJoin = sandbox.stub().returns({
            select: selectStub.returns({
              where: whereStub.returns({
                andWhere: andWhereStub.returns({
                  first: firstStub.returns(settlementParticipantCurrencyRecord)
                })
              })
            })
          })

          const result = await SettlementParticipantCurrencyModel.getBySettlementAndAccount(settlementId, accountId)
          test.ok(result, 'Result returned')
          test.ok(builderStub.innerJoin.withArgs('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'settlementParticipantCurrency.currentStateChangeId').calledOnce, 'innerJoin with args ... called once')
          test.ok(selectStub.withArgs('settlementParticipantCurrency.*', 'spcsc.settlementStateId', 'spcsc.reason', 'spcsc.externalReference').calledOnce, 'select with args ... called once')
          test.ok(whereStub.withArgs({ settlementId }).calledOnce, 'where with args ... called once')
          test.ok(andWhereStub.withArgs('participantCurrencyId', accountId).calledOnce, 'andWhere with args ... called once')
          test.deepEqual(result, settlementParticipantCurrencyRecord, 'Result matched')

          Db.settlementParticipantCurrency.query = sandbox.stub().throws(new Error('Error occurred'))
          try {
            await SettlementParticipantCurrencyModel.getBySettlementAndAccount(settlementId, accountId)
            test.fail('Error expected, but not thrown!')
          } catch (err) {
            test.equal(err.message, 'Error occurred', `Error "${err.message}" thrown as expected`)
          }
          test.end()
        } catch (err) {
          logger.error(`getAccountInSettlementTest failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await getAccountInSettlementTest.end()
    } catch (err) {
      logger.error(`settlementParticipantCurrencyModelTest failed with error - ${err}`)
      getAccountInSettlementTest.fail()
      getAccountInSettlementTest.end()
    }
  })

  await settlementParticipantCurrencyModelTest.end()
})
