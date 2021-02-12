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
const Model = require('../../../../src/models/participant/participant')

Test('Participant model', async (participantTest) => {
  let sandbox

  const participantFixtures = [
    {
      participantId: '1',
      name: 'fsp1z',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date()
    },
    {
      participantId: '2',
      name: 'fsp2',
      currency: 'EUR',
      isActive: 1,
      createdDate: new Date()
    }
  ]
  const participant = participantFixtures[0]
  const participantId = 1
  participantTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.participant = {
      insert: sandbox.stub(),
      update: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      destroy: sandbox.stub()
    }

    Db.participantEndpoint = {
      destroy: sandbox.stub()
    }

    Db.from = (table) => {
      return Db[table]
    }

    t.end()
  })

  participantTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await participantTest.test('create false participant', async (assert) => {
    const falseParticipant = { name: 'fsp3' }
    Db.participant.insert.withArgs({ name: falseParticipant.name }).throws(new Error('message'))
    try {
      const r = await Model.create(falseParticipant)
      assert.comment(r)
      assert.fail('should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('create participant', async (assert) => {
    try {
      Db.participant.insert.withArgs({
        name: participantFixtures[0].name,
        createdBy: 'unknown'
      }).returns(1)
      const result = await Model.create(participantFixtures[0])
      assert.equal(result, 1, ` returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('create participant should throw an error', async (test) => {
    try {
      Db.participant.insert.withArgs({
        name: participantFixtures[0].name,
        createdBy: 'unknown'
      }).throws(new Error())
      const result = await Model.create(participantFixtures[0])
      test.equal(result, 1, ` returns ${result}`)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await participantTest.test('get with empty name', async (assert) => {
    Db.participant.findOne.withArgs({ name: '' }).throws(new Error())
    try {
      await Model.getByName('')
      assert.fail(' should throws with empty name ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('getAll', async (assert) => {
    Db.participant.find.returns(participantFixtures)
    try {
      const result = await Model.getAll()
      assert.deepEqual(result, participantFixtures)
      assert.end()
    } catch (err) {
      Logger.error(`get all participants failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getAll should throw an error', async (test) => {
    try {
      Db.participant.find.throws(new Error())
      const result = await Model.getAll()
      test.deepEqual(result, participantFixtures)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`get all participants failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await participantTest.test('update', async (assert) => {
    try {
      Db.participant.update.withArgs(
        { participantId: 1 }, { isActive: 1 }
      ).returns(participantId)
      const updatedId = await Model.update(Object.assign(participant, { participantId: 1 }), 1)
      assert.equal(updatedId, participantId)
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`update participant failed with error - ${err}`)
      sandbox.restore()
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('update should throw an error', async (test) => {
    try {
      Db.participant.update.withArgs(
        { participantId: 1 }, { isActive: 1 }
      ).throws(new Error())
      const updatedId = await Model.update(Object.assign(participant, { participantId: 1 }), 1)
      test.equal(updatedId, participantId)
      test.fail('Error not thrown')
      sandbox.restore()
      test.end()
    } catch (err) {
      Logger.error(`update participant failed with error - ${err}`)
      test.pass('Error thrown')
      sandbox.restore()
      test.end()
    }
  })

  await participantTest.test('destroyByName', async (assert) => {
    try {
      Db.participant.destroy.withArgs({ name: participant.name }).returns(Promise.resolve(true))
      const result = await Model.destroyByName(participant.name)
      assert.equal(result, true)
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`destroy participant failed with error - ${err}`)
      sandbox.restore()
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('destroyByName should throw an error', async (test) => {
    try {
      Db.participant.destroy.withArgs({ name: participant.name }).throws(new Error())
      const result = await Model.destroyByName(participant.name)
      test.equal(result, true)
      test.fail('Error not thrown')
      sandbox.restore()
      test.end()
    } catch (err) {
      Logger.error(`destroy participant failed with error - ${err}`)
      test.pass('Error thrown')
      sandbox.restore()
      test.end()
    }
  })

  await participantTest.test('destroyParticipantEndpointByParticipantId', async (assert) => {
    try {
      Db.participantEndpoint.destroy.withArgs({ participantId: participant.participantId }).returns(Promise.resolve(true))
      const result = await Model.destroyParticipantEndpointByParticipantId(participant.participantId)
      assert.equal(result, true)
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`destroyParticipantEndpointByParticipantId failed with error - ${err}`)
      sandbox.restore()
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('destroyParticipantEndpointByParticipantId should throw an error', async (test) => {
    try {
      Db.participantEndpoint.destroy.withArgs({ participantId: participant.participantId }).throws(new Error())
      const result = await Model.destroyParticipantEndpointByParticipantId(participant.participantId)
      test.equal(result, true)
      test.fail('Error not thrown')
      sandbox.restore()
      test.end()
    } catch (err) {
      Logger.error(`destroyParticipantEndpointByParticipantId failed with error - ${err}`)
      test.pass('Error thrown')
      sandbox.restore()
      test.end()
    }
  })

  await participantTest.end()
})
