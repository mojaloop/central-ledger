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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-shared').Logger
const ParticipantCurrencyModel = require('../../../../src/models/participant/participantCurrency')
const Model = require('../../../../src/models/participant/participantLimit')

Test('Participant Limit model', async (participantLimitTest) => {
  let sandbox

  participantLimitTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.participantLimit = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      destroy: sandbox.stub()
    }
    t.end()
  })

  participantLimitTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await participantLimitTest.test('getByParticipantCurrencyId', async (assert) => {
    try {
      Db.participantLimit.findOne.withArgs({ participantCurrencyId: 1, isActive: 1 }).returns({
        participantLimitId: 1,
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 1000000.00,
        thresholdAlarmPercentage: 10.0,
        startAfterParticipantPositionChangeId: null,
        isActive: 1,
        createdDate: '2018-07-19',
        createdBy: 'unknown'
      })
      const expected = {
        participantLimitId: 1,
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 1000000.00,
        thresholdAlarmPercentage: 10.0,
        startAfterParticipantPositionChangeId: null,
        isActive: 1,
        createdDate: '2018-07-19',
        createdBy: 'unknown'
      }
      let result = await Model.getByParticipantCurrencyId(1)
      assert.equal(JSON.stringify(result), JSON.stringify(expected))
      assert.end()
    } catch (err) {
      Logger.error(`getByParticipantCurrencyId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantLimitTest.test('getByParticipantCurrencyId should fail', async (test) => {
    try {
      Db.participantLimit.findOne.withArgs({ participantCurrencyId: 1, isActive: 1 }).throws(new Error())
      await Model.getByParticipantCurrencyId(1)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`getByParticipantCurrencyId failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await participantLimitTest.test('destroyByParticipantCurrencyId', async (assert) => {
    try {
      Db.participantLimit.destroy.withArgs({ participantCurrencyId: 1 }).returns(1)
      let result = await Model.destroyByParticipantCurrencyId(1)
      assert.equal(result, 1, 'Results match')
      assert.end()
    } catch (err) {
      Logger.error(`destroyByParticipantCurrencyId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantLimitTest.test('destroyByParticipantCurrencyId should fail', async (test) => {
    try {
      Db.participantLimit.destroy.withArgs({ participantCurrencyId: 1 }).throws(new Error())
      await Model.destroyByParticipantCurrencyId(1)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`destroyByParticipantCurrencyId failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await participantLimitTest.test('destroyByParticipantId should clean all participant account positions', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      Db.getKnex.returns(knexStub)
      sandbox.stub(ParticipantCurrencyModel, 'getByParticipantId')
      ParticipantCurrencyModel.getByParticipantId.withArgs(1).returns(Promise.resolve([{ participantCurrencyId: 1 }]))
      knexStub.withArgs('participantPosition').returns({
        whereIn: sandbox.stub().returns({
          del: sandbox.stub().returns(true)
        })
      })

      let result = await Model.destroyByParticipantId(1)
      test.ok(result)
      test.end()
    } catch (err) {
      test.pass('Error thrown')
      test.end()
    }
  })

  await participantLimitTest.test('destroyByParticipantId should fail', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      Db.getKnex.throws(new Error())
      await Model.destroyByParticipantId(1)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      test.pass('Error thrown')
      test.end()
    }
  })
  participantLimitTest.end()
})
