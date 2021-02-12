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
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const Model = require('../../../../src/models/transfer/transfer')

Test('Transfer model', async (transfer) => {
  let sandbox

  const transferRecord = {
    transferId: 'caa0bdb4-b8da-437b-b0b9-25f094cea208',
    ilpFulfilment: 'oAKAAA',
    completedDate: new Date() - 60000,
    isValid: 1,
    settlementWindowId: 1,
    createdDate: new Date()
  }

  transfer.beforeEach(beforeTest => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Logger, 'isErrorEnabled').value(true)
    sandbox.stub(Logger, 'isDebugEnabled').value(true)
    Db.transfer = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
      destroy: sandbox.stub(),
      truncate: sandbox.stub()
    }
    Db.from = (table) => {
      return Db[table]
    }
    beforeTest.end()
  })

  transfer.afterEach(afterTest => {
    sandbox.restore()
    afterTest.end()
  })

  await transfer.test('getById should', async (assert) => {
    Db.transfer.findOne.returns(Promise.resolve(transferRecord))

    Model.getById(transferRecord.transferId)
      .then(result => {
        assert.deepEqual(result, transferRecord, 'match the result object')
        assert.ok(Db.transfer.findOne.calledWith({ transferId: transferRecord.transferId }), 'called with transferId')
        assert.end()
      })
  })

  await transfer.test('getById should', async (assert) => {
    try {
      Db.transfer.findOne.throws(new Error())
      await Model.getById(transferRecord.transferId)
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      Logger.error(`getByTransferId failed with error - ${err}`)
      assert.pass('throw error')
      assert.end()
    }
  })

  await transfer.test('saveTransfer test', async (assert) => {
    try {
      const saved = { transferId: transferRecord.transferId }
      Db.transfer.insert.returns(Promise.resolve(saved))
      const transferCreated = await Model.saveTransfer(transferRecord)
      assert.equal(transferCreated, saved, 'transfer is inserted and id is returned')
      assert.ok(Db.transfer.insert.calledOnce, 'transfer insert is called once')
      assert.end()
    } catch (err) {
      Logger.error(`saveTransfer failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transfer.test('saveTransfer should', async (assert) => {
    try {
      Db.transfer.insert.throws(new Error())
      await Model.saveTransfer(transferRecord)
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      Logger.error(`getByTransferId failed with error - ${err}`)
      assert.pass('throw error')
      assert.end()
    }
  })

  await transfer.test('destroyById should', async (assert) => {
    try {
      Db.transfer.destroy.returns(Promise.resolve())
      await Model.destroyById(1)
      assert.ok(Db.transfer.destroy.calledOnce, 'have been called once')
      assert.end()
    } catch (err) {
      Logger.error(`destroyById failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transfer.test('destroyById should throw an error', async (assert) => {
    try {
      Db.transfer.destroy.throws(new Error())
      await Model.destroyById(1)
      assert.ok(Db.transfer.destroy.calledOnce)
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      Logger.error(`destroyById failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await transfer.test('truncateTransfer should', async (assert) => {
    try {
      Db.transfer.truncate.returns(Promise.resolve())
      await Model.truncateTransfer()
      assert.ok(Db.transfer.truncate.calledOnce, 'have been called once')
      assert.end()
    } catch (err) {
      Logger.error(`create transfer failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transfer.test('truncateTransfer should throw an error', async (assert) => {
    try {
      Db.transfer.truncate.throws(new Error())
      await Model.truncateTransfer()
      assert.ok(Db.transfer.truncate.calledOnce)
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      Logger.error(`truncateTransfer failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })
  transfer.end()
})
