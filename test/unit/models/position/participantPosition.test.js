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
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const Model = require('../../../../src/models/position/participantPosition')

Test('Participant Limit model', async (participantPositionTest) => {
  let sandbox
  const participantPosition1 = {
    participantCurrencyId: 1,
    value: 100,
    reservedValue: 0,
    changedDate: new Date()
  }

  participantPositionTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.participantPosition = {
      insert: sandbox.stub(),
      update: sandbox.stub(),
      findOne: sandbox.stub()
    }

    Db.from = (table) => {
      return Db[table]
    }

    t.end()
  })

  participantPositionTest.afterEach(t => {
    sandbox.restore()

    t.end()
  })

  await participantPositionTest.test('insert participant position', async (assert) => {
    try {
      Db.participantPosition.insert.withArgs(participantPosition1).returns(1)
      const result = await Model.insert(participantPosition1)
      assert.equal(result, 1, `returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`insert participant position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantPositionTest.test('insert participant position should throw an error', async (assert) => {
    try {
      Db.participantPosition.insert.withArgs(participantPosition1).throws(new Error('message'))
      await Model.insert(participantPosition1)
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      Logger.error(`insert participant position failed with error - ${err}`)
      assert.assert(err instanceof Error, 'instance of Error')
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await participantPositionTest.test('update participant position', async (assert) => {
    try {
      Db.participantPosition.update.returns(1)
      const result = await Model.update(participantPosition1)
      assert.equal(result, 1, `returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`update participant position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantPositionTest.test('update participant position should throw an error', async (assert) => {
    try {
      Db.participantPosition.update.throws(new Error('message'))
      await Model.update(participantPosition1)
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      Logger.error(`update participant position failed with error - ${err}`)
      assert.assert(err instanceof Error, 'instance of Error')
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await participantPositionTest.test('getPositionByCurrencyId participant position', async (assert) => {
    try {
      Db.participantPosition.findOne.withArgs({ participantCurrencyId: participantPosition1.participantCurrencyId }).returns(1)
      const result = await Model.getPositionByCurrencyId(participantPosition1.participantCurrencyId)
      assert.equal(result, 1, `returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`getPositionByCurrencyId participant position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantPositionTest.test('getPositionByCurrencyId participant position should throw an error', async (assert) => {
    try {
      Db.participantPosition.findOne.withArgs({ participantCurrencyId: participantPosition1.participantCurrencyId }).throws(new Error('message'))
      await Model.getPositionByCurrencyId(participantPosition1.participantCurrencyId)
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      Logger.error(`getPositionByCurrencyId participant position failed with error - ${err}`)
      assert.assert(err instanceof Error, 'instance of Error')
      assert.pass('Error thrown')
      assert.end()
    }
  })

  participantPositionTest.end()
})
