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

 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tape')
const Db = require('../../../../dist/lib/db')
const Cache = require('../../../../dist/lib/cache')
const ProxyCache = require('../../../../dist/lib/proxyCache')
const Logger = require('@mojaloop/central-services-logger')
const Config = require('../../../../dist/lib/config')
const Model = require('../../../../dist/models/transfer/transferError')
const HelperModule = require('../../helpers')

Test('Transfer Error model test', async (transferErrorTest) => {
  let transferErrorPrepareResult = {}
  await transferErrorTest.test('setup', async (assert) => {
    try {
      await Db.connect(Config.DATABASE).then(async () => {
        await Cache.initCache()
        await ProxyCache.connect()
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

  await transferErrorTest.test('create transfer Error test', async (assert) => {
    try {
      transferErrorPrepareResult = await HelperModule.prepareNeededData('transferError')
      // assert.comment('the prepared data are: ', JSON.stringify(transferErrorPrepareResult, null, 4))

      const read = transferErrorPrepareResult.transferError
      const result = await Model.getByTransferStateChangeId(transferErrorPrepareResult.transferStateChange.transferStateChangeId)
      assert.equal(read.transferStateChangeId, result.transferStateChangeId, 'transferStateChangeId match')
      assert.equal(read.errorCode, result.errorCode, 'errorCode match')
      assert.equal(read.errorDescription, result.errorDescription, 'errorDescription match')
      assert.end()
    } catch (err) {
      Logger.error(`create transfer error failed with error - ${err}`)
      assert.fail(`Create transfer error failed - ${err}`)
      assert.end()
    }
  })

  await transferErrorTest.test('create transferError without transferStateChangeId should throw error', async (assert) => {
    try {
      await Model.insert({
        transferStateChangeId: 0,
        errorCode: '3106',
        errorDescription: 'Invalid Request'
      })
      assert.fail('should throw')
      assert.end()
    } catch (err) {
      // Logger.error('create transfer error without transferStateChangeId is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await transferErrorTest.test('teardown', async (assert) => {
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

  await transferErrorTest.end()
})
