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

// TODO rework

'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
// const Config = require('../../../../src/lib/config')
const Model = require('../../../../src/domain/participant/model')

Test('Participant service', async (participantTest) => {
  let sandbox

  participantTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()

    Db.participant = {
      insert: sandbox.stub(),
      update: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub()
    }
  })

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

  participantTest.test('setup', async (assert) => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Model, 'create')
    sandbox.stub(Model, 'getByName')
    sandbox.stub(Model, 'getAll')
    sandbox.stub(Model, 'getById')
    sandbox.stub(Model, 'update')
    participantFixtures.forEach((participant, index) => {
      Model.create.withArgs(participant).returns(index)
      Model.getByName.withArgs(participant.name).returns(participant)
      Model.getById.withArgs(index).returns(participant)
      Model.update.withArgs(participant, true).returns(index)
    })
    Model.getAll.returns(participantFixtures)
    assert.pass('setup OK')
    assert.end()
  })

  participantTest.test('create false participant', (assert) => {
    const falseParticipant = {name: 'fsp3'}
    Model.create.withArgs(falseParticipant).throws(new Error())
    try {
      Model.create(falseParticipant)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  participantTest.test('create participant', (assert) => {
    try {
      assert.plan(participantFixtures.length)
      participantFixtures.forEach((participant, index) => {
        var result = Model.create(participant)
        participantMap.set(result, participant)
        assert.comment(`Testing with participant \n ${JSON.stringify(participant, null, 2)}`)
        assert.ok(Sinon.match(result, index), ` returns ${result}`)
      })
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  participantTest.test('get with empty name', (assert) => {
    Model.getByName.withArgs('').throws(new Error())
    try {
      Model.getByName('')
      assert.fail(' should throws with empty name ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  participantTest.test('getByName', (assert) => {
    try {
      assert.plan(Object.keys(participantFixtures[0]).length * participantFixtures.length)
      participantFixtures.forEach(participant => {
        var result = Model.getByName(participant.name)
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

  participantTest.test('getAll', (assert) => {
    try {
      var result = Model.getAll()
      assert.deepEqual(result, participantFixtures)
      assert.end()
    } catch (err) {
      Logger.error(`get all participants failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  participantTest.test('getById', (assert) => {
    try {
      for (let participantId of participantMap.keys()) {
        let participant = Model.getById(participantId)
        assert.equal(JSON.stringify(participant), JSON.stringify(participantMap.get(participantId)))
      }
      assert.end()
    } catch (err) {
      Logger.error(`get participant by Id failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  participantTest.test('update', (assert) => {
    try {
      for (let participantId of participantMap.keys()) {
        let updatedId = Model.update(participantMap.get(participantId), true)
        assert.equal(updatedId, participantId)
      }
      assert.end()
    } catch (err) {
      Logger.error(`update participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })
})
