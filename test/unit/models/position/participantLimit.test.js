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

const Test = require('tape')
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
const Model = require('../../../../src/models/participant/participantLimit')
const Enum = require('../../../../src/lib/enum')

Test('Participant Limit model', async (participantLimitTest) => {
  let sandbox
  const participantLimit1 = {
    participantCurrencyId: 1,
    participantLimitTypeId: Enum.ParticipantLimitType.NET_DEBIT_CAP,
    value: 1000,
    thresholdAlarmPercentage: 10,
    startAfterParticipantPositionChangeId: null,
    isActive: true,
    createDate: new Date(),
    createdBy: 'unit-testing'
  }

  sandbox = Sinon.createSandbox()
  Db.participantLimit = {
    insert: sandbox.stub(),
    update: sandbox.stub(),
    findOne: sandbox.stub()
  }

  await participantLimitTest.test('insert participant limit', async (assert) => {
    try {
      Db.participantLimit.insert.withArgs(participantLimit1).returns(1)
      var result = await Model.insert(participantLimit1)
      assert.ok(Sinon.match(result, 1), `returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`insert participant limit failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantLimitTest.test('insert participant limit should throw an error', async (assert) => {
    try {
      Db.participantLimit.insert.withArgs(participantLimit1).throws(new Error('message'))
      await Model.insert(participantLimit1)
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      Logger.error(`insert participant limit failed with error - ${err}`)
      assert.assert(err instanceof Error, 'instance of Error')
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await participantLimitTest.test('update participant limit', async (assert) => {
    try {
      Db.participantLimit.update.withArgs({ participantCurrencyId: participantLimit1.participantCurrencyId }, { value: participantLimit1.value, isActive: participantLimit1.isActive }).returns(1)
      var result = await Model.update(participantLimit1)
      assert.ok(Sinon.match(result, 1), `returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`update participant limit failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantLimitTest.test('update participant limit should throw an error', async (assert) => {
    try {
      Db.participantLimit.update.withArgs({ participantCurrencyId: participantLimit1.participantCurrencyId }, { value: participantLimit1.value, isActive: participantLimit1.isActive }).throws(new Error('message'))
      await Model.update(participantLimit1)
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      Logger.error(`update participant limit failed with error - ${err}`)
      assert.assert(err instanceof Error, 'instance of Error')
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await participantLimitTest.test('getLimitByCurrencyId participant limit', async (assert) => {
    try {
      Db.participantLimit.findOne.withArgs({ participantCurrencyId: participantLimit1.participantCurrencyId }).returns(1)
      var result = await Model.getLimitByCurrencyId(participantLimit1)
      assert.ok(Sinon.match(result, 1), `returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`getLimitByCurrencyId participant limit failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantLimitTest.test('getLimitByCurrencyId participant limit should throw an error', async (assert) => {
    try {
      Db.participantLimit.findOne.withArgs({ participantCurrencyId: participantLimit1.participantCurrencyId }).throws(new Error('message'))
      await Model.getLimitByCurrencyId(participantLimit1.participantCurrencyId)
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      Logger.error(`getLimitByCurrencyId participant limit failed with error - ${err}`)
      assert.assert(err instanceof Error, 'instance of Error')
      assert.pass('Error thrown')
      assert.end()
    }
  })

  participantLimitTest.end()
})
