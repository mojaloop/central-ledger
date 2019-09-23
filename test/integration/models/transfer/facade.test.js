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
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 * Deon Botha <deon.botha@modusbox.com>
 --------------
******/

'use strict'

const Test = require('tape')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const Config = require('../../../../src/lib/config')
const TransferFacade = require('../../../../src/models/transfer/facade')
const HelperModule = require('../../helpers')

Test('Transfer read model test', async (transferReadModelTest) => {
  let transferPrepareResult = {}

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
      const transfers = await TransferFacade.getAll()
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
      const transfer = await TransferFacade.getById(transferPrepareResult.transfer.transferId)
      assert.equal(transfer.transferId, transferPrepareResult.transfer.transferId, 'created and read transfer are equal')
      assert.end()
    } catch (err) {
      Logger.error(`Setup for test failed with error - ${err}`)
      assert.fail(`Setup for test failed with error - ${err}`)
      assert.end()
    }
  })

  await transferReadModelTest.test('teardown', async (assert) => {
    try {
      await Db.disconnect()
      assert.pass('database connection closed')
      assert.end()
    } catch (err) {
      Logger.error(`teardown failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  transferReadModelTest.end()
})
