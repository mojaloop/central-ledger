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
const Model = require('../../../../src/models/transfer/transferStateChange')

Test('TransferStateChange model', async (transferStateChangeModel) => {
  let sandbox

  const transferStateChangeModelFixtures = [
    {
      transferId: 1,
      transferStateId: 1
    },
    {
      transferId: 2,
      transferStateId: 2
    }
  ]

  transferStateChangeModel.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.transferStateChange = {
      insert: sandbox.stub(),
      truncate: sandbox.stub(),
      query: sandbox.stub()
    }
    Db.from = (table) => {
      return Db[table]
    }
    t.end()
  })

  transferStateChangeModel.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await transferStateChangeModel.test('create false transfer state change', async (assert) => {
    Db.transferStateChange.insert.withArgs({
      transferId: '',
      transferStateId: 1
    }).throws(new Error('message'))
    try {
      await Model.saveTransferStateChange({
        transferId: '',
        transferStateId: 1
      })
      assert.fail(' this should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await transferStateChangeModel.test('save transferStateChange', async (assert) => {
    Db.transferStateChange.insert.withArgs(transferStateChangeModelFixtures[0]).returns(1)
    try {
      const result = await Model.saveTransferStateChange(transferStateChangeModelFixtures[0])
      assert.equal(result, 1, ` returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`create transferStateChange failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transferStateChangeModel.test('get by transferId', async (assert) => {
    try {
      const builderStub = sandbox.stub()
      const selectStub = sandbox.stub()
      const orderStub = sandbox.stub()
      const firstStub = sandbox.stub()
      builderStub.where = sandbox.stub()

      Db.transferStateChange.query.callsArgWith(0, builderStub)
      Db.transferStateChange.query.returns(transferStateChangeModelFixtures[0])
      builderStub.where.returns({
        select: selectStub.returns({
          orderBy: orderStub.returns({
            first: firstStub.returns(transferStateChangeModelFixtures[0])
          })
        })
      })

      const result = await Model.getByTransferId(1)
      assert.deepEqual(result, transferStateChangeModelFixtures[0])
      assert.end()
      sandbox.restore()
    } catch (err) {
      Logger.error(`create transferStateChange failed with error - ${err}`)
      assert.fail()
      sandbox.restore()
      assert.end()
    }
  })

  await transferStateChangeModel.test('get by transferId', async (assert) => {
    Db.transferStateChange.query.throws(new Error())
    try {
      await Model.getByTransferId(null)
      assert.fail('should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
    sandbox.restore()
  })

  await transferStateChangeModel.test('get latest', async (assert) => {
    try {
      const builderStub = sandbox.stub()
      const orderStub = sandbox.stub()
      const firstStub = sandbox.stub()

      Db.transferStateChange.query.callsArgWith(0, builderStub)
      Db.transferStateChange.query.returns(transferStateChangeModelFixtures[0])
      builderStub.selext = sandbox.stub().returns({
        orderBy: orderStub.returns({
          first: firstStub.returns(transferStateChangeModelFixtures[0])
        })
      })

      const result = await Model.getLatest()
      assert.deepEqual(result, transferStateChangeModelFixtures[0])
      assert.end()
      sandbox.restore()
    } catch (err) {
      Logger.error(`create transferStateChange failed with error - ${err}`)
      assert.fail()
      sandbox.restore()
      assert.end()
    }
  })

  await transferStateChangeModel.test('get latest', async (assert) => {
    Db.transferStateChange.query.throws(new Error())
    try {
      await Model.getLatest()
      assert.fail('should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
    sandbox.restore()
  })

  await transferStateChangeModel.test('truncateTransfers should throw an error', async (assert) => {
    try {
      Db.transferStateChange.truncate.throws(new Error())
      await Model.truncate()
      assert.ok(Db.transferStateChange.truncate.called)
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
    sandbox.restore()
  })

  await transferStateChangeModel.test('transferStateChange truncate should', async (assert) => {
    try {
      Db.transferStateChange.truncate.returns(Promise.resolve())
      await Model.truncate()
      assert.ok(Db.transferStateChange.truncate.called)
      assert.end()
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
    sandbox.restore()
  })

  await transferStateChangeModel.test('getByTransferIdList', async (test) => {
    try {
      const transferStateChangeList = [
        {
          transferStateChangeId: 1,
          transferId: '9136780b-37e2-457c-8c05-f15dbb033b10',
          transferStateId: 'RECEIVED_PREPARE',
          reason: null,
          createdDate: '2018-08-15 13:44:38'
        },
        {
          transferStateChangeId: 1,
          transferId: '9136780b-37e2-427c-8c05-f15dbb033b10',
          transferStateId: 'RESERVED',
          reason: null,
          createdDate: '2018-08-15 13:44:39'
        }
      ]

      const builderStub = sandbox.stub()
      Db.transferStateChange.query.callsArgWith(0, builderStub)
      builderStub.whereIn = sandbox.stub().returns(transferStateChangeList)

      const result = await Model.getByTransferIdList('9136780b-37e2-457c-8c05-f15dbb033b10')
      test.deepEqual(result, transferStateChangeList)
      test.end()
    } catch (err) {
      Logger.error(`getByTransferIdList failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferStateChangeModel.test('getByTransferIdList should fail', async (test) => {
    try {
      Db.transferStateChange.query.throws(new Error('message'))

      await Model.getByTransferIdList('9136780b-37e2-457c-8c05-f15dbb033b10')
      test.fail(' should throw')
      test.end()
    } catch (err) {
      test.pass('Error thrown')
      test.end()
    }
  })

  await transferStateChangeModel.end()
})
