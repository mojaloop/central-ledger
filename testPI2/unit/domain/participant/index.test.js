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

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
const ParticipantModel = require('../../../../src/models/participant/participant')
const ParticipantCurrencyModel = require('../../../../src/models/participant/participantCurrency')
const ParticipantFacade = require('../../../../src/models/participant/facade')

const Service = require('../../../../src/domain/participant/index')

Test('Participant service', async (participantTest) => {
  let sandbox
  const participantFixtures = [
    {
      participantId: 0,
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date()
    },
    {
      participantId: 1,
      name: 'fsp2',
      currency: 'EUR',
      isActive: 1,
      createdDate: new Date()
    }
  ]
  const participantResult = [
    {
      participantId: 0,
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date(),
      currencyList: 'USD'
    },
    {
      participantId: 1,
      name: 'fsp2',
      currency: 'EUR',
      isActive: 1,
      createdDate: new Date(),
      currencyList: 'EUR'
    }
  ]
  const participantCurrencyResult = [
    {
      participantCurrancyId: 0,
      participantId: 0,
      currencyId: 'USD',
      isActive: 1
    },
    {
      participantCurrancyId: 1,
      participantId: 1,
      currencyId: 'EUR',
      isActive: 1
    }
  ]

  const endpoints = [
    {
      participantEndpointId: 1,
      participantId: 0,
      endpointTypeId: 1,
      value: 'http://localhost:3001/participants/dfsp1/notification1',
      isActive: 1,
      createdDate: '2018-07-11',
      createdBy: 'unknown',
      name: 'FSIOP_CALLBACK_URL'
    },
    {
      participantEndpointId: 2,
      participantId: 0,
      endpointTypeId: 2,
      value: 'http://localhost:3001/participants/dfsp1/notification2',
      isActive: 1,
      createdDate: '2018-07-11',
      createdBy: 'unknown',
      name: 'ALARM_NOTIFICATION_URL'
    }
  ]

  let participantMap = new Map()

  participantTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(ParticipantModel, 'create')
    sandbox.stub(ParticipantModel, 'getByName')
    sandbox.stub(ParticipantModel, 'getAll')
    sandbox.stub(ParticipantModel, 'getById')
    sandbox.stub(ParticipantModel, 'update')
    sandbox.stub(ParticipantModel, 'destroyByName')
    sandbox.stub(ParticipantModel, 'destroyPariticpantEndpointByParticipantId')

    sandbox.stub(ParticipantCurrencyModel, 'create')
    sandbox.stub(ParticipantCurrencyModel, 'getByParticipantId')
    sandbox.stub(ParticipantCurrencyModel, 'getById')
    sandbox.stub(ParticipantCurrencyModel, 'destroyByParticipantId')

    sandbox.stub(ParticipantFacade, 'getEndpoint')
    sandbox.stub(ParticipantFacade, 'getAllEndpoints')
    sandbox.stub(ParticipantFacade, 'addEndpoint')

    Db.participant = {
      insert: sandbox.stub(),
      update: sandbox.stub(),
      findOne: sandbox.stub(),
      destroy: sandbox.stub()
    }

    Db.participantCurrency = {
      insert: sandbox.stub(),
      update: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      destroy: sandbox.stub()
    }

    participantFixtures.forEach((participant, index) => {
      participantMap.set(index + 1, participantResult[index])
      Db.participant.insert.withArgs({ participant }).returns(index)
      ParticipantModel.create.withArgs({ name: participant.name }).returns((index + 1))
      ParticipantModel.getByName.withArgs(participant.name).returns(participantResult[index])
      ParticipantModel.getById.withArgs(index).returns(participantResult[index])
      ParticipantModel.update.withArgs(participant, 1).returns((index + 1))
      ParticipantCurrencyModel.create.withArgs({ participantId: index, currencyId: participant.currency }).returns((index + 1))
      ParticipantCurrencyModel.getById.withArgs(index).returns({
        participantCurrancyId: participant.participantId,
        participantId: participant.participantId,
        currencyId: participant.currency,
        isActive: 1
      })
      ParticipantCurrencyModel.getByParticipantId.withArgs(participant.participantId).returns(participant.currency)
      ParticipantModel.destroyByName.withArgs(participant.name).returns(Promise.resolve(true))
      ParticipantCurrencyModel.destroyByParticipantId.withArgs(participant.participantId).returns(Promise.resolve(true))
      Db.participant.destroy.withArgs({ name: participant.name }).returns(Promise.resolve(true))
    })
    ParticipantModel.getAll.returns(Promise.resolve(participantResult))
    t.end()
  })

  participantTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await participantTest.test('create false participant', async (assert) => {
    const falseParticipant = { name: 'fsp3' }
    ParticipantModel.create.withArgs(falseParticipant).throws(new Error())
    try {
      await Service.create(falseParticipant)
      assert.fail('should throw')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('create participant', async (assert) => {
    try {
      for (let [index, participant] of participantMap) {
        var result = await Service.create({ name: participant.name })
        assert.comment(`Testing with participant \n ${JSON.stringify(participant, null, 2)}`)
        assert.ok(Sinon.match(result, index + 1), `returns ${result}`)
      }
      assert.end()
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('get with empty name', async (assert) => {
    ParticipantModel.getByName.withArgs('').throws(new Error())
    try {
      await Service.getByName('')
      assert.fail('should throws with empty name ')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('getByName', async (assert) => {
    try {
      // assert.plan(Object.keys(participantFixtures[0]).length * participantFixtures.length)
      participantFixtures.forEach(async participant => {
        var result = await Service.getByName(participant.name)
        assert.equal(result.participantId, participant.participantId, 'participantIds are equal')
        assert.equal(result.name, participant.name, 'names are equal')
        assert.equal(result.currency, participant.currency, 'currencies match')
        assert.equal(result.isActive, participant.isActive, 'isActive flag match')
        assert.equal(result.currencyList, participantMap.get(participant.participantId + 1).currencyList, 'currencyList match')
        assert.ok(Sinon.match(result.createdDate, participant.createdDate), 'created date matches')
      })
      assert.end()
    } catch (err) {
      Logger.error(`getByName failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getAll', async (assert) => {
    try {
      var result = await Service.getAll()
      assert.deepEqual(result, participantResult)
      assert.end()
    } catch (err) {
      Logger.error(`get all participants failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getAll should throw an error', async (assert) => {
    try {
      ParticipantModel.getAll.throws(new Error())
      await Service.getAll()
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      Logger.error(`get all participants failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await participantTest.test('getById', async (assert) => {
    try {
      participantFixtures.forEach(async (participantX, index) => {
        let participant = await Service.getById(index)
        assert.equal(JSON.stringify(participant), JSON.stringify(participantMap.get(index + 1)))
      })
      assert.end()
    } catch (err) {
      Logger.error(`get participant by Id failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('update', async (assert) => {
    try {
      participantFixtures.forEach(async (participant, index) => {
        let updated = await Service.update(participant.name, { isActive: 1 })
        assert.equal(JSON.stringify(updated), JSON.stringify(participantMap.get(index + 1)))
      })
      //  sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`update participant failed with error - ${err}`)
      sandbox.restore()
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('update should throw an error', async (assert) => {
    ParticipantModel.getByName.withArgs(participantFixtures[0].name).throws(new Error())
    try {
      await Service.update(participantFixtures[0].name, { isActive: 1 })
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      Logger.error(`update participant failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await participantTest.test('createParticipantCurrency should create the currency', async (assert) => {
    try {
      participantFixtures.forEach(async (participant, index) => {
        var result = await Service.createParticipantCurrency({ participantId: participant.participantId, currencyId: participant.currency })
        assert.comment(`Testing with participant \n ${JSON.stringify(participant, null, 2)}`)
        assert.ok(Sinon.match(result, index + 1), `returns ${result}`)
      })
      assert.end()
    } catch (err) {
      Logger.error(`createParticipantCurrency failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('createParticipantCurrency with false participant should fail', async (assert) => {
    const falseParticipant = { name: 'fsp3', participantId: 3, currency: 'FAKE' }
    ParticipantCurrencyModel.create.withArgs({ participantId: falseParticipant.participantId, currencyId: falseParticipant.currency }).throws(new Error())
    try {
      await Service.createParticipantCurrency({ participantId: falseParticipant.participantId, currencyId: falseParticipant.currency })
      assert.fail('should throw')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('getParticipantCurrencyById should return the currency', async (assert) => {
    try {
      participantFixtures.forEach(async (participant, index) => {
        var result = await Service.getParticipantCurrencyById(index)
        assert.deepEqual(result, participantCurrencyResult[index])
      })
      assert.end()
    } catch (err) {
      Logger.error(`getParticipantCurrencyById failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getParticipantCurrencyById with false participant should fail', async (assert) => {
    const falseParticipant = { name: 'fsp3', participantId: 3, currency: 'FAKE' }
    ParticipantCurrencyModel.getById.withArgs(falseParticipant.currency).throws(new Error())
    try {
      await Service.getParticipantCurrencyById(falseParticipant.currency)
      assert.fail('should throw')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('destroyByName', async (assert) => {
    try {
      participantFixtures.forEach(async (participant, index) => {
        var result = await Service.destroyByName(participant.name)
        assert.comment(`Testing with participant \n ${JSON.stringify(participant, null, 2)}`)
        assert.equal(result, true, `equals ${result}`)
      })
      assert.end()
    } catch (err) {
      Logger.error(`destroy participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('destroyByName should throw an error', async (assert) => {
    try {
      const falseParticipant = { name: 'fsp3', participantId: 3, currency: 'FAKE' }
      ParticipantModel.getByName.withArgs(falseParticipant.name).returns(falseParticipant)
      ParticipantModel.destroyByName.withArgs(falseParticipant.name).throws(new Error())
      await Service.destroyByName(falseParticipant.name)
      assert.fail('should throw')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err}`)
    }
    assert.end()
  })

  await participantTest.test('getEndpoint', async (assert) => {
    try {
      const endpoint = {
        type: 'FSIOP_CALLBACK_URL',
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }
      ParticipantModel.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

      ParticipantFacade.getEndpoint.withArgs(participantFixtures[0].participantId, endpoint.type).returns([endpoints[0]])
      const result = await Service.getEndpoint(participantFixtures[0].name, endpoint.type)
      assert.deepEqual(result[0], endpoints[0], 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`get endpoint failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getEndpoint should fail if no endpoints found', async (assert) => {
    const endpoint = {
      type: 'FSIOP_CALLBACK_URL',
      value: 'http://localhost:3001/participants/dfsp1/notification1'
    }
    ParticipantModel.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

    ParticipantFacade.getEndpoint.withArgs(participantFixtures[0].participantId, endpoint.type).returns(null)

    try {
      await Service.getEndpoint(participantFixtures[0], endpoint.type)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('getAllEndpoints', async (assert) => {
    try {
      ParticipantModel.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

      ParticipantFacade.getAllEndpoints.withArgs(participantFixtures[0].participantId).returns(endpoints)
      const result = await Service.getAllEndpoints(participantFixtures[0].name)
      assert.deepEqual(result, endpoints, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`getAllEndpoints failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getAllEndpoints should throw error', async (assert) => {
    ParticipantModel.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

    ParticipantFacade.getAllEndpoints.withArgs(participantFixtures[0].participantId).throws(new Error())

    try {
      await Service.getAllEndpoints(participantFixtures[0].name)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('addEndpoint', async (assert) => {
    try {
      const payload = {
        type: 'FSIOP_CALLBACK_URL',
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }
      ParticipantModel.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

      ParticipantFacade.addEndpoint.withArgs(participantFixtures[0].participantId, payload).returns(1)
      const result = await Service.addEndpoint(participantFixtures[0].name, payload)
      assert.deepEqual(result, 1, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`addEndpoint failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('addEndpoint should fail if cant add endpoint', async (assert) => {
    const payload = {
      type: 'FSIOP_CALLBACK_URL',
      value: 'http://localhost:3001/participants/dfsp1/notification1'
    }
    ParticipantModel.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

    ParticipantFacade.addEndpoint.withArgs(participantFixtures[0].participantId, payload).throws(new Error())

    try {
      await Service.addEndpoint(participantFixtures[0].name, payload)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('destroyPariticpantEndpointByName', async (assert) => {
    try {
      ParticipantModel.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

      ParticipantModel.destroyPariticpantEndpointByParticipantId.withArgs(participantFixtures[0].participantId).returns(true)
      const result = await Service.destroyPariticpantEndpointByName(participantFixtures[0].name)
      assert.equal(result, true, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`destroyPariticpantEndpointByName failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('destroyPariticpantEndpointByName should fail', async (assert) => {
    ParticipantModel.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

    ParticipantModel.destroyPariticpantEndpointByParticipantId.withArgs(participantFixtures[0].participantId).throws(new Error())

    try {
      await Service.destroyPariticpantEndpointByName(participantFixtures[0].name)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.end()
})
