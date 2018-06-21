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
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 * Deon Botha <deon.botha@modusbox.com>
 --------------
******/

'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const Db = require('../../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../../../src/lib/config')
const Model = require('../../../../../src/domain/transfer/models/transfer-read-model')
const HelperModule = require('../../../helpers/index')

Test('Transfer read model test', async (transferReadModelTest) => {
  let sandbox = Sinon.sandbox.create()
  var transferPrepareResult = {}

  await transferReadModelTest.test('setup', async (assert) => {
    try {
      await Db.connect(Config.DATABASE_URI).then(async () => {
        transferPrepareResult = await HelperModule.prepareNeededData('transferModel')
        assert.pass('setup OK')
        assert.end()
      }).catch(err => {
        Logger.error(`Connecting to database - ${err}`)
        assert.fail(`Connecting to database - ${err}`)
        assert.end()
      })
    } catch (err) {
      Logger.error(`Setup for test failed with error - ${err}`)
      assert.fail(`Setup for test failed with error - ${err}`)
      assert.end()
    }
  })

  await transferReadModelTest.test('get the created transfer test', async function (assert) {
    try {
      let transfers = await Model.getAll()
      assert.true(transfers.length >= 1, 'one or more transfers are returned')
      assert.equal(transfers[0].transferId, transferPrepareResult.transfer.transferId)
      assert.end()
    } catch (err) {
      Logger.error(`Setup for test failed with error - ${err}`)
      assert.fail(`Setup for test failed with error - ${err}`)
      assert.end()
    }
  })

  await transferReadModelTest.test('get the created transfer change test', async (assert) => {
    try {
      let transfer = await Model.getById(transferPrepareResult.transfer.transferId)
      assert.deepEqual(transfer, transferPrepareResult.transfer, 'created and read transfer are equal')
      assert.end()
    } catch (err) {
      Logger.error(`Setup for test failed with error - ${err}`)
      assert.fail(`Setup for test failed with error - ${err}`)
      assert.end()
    }
  })

  await transferReadModelTest.test('save transfer', async (assert) => {
    try {
      await Model.saveTransfer({
        payeeParticipantId: transferPrepareResult.participants.participantPayee.participantId,
        payerParticipantId: transferPrepareResult.participants.participantPayer.participantId,
        transferId: 'test_tr_id',
        amount: 100,
        currencyId: 'USD',
        expirationDate: null,
        settlementWindowId: null
      })
      let read = await Model.getById('test_tr_id')
      assert.equal(read.transferId, 'test_tr_id')
      assert.end()
    } catch (err) {
      Logger.error(`Setup for test failed with error - ${err}`)
      assert.fail(`Setup for test failed with error - ${err}`)
      assert.end()
    }
  })

  await transferReadModelTest.test('update transfer', async (assert) => {
    try {
      await Model.updateTransfer(transferPrepareResult.transfer.transferId, {
        currencyId: 'EUR'
      })
      let read = await Model.getById(transferPrepareResult.transfer.transferId)
      assert.equal(read.currencyId, 'EUR', 'date is updated fine')
      assert.end()
    } catch (err) {
      Logger.error(`Setup for test failed with error - ${err}`)
      assert.fail(`Setup for test failed with error - ${err}`)
      assert.end()
    }
  })

  await transferReadModelTest.test('teardown', async (assert) => {
    try {
      await HelperModule.deletePreparedData('transferModel', {
        transferId: transferPrepareResult.transfer.transferId,
        payerName: transferPrepareResult.participants.participantPayer.name,
        payeeName: transferPrepareResult.participants.participantPayee.name

      }).then(async () => {
        return await Db.disconnect()
      })
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`transfer model teardown failed with error - ${err}`)
      assert.fail(`transfer model teardown failed - ${err}`)
      assert.end()
    }
  })
})
