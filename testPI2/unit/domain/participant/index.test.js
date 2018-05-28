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

// TODO

'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
// const Config = require('../../../../src/lib/config')
const Model = require('../../../../src/domain/participant/model')
const Service = require('../../../../src/domain/participant/index')

Test('Participant service', async (participantTest) => {
  let sandbox

  // participantTest.beforeEach((t) => {
  //   sandbox = Sinon.sandbox.create()

  const participantFixtures = [
    {
      name: 'fsp1',
      currency: 'USD',
      isDisabled: 0,
      createdDate: new Date()
    },
    {
      name: 'fsp2',
      currency: 'EUR',
      isDisabled: 0,
      createdDate: new Date()
    }
  ]

  let participantMap = new Map()

  await participantTest.test('setup', async (assert) => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Model, 'create')
    sandbox.stub(Model, 'getByName')
    sandbox.stub(Model, 'getAll')
    sandbox.stub(Model, 'getById')
    sandbox.stub(Model, 'update')

    Db.participant = {
      insert: sandbox.stub(),
      update: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub()
    }

    participantFixtures.forEach((participant, index) => {
      participantMap.set(index + 1, participant)
      Db.participant.insert.withArgs({participant}).returns(index)
      // Model.create({ name: payload.name, currency: payload.currency })
      Model.create.withArgs({name: participant.name, currency: participant.currency}).returns((index + 1))
      Model.getByName.withArgs(participant.name).returns((participant))
      Model.getById.withArgs(index).returns((participant))
      Model.update.withArgs(participant, 1).returns((index + 1))
    })
    Model.getAll.returns(Promise.resolve(participantFixtures))
    assert.pass('setup OK')
    assert.end()
  })

  await participantTest.test('create false participant', async (assert) => {
    const falseParticipant = {name: 'fsp3'}
    Model.create.withArgs(falseParticipant).throws(new Error())
    try {
      await Service.create(falseParticipant)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('create participant', async (assert) => {
    try {
      for (let [index, participant] of participantMap) {
        var result = await Service.create({ name: participant.name, currency: participant.currency })
        assert.comment(`Testing with participant \n ${JSON.stringify(participant, null, 2)}`)
        assert.ok(Sinon.match(result, index + 1), ` returns ${result}`)
      }
      assert.end()
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('get with empty name', async (assert) => {
    Model.getByName.withArgs('').throws(new Error())
    try {
      Service.getByName('')
      assert.fail(' should throws with empty name ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('getByName', async (assert) => {
    try {
      assert.plan(Object.keys(participantFixtures[0]).length * participantFixtures.length)
      participantFixtures.forEach(participant => {
        var result = Service.getByName(participant.name)
        assert.equal(result.name, participant.name, ' names are equal')
        assert.equal(result.currency, participant.currency, ' currencies match')
        assert.equal(result.isDisabled, participant.isDisabled, ' isDisabled flag match')
        assert.ok(Sinon.match(result.createdDate, participant.createdDate), ' created date matches')
      })
      assert.end()
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getAll', async (assert) => {
    try {
      var result = await Service.getAll()
      assert.deepEqual(result, participantFixtures)
      assert.end()
    } catch (err) {
      Logger.error(`get all participants failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getById', async (assert) => {
    try {
      for (let participantId of participantMap.keys()) {
        let participant = await Service.getById(participantId)
        assert.equal(JSON.stringify(participant), JSON.stringify(participantMap.get(participantId + 1)))
      }
      assert.end()
    } catch (err) {
      Logger.error(`get participant by Id failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('update', async (assert) => {
    try {
      for (let participant of participantMap.values()) {
        let updated = await Service.update(participant.name, {is_disabled: 1})
        assert.equal(updated, participant)
      }
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`update participant failed with error - ${err}`)
      sandbox.restore()
      assert.fail()
      assert.end()
    }
  })
})
