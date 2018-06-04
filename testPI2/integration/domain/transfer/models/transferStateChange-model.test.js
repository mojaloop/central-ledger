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
 * Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const Db = require('../../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../../../src/lib/config')
const Model = require('../../../../../src/domain/transfer/models/transferStateChanges')
const HelperModule = require('../../../helpers/index')

Test('Transfer State Change model test', async (stateChangeTest) => {
  let sandbox = Sinon.sandbox.create()
  // let stateMap = new Map()
  var stateChangePrepareResult = {}
  var latestInsertedTransferStateChange = {}
  await stateChangeTest.test('setup', async (assert) => {
    try {
      await Db.connect(Config.DATABASE_URI).then(async () => {
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

  await stateChangeTest.test('create state change test', async (assert) => {
    try {
      // Prepare helper tests actually the Model.saveExtension and Model.getByTransferId

      stateChangePrepareResult = await HelperModule.prepareNeededData('transferStateChange')
      assert.comment('the prepared data are: ', JSON.stringify(stateChangePrepareResult, null, 4))

      let state = stateChangePrepareResult.transferStateResults[1]
      let createdId = 0
      let result = {}
      let transferStateChange = {
        transferId: stateChangePrepareResult.transfer.transferId,
        transferStateId: state.transferStateId,
        reason: null,
        changedDate: new Date()
      }

      createdId = await Model.saveTransferStateChange(transferStateChange)
      result = await Model.getByTransferId(stateChangePrepareResult.transfer.transferId)
      assert.equal(createdId, result.transferStateChangeId, ' transferId match')
      assert.equal(transferStateChange.transferStateId, result.transferStateId, ' key match')
      assert.equal(transferStateChange.reason, result.reason, ' value match')
      // assert.equal(transferStateChange.changedDate.toString(), result.changedDate.toString(), ' changedDate match') one second difference needs to be tackled
      latestInsertedTransferStateChange = result
      assert.end()
    } catch (err) {
      Logger.error(`create all extension objects failed with error - ${err}`)
      assert.fail(`Create all extension objects failed - ${err}`)
      assert.end()
    }
  })

  await stateChangeTest.test('create stateChange without transferId should throw error', async (assert) => {
    let state = stateChangePrepareResult.transferStateResults[0]
    try {
      await Model.saveTransferStateChange({
        transferStateId: state.transferStateId,
        reason: null,
        changedDate: new Date()
      })
      assert.fail('should throw')
      assert.end()
    } catch (err) {
      Logger.error('create state change without transferId is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await stateChangeTest.test('create stateChange without transferStateId should throw error', async (assert) => {
    // let state = stateChangePrepareResult.transferStateResults[0]
    try {
      await Model.saveTransferStateChange({
        transferId: stateChangePrepareResult.transfer.transferId,
        reason: null,
        changedDate: new Date()
      })
      assert.fail('should throw')
      assert.end()
    } catch (err) {
      Logger.error('create state change without transferStateId is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  // await stateChangeTest.test('create stateChange without changedDate should throw error', async (assert) => {
  //   let state = stateChangePrepareResult.transferStateResults[0]
  //   try {
  //     await Model.saveTransferStateChange({
  //       transferId: stateChangePrepareResult.transfer.transferId,
  //       transferStateId: state.transferStateId,
  //       reason: null
  //     })
  //     assert.fail('should throw')
  //     assert.end()
  //   } catch (err) {
  //     Logger.error('create state change without transferStateId is failing with message ')
  //     assert.ok((('message' in err) && ('stack' in err)), err.message)
  //     assert.end()
  //   }
  // })

  await stateChangeTest.test('getByTransferId', async (assert) => {
    try {
      let result = await Model.getByTransferId(stateChangePrepareResult.transfer.transferId)

      assert.equal(JSON.stringify(latestInsertedTransferStateChange), JSON.stringify(result))
      assert.comment(`Testing with extension \n ${JSON.stringify(result, null, 2)}`)
      assert.equal(result.transferId, latestInsertedTransferStateChange.transferId, ' transferId match')
      assert.equal(result.key, latestInsertedTransferStateChange.key, ' key match')
      assert.equal(result.value, latestInsertedTransferStateChange.value, ' value match')
      assert.equal(result.changedDate.toString(), latestInsertedTransferStateChange.changedDate.toString(), ' changedDate match')
      assert.equal(result.changedBy, latestInsertedTransferStateChange.changedBy, ' changedBy match')
      assert.end()
    } catch (err) {
      Logger.error(`get extension by transferId failed with error - ${err}`)
      assert.fail(`Get extension by transferId failed - ${err}`)
      assert.end()
    }
  })

  await stateChangeTest.test('teardown', async (assert) => {
    try {
      await HelperModule.deletePreparedData('transferStateChange', {
        transferId: stateChangePrepareResult.transfer.transferId,
        payerName: stateChangePrepareResult.participants.participantPayer.name,
        payeeName: stateChangePrepareResult.participants.participantPayee.name
      })
      await Db.disconnect()
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`extension teardown failed with error - ${err}`)
      assert.fail(`extension teardown failed - ${err}`)
      assert.end()
    }
  })
})
