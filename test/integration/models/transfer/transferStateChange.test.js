/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tape')
const Db = require('../../../../dist/lib/db')
const Cache = require('../../../../dist/lib/cache')
const ProxyCache = require('../../../../dist/lib/proxyCache')
const Logger = require('@mojaloop/central-services-logger')
const Config = require('../../../../dist/lib/config')
const Model = require('../../../../dist/models/transfer/transferStateChange')
const HelperModule = require('../../helpers')
const Time = require('@mojaloop/central-services-shared').Util.Time
const ParticipantCached = require('../../../../dist/models/participant/participantCached')
const ParticipantCurrencyCached = require('../../../../dist/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('../../../../dist/models/participant/participantLimitCached')

Test('Transfer State Change model test', async (stateChangeTest) => {
  let stateChangePrepareResult = {}
  await stateChangeTest.test('setup', async (assert) => {
    try {
      await Db.connect(Config.DATABASE).then(async () => {
        await ProxyCache.connect()
        await ParticipantCached.initialize()
        await ParticipantCurrencyCached.initialize()
        await ParticipantLimitCached.initialize()
        await Cache.initCache()
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
      // Prepare helper tests actually the Model.saveTransferExtension and Model.getByTransferId
      stateChangePrepareResult = await HelperModule.prepareNeededData('transferStateChange')
      // assert.comment('the prepared data is: ', JSON.stringify(stateChangePrepareResult, null, 4))

      const state = stateChangePrepareResult.transferStateResults[1]
      const transferStateChange = {
        transferId: stateChangePrepareResult.transfer.transferId,
        transferStateId: state.transferStateId,
        reason: null,
        createdDate: Time.getUTCString(new Date())
      }

      const createdId = await Model.saveTransferStateChange(transferStateChange)
      const result = await Model.getByTransferId(stateChangePrepareResult.transfer.transferId)
      assert.equal(createdId, result.transferStateChangeId, 'transferId match')
      assert.equal(transferStateChange.transferStateId, result.transferStateId, 'key match')
      assert.equal(transferStateChange.reason, result.reason, 'value match')
      assert.end()
    } catch (err) {
      Logger.error(`create all extension objects failed with error - ${err}`)
      assert.fail(`Create all extension objects failed - ${err}`)
      assert.end()
    }
  })

  await stateChangeTest.test('create stateChange without transferId should throw error', async (assert) => {
    const state = stateChangePrepareResult.transferStateResults[0]
    try {
      await Model.saveTransferStateChange({
        transferStateId: state.transferStateId,
        reason: null,
        createdDate: new Date()
      })
      assert.fail('should throw')
      assert.end()
    } catch (err) {
      // Logger.error('create state change without transferId is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await stateChangeTest.test('create stateChange without transferStateId should throw error', async (assert) => {
    try {
      await Model.saveTransferStateChange({
        transferId: stateChangePrepareResult.transfer.transferId,
        reason: null,
        createdDate: new Date()
      })
      assert.fail('should throw')
      assert.end()
    } catch (err) {
      // Logger.error('create state change without transferStateId is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await stateChangeTest.test('teardown', async (assert) => {
    try {
      await Cache.destroyCache()
      await Db.disconnect()
      await ProxyCache.disconnect()
      assert.pass('database connection closed')
      assert.end()
    } catch (err) {
      Logger.error(`teardown failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await stateChangeTest.end()
})
