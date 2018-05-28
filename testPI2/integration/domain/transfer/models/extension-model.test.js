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
const Model = require('../../../../../src/models/extensions')
const HelperModule = require('../../../helpers/index')

Test('Extension model test', async (extensionTest) => {
  let sandbox

  let extensionTestValues = [
    {
      transferId: '1',
      key: 'extTestKey1',
      value: 'extTestValue1',
      changedDate: new Date(),
      changedBy: 'extension.changedBy'
    }
  ]

  let extensionMap = new Map()

  await extensionTest.test('setup', async (assert) => {
    try {
      sandbox = Sinon.sandbox.create()
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
          // Prepare helper tests actually the Model.saveExtension and Model.getByTransferId
          let extensionResult = await HelperModule.prepareNeededData('extension')
          let result = extensionResult.extension

          let read = await Model.getByTransferId(extensionResult.transfer.transferId)

          read = Object.assign({}, { extension: read }, {
            participants: extensionResult.participants
          })

          extensionMap.set(result.extensionId, read)

          assert.comment(`Testing with extension \n ${JSON.stringify(extension, null, 2)}`)
          assert.equal(result.transferId, read.extension.transferId, ' transferId match')
          assert.equal(result.key, read.extension.key, ' key match')
          assert.equal(result.value, read.extension.value, ' value match')
          assert.equal(result.changedDate.toString(), read.extension.changedDate.toString(), ' changedDate match')
          assert.equal(result.changedBy, read.extension.changedBy, ' changedBy match')
          assert.end()
        } catch (err) {
          Logger.error(`create 1 extension failed with error - ${err}`)
          assert.fail(`Create 1 extension failed - ${err}`)
          assert.end()
        }
      })
      // assert.end()
    } catch (err) {
      Logger.error(`create all extension objects failed with error - ${err}`)
      assert.fail(`Create all extension objects failed - ${err}`)
      assert.end()
    }
  })

  await extensionTest.test('create extension without transferId should throw error', async (assert) => {
    try {
      await Model.saveExtension({
        key: 'extTestKey1',
        value: 'extTestValue1',
        changedDate: new Date(),
        changedBy: 'extension.changedBy'
      })
      assert.end()
    } catch (err) {
      Logger.error('create ilp without transferId is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await extensionTest.test('create extension without value should throw error', async (assert) => {
    try {
      await Model.saveExtension({
        transferId: '1',
        key: 'extTestKey1',
        changedDate: new Date(),
        changedBy: 'extension.changedBy'
      })
      assert.end()
    } catch (err) {
      Logger.error('create ilp without transferId is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await extensionTest.test('create extension without key should throw error', async (assert) => {
    try {
      await Model.saveExtension({
        transferId: '1',
        value: 'extTestValue1',
        changedDate: new Date(),
        changedBy: 'extension.changedBy'
      })
      assert.end()
    } catch (err) {
      Logger.error('create ilp without transferId is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await extensionTest.test('create extension without changedDate should throw error', async (assert) => {
    try {
      await Model.saveExtension({
        transferId: '1',
        key: 'extTestKey1',
        value: 'extTestValue1',
        changedBy: 'extension.changedBy'
      })
      assert.end()
    } catch (err) {
      Logger.error('create ilp without transferId is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await extensionTest.test('create extension without changedBy should throw error', async (assert) => {
    try {
      await Model.saveExtension({
        transferId: '1',
        key: 'extTestKey1',
        value: 'extTestValue1',
        changedDate: new Date()
      })
      assert.end()
    } catch (err) {
      Logger.error('create ilp without transferId is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await extensionTest.test('getByTransferId', async (assert) => {
    try {
      for (let extensionObj of extensionMap.values()) {
        let extension = extensionObj.extension
        let result = await Model.getByTransferId(extension.transferId)
        assert.equal(JSON.stringify(extension), JSON.stringify(result))
        assert.comment(`Testing with extension \n ${JSON.stringify(extension, null, 2)}`)
        assert.equal(result.transferId, extension.transferId, ' transferId match')
        assert.equal(result.key, extension.key, ' key match')
        assert.equal(result.value, extension.value, ' value match')
        assert.equal(result.changedDate.toString(), extension.changedDate.toString(), ' changedDate match')
        assert.equal(result.changedBy, extension.changedBy, ' changedBy match')
      }
      assert.end()
    } catch (err) {
      Logger.error(`get extension by transferId failed with error - ${err}`)
      assert.fail(`Get extension by transferId failed - ${err}`)
      assert.end()
    }
  })

  await extensionTest.test('getByExtensionId', async (assert) => {
    try {
      for (let [extensionId, extensionObj] of extensionMap.entries()) {
        let extension = extensionObj.extension
        let result = await Model.getByTransferId(extension.transferId)
        assert.equal(JSON.stringify(extension), JSON.stringify(result))
        assert.comment(`Testing with extension \n ${JSON.stringify(extension, null, 2)}`)
        assert.equal(result.extensionId, extensionId, ' extensionId match')
        assert.equal(result.transferId, extension.transferId, ' transferId match')
        assert.equal(result.key, extension.key, ' key match')
        assert.equal(result.value, extension.value, ' value match')
        assert.equal(result.changedDate.toString(), extension.changedDate.toString(), ' changedDate match')
        assert.equal(result.changedBy, extension.changedBy, ' changedBy match')
      }
      assert.end()
    } catch (err) {
      Logger.error(`get extension by extensionId failed with error - ${err}`)
      assert.fail(`Get extension by extensionId failed - ${err}`)
      assert.end()
    }
  })

  await extensionTest.test('update', async (assert) => {
    try {
      for (let extensionObj of extensionMap.values()) {
        let extension = extensionObj.extension
        let result = await Model.update(Object.assign({}, extension, { value: 'new value' }))
        let extensionDb = await Model.getByTransferId(extension.transferId)
        assert.equal(result, 1, ' ilp is updated')
        assert.equal(extension.extensionId, extensionDb.extensionId, ' ids match')
        assert.equal(extensionDb.value, 'new value', 'update is real')
      }
      assert.end()
    } catch (err) {
      Logger.error(`update ilp failed with error - ${err}`)
      assert.fail(`Update ilp failed - ${err}`)
      assert.end()
    }
  })

  await extensionTest.test('teardown', async (assert) => {
    try {
      for (let extensionObj of extensionMap.values()) {
        let extension = extensionObj.extension
        await HelperModule.deletePreparedData('extension', {
          extensionId: extension.extensionId,
          transferId: extension.transferId,
          payerName: extensionObj.participants.participantPayer.name,
          payeeName: extensionObj.participants.participantPayee.name

        })
      }
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
