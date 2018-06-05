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
const Model = require('../../../../../src/domain/transfer/models/transferStates')

Test('transferState model', async (transferStateTest) => {
  let sandbox

  const transferStateTestValues = [
    {
      enumeration: '1',
      description: 'test description'
    }
  ]
  const transferState = transferStateTestValues[0]

  sandbox = Sinon.sandbox.create()
  Db.transferState = {
    insert: sandbox.stub(),
    findOne: sandbox.stub(),
    find: sandbox.stub(),
    truncate: sandbox.stub(),
    destroy: sandbox.stub()
  }

  await transferStateTest.test('create false transferState', async (assert) => {
    const falseTransferState = {description: 'test description'}
    Db.transferState.insert.withArgs({
      description: falseTransferState.description
    }).throws(new Error('message'))
    try {
      let r = await Model.saveTransferState(falseTransferState)
      assert.comment(r)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await transferStateTest.test('create transferState', async (assert) => {
    try {
      Db.transferState.insert.withArgs({
        enumeration: transferState.enumeration,
        description: transferState.description
      }).returns(1)
      var result = await Model.saveTransferState(transferState)
      assert.ok(result === 1, ` returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`create ilp failed with error - ${err}`)
      assert.fail(`create ilp failed with error - ${err}`)
      assert.end()
    }
  })

  await transferStateTest.test('get with empty transferStateId', async (assert) => {
    Db.transferState.findOne.withArgs({transferStateId: ''}).throws(new Error())
    try {
      await Model.getByTransferStateId('')
      assert.fail(' should throws with empty transferId ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await transferStateTest.test('getByTransferId', async (assert) => {
    try {
      Db.transferState.findOne.withArgs({transferStateId: '1'}).returns(transferStateTestValues[0])
      var result = await Model.getByTransferStateId('1')
      assert.equal(result.enumeration, transferState.enumeration, ' enumerations are equal')
      assert.equal(result.description, transferState.description, ' descriptions match')
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
  })

  await transferStateTest.test('getAll false transferState', async (assert) => {
    Db.transferState.find.throws(new Error('False getAll transferState'))
    try {
      await Model.getAll()
      assert.fail(' should throws error ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await transferStateTest.test('getAll', async (assert) => {
    Db.transferState.find.returns(transferStateTestValues)
    try {
      var result = await Model.getAll()
      assert.deepEqual(result, transferStateTestValues)
      assert.end()
    } catch (err) {
      Logger.error(`get all transfer states failed with error - ${err}`)
      assert.fail(`get all transfer states failed with error - ${err}`)
      assert.end()
    }
  })

  await transferStateTest.test('destroyTransferStates false transferState', async (assert) => {
    Db.transferState.destroy.throws(new Error('False destroyTransferStates transferState'))

    try {
      await Model.destroyTransferStates()
      assert.fail(' should throws error ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await transferStateTest.test('destroyTransferStates', async (assert) => {
    Db.transferState.destroy.returns(1)

    try {
      var result = await Model.destroyTransferStates()
      assert.deepEqual(result, 1)
      assert.end()
    } catch (err) {
      Logger.error(`destroy all transfer states failed with error - ${err}`)
      assert.fail(`destroy all transfer states failed with error - ${err}`)
      assert.end()
    }
  })

  await transferStateTest.test('destroyTransferStatesById false transferState', async (assert) => {
    Db.transferState.destroy.throws(new Error('False destroyTransferStatesById transferState'))

    try {
      await Model.destroyTransferStatesById()
      assert.fail(' should throws error ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await transferStateTest.test('destroyTransferStatesById', async (assert) => {
    Db.transferState.destroy.withArgs({transferStateId: '1'}).returns(1)

    try {
      await Model.destroyTransferStatesById('1')
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`destroy transfer state by transferStateId failed with error - ${err}`)
      assert.fail(`destroy transfer states by transferStateId failed with error - ${err}`)
      sandbox.restore()
      assert.end()
    }
  })
})
