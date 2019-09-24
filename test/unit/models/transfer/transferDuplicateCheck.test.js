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
const Model = require('../../../../src/models/transfer/transferDuplicateCheck')
const Db = require('../../../../src/lib/db')

Test('TransferDuplicateCheck model', async (TransferDuplicateCheckTest) => {
  let sandbox
  const existingHash = {
    transferId: '9136780b-37e2-457c-8c05-f15dbb033b10',
    hash: 'EE1H9SMsUlHDMOm0H4OfI4D57MHOVTYwwXBK+BWHr/4',
    createdDate: '2018-08-15 13:41:28'
  }
  TransferDuplicateCheckTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    Db.transferDuplicateCheck = {
      findOne: sandbox.stub(),
      insert: sandbox.stub()
    }
    test.end()
  })

  TransferDuplicateCheckTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await TransferDuplicateCheckTest.test('getTransferDuplicateCheck should', async (getTransferDuplicateCheckTest) => {
    await getTransferDuplicateCheckTest.test('get the transfer duplicate check hash', async test => {
      try {
        const { transferId } = existingHash
        Db.transferDuplicateCheck.findOne.withArgs({ transferId }).returns(existingHash)
        const result = await Model.getTransferDuplicateCheck(transferId)
        test.deepEqual(result, existingHash)
        test.end()
      } catch (err) {
        Logger.error(`getTransferDuplicateCheck failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await getTransferDuplicateCheckTest.test('throw error', async test => {
      try {
        const { transferId } = existingHash
        Db.transferDuplicateCheck.findOne.throws(new Error('message'))
        await Model.getTransferDuplicateCheck(transferId)
        test.fail(' should throw')
        test.end()
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    await getTransferDuplicateCheckTest.end()
  })

  await TransferDuplicateCheckTest.test('saveTransferDuplicateCheck should', async (saveTransferDuplicateCheckTest) => {
    await saveTransferDuplicateCheckTest.test('save the transfer duplicate check hash', async test => {
      try {
        Db.transferDuplicateCheck.insert.returns(1)
        const { transferId, hash } = existingHash
        const result = await Model.saveTransferDuplicateCheck(transferId, hash)
        test.equal(result, 1)
        test.end()
      } catch (err) {
        Logger.error(`saveTransferDuplicateCheck failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await saveTransferDuplicateCheckTest.test('throw error', async test => {
      try {
        Db.transferDuplicateCheck.insert.throws(new Error('message'))
        const { transferId, hash } = existingHash
        await Model.saveTransferDuplicateCheck(transferId, hash)
        test.fail(' should throw')
        test.end()
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    await saveTransferDuplicateCheckTest.end()
  })

  await TransferDuplicateCheckTest.test('checkAndInsertDuplicateHash should', async (checkAndInsertDuplicateHashTest) => {
    await checkAndInsertDuplicateHashTest.test('return the hash if it exists', async test => {
      try {
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.commit = sandbox.stub()
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)

        knexStub.returns({
          transacting: sandbox.stub().returns({
            where: sandbox.stub().returns({
              select: sandbox.stub().returns({
                first: sandbox.stub().returns(existingHash)
              })
            }),
            insert: sandbox.stub().returns(null)
          })
        })
        const result = await Model.checkAndInsertDuplicateHash(existingHash.transferId, existingHash.hash)
        test.ok(knexStub.withArgs('transferDuplicateCheck').calledOnce, 'knex called with transferDuplicateCheck once')
        test.deepEqual(result, { existsMatching: true, existsNotMatching: false })
        test.end()
      } catch (err) {
        Logger.error(`checkAndInsertDuplicateHash failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await checkAndInsertDuplicateHashTest.test('insert the hash if it does not exists', async test => {
      try {
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.commit = sandbox.stub()
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)

        knexStub.returns({
          transacting: sandbox.stub().returns({
            where: sandbox.stub().returns({
              select: sandbox.stub().returns({
                first: sandbox.stub().returns(null)
              })
            }),
            insert: sandbox.stub().returns([1])
          })
        })
        const result = await Model.checkAndInsertDuplicateHash(existingHash.transferId, existingHash.hash)
        test.ok(knexStub.withArgs('transferDuplicateCheck').calledTwice, 'knex called with transferDuplicateCheck once')
        test.deepEqual(result, { existsMatching: false, existsNotMatching: false })
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

        await Model.checkAndInsertDuplicateHash(existingHash.transferId, existingHash.hash)
        test.fail(' should throw')
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

        await Model.checkAndInsertDuplicateHash(existingHash.transferId, existingHash.hash)
        test.fail(' should throw')
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    await checkAndInsertDuplicateHashTest.end()
  })

  await TransferDuplicateCheckTest.end()
})
