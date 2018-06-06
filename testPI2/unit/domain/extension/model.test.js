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
 --------------
 ******/

'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
const Model = require('../../../../src/models/extensions')

Test('Extension model', async (extensionModelTest) => {
  let sandbox

  const extensionModelFixtures = [
    {
      transferId: 1,
      key: 'key1',
      value: 'value1',
      changedDate: new Date(),
      changedBy: ''
    },
    {
      transferId: 2,
      key: 'key2',
      value: 'value2',
      changedDate: new Date(),
      changedBy: ''

    }
  ]

  sandbox = Sinon.sandbox.create()
  Db.extension = {
    insert: sandbox.stub(),
    update: sandbox.stub(),
    findOne: sandbox.stub(),
    destroy: sandbox.stub()
  }

  await extensionModelTest.test('create false extension', async (assert) => {
    Db.extension.insert.withArgs({
      transferId: 1,
      key: 'key1',
      value: 'value1',
      changedDate: undefined,
      changedBy: undefined
    }).throws(new Error('message'))
    try {
      await Model.saveExtension({
        transferId: 1,
        key: 'key1',
        value: 'value1',
        changedDate: undefined,
        changedBy: undefined
      })
      assert.fail(' this should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await extensionModelTest.test('save extension', async (assert) => {
    Db.extension.insert.withArgs({
      transferId: 1,
      key: 'key1',
      value: 'value1',
      changedDate: new Date(),
      changedBy: ''
    }).returns(1)
    try {
      var result = await Model.saveExtension(extensionModelFixtures[0])
      assert.ok(Sinon.match(result, 1), ` returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`save extension failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await extensionModelTest.test('get extensions by transferId with empty id', async (assert) => {
    Db.extension.findOne.withArgs({ transferId: '' }).throws(new Error())
    try {
      await Model.getByTransferId('')
      assert.fail(' should throws with empty name ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await extensionModelTest.test('get by extension by transferId', async (assert) => {
    Db.extension.findOne.withArgs({transferId: 1}).returns(extensionModelFixtures[0])
    try {
      var result = await Model.getByTransferId(1)
      assert.deepEqual(result, extensionModelFixtures[0])
      assert.end()
    } catch (err) {
      Logger.error(`get by extension by transferId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await extensionModelTest.test('get extensions by transferId with empty id', async (assert) => {
    Db.extension.findOne.withArgs({ extensionId: '' }).throws(new Error())
    try {
      await Model.getByExtensionId('')
      assert.fail(' should throws with empty name ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await extensionModelTest.test('get by extensionId', async (assert) => {
    Db.extension.findOne.withArgs({extensionId: 1}).returns(extensionModelFixtures[0])
    try {
      var result = await Model.getByExtensionId(1)
      assert.deepEqual(result, extensionModelFixtures[0])
      assert.end()
    } catch (err) {
      Logger.error(`get by extensionId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await extensionModelTest.test('update extension with wrong Id', async (assert) => {
    Db.extension.update.withArgs(
      { extensionId: 12 },
      Object.assign({}, extensionModelFixtures[1], { transferId: 1 })
    ).throws(new Error())
    try {
      await Model.update(
        Object.assign({}, extensionModelFixtures[1], { extensionId: 12, transferId: 1 }), Object.assign(extensionModelFixtures[1], { transferId: 1 }))
      assert.fail(' should throw without empty extension ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await extensionModelTest.test('update extension', async (assert) => {
    try {
      Db.extension.update.withArgs(
        { extensionId: 1 },
        Object.assign({}, extensionModelFixtures[1], { transferId: 1 })
      ).returns(1)
      let updatedId = await Model.update(
        Object.assign(extensionModelFixtures[1], { extensionId: 1, transferId: 1 }), Object.assign(extensionModelFixtures[1], { transferId: 1 }))
      assert.equal(updatedId, 1)
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`update extension failed with error - ${err}`)
      assert.fail()
      sandbox.restore()
      assert.end()
    }
  })

  await extensionModelTest.test('destroy extension', async (assert) => {
    Db.extension.destroy.withArgs({transferId: 1}).returns(1)
    try {
      let result = await Model.destroyByTransferId(extensionModelFixtures[0])
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
    Db.extension.destroy.withArgs({transferId: 12}).throws(new Error())
    try {
      await Model.destroyByTransferId(Object.assign({}, extensionModelFixtures[0], {transferId: 12}))
      assert.fail(' should throw without empty extension ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })
})
