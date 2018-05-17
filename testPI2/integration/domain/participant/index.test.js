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

const Test = require('tape')
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../../src/lib/config')
const Model = require('../../../../src/domain/participant/model')
const Service = require('../../../../src/domain/participant/index')

Test('Participant service', async (participantTest) => {
  let sandbox

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
    try {
      sandbox = Sinon.sandbox.create()
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
        let result = await Service.create({name: participant.name, currency: participant.currency})
        let read = await Service.getById(result)
        participantMap.set(result, read)
        assert.comment(`Testing with participant \n ${JSON.stringify(participant, null, 2)}`)
        assert.equal(read.name, participant.name, ' names are equal')
        assert.equal(read.currencyId, participant.currency, ' currency match')
        assert.equal(read.isDisabled, participant.isDisabled, ' isDisabled flag match')
        assert.ok(Sinon.match(read.createdDate, participant.createdDate), ' created date matches')
      })
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('create participant without currency should throw error', async (assert) => {
    try {
      assert.plan(1)
      await Service.create({name: 'fsp3'})
    } catch (err) {
      Logger.error('create participant without currency is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
    }
  })

  await participantTest.test('getByName', async (assert) => {
    try {
      assert.plan(Object.keys(participantFixtures[0]).length * participantFixtures.length)
      participantFixtures.forEach(async participant => {
        try {
          var result = await Service.getByName(participant.name)
          assert.equal(result.name, participant.name, ' names are equal')
          assert.equal(result.currencyId, participant.currency, ' currencies match')
          assert.equal(result.isDisabled, participant.isDisabled, ' isDisabled flag match')
          assert.ok(Sinon.match(result.createdDate, participant.createdDate), ' created date matches')
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
      assert.ok(result, ' returns result')
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
        let participant = await Service.update(participantMap.get(participantId).name, { is_disabled: 1 })
        let p = await Service.getById(participant.participantId)
        assert.equal(participant.participantId, p.participantId, ' ids match')
        assert.equal(p.isDisabled, 1, 'update is real')
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
      participantFixtures.forEach(async (participant) => {
        await Model.destroyByName(participant)
      })
      await Db.disconnect()
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`teardown failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })
})
