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

 * Vijaya Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Logger = require('../../../../src/shared/logger').logger
const Model = require('../../../../src/models/position/participantPositionChanges')

Test('participantPositionChanges model', async (participantPositionChangesTest) => {
  let sandbox

  participantPositionChangesTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Db, 'getKnex')
    const knexStub = sandbox.stub()
    knexStub.returns({
      where: sandbox.stub().returns({
        where: sandbox.stub().returns({
          innerJoin: sandbox.stub().returns({
            select: sandbox.stub().resolves({})
          })
        })
      })
    })
    Db.getKnex.returns(knexStub)

    t.end()
  })

  participantPositionChangesTest.afterEach(t => {
    sandbox.restore()

    t.end()
  })

  await participantPositionChangesTest.test('getReservedPositionChangesByCommitRequestId', async (assert) => {
    try {
      const commitRequestId = 'b0000001-0000-0000-0000-000000000000'
      const result = await Model.getReservedPositionChangesByCommitRequestId(commitRequestId)
      assert.deepEqual(result, {}, `returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`getReservedPositionChangesByCommitRequestId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantPositionChangesTest.test('getReservedPositionChangesByTransferId', async (assert) => {
    try {
      const transferId = 'a0000001-0000-0000-0000-000000000000'
      const result = await Model.getReservedPositionChangesByTransferId(transferId)
      assert.deepEqual(result, {}, `returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`getReservedPositionChangesByTransferId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantPositionChangesTest.test('getReservedPositionChangesByCommitRequestId throws an error', async (assert) => {
    try {
      Db.getKnex.returns(Promise.reject(new Error('Test Error')))
      const commitRequestId = 'b0000001-0000-0000-0000-000000000000'
      await Model.getReservedPositionChangesByCommitRequestId(commitRequestId)
      assert.fail()
      assert.end()
    } catch (err) {
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await participantPositionChangesTest.test('getReservedPositionChangesByTransferId throws an error', async (assert) => {
    try {
      Db.getKnex.returns(Promise.reject(new Error('Test Error')))
      const transferId = 'a0000001-0000-0000-0000-000000000000'
      await Model.getReservedPositionChangesByTransferId(transferId)
      assert.fail()
      assert.end()
    } catch (err) {
      assert.pass('Error thrown')
      assert.end()
    }
  })

  participantPositionChangesTest.end()
})
