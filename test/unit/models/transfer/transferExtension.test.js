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
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const Model = require('../../../../src/models/transfer/transferExtension')

Test('Extension model', async (extensionModelTest) => {
  const transferExtensionModelFixtures = [
    {
      transferId: 1,
      key: 'key1',
      value: 'value1',
      createdDate: new Date()
    },
    {
      transferId: 2,
      key: 'key2',
      value: 'value2',
      createdDate: new Date()
    }
  ]

  let sandbox

  extensionModelTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()

    Db.transferExtension = {
      insert: sandbox.stub(),
      update: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      destroy: sandbox.stub()
    }

    Db.from = (table) => {
      return Db[table]
    }

    t.end()
  })

  extensionModelTest.afterEach(t => {
    sandbox.restore()

    t.end()
  })

  await extensionModelTest.test('create false extension', async (assert) => {
    Db.transferExtension.insert.withArgs({
      transferId: 1,
      key: 'key1',
      value: 'value1',
      createdDate: undefined
    }).throws(new Error())
    try {
      await Model.saveTransferExtension({
        transferId: 1,
        key: 'key1',
        value: 'value1',
        createdDate: undefined
      })
      assert.fail('should throw error')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err}`)
    }
    assert.end()
  })

  await extensionModelTest.test('save extension', async (assert) => {
    Db.transferExtension.insert.withArgs(transferExtensionModelFixtures[0]).returns(1)
    try {
      const result = await Model.saveTransferExtension(transferExtensionModelFixtures[0])
      assert.equal(result, 1, `returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`save extension failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await extensionModelTest.test('get extensions by transferId with empty id', async (assert) => {
    Db.transferExtension.find.withArgs({ transferId: null, isFulfilment: false, isError: false }).throws(new Error())
    try {
      await Model.getByTransferId(null)
      assert.fail('should throw with empty transferId')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err}`)
    }
    assert.end()
  })

  await extensionModelTest.test('get extension by transferId', async (assert) => {
    Db.transferExtension.find.withArgs({ transferId: 1, isFulfilment: false, isError: false }).returns(transferExtensionModelFixtures[0])
    try {
      const result = await Model.getByTransferId(1)
      assert.deepEqual(result, transferExtensionModelFixtures[0])
      assert.end()
    } catch (err) {
      Logger.error(`get extension by transferId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await extensionModelTest.test('get fulfilment extension by transferId', async (assert) => {
    const isFulfilment = true
    Db.transferExtension.find.withArgs({ transferId: 1, isFulfilment, isError: false }).returns(transferExtensionModelFixtures[0])
    try {
      const result = await Model.getByTransferId(1, isFulfilment)
      assert.deepEqual(result, transferExtensionModelFixtures[0])
      assert.end()
    } catch (err) {
      Logger.error(`get extension by transferId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await extensionModelTest.test('get transferError extensions by transferId with empty id', async (assert) => {
    Db.transferExtension.find.withArgs({ transferId: null, isFulfilment: false, isError: true }).throws(new Error())
    try {
      await Model.getByTransferId(null, false, true)
      assert.fail('should throw with empty ErrorId')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err}`)
    }
    assert.end()
  })

  await extensionModelTest.test('get extension by transferErrorId', async (assert) => {
    Db.transferExtension.find.withArgs({ transferId: 1, isFulfilment: false, isError: true }).returns(transferExtensionModelFixtures[0])
    try {
      const result = await Model.getByTransferId(1, false, true)
      assert.deepEqual(result, transferExtensionModelFixtures[0])
      assert.end()
    } catch (err) {
      Logger.error(`get extension by transferId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await extensionModelTest.test('get extensions by transferExtensionId with empty id', async (assert) => {
    Db.transferExtension.findOne.withArgs({ transferExtensionId: '' }).throws(new Error())
    try {
      await Model.getByTransferExtensionId('')
      assert.fail('should throw with empty name')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err}`)
    }
    assert.end()
  })

  await extensionModelTest.test('get by transferExtensionId', async (assert) => {
    Db.transferExtension.findOne.withArgs({ transferExtensionId: 1 }).returns(transferExtensionModelFixtures[0])
    try {
      const result = await Model.getByTransferExtensionId(1)
      assert.deepEqual(result, transferExtensionModelFixtures[0])
      assert.end()
    } catch (err) {
      Logger.error(`get by transferExtensionId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await extensionModelTest.test('destroy extension', async (assert) => {
    Db.transferExtension.destroy.withArgs({ transferId: 1 }).returns(1)
    try {
      const result = await Model.destroyByTransferId(transferExtensionModelFixtures[0].transferId)
      assert.equal(result, 1)
      assert.end()
    } catch (err) {
      Logger.error(`destroy extension failed with error - ${err}`)
      assert.fail()
      sandbox.restore()
      assert.end()
    }
  })

  await extensionModelTest.test('destroy extension with missing transferId', async (assert) => {
    Db.transferExtension.destroy.withArgs({ transferId: 10 }).throws(new Error())
    try {
      await Model.destroyByTransferId(10)
      assert.fail('should throw without empty extension ')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err}`)
    }
    assert.end()
  })

  await extensionModelTest.end()
})
