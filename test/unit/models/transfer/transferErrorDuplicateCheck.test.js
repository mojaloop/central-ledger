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
const Logger = require('@mojaloop/central-services-logger')
const Model = require('../../../../src/models/transfer/transferErrorDuplicateCheck')
const Db = require('../../../../src/lib/db')

Test('TransferErrorDuplicateCheck model', async (TransferErrorDuplicateCheckTest) => {
  let sandbox
  const newHash = 'EE1H9SMsUlHDMOm0H4OfI4D57MHOVTYwwXBK+BWHr/1'
  const existingHashes = [{
    transferId: '9136780b-37e2-457c-8c05-f15dbb033b10',
    hash: 'EE1H9SMsUlHDMOm0H4OfI4D57MHOVTYwwXBK+BWHr/4',
    createdDate: '2018-08-15 13:41:28',
    transferErrorId: 1
  }]
  TransferErrorDuplicateCheckTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    Db.transferErrorDuplicateCheck = {
      findOne: sandbox.stub(),
      insert: sandbox.stub()
    }
    test.end()
  })

  TransferErrorDuplicateCheckTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await TransferErrorDuplicateCheckTest.test('getTransferErrorDuplicateCheck should', async (getTransferErrorDuplicateCheckTest) => {
    await getTransferErrorDuplicateCheckTest.test('get the transfer duplicate check hash', async test => {
      try {
        const { transferId } = existingHashes[0]
        Db.transferErrorDuplicateCheck.findOne.withArgs({ transferId }).returns(existingHashes[0])
        const result = await Model.getTransferErrorDuplicateCheck(transferId)
        test.deepEqual(result, existingHashes[0])
        test.end()
      } catch (err) {
        Logger.error(`getTransferErrorDuplicateCheck failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await getTransferErrorDuplicateCheckTest.test('throw error', async test => {
      try {
        const { transferId } = existingHashes[0]
        Db.transferErrorDuplicateCheck.findOne.throws(new Error('message'))
        await Model.getTransferErrorDuplicateCheck(transferId)
        test.fail(' should throw')
        test.end()
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    await getTransferErrorDuplicateCheckTest.end()
  })

  await TransferErrorDuplicateCheckTest.test('saveTransferErrorDuplicateCheck should', async (saveTransferErrorDuplicateCheckTest) => {
    await saveTransferErrorDuplicateCheckTest.test('save the transfer duplicate check hash', async test => {
      try {
        Db.transferErrorDuplicateCheck.insert.returns(1)
        const { transferId, hash } = existingHashes[0]
        const result = await Model.saveTransferErrorDuplicateCheck(transferId, hash)
        test.equal(result, 1)
        test.end()
      } catch (err) {
        Logger.error(`saveTransferErrorDuplicateCheck failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await saveTransferErrorDuplicateCheckTest.test('throw error', async test => {
      try {
        Db.transferErrorDuplicateCheck.insert.throws(new Error('message'))
        const { transferId, hash } = existingHashes[0]
        await Model.saveTransferErrorDuplicateCheck(transferId, hash)
        test.fail(' should throw')
        test.end()
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    await saveTransferErrorDuplicateCheckTest.end()
  })

  await TransferErrorDuplicateCheckTest.test('checkAndInsertDuplicateHash should', async (checkAndInsertDuplicateHashTest) => {
    await checkAndInsertDuplicateHashTest.test('insert new hash if it does not exist', async test => {
      try {
        const transferErrorDuplicateCheckId = 1
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
            insert: sandbox.stub().returns(transferErrorDuplicateCheckId)
          })
        })
        const expected = {
          existsMatching: false,
          existsNotMatching: true,
          isValid: false,
          transferErrorDuplicateCheckId
        }

        const result = await Model.checkAndInsertDuplicateHash(existingHashes[0].transferId, newHash)
        test.ok(knexStub.withArgs('transferErrorDuplicateCheck').calledTwice, 'knex called with transferErrorDuplicateCheck twice')
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
        let transferErrorDuplicateCheckId
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
          isValid: true,
          transferErrorDuplicateCheckId
        }

        const result = await Model.checkAndInsertDuplicateHash(existingHashes[0].transferId, existingHashes[0].hash)
        test.ok(knexStub.withArgs('transferErrorDuplicateCheck').calledOnce, 'knex called with transferErrorDuplicateCheck once')
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

  await TransferErrorDuplicateCheckTest.end()
})
