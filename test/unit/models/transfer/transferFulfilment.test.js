
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
const Model = require('../../../../src/models/transfer/transferFulfilment')

Test('TransferFulfilment model', async (transferFulfilment) => {
  let sandbox

  const transferFulfilmentRecord = {
    transferId: 'ca61ead2-f7d0-4605-b86e-c23f3eff1d04',
    ilpFulfilment: 'oAKAAA',
    completedDate: new Date() - 60000,
    isValid: 1,
    settlementWindowId: 1,
    createdDate: new Date()
  }

  transferFulfilment.beforeEach(beforeTest => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Logger, 'isErrorEnabled').value(true)
    sandbox.stub(Logger, 'isDebugEnabled').value(true)
    Db.transferFulfilment = {
      insert: sandbox.stub(),
      find: sandbox.stub()
    }
    Db.from = (table) => {
      return Db[table]
    }
    beforeTest.end()
  })

  transferFulfilment.afterEach(afterTest => {
    sandbox.restore()
    afterTest.end()
  })

  await transferFulfilment.test('getByTransferId test', async (assert) => {
    try {
      Db.transferFulfilment.find.returns(Promise.resolve(transferFulfilmentRecord))
      const response = await Model.getByTransferId(transferFulfilmentRecord.transferId)
      assert.equal(response, transferFulfilmentRecord, 'transfer fulfilment is returned')
      assert.ok(Db.transferFulfilment.find.calledOnce, 'find is called once')
      assert.end()
    } catch (err) {
      Logger.error(`getByTransferId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transferFulfilment.test('getByTransferId should', async (assert) => {
    try {
      Db.transferFulfilment.find.throws(new Error())
      await Model.getByTransferId(transferFulfilmentRecord)
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      Logger.error(`getByTransferId failed with error - ${err}`)
      assert.pass('throw error')
      assert.end()
    }
  })

  await transferFulfilment.test('saveTransferFulfilment test', async (assert) => {
    try {
      const saved = { transferId: transferFulfilmentRecord.transferId }
      Db.transferFulfilment.insert.returns(Promise.resolve(saved))
      const transferFulfilmentCreated = await Model.saveTransferFulfilment(transferFulfilmentRecord)
      assert.equal(transferFulfilmentCreated, saved, 'transfer fulfilment is inserted and id is returned')
      assert.ok(Db.transferFulfilment.insert.calledOnce, 'transfer fulfilment insert is called once')
      assert.end()
    } catch (err) {
      Logger.error(`create transfer fulfilment failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transferFulfilment.test('saveTransferFulfilment should', async (assert) => {
    try {
      Db.transferFulfilment.insert.throws(new Error())
      await Model.saveTransferFulfilment(transferFulfilmentRecord)
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      Logger.error(`create transfer fulfilment failed with error - ${err}`)
      assert.pass('throw error')
      assert.end()
    }
  })

  transferFulfilment.end()
})
