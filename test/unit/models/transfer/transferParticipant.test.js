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
const Model = require('../../../../src/models/transfer/transferParticipant')

Test('TransferParticipant model', async (transferParticipant) => {
  let sandbox

  const transferParticipantRecord = {
    transferParticipantId: 1,
    transferId: '1546bcce-0470-44df-aa07-cddccb04495e',
    participantCurrencyId: 1,
    transferParticipantRoleTypeId: 1,
    ledgerEntryTypeId: 1,
    amount: 100,
    expirationDate: new Date()
  }

  transferParticipant.beforeEach(beforeTest => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Logger, 'isErrorEnabled').value(true)
    sandbox.stub(Logger, 'isDebugEnabled').value(true)
    Db.transferParticipant = {
      insert: sandbox.stub()
    }
    Db.from = (table) => {
      return Db[table]
    }
    beforeTest.end()
  })

  transferParticipant.afterEach(afterTest => {
    sandbox.restore()
    afterTest.end()
  })

  await transferParticipant.test('saveTransferParticipant test', async (assert) => {
    try {
      const saved = { transferParticipantId: transferParticipantRecord.transferParticipantId }
      Db.transferParticipant.insert.returns(Promise.resolve(saved))
      const transferParticipantCreated = await Model.saveTransferParticipant(transferParticipantRecord)
      assert.equal(transferParticipantCreated, saved, 'transfer participant is inserted and id is returned')
      assert.ok(Db.transferParticipant.insert.calledOnce, 'transfer participant insert is called once')
      assert.end()
    } catch (err) {
      Logger.error(`create transfer participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transferParticipant.test('saveTransferParticipant should', async (assert) => {
    try {
      Db.transferParticipant.insert.throws(new Error())
      await Model.saveTransferParticipant(transferParticipantRecord)
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      Logger.error(`create transfer participant failed with error - ${err}`)
      assert.pass('throw error')
      assert.end()
    }
  })

  transferParticipant.end()
})
