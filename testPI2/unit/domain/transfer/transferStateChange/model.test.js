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

const Test = require('tape') // require('tapes')(require('tape')) //
const Sinon = require('sinon')
const Db = require('../../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
// const Config = require('../../../../src/lib/config')
const Model = require('../../../../../src/domain/transfer/models/transferStateChanges')

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

  sandbox = Sinon.sandbox.create()
  Db.transferStateChange = {
    insert: sandbox.stub(),
    query: sandbox.stub()
  }

  let builderStub = sandbox.stub()
  let orderStub = sandbox.stub()
  let firstStub = sandbox.stub()
  builderStub.select = sandbox.stub()

  Db.transferStateChange.query.callsArgWith(0, builderStub)
  Db.transferStateChange.query.returns(transferStateChangeModelFixtures[0])
  builderStub.select.returns({
    orderBy: orderStub.returns({
      first: firstStub.returns(transferStateChangeModelFixtures[0])
    })
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
      let result = await Model.saveTransferStateChange(transferStateChangeModelFixtures[0])
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
      var result = await Model.getByTransferId(1)
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
})
