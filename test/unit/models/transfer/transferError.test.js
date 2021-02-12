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

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Logger = require('@mojaloop/central-services-logger')
const Model = require('../../../../src/models/transfer/transferError')
const Db = require('../../../../src/lib/db')
const Time = require('@mojaloop/central-services-shared').Util.Time

Test('TransferError model', async (TransferErrorTest) => {
  let sandbox
  const transferErrorFixtures = [{
    transferId: 't1',
    transferStateChangeId: 1,
    errorCode: '3100',
    errorDescription: 'Invalid Payee'
  },
  {
    transferErrorId: 12,
    transferStateChangeId: 99,
    errorCode: '5101',
    errorDescription: 'Payee transaction limit reached',
    createdDate: Time.getUTCString(new Date())
  }]

  TransferErrorTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Logger, 'isErrorEnabled').value(true)
    sandbox.stub(Logger, 'isDebugEnabled').value(true)
    Db.transferError = {
      insert: sandbox.stub(),
      find: sandbox.stub(),
      query: sandbox.stub()
    }
    Db.from = (table) => {
      return Db[table]
    }
    test.end()
  })

  TransferErrorTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await TransferErrorTest.test('insert should', async (insertTest) => {
    await insertTest.test('insert the record into database', async test => {
      try {
        Db.transferError.insert.withArgs(transferErrorFixtures[0]).returns(1)
        const result = await Model.insert(transferErrorFixtures[0].transferId, transferErrorFixtures[0].transferStateChangeId, transferErrorFixtures[0].errorCode, transferErrorFixtures[0].errorDescription)
        test.equal(result, 1)
        test.end()
      } catch (err) {
        Logger.error(`insert failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await insertTest.test('should throw error', async (test) => {
      try {
        Db.transferError.insert.withArgs(transferErrorFixtures[0]).throws(new Error('message'))

        await Model.insert(transferErrorFixtures[0].transferId, transferErrorFixtures[0].transferStateChangeId, transferErrorFixtures[0].errorCode, transferErrorFixtures[0].errorDescription)
        test.fail(' should throw')
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    await insertTest.end()
  })

  await TransferErrorTest.test('getByTransferStateChangeId should', async (getByTransferStateChangeIdTest) => {
    await getByTransferStateChangeIdTest.test('getByTransferStateChangeId the record into database', async test => {
      try {
        Db.transferError.find.returns(transferErrorFixtures[0])
        const result = await Model.getByTransferStateChangeId(transferErrorFixtures[0].transferStateChangeId)
        test.deepEqual(result, transferErrorFixtures[0], 'Results match')
        test.end()
      } catch (err) {
        Logger.error(`getByTransferStateChangeIdTest failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await getByTransferStateChangeIdTest.test('should throw error', async (test) => {
      try {
        Db.transferError.find.throws(new Error('message'))

        await Model.getByTransferStateChangeId(transferErrorFixtures[0].transferStateChangeId)
        test.fail(' should throw')
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    await getByTransferStateChangeIdTest.end()
  })

  await TransferErrorTest.test('getByTransferId should', async (getByTransferIdTest) => {
    await getByTransferIdTest.test('retrieve last transfer error from the database', async test => {
      try {
        const builderStub = sandbox.stub()
        const selectStub = sandbox.stub()
        const firstStub = sandbox.stub()
        builderStub.where = sandbox.stub()

        Db.transferError.query.callsArgWith(0, builderStub)
        builderStub.where.returns({
          select: selectStub.returns({
            first: firstStub.returns(transferErrorFixtures[1])
          })
        })

        const result = await Model.getByTransferId(1)
        test.equal(result, transferErrorFixtures[1])
        test.end()
      } catch (err) {
        Logger.error(`getByTransferIdTest failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await getByTransferIdTest.test('throw error', async (test) => {
      try {
        Db.transferError.query.throws(new Error('message'))

        await Model.getByTransferId(1)
        test.fail('should throw')
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    await getByTransferIdTest.end()
  })

  await TransferErrorTest.end()
})
