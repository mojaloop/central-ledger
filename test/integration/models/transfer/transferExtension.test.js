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
 --------------
 ******/

'use strict'

const Test = require('tape')
const Db = require('../../../../src/db')
const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../../src/lib/config')
const Model = require('../../../../src/models/transfer/transferExtension')
const HelperModule = require('../../helpers')

Test('Extension model test', async (extensionTest) => {
  let transferId

  let extensionTestValues = [
    {
      transferId: '1',
      key: 'extTestKey1',
      value: 'extTestValue1',
      createdDate: new Date()
    }
  ]

  let extensionMap = new Map()

  await extensionTest.test('setup', async (assert) => {
    try {
      await Db.connect(Config.DATABASE_URI).then(() => {
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

  await extensionTest.test('create extension', async (assert) => {
    try {
      extensionTestValues.forEach(async (extension) => {
        try {
          let extensionResult = await HelperModule.prepareNeededData('transferExtension')
          let result = extensionResult.extension[0]
          transferId = result.transferId

          let read = await Model.getByTransferId(extensionResult.transfer.transferId)

          read = Object.assign({}, { extension: read[0] }, {
            participants: extensionResult.participants
          })

          extensionMap.set(result.extensionId, read)

          // assert.comment(`Testing with extension \n ${JSON.stringify(extension, null, 2)}`)
          assert.equal(result.transferId, read.extension.transferId, 'transferId match')
          assert.equal(result.key, read.extension.key, 'key match')
          assert.equal(result.value, read.extension.value, 'value match')
          assert.equal(result.createdDate.toString(), read.extension.createdDate.toString(), 'createdDate match')
          assert.end()
        } catch (err) {
          Logger.error(`create 1 extension failed with error - ${err}`)
          assert.fail(`Create 1 extension failed - ${err}`)
          assert.end()
        }
      })
    } catch (err) {
      Logger.error(`create all extension objects failed with error - ${err}`)
      assert.fail(`Create all extension objects failed - ${err}`)
      assert.end()
    }
  })

  await extensionTest.test('create transferExtension without transferId should throw error', async (assert) => {
    try {
      await Model.saveTransferExtension({
        key: 'extTestKey1',
        value: 'extTestValue1',
        createdDate: new Date()
      })
      assert.fail('should throw')
      assert.end()
    } catch (err) {
      // Logger.error('create ilp without transferId is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await extensionTest.test('create transferExtension without value should throw error', async (assert) => {
    try {
      await Model.saveTransferExtension({
        transferId,
        key: 'extTestKey1',
        createdDate: new Date()
      })
      assert.fail('should throw')
      assert.end()
    } catch (err) {
      // Logger.error('create transferExtension without value is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await extensionTest.test('create transferExtension without key should throw error', async (assert) => {
    try {
      await Model.saveTransferExtension({
        transferId,
        value: 'extTestValue1',
        createdDate: new Date()
      })
      assert.fail('should throw')
      assert.end()
    } catch (err) {
      // Logger.error('create transferExtension without key is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await extensionTest.test('getByTransferId', async (assert) => {
    try {
      for (let extensionObj of extensionMap.values()) {
        let extension = extensionObj.extension
        let result = await Model.getByTransferId(extension.transferId)
        assert.equal(JSON.stringify(extension), JSON.stringify(result[0]))
        // assert.comment(`Testing with extension \n ${JSON.stringify(extension, null, 2)}`)
        assert.equal(result[0].transferId, extension.transferId, 'transferId match')
        assert.equal(result[0].key, extension.key, 'key match')
        assert.equal(result[0].value, extension.value, 'value match')
        assert.equal(result[0].createdDate.toString(), extension.createdDate.toString(), 'changedDate match')
      }
      assert.end()
    } catch (err) {
      Logger.error(`get extension by transferId failed with error - ${err}`)
      assert.fail(`Get extension by transferId failed - ${err}`)
      assert.end()
    }
  })

  await extensionTest.test('getByTransferExtensionId', async (assert) => {
    try {
      for (let [extensionId, extensionObj] of extensionMap.entries()) {
        let extension = extensionObj.extension
        let result = await Model.getByTransferExtensionId(extension.transferExtensionId)
        assert.equal(JSON.stringify(extension), JSON.stringify(result))
        // assert.comment(`Testing with extension \n ${JSON.stringify(extension, null, 2)}`)
        assert.equal(result.extensionId, extensionId, 'extensionId match')
        assert.equal(result.transferId, extension.transferId, 'transferId match')
        assert.equal(result.key, extension.key, 'key match')
        assert.equal(result.value, extension.value, 'value match')
        assert.equal(result.createdDate.toString(), extension.createdDate.toString(), 'createdDate match')
      }
      assert.end()
    } catch (err) {
      Logger.error(`get extension by extensionId failed with error - ${err}`)
      assert.fail(`Get extension by extensionId failed - ${err}`)
      assert.end()
    }
  })

  await extensionTest.test('teardown', async (assert) => {
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

  extensionTest.end()
})
