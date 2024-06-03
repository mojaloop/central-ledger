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
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const ParticipantModelCached = require('../../../../src/models/participant/participantCached')
const ParticipantCurrencyModel = require('../../../../src/models/participant/participantCurrencyCached')
const ParticipantPositionModel = require('../../../../src/models/participant/participantPosition')
const ParticipantLimitModel = require('../../../../src/models/participant/participantLimit')
const ParticipantFacade = require('../../../../src/models/participant/facade')
const PositionFacade = require('../../../../src/models/position/facade')
const ParticipantPositionChangeModel = require('../../../../src/models/participant/participantPositionChange')
const LedgerAccountTypeFacade = require('../../../../src/models/participant/facade')
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const LedgerAccountTypeModel = require('../../../../src/models/ledgerAccountType/ledgerAccountType')
const EnumCached = require('../../../../src/lib/enumCached')

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
      currencyList: ['USD']
    },
    {
      participantId: 1,
      name: 'fsp2',
      currency: 'EUR',
      isActive: 1,
      createdDate: new Date(),
      currencyList: ['EUR']
    }
  ]
  const participantCurrencyResult = [
    {
      participantCurrencyId: 0,
      participantId: 0,
      currencyId: 'USD',
      isActive: 1
    },
    {
      participantCurrencyId: 1,
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

  const participantMap = new Map()

  participantTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()

    sandbox.stub(ParticipantModelCached, 'invalidateParticipantsCache')
    sandbox.stub(ParticipantModelCached, 'getById')
    sandbox.stub(ParticipantModelCached, 'getByName')
    sandbox.stub(ParticipantModelCached, 'getAll')
    sandbox.stub(ParticipantModelCached, 'create')
    sandbox.stub(ParticipantModelCached, 'update')
    sandbox.stub(ParticipantModelCached, 'destroyByName')
    sandbox.stub(ParticipantModelCached, 'destroyParticipantEndpointByParticipantId')

    sandbox.stub(ParticipantCurrencyModel, 'invalidateParticipantCurrencyCache')
    sandbox.stub(ParticipantCurrencyModel, 'create')
    sandbox.stub(ParticipantCurrencyModel, 'getByParticipantId')
    sandbox.stub(ParticipantCurrencyModel, 'getById')
    sandbox.stub(ParticipantCurrencyModel, 'destroyByParticipantId')
    sandbox.stub(ParticipantCurrencyModel, 'findOneByParams')
    sandbox.stub(ParticipantCurrencyModel, 'hubAccountExists')

    sandbox.stub(ParticipantFacade, 'getEndpoint')
    sandbox.stub(ParticipantFacade, 'getAllEndpoints')
    sandbox.stub(ParticipantFacade, 'addEndpoint')
    sandbox.stub(ParticipantFacade, 'getByNameAndCurrency')
    sandbox.stub(ParticipantFacade, 'adjustLimits')
    sandbox.stub(ParticipantFacade, 'getParticipantLimitsByCurrencyId')
    sandbox.stub(ParticipantFacade, 'getParticipantLimitsByParticipantId')
    sandbox.stub(ParticipantFacade, 'addLimitAndInitialPosition')
    sandbox.stub(ParticipantFacade, 'getAllAccountsByNameAndCurrency')
    sandbox.stub(ParticipantFacade, 'addHubAccountAndInitPosition')
    sandbox.stub(ParticipantFacade, 'getLimitsForAllParticipants')
    sandbox.stub(ParticipantFacade, 'getAllNonHubParticipantsWithCurrencies')

    sandbox.stub(ParticipantLimitModel, 'getByParticipantCurrencyId')
    sandbox.stub(ParticipantLimitModel, 'destroyByParticipantCurrencyId')
    sandbox.stub(ParticipantLimitModel, 'destroyByParticipantId')
    sandbox.stub(ParticipantPositionModel, 'getByParticipantCurrencyId')
    sandbox.stub(ParticipantPositionModel, 'destroyByParticipantCurrencyId')
    sandbox.stub(ParticipantPositionModel, 'destroyByParticipantId')
    sandbox.stub(ParticipantPositionModel, 'createParticipantPositionRecords')

    sandbox.stub(ParticipantPositionChangeModel, 'getByParticipantPositionId')

    sandbox.stub(PositionFacade, 'getByNameAndCurrency')
    sandbox.stub(PositionFacade, 'getAllByNameAndCurrency')

    sandbox.stub(LedgerAccountTypeModel, 'getLedgerAccountByName')

    sandbox.stub(Kafka, 'produceGeneralMessage')
    sandbox.stub(EnumCached)
    EnumCached.getEnums.returns(Promise.resolve({ POSITION: 1, SETTLEMENT: 2, HUB_RECONCILIATION: 3, HUB_MULTILATERAL_SETTLEMENT: 4, HUB_FEE: 5 }))

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

    Db.from = (table) => {
      return Db[table]
    }

    participantFixtures.forEach((participant, index) => {
      participantMap.set(index + 1, participantResult[index])
      Db.participant.insert.withArgs({ participant }).returns(index)
      ParticipantModelCached.create.withArgs({ name: participant.name }).returns((index + 1))
      ParticipantModelCached.getByName.withArgs(participant.name).returns(participantResult[index])
      ParticipantModelCached.getById.withArgs(index).returns(participantResult[index])
      ParticipantModelCached.update.withArgs(participant, 1).returns((index + 1))
      ParticipantCurrencyModel.create.withArgs({
        participantId: index,
        currencyId: participant.currency
      }).returns((index + 1))
      ParticipantCurrencyModel.getById.withArgs(index).returns({
        participantCurrencyId: participant.participantId,
        participantId: participant.participantId,
        currencyId: participant.currency,
        isActive: 1
      })
      ParticipantCurrencyModel.getByParticipantId.withArgs(participant.participantId, 1).returns(participant.currency)
      ParticipantModelCached.destroyByName.withArgs(participant.name).returns(Promise.resolve(true))
      ParticipantCurrencyModel.destroyByParticipantId.withArgs(participant.participantId).returns(Promise.resolve(true))
      Db.participant.destroy.withArgs({ name: participant.name }).returns(Promise.resolve(true))
    })
    ParticipantModelCached.getAll.returns(Promise.resolve(participantResult))
    t.end()
  })

  participantTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await participantTest.test('getById with non-existing id should', async (assert) => {
    try {
      ParticipantModelCached.getById.withArgs(10).returns(Promise.resolve(null))
      const result = await Service.getById(10)
      assert.equal(result, null, 'return null')
      assert.end()
    } catch (err) {
      Logger.error(`get participant by Id failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getByName with non-existing name should', async (assert) => {
    try {
      ParticipantModelCached.getByName.withArgs('name').returns(Promise.resolve(null))
      const result = await Service.getByName('name')
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
    ParticipantModelCached.create.withArgs(falseParticipant).throws(new Error())
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
      for (const [index, participant] of participantMap) {
        const result = await Service.create({ name: participant.name })
        assert.comment(`Testing with participant \n ${JSON.stringify(participant, null, 2)}`)
        assert.equal(result, index, `returns ${result}`)
      }
      assert.end()
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('get with empty name', async (assert) => {
    ParticipantModelCached.getByName.withArgs('').throws(new Error())
    try {
      await Service.getByName('')
      assert.fail('should throw with empty name')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('getByName', async (assert) => {
    try {
      // assert.plan(Object.keys(participantFixtures[0]).length * participantFixtures.length)
      participantFixtures.forEach(async participant => {
        const result = await Service.getByName(participant.name)
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
      const result = await Service.getAll()
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
      ParticipantModelCached.getAll.throws(new Error())
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
        const participant = await Service.getById(index)
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
        const updated = await Service.update(participant.name, { isActive: 1 })
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
    ParticipantModelCached.getByName.withArgs(participantFixtures[0].name).throws(new Error())
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
        const result = await Service.createParticipantCurrency({
          participantId: participant.participantId,
          currencyId: participant.currency
        })
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
    ParticipantCurrencyModel.create.withArgs({
      participantId: falseParticipant.participantId,
      currencyId: falseParticipant.currency
    }).throws(new Error())
    try {
      await Service.createParticipantCurrency({
        participantId: falseParticipant.participantId,
        currencyId: falseParticipant.currency
      })
      assert.fail('should throw')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('createHubAccount should create the account', async (assert) => {
    try {
      await participantFixtures.forEach(async (participant, index) => {
        ParticipantFacade.addHubAccountAndInitPosition.returns(Promise.resolve(index + 1))
        const result = await Service.createHubAccount({
          participantId: participant.participantId,
          currencyId: participant.currency
        })
        assert.ok(Sinon.match(result, index + 1), `returns ${result}`)
      })
      assert.end()
    } catch (err) {
      Logger.error(`createHubAccount failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('createHubAccount with false participant should fail', async (assert) => {
    const falseParticipant = { name: 'fsp3', participantId: 3, currency: 'FAKE' }
    ParticipantFacade.addHubAccountAndInitPosition.throws(new Error())
    try {
      await Service.createHubAccount({
        participantId: falseParticipant.participantId,
        currencyId: falseParticipant.currency
      })
      assert.fail('should throw')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('getParticipantCurrencyById should return the currency', async (assert) => {
    try {
      participantFixtures.forEach(async (participant, index) => {
        const result = await Service.getParticipantCurrencyById(index)
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
      ParticipantModelCached.destroyByName = sandbox.stub().returns(Promise.resolve(true))
      await participantFixtures.forEach(async (participant) => {
        const result = await Service.destroyByName(participant.name)
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
      ParticipantModelCached.getByName.withArgs(falseParticipant.name).returns(falseParticipant)
      ParticipantModelCached.destroyByName.withArgs(falseParticipant.name).throws(new Error())
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
      ParticipantModelCached.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

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
    ParticipantModelCached.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

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
      ParticipantModelCached.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

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
    ParticipantModelCached.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

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
      ParticipantModelCached.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

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
    ParticipantModelCached.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

    ParticipantFacade.addEndpoint.withArgs(participantFixtures[0].participantId, payload).throws(new Error())

    try {
      await Service.addEndpoint(participantFixtures[0].name, payload)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('destroyParticipantEndpointByName', async (assert) => {
    try {
      ParticipantModelCached.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

      ParticipantModelCached.destroyParticipantEndpointByParticipantId.withArgs(participantFixtures[0].participantId).returns(true)
      const result = await Service.destroyParticipantEndpointByName(participantFixtures[0].name)
      assert.equal(result, true, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`destroyParticipantEndpointByName failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('destroyParticipantEndpointByName should fail', async (assert) => {
    ParticipantModelCached.getByName.withArgs(participantFixtures[0].name).returns(participantFixtures[0])

    ParticipantModelCached.destroyParticipantEndpointByParticipantId.withArgs(participantFixtures[0].participantId).throws(new Error())

    try {
      await Service.destroyParticipantEndpointByName(participantFixtures[0].name)
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
      payload.name = participant.name
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
        },
        initialPosition: 1000
      }
      const limitPositionObj = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        },
        initialPosition: 1000
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
      limitPositionObj.name = participant.name
      ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, payload.currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(participant.name, payload.currency, 2).returns(settlementAccount)
      ParticipantLimitModel.getByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(null)
      ParticipantPositionModel.getByParticipantCurrencyId.withArgs(participant.participantCurrencyId).returns(null)
      ParticipantPositionModel.getByParticipantCurrencyId.withArgs(settlementAccount.participantCurrencyId).returns(null)
      ParticipantFacade.addLimitAndInitialPosition.withArgs(participant.participantCurrencyId, settlementAccount.participantCurrencyId, limitPositionObj).returns(1)
      Kafka.produceGeneralMessage.returns(true)
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

      ParticipantFacade.getParticipantLimitsByCurrencyId.withArgs(participant.participantCurrencyId, limit[0].name).returns(Promise.resolve(limit))
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

      ParticipantFacade.getParticipantLimitsByCurrencyId.withArgs(participant.participantCurrencyId).returns(Promise.resolve(limit))
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
        participantCurrencyId: 1
      }
      ParticipantModelCached.getByName.withArgs(participant.name).returns(participant)

      ParticipantFacade.getParticipantLimitsByParticipantId.withArgs(participant.participantId, 'NET_DEBIT_CAP', 1).returns(Promise.resolve(limit))
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
        participantCurrencyId: 1
      }
      ParticipantModelCached.getByName.withArgs(participant.name).returns(participant)

      ParticipantFacade.getParticipantLimitsByParticipantId.withArgs(participant.participantId, null, 1).returns(Promise.resolve(limit))
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
      participantCurrencyId: 1
    }
    ParticipantModelCached.getByName.withArgs(participant.name).returns(participant)
    ParticipantFacade.getParticipantLimitsByParticipantId.withArgs(participant.participantId, null, 1).throws(new Error())
    try {
      await Service.getLimits(participant.name, {})
      assert.fail('should throw')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err} `)
    }
    assert.end()
  })

  await participantTest.test('getLimitsForAllParticipants', async (assert) => {
    try {
      const currencyId = 'USD'
      const type = 'NET_DEBIT_CAP'
      const limits = [
        {
          name: 'fsp1',
          currencyId: 'USD',
          limitType: 'NET_DEBIT_CAP',
          value: 1000000
        },
        {
          name: 'fsp2',
          currencyId: 'USD',
          limitType: 'NET_DEBIT_CAP',
          value: 2000000
        }
      ]
      ParticipantFacade.getLimitsForAllParticipants.returns(Promise.resolve(limits))
      const result = await Service.getLimitsForAllParticipants({ currency: currencyId, type })
      assert.deepEqual(result, limits, 'Results matched')
      assert.end()
    } catch (err) {
      Logger.error(`getLimitsForAllParticipants failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getLimitsForAllParticipants', async (assert) => {
    const currencyId = undefined
    const type = undefined

    ParticipantFacade.getLimitsForAllParticipants.throws(new Error())
    try {
      await Service.getLimitsForAllParticipants({ currency: currencyId, type })
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
      PositionFacade.getByNameAndCurrency.withArgs(participantName, 1, query.currency).returns(Promise.resolve(positionReturn))

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
      PositionFacade.getByNameAndCurrency.withArgs(participantName, 1, query.currency).returns(Promise.resolve(positionReturn))

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
      ParticipantModelCached.getByName.withArgs(participantName).returns(participant)
      PositionFacade.getByNameAndCurrency.withArgs(participantName).returns(Promise.resolve(positionReturn))

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
      ParticipantModelCached.getByName.withArgs(participantName).returns(participant)
      PositionFacade.getByNameAndCurrency.withArgs(participantName).returns(Promise.resolve(positionReturn))

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
          isActive: 1,
          value: 0,
          reservedValue: 0,
          changedDate: '2018-10-11T11:45:00.000Z'
        },
        {
          participantCurrencyId: 2,
          ledgerAccountType: 'SETTLEMENT',
          currencyId: 'USD',
          isActive: 1,
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
          isActive: 1,
          value: 0,
          reservedValue: 0,
          changedDate: '2018-10-11T11:45:00.000Z'
        },
        {
          id: 2,
          ledgerAccountType: 'SETTLEMENT',
          currency: 'USD',
          isActive: 1,
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

      ParticipantModelCached.getByName.withArgs(participantName).returns(participant)
      PositionFacade.getAllByNameAndCurrency.withArgs(participantName, query.currency).returns(Promise.resolve(accountsMock))

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
      ParticipantModelCached.getByName.withArgs(participantName).returns(participant)
      PositionFacade.getAllByNameAndCurrency.withArgs(participantName).returns(Promise.resolve(positionReturn))

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

  await participantTest.test('updateAccount should update account', async (assert) => {
    try {
      const payload = {
        isActive: 1
      }
      const params = {
        name: 'dfsp1',
        id: 1
      }
      const enums = {
        ledgerAccountType: {
          POSITION: 1
        }
      }
      const participant = {
        participantId: 2,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      const account = {
        participantCurrencyId: 3,
        participantId: 2,
        currencyId: 'USD',
        ledgerAccountTypeId: 1,
        isActive: 1,
        createdDate: new Date(),
        createdBy: 'unknown'
      }
      ParticipantModelCached.getByName.withArgs(params.name).returns(Promise.resolve(participant))
      ParticipantCurrencyModel.getById.withArgs(params.id).returns(Promise.resolve(account))

      await Service.updateAccount(payload, params, enums)
      assert.pass('Account updated')
      assert.end()
    } catch (err) {
      Logger.error(`updateAccount failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('updateAccount should throw Account not found error', async (assert) => {
    try {
      const payload = {
        isActive: 1
      }
      const params = {
        name: 'dfsp1',
        id: 1
      }
      const enums = {
        ledgerAccountType: {
          POSITION: 1
        }
      }
      const participant = {
        participantId: 2,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      ParticipantModelCached.getByName.withArgs(params.name).returns(Promise.resolve(participant))

      try {
        const account = null
        ParticipantCurrencyModel.getById.withArgs(params.id).returns(Promise.resolve(account))

        await Service.updateAccount(payload, params, enums)
        assert.fail('Error not thrown')
      } catch (err) {
        assert.ok(err instanceof Error)
        assert.equal(err.message, 'Account not found')
      }

      try {
        const account = {
          participantId: 1
        }
        ParticipantCurrencyModel.getById.withArgs(params.id).returns(Promise.resolve(account))

        await Service.updateAccount(payload, params, enums)
        assert.fail('Error not thrown')
      } catch (err) {
        assert.ok(err instanceof Error)
        assert.equal(err.message, 'Participant/account mismatch')
      }

      try {
        const account = {
          participantId: participant.participantId,
          ledgerAccountTypeId: 2
        }
        ParticipantCurrencyModel.getById.withArgs(params.id).returns(Promise.resolve(account))

        await Service.updateAccount(payload, params, enums)
        assert.fail('Error not thrown')
      } catch (err) {
        assert.ok(err instanceof Error)
        assert.equal(err.message, 'Only position account update is permitted')
      }
      assert.end()
    } catch (err) {
      Logger.error(`updateAccount failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getLedgerAccountType by name name should return ledgerAccountType', async (assert) => {
    const name = {
      currency: 'AFA',
      type: 'POSITION'
    }
    const ledgerAccountsMock = {
      ledgerAccountTypeId: 1,
      name: 'POSITION',
      description: 'Typical accounts from which a DFSP provisions  transfers',
      isActive: 1,
      createdDate: '2018-10-11T11:45:00.000Z'
    }

    try {
      LedgerAccountTypeModel.getLedgerAccountByName.withArgs(name.type).returns(ledgerAccountsMock)
      const expected = await Service.getLedgerAccountTypeName(name.type)
      assert.deepEqual(expected, ledgerAccountsMock, 'Results matched')
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
  })

  await participantTest.test('getLedgerAccountType by name name should throw an error if the name is invalid', async (assert) => {
    const name = {
      currency: 'AFA',
      type: 'POSITION'
    }
    const ledgerAccountsMock = {
      ledgerAccountTypeId: 1,
      name: 'POSITION',
      description: 'Typical accounts from which a DFSP provisions  transfers',
      isActive: 1,
      createdDate: '2018-10-11T11:45:00.000Z'
    }

    try {
      LedgerAccountTypeModel.getLedgerAccountByName.withArgs(name.type).throws(new Error())
      const expected = await Service.getLedgerAccountTypeName(name.type)
      assert.deepEqual(expected, ledgerAccountsMock, 'Results matched')
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
  })

  await participantTest.test('getParticipantAccount should return participant account', async (assert) => {
    const params = {
      participantCurrencyId: 1
    }
    const participantAccountsMock = {
      participantCurrencyId: 1,
      ledgerAccountTypeId: 1,
      name: 'POSITION',
      description: 'Typical accounts from which a DFSP provisions transfers',
      isActive: 1,
      createdDate: '2018-10-11T11:45:00.000Z'
    }

    try {
      ParticipantCurrencyModel.getByName.withArgs(params).returns(participantAccountsMock)
      const expected = await Service.getParticipantAccount(params)
      assert.deepEqual(expected, participantAccountsMock, 'Results matched')
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
  })

  await participantTest.test('getParticipantAccount should throw an error', async (assert) => {
    const params = {
      participantCurrencyId: 1
    }

    try {
      ParticipantCurrencyModel.getByName.withArgs(params).throws(new Error())
      await Service.getParticipantAccount(params)
      assert.fail('Error not thrown')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
  })

  await participantTest.test('createParticipantCurrency should return a new currency and position record', async (assert) => {
    const payload = {
      participantId: 1,
      currencyId: 1,
      ledgerAccountTypeId: 3
    }
    const participantCurrency = {
      participantCurrencyId: 1,
      participantId: 1,
      currencyId: 1,
      ledgerAccountTypeId: 1,
      isActive: 1,
      createdDate: '2018-10-11T11:45:00.000Z',
      createdBy: 'unknown'
    }

    try {
      LedgerAccountTypeFacade.addNewCurrencyAndPosition.withArgs(payload.participantId, payload.currencyId, payload.ledgerAccountTypeId).returns(participantCurrency)
      const expected = await Service.createParticipantCurrency(payload.participantId, payload.currencyId, payload.ledgerAccountTypeId)
      assert.deepEqual(expected, 1, 'Results matched')
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
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
      const enums = {
        hubParticipant: {
          name: 'Hub'
        },
        ledgerAccountType: {
          SETTLEMENT: 2
        }
      }
      ParticipantFacade.getAllAccountsByNameAndCurrency.withArgs(params.name, payload.amount.currency).returns([{
        ledgerAccountType: 'SETTLEMENT',
        ledgerAccountTypeId: 2,
        participantCurrencyId: 1,
        accountIsActive: 1
      }])
      ParticipantModelCached.getByName.withArgs(params.name).returns({
        participantId: 0,
        name: 'dfsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date()
      })
      Kafka.produceGeneralMessage.returns(true)

      const result = await Service.recordFundsInOut(payload, params, enums)
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
        reason: 'Reason for in/out flow of funds',
        extensionList: {}
      }
      const params = {
        name: 'dfsp1',
        id: 1,
        transferId: 'a87fc534-ee48-7775-b6a9-ead2955b6413'
      }
      const enums = {
        hubParticipant: {
          name: 'Hub'
        },
        ledgerAccountType: {
          SETTLEMENT: 2
        }
      }
      ParticipantFacade.getAllAccountsByNameAndCurrency.withArgs(params.name, null).returns([{
        ledgerAccountType: 'SETTLEMENT',
        ledgerAccountTypeId: 2,
        participantCurrencyId: 1,
        accountIsActive: 1
      }])
      ParticipantModelCached.getByName.withArgs(params.name).returns({
        participantId: 0,
        name: 'dfsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date()
      })
      Kafka.produceGeneralMessage.returns(true)

      const result = await Service.recordFundsInOut(payload, params, enums)
      assert.ok(result, 'topic created')
      assert.end()
    } catch (err) {
      Logger.error(`get position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('recordFundsInOut should throw if account does not match participant', async (assert) => {
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
      const enums = {
        ledgerAccountType: {
          SETTLEMENT: 2
        },
        hubParticipant: {
          name: 'Hub'
        }
      }
      ParticipantFacade.getAllAccountsByNameAndCurrency.withArgs(params.name, payload.amount.currency).returns([{
        ledgerAccountType: 'POSITION',
        ledgerAccountTypeId: 1,
        participantCurrencyId: 2,
        accountIsActive: 1
      }])
      ParticipantModelCached.getByName.withArgs(params.name).returns({
        participantId: 0,
        name: 'dfsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date()
      })
      Kafka.produceGeneralMessage.returns(true)
      await Service.recordFundsInOut(payload, params, enums)
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      assert.ok(err.message, 'Error thrown')
      assert.end()
    }
  })

  await participantTest.test('recordFundsInOut should throw if account is not settlement type', async (assert) => {
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
      const enums = {
        ledgerAccountType: {
          SETTLEMENT: 2
        },
        hubParticipant: {
          name: 'Hub'
        }
      }
      ParticipantFacade.getAllAccountsByNameAndCurrency.withArgs(params.name, payload.amount.currency).returns([{
        ledgerAccountType: 'POSITION',
        ledgerAccountTypeId: 1,
        participantCurrencyId: 1,
        accountIsActive: 1
      }])
      ParticipantModelCached.getByName.withArgs(params.name).returns({
        participantId: 0,
        name: 'dfsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date()
      })
      Kafka.produceGeneralMessage.returns(true)
      await Service.recordFundsInOut(payload, params, enums)
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      assert.ok(err.message, 'error thrown')
      assert.end()
    }
  })

  await participantTest.test('recordFundsInOut should throw if account is inactive', async (assert) => {
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
        participantCurrencyId: 1,
        accountIsActive: 0
      }])
      ParticipantModelCached.getByName.withArgs(params.name).returns({
        participantId: 0,
        name: 'dfsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date()
      })
      Kafka.produceGeneralMessage.returns(true)
      await Service.recordFundsInOut(payload, params, {})
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      assert.ok(err.message, 'error thrown')
      assert.end()
    }
  })

  await participantTest.test('recordFundsInOut should throw if participant is inactive', async (assert) => {
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
        participantCurrencyId: 1,
        accountIsActive: 1
      }])
      ParticipantModelCached.getByName.withArgs(params.name).returns({
        participantId: 0,
        name: 'dfsp1',
        currency: 'USD',
        isActive: 0,
        createdDate: new Date()
      })
      Kafka.produceGeneralMessage.returns(true)
      await Service.recordFundsInOut(payload, params, {})
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      assert.ok(err.message, 'error thrown')
      assert.end()
    }
  })

  await participantTest.test('recordFundsInOut should throw if action is not allowed', async (assert) => {
    try {
      const payload = {
        transferId: 'a87fc534-ee48-7775-b6a9-ead2955b6413',
        externalReference: 'string',
        action: 'notAllowedAction',
        reason: 'Reason for in/out flow of funds',
        extensionList: {}
      }
      const params = {
        name: 'dfsp1',
        id: 1,
        transferId: 'a87fc534-ee48-7775-b6a9-ead2955b6413'
      }
      const enums = {
        hubParticipant: {
          name: 'Hub'
        },
        ledgerAccountType: {
          SETTLEMENT: 2
        }
      }
      ParticipantFacade.getAllAccountsByNameAndCurrency.withArgs(params.name, null).returns([{
        ledgerAccountType: 'SETTLEMENT',
        ledgerAccountTypeId: 2,
        participantCurrencyId: 1,
        accountIsActive: 1
      }])
      ParticipantModelCached.getByName.withArgs(params.name).returns({
        participantId: 0,
        name: 'dfsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date()
      })
      Kafka.produceGeneralMessage.returns(true)

      await Service.recordFundsInOut(payload, params, enums)
      assert.fail('Error not thrown!')
      assert.end()
    } catch (err) {
      assert.ok(err.message, 'Error thrown')
      assert.end()
    }
  })

  await participantTest.test('validateHubAccounts should', async (assert) => {
    try {
      const currency = 'USD'
      ParticipantCurrencyModel.hubAccountExists.withArgs(currency, 3).resolves(true)
      ParticipantCurrencyModel.hubAccountExists.withArgs(currency, 4).resolves(true)
      const result = await Service.validateHubAccounts(currency)
      assert.equal(result, true, 'return true')
      assert.end()
    } catch (err) {
      Logger.error(`validateHubAccounts failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('validateHubAccounts should throw error when hub reconciliation account does not exist', async (assert) => {
    try {
      const currency = 'USD'
      ParticipantCurrencyModel.hubAccountExists.withArgs(currency, 3).resolves(false)
      ParticipantCurrencyModel.hubAccountExists.withArgs(currency, 4).resolves(true)
      await Service.validateHubAccounts(currency)
      assert.fail('should throw')
      assert.end()
    } catch (err) {
      Logger.error(`validateHubAccounts failed with error - ${err}`)
      assert.equal(err.message, 'Hub reconciliation account for the specified currency does not exist', 'throws Hub reconciliation account for the specified currency does not exist')
      assert.end()
    }
  })

  await participantTest.test('validateHubAccounts should throw error when hub settlement account does not exist', async (assert) => {
    try {
      const currency = 'USD'
      ParticipantCurrencyModel.hubAccountExists.withArgs(currency, 3).resolves(true)
      ParticipantCurrencyModel.hubAccountExists.withArgs(currency, 4).resolves(false)
      await Service.validateHubAccounts(currency)
      assert.fail('should throw')
      assert.end()
    } catch (err) {
      Logger.error(`validateHubAccounts failed with error - ${err}`)
      assert.equal(err.message, 'Hub multilateral net settlement account for the specified currency does not exist', 'throws Hub multilateral net settlement account for the specified currency does not exist')
      assert.end()
    }
  })

  await participantTest.test('createAssociatedParticipantAccounts should create ParticipantPositionRecords records', async (assert) => {
    try {
      const currency = 'AUD'
      const ledgerAccountTypeId = 127
      const existingParticipantWithCurrencies = [
        {
          participantCurrencyId: 2,
          participantId: '2',
          currencyId: 'USD'
        }
      ]

      ParticipantFacade.getAllNonHubParticipantsWithCurrencies.resolves(existingParticipantWithCurrencies)

      ParticipantCurrencyModel.getByParticipantId.resolves(['EUR', 'USD'])
      ParticipantCurrencyModel.create.resolves(1)
      ParticipantModelCached.getById.withArgs('1').resolves(participantResult[1])
      ParticipantModelCached.getById.withArgs('2').resolves(participantResult[0])
      ParticipantPositionModel.createParticipantPositionRecords.resolves(true)
      await Service.createAssociatedParticipantAccounts(currency, ledgerAccountTypeId)
      assert.equal(ParticipantFacade.getAllNonHubParticipantsWithCurrencies.callCount, 1, 'should retrieve non HUB Participants with currencies')
      assert.deepEqual(ParticipantCurrencyModel.create.callCount, 1, 'should call the create partipant currency record function')
      assert.equal(ParticipantCurrencyModel.create.lastCall.args[1], 'AUD', 'should call the create partipant currency records function with currency AUD')
      assert.equal(ParticipantCurrencyModel.create.lastCall.args[2], 127, 'should call the create partipant currency records function with ledgerAccountTypeId')

      assert.equal(ParticipantPositionModel.createParticipantPositionRecords.callCount, 1, 'should call the model create function')
      const expectedParticipantPositionArg = [
        { participantCurrencyId: 1, value: 0, reservedValue: 0 }
      ]
      assert.deepEqual(ParticipantPositionModel.createParticipantPositionRecords.lastCall.args[0], expectedParticipantPositionArg, 'should call the create partipant position records function with the right arguments')

      assert.end()
    } catch (err) {
      console.log(err)
      assert.fail(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
  })

  await participantTest.test('createAssociatedParticipantAccounts should throw an error if the LedgerAccountTypeModel service fails', async (assert) => {
    try {
      ParticipantFacade.getAllNonHubParticipantsWithCurrencies.rejects(new Error('Error message'))
      const ledgerAccountTypeId = 127
      const currency = 'AUD'

      await Service.createAssociatedParticipantAccounts(currency, ledgerAccountTypeId)
      assert.fail('Error not thrown', 'should have thrown an error')
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, 'should throw an error')
      assert.ok(err.message, 'Error message', 'should throw the right error message')
      assert.end()
    }
  })

  await participantTest.end()
})
