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

const Test = require('tape')
const Sinon = require('sinon')
const Db = require('../../../../src/db')
const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../../src/lib/config')
const Service = require('../../../../src/domain/participant')

Test('Participant service', async (participantTest) => {
  let sandbox

  const participantFixtures = [
    {
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date()
    },
    {
      name: 'fsp2',
      currency: 'EUR',
      isActive: 1,
      createdDate: new Date()
    }
  ]

  const endpointsFixtures = [
    {
      name: 'fsp1',
      payload: {
        type: 'FSIOP_CALLBACK_URL',
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }
    },
    {
      name: 'fsp1',
      payload: {
        type: 'ALARM_NOTIFICATION_URL',
        value: 'http://localhost:3001/participants/dfsp1/notification2'
      }
    }
  ]

  let participantMap = new Map()

  await participantTest.test('setup', async (assert) => {
    try {
      sandbox = Sinon.createSandbox()
      await Db.connect(Config.DATABASE_URI).then(() => {
        assert.pass('setup OK')
        assert.end()
      }).catch(err => {
        Logger.error(`Setup for test failed with error - ${err}`)
        assert.fail()
        assert.end()
      })
    } catch (err) {
      Logger.error(`Setup for test failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('create participant', async (assert) => {
    try {
      assert.plan(Object.keys(participantFixtures[0]).length * participantFixtures.length)
      participantFixtures.forEach(async participant => {
        let result = await Service.create({ name: participant.name })
        await Service.createParticipantCurrency(result, participant.currency)
        let read = await Service.getById(result)
        participantMap.set(result, read)
        assert.comment(`Testing with participant \n ${JSON.stringify(participant, null, 2)}`)
        assert.equal(read.name, participant.name, 'names are equal')
        assert.equal(read.currencyList[0].currencyId, participant.currency, 'currency match')
        assert.equal(read.isActive, participant.isActive, 'isActive flag matches')
        assert.ok(Sinon.match(read.createdDate, participant.createdDate), 'created date matches')
      })
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getByName', async (assert) => {
    try {
      assert.plan(Object.keys(participantFixtures[0]).length * participantFixtures.length)
      participantFixtures.forEach(async participant => {
        try {
          var result = await Service.getByName(participant.name)
          assert.equal(result.name, participant.name, 'names are equal')
          assert.equal(result.currencyList[0].currencyId, participant.currency, 'currencies match')
          assert.equal(result.isDisabled, participant.isDisabled, 'isActive flag matches')
          assert.ok(Sinon.match(result.createdDate, participant.createdDate), 'created date matches')
        } catch (err) {
          Logger.error(`get participant by name failed with error - ${err}`)
          assert.fail()
          assert.end()
        }
      })
    } catch (err) {
      Logger.error(`get participant by name failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getAll', async (assert) => {
    try {
      let result = await Service.getAll()
      assert.ok(result, 'returns result')
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
        assert.equal(JSON.stringify(participant), JSON.stringify(participantMap.get(participantId)))
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
      for (let participantId of participantMap.keys()) {
        let participant = await Service.update(participantMap.get(participantId).name, { isActive: 0 })
        let p = await Service.getById(participant.participantId)
        assert.equal(participant.participantId, p.participantId, 'ids match')
        assert.equal(p.isActive, 0, 'update works')
      }
      assert.end()
    } catch (err) {
      Logger.error(`update participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('add participant endpoint', async (assert) => {
    try {
      for (const fixture of endpointsFixtures) {
        let result = await Service.addEndpoint(fixture.name, fixture.payload)
        assert.ok(result, `addEndpoint successful for Participant: ${fixture.name}`)
      }
      assert.end()
    } catch (err) {
      Logger.error(`add participant endpoint failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getEndpoint', async (assert) => {
    try {
      const participant = {
        participantId: 1,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date()
      }
      const endpoint = {
        value: 'http://localhost:3001/participants/dfsp1/notification1',
        isActive: 1,
        name: 'FSIOP_CALLBACK_URL'
      }
      var result = await Service.getEndpoint(participant.name, endpoint.name)
      assert.equal(result[0].name, endpoint.name, 'endpoint types are equal')
      assert.equal(result[0].value, endpoint.value, 'endpoint values match')
      assert.equal(result[0].isActive, endpoint.isActive, 'isActive flag match')
      assert.end()
    } catch (err) {
      Logger.error(`get endpoint failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getAllEndpoints', async (assert) => {
    try {
      const participant = {
        participantId: 1,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date()
      }
      const endpoint = [
        {
          value: 'http://localhost:3001/participants/dfsp1/notification1',
          isActive: 1,
          name: 'FSIOP_CALLBACK_URL'
        },
        {
          value: 'http://localhost:3001/participants/dfsp1/notification2',
          isActive: 1,
          name: 'ALARM_NOTIFICATION_URL'
        }
      ]

      var result = await Service.getAllEndpoints(participant.name)
      assert.comment('First endpoint')
      assert.equal(result[0].name, endpoint[0].name, 'endpoint types are equal')
      assert.equal(result[0].value, endpoint[0].value, 'endpoint values match')
      assert.equal(result[0].isActive, endpoint[0].isActive, 'isActive flag match')

      assert.comment('Second endpoint')
      assert.equal(result[1].name, endpoint[1].name, 'endpoint types are equal')
      assert.equal(result[1].value, endpoint[1].value, 'endpoint values match')
      assert.equal(result[1].isActive, endpoint[1].isActive, 'isActive flag match')

      assert.end()
    } catch (err) {
      Logger.error(`getAllEndpoints failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('destroyPariticpantEndpointByName', async (assert) => {
    try {
      const result = await Service.destroyPariticpantEndpointByName(participantFixtures[0].name)
      assert.ok(result, `destroy endpoint for ${participantFixtures[0].name} success`)
      assert.end()
    } catch (err) {
      Logger.error(`destroyPariticpantEndpointByName failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('teardown', async (assert) => {
    try {
      for (let participant of participantFixtures) {
        const result = await Service.destroyByName(participant.name)
        assert.ok(result, `destroy ${participant.name} success`)
      }
      await Db.disconnect()
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`teardown failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.end()
})
