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

const Test = require('tape')
const Sinon = require('sinon')
const Db = require('../../../../src/db')
const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../../src/lib/config')
const Service = require('../../../../src/domain/participant')
const ParticipantHelper = require('../../helpers/participant')
const ParticipantEndpointHelper = require('../../helpers/participantEndpoint')
const ParticipantLimitHelper = require('../../helpers/participantLimit')

Test('Participant service', async (participantTest) => {
  let sandbox
  let participantFixtures = []
  let endpointsFixtures = []
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
      let result = await ParticipantHelper.prepareData('fsp1')
      participantFixtures.push(result.participant)
      result = await ParticipantHelper.prepareData('fsp2')
      participantFixtures.push(result.participant)
      participantFixtures.forEach(async participant => {
        let read = await Service.getById(participant.participantId)
        participantMap.set(participant.participantId, read)
        assert.comment(`Testing with participant \n ${JSON.stringify(participant, null, 2)}`)
        assert.equal(read.name, participant.name, 'names are equal')
        assert.deepEqual(read.currencyList, participant.currencyList, 'currency match')
        assert.equal(read.isActive, participant.isActive, 'isActive flag matches')
        assert.ok(Sinon.match(read.createdDate, participant.createdDate), 'created date matches')
      })
      assert.end()
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getByName', async (assert) => {
    try {
      participantFixtures.forEach(async participant => {
        let result = await Service.getByName(participant.name)
        assert.equal(result.name, participant.name, 'names are equal')
        assert.deepEqual(result.currencyList, participant.currencyList, 'currencies match')
        assert.equal(result.isActive, participant.isActive, 'isActive flag matches')
        assert.ok(Sinon.match(result.createdDate, participant.createdDate), 'created date matches')
      })
      assert.end()
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

  await participantTest.test('add participant endpoint', async (assert) => {
    try {
      const participant = participantFixtures[0]
      let result = await ParticipantEndpointHelper.prepareData(participant.name, 'FSIOP_CALLBACK_URL')
      endpointsFixtures.push(result)
      result = await ParticipantEndpointHelper.prepareData(participant.name, 'ALARM_NOTIFICATION_URL')
      endpointsFixtures.push(result)
      endpointsFixtures.forEach(async endpoint => {
        let read = await Service.getEndpoint(participant.name, endpoint.type)
        assert.equal(read[0].name, endpoint.type, 'endpoint types are equal')
        assert.equal(read[0].value, endpoint.value, 'endpoint values match')
      })
      assert.end()
    } catch (err) {
      console.log(err)
      Logger.error(`add participant endpoint failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getEndpoint', async (assert) => {
    try {
      endpointsFixtures.forEach(async endpoint => {
        let result = await Service.getEndpoint(participantFixtures[0].name, endpoint.type)
        assert.equal(result[0].name, endpoint.type, 'endpoint types are equal')
        assert.equal(result[0].value, endpoint.value, 'endpoint values match')
        assert.equal(result[0].isActive, 1, 'isActive flag match')
      })
      assert.end()
    } catch (err) {
      Logger.error(`get endpoint failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getAllEndpoints', async (assert) => {
    try {
      const result = await Service.getAllEndpoints(participantFixtures[0].name)
      assert.comment('First endpoint')
      assert.equal(result[0].name, endpointsFixtures[0].type, 'endpoint types are equal')
      assert.equal(result[0].value, endpointsFixtures[0].value, 'endpoint values match')
      assert.equal(result[0].isActive, 1, 'isActive flag match')

      assert.comment('Second endpoint')
      assert.equal(result[1].name, endpointsFixtures[1].type, 'endpoint types are equal')
      assert.equal(result[1].value, endpointsFixtures[1].value, 'endpoint values match')
      assert.equal(result[1].isActive, 1, 'isActive flag match')

      assert.end()
    } catch (err) {
      Logger.error(`getAllEndpoints failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('destroyPariticpantEndpointByName', async (assert) => {
    try {
      const result = await ParticipantEndpointHelper.deletePreparedData(participantFixtures[0].name)
      assert.ok(result, `destroy endpoint for ${participantFixtures[0].name} success`)
      assert.end()
    } catch (err) {
      Logger.error(`destroyPariticpantEndpointByName failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('add participant limit and initial position', async (assert) => {
    try {
      let result = await ParticipantLimitHelper.prepareLimitAndInitialPosition(participantFixtures[0].name, { limit: { value: 30 } })
      assert.ok(result, `addLimitAndInitialPosition successful for Participant: ${participantFixtures[0].name}`)
      assert.end()
    } catch (err) {
      console.log(err)
      Logger.error(`add participant limit and initial position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('update limits', async (assert) => {
    try {
      let result = await ParticipantLimitHelper.adjustLimits(participantFixtures[0].name, { limit: { value: 50 } })
      assert.ok(result, `adjustLimits successful for Participant: ${participantFixtures[0].name}`)
      assert.equal(result.participantLimit.value, 50, 'The limits updated successfully')
      assert.end()
    } catch (err) {
      console.log(err)
      Logger.error(`update participant limit failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('get participant position', async (assert) => {
    try {
      const result = await Service.getPositions(participantFixtures[0].name, participantFixtures[0].currencyList[0].currencyId)
      assert.equal(result[0].currency, participantFixtures[0].currencyList[0].currencyId, 'currencies are equal')
      assert.equal(result[0].value, 0, 'position value match')
      assert.end()
    } catch (err) {
      Logger.error(`get positions failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('destroy participant position', async (assert) => {
    try {
      const result = await ParticipantLimitHelper.deleteInitialPositionData(participantFixtures[0].name)
      assert.ok(result, `destroy participant position for ${participantFixtures[0].name} success`)
      assert.end()
    } catch (err) {
      Logger.error(`destroy participant position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('destroy participant limits', async (assert) => {
    try {
      const result = await ParticipantLimitHelper.deleteInitialLimitData(participantFixtures[0].name)
      assert.ok(result, `destroy participant limits for ${participantFixtures[0].name} success`)
      assert.end()
    } catch (err) {
      Logger.error(`destroy participant limits failed with error - ${err}`)
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

  await participantTest.test('teardown', async (assert) => {
    try {
      for (let participant of participantFixtures) {
        const result = await ParticipantHelper.deletePreparedData(participant.name)
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

Test.onFinish(async () => {
  process.exit(0)
})
