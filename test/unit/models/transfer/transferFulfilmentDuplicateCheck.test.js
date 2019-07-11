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
const Model = require('../../../../src/models/transfer/transferFulfilmentDuplicateCheck')
const Db = require('../../../../src/lib/db')
const Uuid = require('uuid4')

Test('TransferFulfilmentDuplicateCheck model', async (TransferFulfilmentDuplicateCheckTest) => {
  let sandbox
  const transferFulfilmentId = Uuid()
  const newHash = 'EE1H9SMsUlHDMOm0H4OfI4D57MHOVTYwwXBK+BWHr/1'
  const existingHashes = [{
    transferId: '9136780b-37e2-457c-8c05-f15dbb033b10',
    hash: 'EE1H9SMsUlHDMOm0H4OfI4D57MHOVTYwwXBK+BWHr/4',
    createdDate: '2018-08-15 13:41:28',
    transferFulfilmentId
  }]
  TransferFulfilmentDuplicateCheckTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    test.end()
  })

  TransferFulfilmentDuplicateCheckTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await TransferFulfilmentDuplicateCheckTest.test('checkAndInsertDuplicateHash should', async (checkAndInsertDuplicateHashTest) => {
    await checkAndInsertDuplicateHashTest.test('insert new hash if it does not exist', async test => {
      try {
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.commit = sandbox.stub()
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)
        knexStub.returns({
          transacting: sandbox.stub().returns({
            leftJoin: sandbox.stub().returns({
              where: sandbox.stub().returns({
                select: sandbox.stub().returns(existingHashes)
              })
            }),
            insert: sandbox.stub()
          })
        })
        const expected = {
          existsMatching: false,
          existsNotMatching: true,
          isValid: false
        }

        const result = await Model.checkAndInsertDuplicateHash(existingHashes[0].transferId, newHash)
        test.ok(knexStub.withArgs('transferFulfilmentDuplicateCheck').calledTwice, 'knex called with transferFulfilmentDuplicateCheck twice')
        test.deepEqual(result, expected, 'result matched')
        test.end()
      } catch (err) {
        Logger.error(`checkAndInsertDuplicateHash failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await checkAndInsertDuplicateHashTest.test('return isValid hash status if exists', async test => {
      try {
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.commit = sandbox.stub()
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)
        knexStub.returns({
          transacting: sandbox.stub().returns({
            leftJoin: sandbox.stub().returns({
              where: sandbox.stub().returns({
                select: sandbox.stub().returns(existingHashes)
              })
            })
          })
        })
        const expected = {
          existsMatching: true,
          existsNotMatching: false,
          isValid: false
        }

        const result = await Model.checkAndInsertDuplicateHash(existingHashes[0].transferId, existingHashes[0].hash)
        test.ok(knexStub.withArgs('transferFulfilmentDuplicateCheck').calledOnce, 'knex called with transferFulfilmentDuplicateCheck once')
        test.deepEqual(result, expected, 'result matched')
        test.end()
      } catch (err) {
        Logger.error(`checkAndInsertDuplicateHash failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await checkAndInsertDuplicateHashTest.test('should fail and rollback', async (test) => {
      try {
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.commit = sandbox.stub()

        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)

        knexStub.throws(new Error())

        await Model.checkAndInsertDuplicateHash(existingHashes[0].transferId, existingHashes[0].hash)
        test.fail('Error not thrown!')
        test.end()
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    await checkAndInsertDuplicateHashTest.test('should throw error', async (test) => {
      try {
        sandbox.stub(Db, 'getKnex')
        const obj = {
          transaction: async () => { }
        }
        Db.getKnex.returns(obj)
        const knex = Db.getKnex()
        sandbox.stub(knex, 'transaction')
        knex.transaction.throws(new Error('message'))

        await Model.checkAndInsertDuplicateHash(existingHashes[0].transferId, existingHashes[0].hash)
        test.fail('Error not thrown!')
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    await checkAndInsertDuplicateHashTest.end()
  })

  await TransferFulfilmentDuplicateCheckTest.end()
})
