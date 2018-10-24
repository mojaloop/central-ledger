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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
const ParticipantModel = require('../../../../src/models/participant/participant')
const ParticipantCurrencyModel = require('../../../../src/models/participant/participantCurrency')
const ParticipantPositionModel = require('../../../../src/models/participant/participantPosition')
const ParticipantLimitModel = require('../../../../src/models/participant/participantLimit')
const ParticipantFacade = require('../../../../src/models/participant/facade')
const PositionFacade = require('../../../../src/models/position/facade')
const P = require('bluebird')
const ParticipantPositionChangeModel = require('../../../../src/models/participant/participantPositionChange')
const Utility = require('../../../../src/handlers/lib/utility')

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
      name: 'FSPIOP_CALLBACK_URL_TRANSFER_POST'
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
    sandbox.stub(ParticipantFacade, 'getByNameAndCurrency')
    sandbox.stub(ParticipantFacade, 'adjustLimits')
    sandbox.stub(ParticipantFacade, 'getParticipantLimitsByCurrencyId')
    sandbox.stub(ParticipantFacade, 'getParticipantLimitsByParticipantId')
    sandbox.stub(ParticipantFacade, 'addLimitAndInitialPosition')
    sandbox.stub(ParticipantFacade, 'getAllAccountsByNameAndCurrency')

    sandbox.stub(ParticipantLimitModel, 'getByParticipantCurrencyId')
    sandbox.stub(ParticipantLimitModel, 'destroyByParticipantCurrencyId')
    sandbox.stub(ParticipantPositionModel, 'getByParticipantCurrencyId')
    sandbox.stub(ParticipantPositionModel, 'destroyByParticipantCurrencyId')

    sandbox.stub(ParticipantPositionChangeModel, 'getByParticipantPositionId')

    sandbox.stub(PositionFacade, 'getByNameAndCurrency')
    sandbox.stub(PositionFacade, 'getAllByNameAndCurrency')

    sandbox.stub(Utility, 'produceGeneralMessage')
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
      ParticipantCurrencyModel.getByParticipantId.withArgs(participant.participantId, 1).returns(participant.currency)
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

  await participantTest.test('getById with non-exisiting id should', async (assert) => {
    try {
      ParticipantModel.getById.withArgs(10).returns(Promise.resolve(null))
      let result = await Service.getById(10)
      assert.equal(result, null, 'return null')
      assert.end()
    } catch (err) {
      Logger.error(`get participant by Id failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getByName with non-exisiting name should', async (assert) => {
    try {
      ParticipantModel.getByName.withArgs('name').returns(Promise.resolve(null))
      let result = await Service.getByName('name')
      assert.equal(result, null, 'return null')
      assert.end()
    } catch (err) {
      Logger.error(`get participant by Id failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
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

  await participantTest.test('create false participant should throw error', async (assert) => {
    const falseParticipant = { name: 'fsp3' }
    ParticipantModel.create.withArgs(falseParticipant).returns(null)
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
        type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
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
      type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
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
        type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
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
      type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
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

  await participantTest.test('addLimitAndInitialPosition should add the initial position and limits', async (assert) => {
    try {
      const payload = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        },
        initialPosition: 0
      }
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      const settlementAccount = {
        participantCurrencyId: 2
      }
      ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, payload.currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, payload.currency, 2).returns(settlementAccount)
      ParticipantLimitModel.getByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(null)
      ParticipantPositionModel.getByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(null)
      ParticipantPositionModel.getByParticipantCurrencyId.withArgs(settlementAccount.participantCurrencyId).returns(null)
      ParticipantFacade.addLimitAndInitialPosition.withArgs(participant.participantCurrencyId, settlementAccount.participantCurrencyId, payload).returns(1)

      const result = await Service.addLimitAndInitialPosition(participant.name, payload)
      assert.deepEqual(result, 1, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`addLimitAndInitialPosition failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('addLimitAndInitialPosition should add the initial position from config and limits if initial position is not passed', async (assert) => {
    try {
      const payload = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        }
      }

      const limitPostionObj = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        },
        initialPosition: 0
      }
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      const settlementAccount = {
        participantCurrencyId: 2
      }
      ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, payload.currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, payload.currency, 2).returns(settlementAccount)
      ParticipantLimitModel.getByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(null)
      ParticipantPositionModel.getByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(null)
      ParticipantPositionModel.getByParticipantCurrencyId.withArgs(settlementAccount.participantCurrencyId).returns(null)
      ParticipantFacade.addLimitAndInitialPosition.withArgs(participant.participantCurrencyId, settlementAccount.participantCurrencyId, limitPostionObj).returns(1)

      const result = await Service.addLimitAndInitialPosition(participant.name, payload)
      assert.deepEqual(result, 1, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`addLimitAndInitialPosition failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('addLimitAndInitialPosition should fail if participant and currency not found', async (assert) => {
    const payload = {
      currency: 'USD',
      limit: {
        type: 'NET_DEBIT_CAP',
        value: 10000000
      },
      initialPosition: 0
    }
    const participant = {
      participantId: 0,
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date(),
      participantCurrencyId: 1
    }
    ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, payload.currency, 1).throws(new Error())

    try {
      await Service.addLimitAndInitialPosition(participant.name, payload)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('addLimitAndInitialPosition should fail if cant add initial position and limit', async (assert) => {
    const payload = {
      currency: 'USD',
      limit: {
        type: 'NET_DEBIT_CAP',
        value: 10000000
      },
      initialPosition: 0
    }
    const participant = {
      participantId: 0,
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date(),
      participantCurrencyId: 1
    }
    ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, payload.currency, 1).returns(participant)
    ParticipantLimitModel.getByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(null)
    ParticipantPositionModel.getByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(null)
    ParticipantFacade.addLimitAndInitialPosition.withArgs(participant.participantCurrencyId, payload).throws(new Error())

    try {
      await Service.addLimitAndInitialPosition(participant.name, payload)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('addLimitAndInitialPosition should fail if initial position already exists', async (assert) => {
    const payload = {
      currency: 'USD',
      limit: {
        type: 'NET_DEBIT_CAP',
        value: 10000000
      },
      initialPosition: 0
    }
    const participant = {
      participantId: 0,
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date(),
      participantCurrencyId: 1
    }
    const participantPosition = {
      participantPositionId: 1,
      participantCurrencyId: 1,
      value: 0.0,
      reservedValue: 0.0,
      changedDate: new Date()
    }
    ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, payload.currency, 1).returns(participant)
    ParticipantLimitModel.getByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(null)
    ParticipantPositionModel.getByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(participantPosition)
    ParticipantFacade.addLimitAndInitialPosition.withArgs(participant.participantCurrencyId, payload).returns(1)

    try {
      await Service.addLimitAndInitialPosition(participant.name, payload)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('addLimitAndInitialPosition should fail if participant limit already exists', async (assert) => {
    const payload = {
      currency: 'USD',
      limit: {
        type: 'NET_DEBIT_CAP',
        value: 10000000
      },
      initialPosition: 0
    }
    const participant = {
      participantId: 0,
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date(),
      participantCurrencyId: 1
    }
    const participantLimit = {
      participantLimitId: 1,
      participantCurrencyId: 1,
      participantLimitTypeId: 1,
      value: 1000000.00,
      thresholdAlarmPercentage: 10.0,
      startAfterParticipantPositionChangeId: null,
      isActive: 1,
      createdDate: new Date(),
      createdBy: 'unknown'
    }
    ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, payload.currency, 1).returns(participant)
    ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, payload.currency, 2).returns(participant)
    ParticipantLimitModel.getByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(participantLimit)
    ParticipantPositionModel.getByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(null)
    ParticipantFacade.addLimitAndInitialPosition.withArgs(participant.participantCurrencyId, payload).returns(1)

    try {
      await Service.addLimitAndInitialPosition(participant.name, payload)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('destroyParticipantPositionByNameAndCurrency should delete the position for participant and currency', async (assert) => {
    try {
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, participant.currency, 1).returns(participant)
      ParticipantPositionModel.destroyByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(1)

      const result = await Service.destroyParticipantPositionByNameAndCurrency(participant.name, participant.currency, 1)
      assert.equal(result, 1, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`destroyParticipantPositionByNameAndCurrency failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('destroyParticipantPositionByNameAndCurrency should throw error', async (assert) => {
    const participant = {
      participantId: 0,
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date(),
      participantCurrencyId: 1
    }
    ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, participant.currency, 1).returns(participant)
    ParticipantPositionModel.destroyByParticipantCurrencyId.withArgs(participant.participantCurrencyId).throws(new Error())
    try {
      await Service.destroyParticipantPositionByNameAndCurrency(participant.name, participant.currency, 1)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('destroyParticipantLimitByNameAndCurrency should delete the limits for participant and currency', async (assert) => {
    try {
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, participant.currency, 1).returns(participant)
      ParticipantLimitModel.destroyByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(1)

      const result = await Service.destroyParticipantLimitByNameAndCurrency(participant.name, participant.currency, 1)
      assert.equal(result, 1, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`destroyParticipantLimitByNameAndCurrency failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('destroyParticipantLimitByNameAndCurrency should throw error', async (assert) => {
    const participant = {
      participantId: 0,
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date(),
      participantCurrencyId: 1
    }
    ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, participant.currency, 1).returns(participant)
    ParticipantLimitModel.destroyByParticipantCurrencyId.withArgs(participant.participantCurrencyId).throws(new Error())
    try {
      await Service.destroyParticipantLimitByNameAndCurrency(participant.name, participant.currency, 1)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('getPositionByParticipantCurrencyId', async (assert) => {
    const participant = {
      participantId: 0,
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date(),
      participantCurrencyId: 1
    }
    const participantPosition = {
      participantPositionId: 1,
      participantCurrencyId: 1,
      value: 0.0,
      reservedValue: 0.0,
      changedDate: new Date()
    }

    ParticipantPositionModel.getByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(participantPosition)
    try {
      const result = await Service.getPositionByParticipantCurrencyId(participant.participantCurrencyId)
      assert.equal(result, participantPosition, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`getPositionByParticipantCurrencyId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getPositionByParticipantCurrencyId should throw error', async (assert) => {
    const participant = {
      participantId: 0,
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date(),
      participantCurrencyId: 1
    }

    ParticipantPositionModel.getByParticipantCurrencyId.withArgs(participant.participantCurrencyId).throws(new Error())
    try {
      await Service.getPositionByParticipantCurrencyId(participant.participantCurrencyId)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('getPositionChangeByParticipantPositionId', async (assert) => {
    const participantPositionChange = {
      participantPositionId: 1,
      participantPositionChangeId: 1,
      transferStateChangeId: 1,
      value: 0.0,
      reservedValue: 0.0,
      changedDate: new Date()
    }

    ParticipantPositionChangeModel.getByParticipantPositionId.withArgs(1).returns(participantPositionChange)
    try {
      const result = await Service.getPositionChangeByParticipantPositionId(1)
      assert.equal(result, participantPositionChange, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`getPositionChangeByParticipantPositionId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getPositionChangeByParticipantPositionId should throw error', async (assert) => {
    ParticipantPositionChangeModel.getByParticipantPositionId.withArgs(1).throws(new Error())
    try {
      await Service.getPositionChangeByParticipantPositionId(1)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('adjustLimits should add/update the limit', async (assert) => {
    try {
      const payload = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        }
      }
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, payload.currency, 1).returns(participant)
      ParticipantFacade.adjustLimits.withArgs(participant.participantCurrencyId, payload.limit).returns(1)

      const result = await Service.adjustLimits(participant.name, payload)
      assert.deepEqual(result, 1, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`adjustLimits failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('adjustLimits should throw error', async (assert) => {
    const payload = {
      currency: 'USD',
      limit: {
        type: 'NET_DEBIT_CAP',
        value: 10000000
      }
    }
    const participant = {
      participantId: 0,
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date(),
      participantCurrencyId: 1
    }
    ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, payload.currency, 1).returns(participant)
    ParticipantFacade.adjustLimits.withArgs(participant.participantCurrencyId, payload.limit).throws(new Error())

    try {
      await Service.adjustLimits(participant.name, payload)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('getLimits', async (assert) => {
    try {
      const limit = [{
        currencyId: 'USD',
        name: 'NET_DEBIT_CAP',
        value: 1000000
      }]
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, participant.currency, 1).returns(participant)

      ParticipantFacade.getParticipantLimitsByCurrencyId.withArgs(participant.participantCurrencyId, limit[0].name).returns(P.resolve(limit))
      const result = await Service.getLimits(participant.name, { currency: participant.currency, type: limit[0].name })
      assert.deepEqual(result, limit, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`get limits failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getLimits should return the limits when type is not passed', async (assert) => {
    try {
      const limit = [{
        currencyId: 'USD',
        name: 'NET_DEBIT_CAP',
        value: 1000000
      }]
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, participant.currency, 1).returns(participant)

      ParticipantFacade.getParticipantLimitsByCurrencyId.withArgs(participant.participantCurrencyId).returns(P.resolve(limit))
      const result = await Service.getLimits(participant.name, { currency: participant.currency })
      assert.deepEqual(result, limit, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`get limits failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getLimits should return all the limits for the type when the currency is not passed', async (assert) => {
    try {
      const limit = [
        {
          currencyId: 'USD',
          name: 'NET_DEBIT_CAP',
          value: 1000000
        },
        {
          currencyId: 'EUR',
          name: 'NET_DEBIT_CAP',
          value: 3000000
        }
      ]
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrancyId: 1
      }
      ParticipantModel.getByName.withArgs(participant.name).returns(participant)

      ParticipantFacade.getParticipantLimitsByParticipantId.withArgs(participant.participantId, 'NET_DEBIT_CAP', 1).returns(P.resolve(limit))
      const result = await Service.getLimits(participant.name, { type: 'NET_DEBIT_CAP' })
      assert.deepEqual(result, limit, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`get limits failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getLimits should return all the limits when the currency or type is not passed', async (assert) => {
    try {
      const limit = [
        {
          currencyId: 'USD',
          name: 'NET_DEBIT_CAP',
          value: 1000000
        },
        {
          currencyId: 'EUR',
          name: 'NET_DEBIT_CAP',
          value: 3000000
        }
      ]
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrancyId: 1
      }
      ParticipantModel.getByName.withArgs(participant.name).returns(participant)

      ParticipantFacade.getParticipantLimitsByParticipantId.withArgs(participant.participantId, null, 1).returns(P.resolve(limit))
      const result = await Service.getLimits(participant.name, {})
      assert.deepEqual(result, limit, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`get limits failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getLimits should throw error', async (assert) => {
    const participant = {
      participantId: 0,
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date(),
      participantCurrancyId: 1
    }
    ParticipantModel.getByName.withArgs(participant.name).returns(participant)
    ParticipantFacade.getParticipantLimitsByParticipantId.withArgs(participant.participantId, null, 1).throws(new Error())
    try {
      await Service.getLimits(participant.name, {})
      assert.fail('should throw')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('getPositions should return the position for given participant name and currency', async (assert) => {
    try {
      const positionReturn = [
        {
          currencyId: 'USD',
          value: 1000,
          changedDate: '2018-08-14T04:01:55.000Z'
        }
      ]

      const expected = {
        currency: 'USD',
        value: 1000,
        changedDate: '2018-08-14T04:01:55.000Z'
      }
      const participantName = 'fsp1'
      const query = { currency: 'USD' }
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      ParticipantFacade.getByNameAndCurrency.withArgs(participantName, query.currency, 1).returns(participant)
      PositionFacade.getByNameAndCurrency.withArgs(participantName, 1, query.currency).returns(P.resolve(positionReturn))

      const result = await Service.getPositions(participantName, query)
      assert.deepEqual(result, expected, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`get position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getPositions should return the empty object is no position defined for the currency', async (assert) => {
    try {
      const positionReturn = []

      const expected = {}
      const participantName = 'fsp1'
      const query = { currency: 'USD' }
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      ParticipantFacade.getByNameAndCurrency.withArgs(participantName, query.currency, 1).returns(participant)
      PositionFacade.getByNameAndCurrency.withArgs(participantName, 1, query.currency).returns(P.resolve(positionReturn))

      const result = await Service.getPositions(participantName, query)
      assert.deepEqual(result, expected, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`get position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getPositions should return the position for given participant name and for all currencies', async (assert) => {
    try {
      const positionReturn = [
        {
          currencyId: 'USD',
          value: 1000,
          changedDate: '2018-08-14T04:01:55.000Z'
        },
        {
          currencyId: 'EUR',
          value: 2000,
          changedDate: '2018-08-14T04:01:55.000Z'
        }
      ]

      const expected = [
        {
          currency: 'USD',
          value: 1000,
          changedDate: '2018-08-14T04:01:55.000Z'
        },
        {
          currency: 'EUR',
          value: 2000,
          changedDate: '2018-08-14T04:01:55.000Z'
        }
      ]
      const participantName = 'fsp1'
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      ParticipantModel.getByName.withArgs(participantName).returns(participant)
      PositionFacade.getByNameAndCurrency.withArgs(participantName).returns(P.resolve(positionReturn))

      const result = await Service.getPositions(participantName, {})
      assert.deepEqual(result, expected, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`get position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getPositions should return [] if no positions exists and currency is not passed', async (assert) => {
    try {
      const positionReturn = []

      const expected = []
      const participantName = 'fsp1'
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      ParticipantModel.getByName.withArgs(participantName).returns(participant)
      PositionFacade.getByNameAndCurrency.withArgs(participantName).returns(P.resolve(positionReturn))

      const result = await Service.getPositions(participantName, {})
      assert.deepEqual(result, expected, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`get position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getPositions should throw error', async (assert) => {
    const participantName = 'fsp1'
    const query = { currency: 'USD' }

    PositionFacade.getByNameAndCurrency.withArgs(participantName).throws(new Error())
    try {
      await Service.getPositions(participantName, query)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('getAccounts should return the account balances for given participant name and currency', async (assert) => {
    try {
      const accountsMock = [
        {
          participantCurrencyId: 1,
          ledgerAccountType: 'POSITION',
          currencyId: 'USD',
          value: 0,
          reservedValue: 0,
          changedDate: '2018-10-11T11:45:00.000Z'
        },
        {
          participantCurrencyId: 2,
          ledgerAccountType: 'SETTLEMENT',
          currencyId: 'USD',
          value: 800,
          reservedValue: 0,
          changedDate: '2018-10-11T11:45:00.000Z'
        }
      ]
      const expected = [
        {
          id: 1,
          ledgerAccountType: 'POSITION',
          currency: 'USD',
          value: 0,
          reservedValue: 0,
          changedDate: '2018-10-11T11:45:00.000Z'
        },
        {
          id: 2,
          ledgerAccountType: 'SETTLEMENT',
          currency: 'USD',
          value: 800,
          reservedValue: 0,
          changedDate: '2018-10-11T11:45:00.000Z'
        }
      ]
      const participantName = 'fsp1'
      const query = { currency: 'USD' }
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }

      ParticipantModel.getByName.withArgs(participantName).returns(participant)
      PositionFacade.getAllByNameAndCurrency.withArgs(participantName, query.currency).returns(P.resolve(accountsMock))

      const result = await Service.getAccounts(participantName, query)
      assert.deepEqual(result, expected, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`get position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getAccounts should return [] if no positions exists and currency is not passed', async (assert) => {
    try {
      const positionReturn = []

      const expected = []
      const participantName = 'fsp1'
      const participant = {
        participantId: 0,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      ParticipantModel.getByName.withArgs(participantName).returns(participant)
      PositionFacade.getAllByNameAndCurrency.withArgs(participantName).returns(P.resolve(positionReturn))

      const result = await Service.getAccounts(participantName, {})
      assert.deepEqual(result, expected, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`get position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })
  await participantTest.test('getAccounts should throw error', async (assert) => {
    const participantName = 'fsp1'
    const query = { currency: 'USD' }

    PositionFacade.getAllByNameAndCurrency.withArgs(participantName).throws(new Error())
    try {
      await Service.getAccounts(participantName, query)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('recordFundsInOut should produce message to kafka topic if input is valid', async (assert) => {
    try {
      const payload = {
        transferId: 'a87fc534-ee48-7775-b6a9-ead2955b6413',
        externalReference: 'string',
        action: 'recordFundsIn',
        amount: {
          amount: 1.0000,
          currency: 'USD'
        },
        reason: 'Reason for in/out flow of funds',
        extensionList: {}
      }

      const params = {
        name: 'dfsp1',
        id: 1,
        transferId: 'a87fc534-ee48-7775-b6a9-ead2955b6413'
      }
      ParticipantFacade.getAllAccountsByNameAndCurrency.withArgs(params.name, payload.amount.currency).returns([{
        ledgerAccountType: 'SETTLEMENT',
        participantCurrencyId: 1
      }])
      ParticipantModel.getByName.withArgs(params.name).returns({
        participantId: 0,
        name: 'dfsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date()
      })
      Utility.produceGeneralMessage.returns(true)
      let result = await Service.recordFundsInOut(payload, params, {})
      assert.ok(result, 'topic created')
      assert.end()
    } catch (err) {
      Logger.error(`get position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('recordFundsInOut should produce message to kafka topic if input is valid and currency is not provided', async (assert) => {
    try {
      const payload = {
        transferId: 'a87fc534-ee48-7775-b6a9-ead2955b6413',
        externalReference: 'string',
        action: 'recordFundsIn',
        // amount: {
        //   amount: 1.0000,
        //   currency: 'USD'
        // },
        reason: 'Reason for in/out flow of funds',
        extensionList: {}
      }

      const params = {
        name: 'dfsp1',
        id: 1,
        transferId: 'a87fc534-ee48-7775-b6a9-ead2955b6413'
      }
      ParticipantFacade.getAllAccountsByNameAndCurrency.withArgs(params.name, null).returns([{
        ledgerAccountType: 'SETTLEMENT',
        participantCurrencyId: 1
      }])
      ParticipantModel.getByName.withArgs(params.name).returns({
        participantId: 0,
        name: 'dfsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date()
      })
      Utility.produceGeneralMessage.returns(true)
      let result = await Service.recordFundsInOut(payload, params, {})
      assert.ok(result, 'topic created')
      assert.end()
    } catch (err) {
      Logger.error(`get position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('recordFundsInOut should throw if actions is not supported', async (assert) => {
    try {
      const payload = {
        transferId: 'a87fc534-ee48-7775-b6a9-ead2955b6413',
        externalReference: 'string',
        action: 'bla',
        amount: {
          amount: 1.0000,
          currency: 'USD'
        },
        reason: 'Reason for in/out flow of funds',
        extensionList: {}
      }

      const params = {
        name: 'dfsp1',
        id: 1,
        transferId: 'a87fc534-ee48-7775-b6a9-ead2955b6413'
      }
      ParticipantFacade.getAllAccountsByNameAndCurrency.withArgs(params.name, payload.amount.currency).returns([{
        ledgerAccountType: 'SETTLEMENT',
        participantCurrencyId: 1
      }])
      ParticipantModel.getByName.withArgs(params.name).returns({
        participantId: 0,
        name: 'dfsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date()
      })
      Utility.produceGeneralMessage.returns(true)
      await Service.recordFundsInOut(payload, params, {})
      assert.fail('did not throw')
      assert.end()
    } catch (err) {
      assert.ok(err.message, 'The action is not supported')
      assert.end()
    }
  })

  await participantTest.test('recordFundsInOut should throw if account is not correct', async (assert) => {
    try {
      const payload = {
        transferId: 'a87fc534-ee48-7775-b6a9-ead2955b6413',
        externalReference: 'string',
        action: 'bla',
        amount: {
          amount: 1.0000,
          currency: 'USD'
        },
        reason: 'Reason for in/out flow of funds',
        extensionList: {}
      }

      const params = {
        name: 'dfsp1',
        id: 1,
        transferId: 'a87fc534-ee48-7775-b6a9-ead2955b6413'
      }
      ParticipantFacade.getAllAccountsByNameAndCurrency.withArgs(params.name, payload.amount.currency).returns([{
        ledgerAccountType: 'POSITION',
        participantCurrencyId: 1
      }])
      ParticipantModel.getByName.withArgs(params.name).returns({
        participantId: 0,
        name: 'dfsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date()
      })
      Utility.produceGeneralMessage.returns(true)
      await Service.recordFundsInOut(payload, params, {})
      assert.fail('did not throw')
      assert.end()
    } catch (err) {
      assert.ok(err.message, 'Account id is not SETTLEMENT type or currency of the account does not match the currency requested')
      assert.end()
    }
  })

  await participantTest.end()
})
