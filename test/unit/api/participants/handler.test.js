'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')

const Logger = require('@mojaloop/central-services-logger')
const Handler = require('../../../../src/api/participants/handler')
const Sidecar = require('../../../../src/lib/sidecar')
const Participant = require('../../../../src/domain/participant')
const EnumCached = require('../../../../src/lib/enumCached')
const FSPIOPError = require('@mojaloop/central-services-error-handling').Factory.FSPIOPError
const SettlementModel = require('../../../../src/domain/settlement')

const createRequest = ({ payload, params, query }) => {
  const sandbox = Sinon.createSandbox()
  const requestPayload = payload || {}
  const requestParams = params || {}
  const requestQuery = query || {}
  const enums = sandbox.stub()
  enums.withArgs('ledgerAccountType').returns({ POSITION: 1, SETTLEMENT: 2, HUB_RECONCILIATION: 3, HUB_MULTILATERAL_SETTLEMENT: 4, HUB_FEE: 5 })
  return {
    payload: requestPayload,
    params: requestParams,
    query: requestQuery,
    server: {
      log: () => { },
      methods: {
        enums
      }
    }
  }
}

Test('Participant', participantHandlerTest => {
  let sandbox

  const participantFixtures = [
    {
      participantId: 1,
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: '2018-07-17T16:04:24.185Z',
      currencyList: [
        { participantCurrencyId: 1, currencyId: 'USD', ledgerAccountTypeId: 1, isActive: 1, createdBy: 'unknown', createdDate: '2018-07-17T16:04:24.185Z' },
        { participantCurrencyId: 2, currencyId: 'USD', ledgerAccountTypeId: 2, isActive: 1, createdBy: 'unknown', createdDate: '2018-07-17T16:04:24.185Z' }
      ]
    },
    {
      participantId: 2,
      name: 'fsp2',
      currency: 'EUR',
      isActive: 1,
      createdDate: '2018-07-17T16:04:24.185Z',
      currencyList: [
        { participantCurrencyId: 3, currencyId: 'EUR', ledgerAccountTypeId: 1, isActive: 1, createdBy: 'unknown', createdDate: '2018-07-17T16:04:24.185Z' },
        { participantCurrencyId: 4, currencyId: 'EUR', ledgerAccountTypeId: 2, isActive: 1, createdBy: 'unknown', createdDate: '2018-07-17T16:04:24.185Z' }
      ]
    },
    {
      participantId: 3,
      name: 'Hub',
      currency: 'USD',
      isActive: 1,
      createdDate: '2018-07-17T16:04:24.185Z',
      currencyList: [
        { participantCurrencyId: 5, currencyId: 'USD', ledgerAccountTypeId: 5, isActive: 1, createdBy: 'unknown', createdDate: '2018-07-17T16:04:24.185Z' }
      ]
    }
  ]

  const participantResults = [
    {
      name: 'fsp1',
      id: 'http://central-ledger/participants/fsp1',
      created: '2018-07-17T16:04:24.185Z',
      isActive: 1,
      links: {
        self: 'http://central-ledger/participants/fsp1'
      },
      accounts: [
        { id: 1, currency: 'USD', ledgerAccountType: 'POSITION', isActive: 1, createdBy: 'unknown', createdDate: new Date('2018-07-17T16:04:24.185Z') },
        { id: 2, currency: 'USD', ledgerAccountType: 'SETTLEMENT', isActive: 1, createdBy: 'unknown', createdDate: new Date('2018-07-17T16:04:24.185Z') }
      ]
    },
    {
      name: 'fsp2',
      id: 'http://central-ledger/participants/fsp2',
      created: '2018-07-17T16:04:24.185Z',
      isActive: 1,
      links: {
        self: 'http://central-ledger/participants/fsp2'
      },
      accounts: [
        { id: 3, currency: 'EUR', ledgerAccountType: 'POSITION', isActive: 1, createdBy: 'unknown', createdDate: new Date('2018-07-17T16:04:24.185Z') },
        { id: 4, currency: 'EUR', ledgerAccountType: 'SETTLEMENT', isActive: 1, createdBy: 'unknown', createdDate: new Date('2018-07-17T16:04:24.185Z') }
      ]
    },
    {
      name: 'Hub',
      id: 'http://central-ledger/participants/Hub',
      created: '2018-07-17T16:04:24.185Z',
      isActive: 1,
      links: {
        self: 'http://central-ledger/participants/Hub'
      },
      accounts: [
        { id: 5, currency: 'USD', ledgerAccountType: 'HUB_FEE', isActive: 1, createdBy: 'unknown', createdDate: new Date('2018-07-17T16:04:24.185Z') }
      ]
    }
  ]
  const settlementModelFixtures = [
    {
      settlementModelId: 1,
      name: 'DEFERREDNET',
      isActive: 1,
      settlementGranularityId: 2,
      settlementInterchangeId: 2,
      settlementDelayId: 2,
      currencyId: null,
      requireLiquidityCheck: 1,
      ledgerAccountTypeId: 1,
      autoPositionReset: 1,
      adjustPosition: 0,
      settlementAccountTypeId: 2
    }
  ]

  participantHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Sidecar)
    sandbox.stub(Logger)
    sandbox.stub(Participant)
    sandbox.stub(EnumCached)
    sandbox.stub(SettlementModel, 'getAll')
    EnumCached.getEnums.returns(Promise.resolve({ POSITION: 1, SETTLEMENT: 2, HUB_RECONCILIATION: 3, HUB_MULTILATERAL_SETTLEMENT: 4, HUB_FEE: 5 }))
    Logger.isDebugEnabled = true
    test.end()
  })

  participantHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  participantHandlerTest.test('Handler Test', async handlerTest => {
    handlerTest.test('getAll should return all the participants', async function (test) {
      Participant.getAll.returns(Promise.resolve(participantFixtures))
      const result = await Handler.getAll(createRequest({}))
      test.deepEqual(result, participantResults, 'The results match')
      test.end()
    })

    handlerTest.test('getByName should return the participant', async function (test) {
      Participant.getByName.withArgs(participantFixtures[0].name).returns(Promise.resolve(participantFixtures[0]))
      const result = await Handler.getByName(createRequest({ params: { name: participantFixtures[0].name } }))
      test.deepEqual(result, participantResults[0], 'The results match')
      test.end()
    })

    handlerTest.test('getByName should throw error', async function (test) {
      Participant.getByName.withArgs(participantFixtures[0].name).returns(Promise.resolve(null))
      try {
        await Handler.getByName(createRequest({ params: { name: participantFixtures[0].name } }))
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'The requested resource could not be found.')
        test.end()
      }
    })

    handlerTest.test('update should update, return participant and utilize logger', async function (test) {
      Participant.update.withArgs(participantFixtures[0].name, { isActive: 1 }).returns(Promise.resolve(participantFixtures[0]))
      try {
        const result = await Handler.update(createRequest({
          params: { name: participantFixtures[0].name },
          payload: { isActive: 1 }
        }))
        test.deepEqual(result, participantResults[0], 'The results match')
        test.ok(Logger.info.withArgs('Participant has been activated :: {"name":"fsp1","isActive":1}').calledOnce, 'Logger.info called once')
        test.end()
      } catch (err) {
        test.fail('Error thrown')
        test.end()
      }
    })

    handlerTest.test('update should update, return participant if participant when inactive and utilize', async function (test) {
      Participant.update.withArgs(participantFixtures[0].name, { isActive: 0 }).returns(Promise.resolve(participantFixtures[0]))
      try {
        const result = await Handler.update(createRequest({
          params: { name: participantFixtures[0].name },
          payload: { isActive: 0 }
        }))
        test.deepEqual(result, participantResults[0], 'The results match')
        test.ok(Logger.info.withArgs('Participant has been disabled :: {"name":"fsp1","isActive":0}').calledOnce, 'Logger.info called once')
        test.end()
      } catch (err) {
        test.fail('Error thrown')
        test.end()
      }
    })

    handlerTest.test('update should update, return participant, but omit logging when isActive is not being updated', async function (test) {
      Participant.update.withArgs(participantFixtures[0].name, {}).returns(Promise.resolve(participantFixtures[0]))
      try {
        const result = await Handler.update(createRequest({
          params: { name: participantFixtures[0].name },
          payload: {}
        }))
        test.deepEqual(result, participantResults[0], 'The results match')
        test.notOk(Logger.info.called, 'Logger.info call omitted')
        test.end()
      } catch (err) {
        test.fail('Error thrown')
        test.end()
      }
    })

    handlerTest.test('update should throw error', async function (test) {
      Participant.update.withArgs(participantFixtures[0].name, { isActive: 1 }).throws(new Error('Test error'))
      try {
        await Handler.update(createRequest({ params: { name: participantFixtures[0].name }, payload: { isActive: 1 } }))
      } catch (e) {
        test.ok(e instanceof FSPIOPError)
        test.equal(e.message, 'Test error')
        test.end()
      }
    })

    handlerTest.test('create should create and return the new participant with settlementModel', async function (test) {
      const payload = {
        name: 'fsp1',
        currency: 'USD'
      }
      const participant = {
        participantId: 1,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z'
      }

      const participantCurrencyId1 = 1
      const participantCurrencyId2 = 2
      const currencyList1 = { participantCurrencyId: 1, currencyId: 'USD', ledgerAccountTypeId: 1, isActive: 1, createdBy: 'unknown', createdDate: '2018-07-17T16:04:24.185Z' }
      const currencyList2 = { participantCurrencyId: 2, currencyId: 'USD', ledgerAccountTypeId: 2, isActive: 1, createdBy: 'unknown', createdDate: '2018-07-17T16:04:24.185Z' }

      Participant.hubAccountExists.withArgs(participant.currency).returns(Promise.resolve(true))
      Participant.getByName.withArgs(participantFixtures[0].name).returns(Promise.resolve(null))
      Participant.create.withArgs(payload).returns(Promise.resolve(participant.participantId))
      Participant.getById.withArgs(participant.participantId).returns(Promise.resolve(participant))
      Participant.createParticipantCurrency.withArgs(participant.participantId, payload.currency, 1).returns(Promise.resolve(participantCurrencyId1))
      Participant.createParticipantCurrency.withArgs(participant.participantId, payload.currency, 2).returns(Promise.resolve(participantCurrencyId2))
      Participant.getParticipantCurrencyById.withArgs(participantCurrencyId1).returns(Promise.resolve(currencyList1))
      Participant.getParticipantCurrencyById.withArgs(participantCurrencyId2).returns(Promise.resolve(currencyList2))
      SettlementModel.getAll.returns(Promise.resolve(settlementModelFixtures))
      const reply = {
        response: (response) => {
          return {
            code: statusCode => {
              test.deepEqual(response, participantResults[0], 'The results match')
              test.equal(statusCode, 201)
              test.end()
            }
          }
        }
      }
      await Handler.create(createRequest({ payload }), reply)
    })

    handlerTest.test('create should create and return the new participant without settlementModel', async function (test) {
      const payload = {
        name: 'fsp1',
        currency: 'USD'
      }
      const participant = {
        participantId: 1,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z'
      }

      const participantCurrencyId1 = 1
      const participantCurrencyId2 = 2
      const currencyList1 = { participantCurrencyId: 1, currencyId: 'USD', ledgerAccountTypeId: 1, isActive: 1, createdBy: 'unknown', createdDate: '2018-07-17T16:04:24.185Z' }
      const currencyList2 = { participantCurrencyId: 2, currencyId: 'USD', ledgerAccountTypeId: 2, isActive: 1, createdBy: 'unknown', createdDate: '2018-07-17T16:04:24.185Z' }

      Participant.hubAccountExists.withArgs(participant.currency).returns(Promise.resolve(true))
      Participant.getByName.withArgs(participantFixtures[0].name).returns(Promise.resolve(null))
      Participant.create.withArgs(payload).returns(Promise.resolve(participant.participantId))
      Participant.getById.withArgs(participant.participantId).returns(Promise.resolve(participant))
      Participant.createParticipantCurrency.withArgs(participant.participantId, payload.currency, 1).returns(Promise.resolve(participantCurrencyId1))
      Participant.createParticipantCurrency.withArgs(participant.participantId, payload.currency, 2).returns(Promise.resolve(participantCurrencyId2))
      Participant.getParticipantCurrencyById.withArgs(participantCurrencyId1).returns(Promise.resolve(currencyList1))
      Participant.getParticipantCurrencyById.withArgs(participantCurrencyId2).returns(Promise.resolve(currencyList2))
      SettlementModel.getAll.returns(Promise.resolve([]))
      const reply = {
        response: (response) => {
          return {
            code: statusCode => {
              test.deepEqual(response, participantResults[0], 'The results match')
              test.equal(statusCode, 201)
              test.end()
            }
          }
        }
      }
      await Handler.create(createRequest({ payload }), reply)
    })

    handlerTest.test('create should find the participant and create new account', async function (test) {
      const payload = {
        name: 'fsp1',
        currency: 'USD'
      }
      const participant = {
        participantId: 1,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z',
        currencyList: []
      }

      const participantCurrencyId1 = 1
      const participantCurrencyId2 = 2
      const currencyList1 = { participantCurrencyId: 1, currencyId: 'USD', ledgerAccountTypeId: 1, isActive: 1, createdBy: 'unknown', createdDate: '2018-07-17T16:04:24.185Z' }
      const currencyList2 = { participantCurrencyId: 2, currencyId: 'USD', ledgerAccountTypeId: 2, isActive: 1, createdBy: 'unknown', createdDate: '2018-07-17T16:04:24.185Z' }

      SettlementModel.getAll.returns(Promise.resolve(settlementModelFixtures))
      Participant.hubAccountExists.withArgs(participant.currency).returns(Promise.resolve(true))
      Participant.getByName.withArgs(participantFixtures[0].name).returns(Promise.resolve(participant))
      Participant.createParticipantCurrency.withArgs(participant.participantId, payload.currency, 1).returns(Promise.resolve(participantCurrencyId1))
      Participant.createParticipantCurrency.withArgs(participant.participantId, payload.currency, 2).returns(Promise.resolve(participantCurrencyId2))
      Participant.getParticipantCurrencyById.withArgs(participantCurrencyId1).returns(Promise.resolve(currencyList1))
      Participant.getParticipantCurrencyById.withArgs(participantCurrencyId2).returns(Promise.resolve(currencyList2))
      const reply = {
        response: (response) => {
          return {
            code: statusCode => {
              test.deepEqual(response, participantResults[0], 'The results match')
              test.equal(statusCode, 201)
              test.end()
            }
          }
        }
      }
      await Handler.create(createRequest({ payload }), reply)
    })

    handlerTest.test('create should fail if participant and account in specified currency exist', async function (test) {
      const payload = {
        name: 'fsp1',
        currency: 'USD'
      }
      const participant = {
        participantId: 1,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z',
        currencyList: [
          { participantCurrencyId: 1, currencyId: 'USD', ledgerAccountTypeId: 1, isActive: 1, createdBy: 'unknown', createdDate: '2018-07-17T16:04:24.185Z' }
        ]
      }

      Participant.hubAccountExists.withArgs(participant.currency).returns(Promise.resolve(true))
      Participant.getByName.withArgs(participantFixtures[0].name).returns(Promise.resolve(participant))
      try {
        await Handler.create(createRequest({ payload }))
        test.fail()
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Participant currency has already been registered')
        test.end()
      }
    })

    handlerTest.test('create should fail if hub reconciliation account does not exist', async function (test) {
      const payload = {
        name: 'fsp1',
        currency: 'USD'
      }
      const participant = {
        participantId: 1,
        name: 'fsp1',
        currency: 'USD',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z',
        currencyList: [{ currencyId: 'USD', isActive: 1 }]
      }

      Participant.getByName.withArgs(participantFixtures[0].name).returns(Promise.resolve(participant))
      Participant.validateHubAccounts.throws(new Error('Hub reconciliation account for the specified currency does not exist'))
      try {
        await Handler.create(createRequest({ payload }))
        test.fail('Error not thrown')
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Hub reconciliation account for the specified currency does not exist')
        test.end()
      }
    })

    handlerTest.test('create should fail if the participant exists with different currency', async function (test) {
      const payload = {
        name: 'fsp1',
        currency: 'USD'
      }
      const participant = {
        participantId: 1,
        name: 'fsp1',
        currency: 'EUR',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z',
        currencyList: [{ currencyId: 'EUR', isActive: 1 }]
      }

      Participant.getByName.withArgs(participantFixtures[0].name).returns(Promise.resolve(participant))
      try {
        await Handler.create(createRequest({ payload }))
      } catch (e) {
        test.ok(e instanceof Error)
        test.end()
      }
    })

    handlerTest.test('create should fail if any error', async function (test) {
      const payload = {
        name: 'fsp1',
        currency: 'USD'
      }
      Participant.hubAccountExists.returns(Promise.resolve(true))
      Participant.getByName.withArgs(participantFixtures[0].name).returns(Promise.resolve(null))
      Participant.create.withArgs(payload).throws(new Error('Error while creating participant'))
      try {
        await Handler.create(createRequest({ payload }))
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Error while creating participant')
        test.end()
      }
    })

    handlerTest.test('addEndpoint should add the endpoint', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const payload = {
        type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }

      Participant.addEndpoint.withArgs(params.name, payload).returns(Promise.resolve(1))
      const reply = {
        response: () => {
          return {
            code: statusCode => {
              test.equal(statusCode, 201, 'Participant Endpoint created successfully')
              test.end()
            }
          }
        }
      }
      await Handler.addEndpoint(createRequest({ params, payload }), reply)
    })

    handlerTest.test('addEndpoint should throw error', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const payload = {
        type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }

      Participant.addEndpoint.withArgs(params.name, payload).throws(new Error('Test error'))

      try {
        await Handler.addEndpoint(createRequest({ params, payload }))
      } catch (e) {
        test.ok(e instanceof FSPIOPError)
        test.equal(e.message, 'Test error')
        test.end()
      }
    })

    handlerTest.test('getEndpoint should return the participant endpoint if type is passed', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const query = {
        type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST'
      }
      const endpoint = {
        type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }
      const endpointReturn = [{
        name: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }]
      Participant.getEndpoint.withArgs(params.name, query.type).returns(Promise.resolve(endpointReturn))
      const result = await Handler.getEndpoint(createRequest({ params, query }))
      test.deepEqual(result, endpoint, 'The results match')
      test.end()
    })

    handlerTest.test('getEndpoint should return empty object if no endpoints found if type is passed', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const query = {
        type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST'
      }
      const endpoint = {}
      const endpointReturn = []
      Participant.getEndpoint.withArgs(params.name, query.type).returns(Promise.resolve(endpointReturn))
      const result = await Handler.getEndpoint(createRequest({ params, query }))
      test.deepEqual(result, endpoint, 'The results match')
      test.end()
    })

    handlerTest.test('getEndpoint should return all the participant endpoints if type is not passed', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const endpoints = [
        {
          name: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
          value: 'http://localhost:3001/participants/dfsp1/notification1'
        },
        {
          name: 'ALARM_NOTIFICATION_URL',
          value: 'http://localhost:3001/participants/dfsp1/notification2'
        }
      ]
      const endpointsResult = [
        {
          type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
          value: 'http://localhost:3001/participants/dfsp1/notification1'
        },
        {
          type: 'ALARM_NOTIFICATION_URL',
          value: 'http://localhost:3001/participants/dfsp1/notification2'
        }
      ]

      Participant.getAllEndpoints.withArgs(params.name).returns(Promise.resolve(endpoints))
      const result = await Handler.getEndpoint(createRequest({ params }))
      test.deepEqual(result, endpointsResult, 'The results match')
      test.end()
    })

    handlerTest.test('getEndpoint should return empty array if no endpoints found if type is not passed', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const endpoints = []
      const endpointsResult = []

      Participant.getAllEndpoints.withArgs(params.name).returns(Promise.resolve(endpoints))
      const result = await Handler.getEndpoint(createRequest({ params }))
      test.deepEqual(result, endpointsResult, 'The results match')
      test.end()
    })

    handlerTest.test('getEndpoint should throw error', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const query = {
        type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST'
      }
      Participant.getEndpoint.withArgs(params.name, query.type).throws(new Error('Test error'))

      try {
        await Handler.getEndpoint(createRequest({ params, query }))
      } catch (e) {
        test.ok(e instanceof FSPIOPError)
        test.equal(e.message, 'Test error')
        test.end()
      }
    })

    handlerTest.test('addLimitAndInitialPosition should add the limits and initial position', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const payload = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        },
        initialPosition: 0
      }

      Participant.addLimitAndInitialPosition.withArgs(params.name, payload).returns(Promise.resolve(1))
      const reply = {
        response: () => {
          return {
            code: statusCode => {
              test.equal(statusCode, 201, 'Participant limit and initial position added successfully')
              test.end()
            }
          }
        }
      }
      await Handler.addLimitAndInitialPosition(createRequest({ params, payload }), reply)
    })

    handlerTest.test('addLimitAndInitialPosition should add the limits and initial position as default 0 if not passed', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const payload = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        }
      }

      Participant.addLimitAndInitialPosition.withArgs(params.name, payload).returns(Promise.resolve(1))
      const reply = {
        response: () => {
          return {
            code: statusCode => {
              test.equal(statusCode, 201, 'Participant limit and initial position added successfully')
              test.end()
            }
          }
        }
      }
      await Handler.addLimitAndInitialPosition(createRequest({ params, payload }), reply)
    })

    handlerTest.test('addLimitAndInitialPosition should throw error', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const payload = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        },
        initialPosition: 0
      }

      Participant.addLimitAndInitialPosition.withArgs(params.name, payload).throws(new Error('Test error'))

      try {
        await Handler.addLimitAndInitialPosition(createRequest({ params, payload }))
      } catch (e) {
        test.ok(e instanceof FSPIOPError)
        test.equal(e.message, 'Test error')
        test.end()
      }
    })

    handlerTest.test('getLimits should return the participant limits for given currency and type of limit', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const query = {
        currency: 'USD',
        type: 'NET_DEBIT_CAP'
      }
      const expected = [
        {
          currency: 'USD',
          limit: {
            type: 'NET_DEBIT_CAP',
            value: 1000000,
            alarmPercentage: undefined
          }
        }
      ]
      const limitReturn = [
        {
          currencyId: 'USD',
          name: 'NET_DEBIT_CAP',
          value: 1000000
        }
      ]
      Participant.getLimits.withArgs(params.name, query).returns(Promise.resolve(limitReturn))
      const result = await Handler.getLimits(createRequest({ params, query }))
      test.deepEqual(result, expected, 'The results match')
      test.end()
    })

    handlerTest.test('getLimits should return empty array when no limits found', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const query = {
        currency: 'USD',
        type: 'NET_DEBIT_CAP'
      }
      const expected = []
      Participant.getLimits.withArgs(params.name, query).returns(Promise.resolve([]))
      const result = await Handler.getLimits(createRequest({ params, query }))
      test.deepEqual(result, expected, 'The results match')
      test.end()
    })

    handlerTest.test('getLimits should return the participant limits for given limit type', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const query = {
        type: 'NET_DEBIT_CAP'
      }
      const expected = [{
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 1000000,
          alarmPercentage: undefined
        }
      }, {
        currency: 'EUR',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 5000000,
          alarmPercentage: undefined
        }
      }]
      const limitReturn = [{
        currencyId: 'USD',
        name: 'NET_DEBIT_CAP',
        value: 1000000
      }, {
        currencyId: 'EUR',
        name: 'NET_DEBIT_CAP',
        value: 5000000
      }]
      Participant.getLimits.withArgs(params.name, query).returns(Promise.resolve(limitReturn))
      const result = await Handler.getLimits(createRequest({ params, query }))
      test.deepEqual(result, expected, 'The results match')
      test.end()
    })

    handlerTest.test('getLimits should return the participant limits for given currency if currency not returned in result', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const query = {
        currency: 'USD',
        type: 'NET_DEBIT_CAP'
      }
      const expected = [{
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 1000000,
          alarmPercentage: undefined
        }
      }]
      const limitReturn = [{
        name: 'NET_DEBIT_CAP',
        value: 1000000
      }]
      Participant.getLimits.withArgs(params.name, query).returns(Promise.resolve(limitReturn))
      const result = await Handler.getLimits(createRequest({ params, query }))
      test.deepEqual(result, expected, 'The results match')
      test.end()
    })

    handlerTest.test('getLimits should return the participant limits for given currency', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const query = {
        currency: 'USD'
      }
      const expected = [
        {
          currency: 'USD',
          limit: {
            type: 'NET_DEBIT_CAP',
            value: 1000000,
            alarmPercentage: undefined
          }
        }
      ]
      const limitReturn = [{
        currencyId: 'USD',
        name: 'NET_DEBIT_CAP',
        value: 1000000
      }]
      Participant.getLimits.withArgs(params.name, query).returns(Promise.resolve(limitReturn))
      const result = await Handler.getLimits(createRequest({ params, query }))
      test.deepEqual(result, expected, 'The results match')
      test.end()
    })

    handlerTest.test('getLimits should throw error', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const query = {
        currency: 'USD',
        type: 'NET_DEBIT_CAP'
      }
      Participant.getLimits.withArgs(params.name, query).throws(new Error('Test error'))

      try {
        await Handler.getLimits(createRequest({ params, query }))
      } catch (e) {
        test.ok(e instanceof FSPIOPError)
        test.equal(e.message, 'Test error')
        test.end()
      }
    })

    handlerTest.test('getLimitsForAllParticipants should return the participant limits for given currency and type of limit', async function (test) {
      const query = {
        currency: 'USD',
        type: 'NET_DEBIT_CAP'
      }
      const expected = [
        {
          name: 'fsp1',
          currency: 'USD',
          limit: {
            type: 'NET_DEBIT_CAP',
            value: 1000000,
            alarmPercentage: undefined
          }
        },
        {
          name: 'fsp2',
          currency: 'USD',
          limit: {
            type: 'NET_DEBIT_CAP',
            value: 2000000,
            alarmPercentage: undefined
          }
        }
      ]
      const limitReturn = [
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
      Participant.getLimitsForAllParticipants.withArgs(query).returns(Promise.resolve(limitReturn))
      const result = await Handler.getLimitsForAllParticipants(createRequest({ query }))
      test.deepEqual(result, expected, 'The results match')
      test.end()
    })

    handlerTest.test('getLimitsForAllParticipants should return empty array when no limits found', async function (test) {
      const query = {
        currency: 'USD',
        type: 'NET_DEBIT_CAP'
      }
      const expected = []
      Participant.getLimitsForAllParticipants.withArgs(query).returns(Promise.resolve([]))
      const result = await Handler.getLimitsForAllParticipants(createRequest({ query }))
      test.deepEqual(result, expected, 'The results match')
      test.end()
    })

    handlerTest.test('getLimitsForAllParticipants should throw error', async function (test) {
      const query = {
        currency: 'USD',
        type: 'NET_DEBIT_CAP'
      }
      Participant.getLimitsForAllParticipants.withArgs(query).throws(new Error('Test error'))

      try {
        await Handler.getLimitsForAllParticipants(createRequest({ query }))
      } catch (e) {
        test.ok(e instanceof FSPIOPError)
        test.equal(e.message, 'Test error')
        test.end()
      }
    })

    handlerTest.test('adjustLimits should adjust existing limits', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const payload = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000,
          alarmPercentage: 5
        }
      }
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: payload.limit.value,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 5
      }

      const expected = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000,
          alarmPercentage: 5
        }
      }

      Participant.adjustLimits.withArgs(params.name, payload).returns(Promise.resolve({ participantLimit }))
      const reply = {
        response: (response) => {
          return {
            code: statusCode => {
              test.equal(statusCode, 200, 'Participant limit adjusted successfully')
              test.deepEqual(response, expected, 'Results match')
              test.end()
            }
          }
        }
      }
      await Handler.adjustLimits(createRequest({ params, payload }), reply)
    })

    handlerTest.test('adjustLimits should throw error', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const payload = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        }
      }

      Participant.adjustLimits.withArgs(params.name, payload).throws(new Error('Test error'))

      try {
        await Handler.adjustLimits(createRequest({ params, payload }))
      } catch (e) {
        test.ok(e instanceof FSPIOPError)
        test.equal(e.message, 'Test error')
        test.end()
      }
    })

    handlerTest.test('getPositions should return the participant position for given participant name and currency', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const query = {
        currency: 'USD'
      }
      const expected = {
        currency: 'USD',
        value: 1000,
        updatedTime: '2018-08-14T04:01:55.000Z'
      }
      const positionReturn = {
        currency: 'USD',
        value: 1000,
        updatedTime: '2018-08-14T04:01:55.000Z'
      }
      Participant.getPositions.withArgs(params.name, query).returns(Promise.resolve(positionReturn))
      const result = await Handler.getPositions(createRequest({ params, query }))
      test.deepEqual(result, expected, 'The results match')
      test.end()
    })

    handlerTest.test('getPositions should return the participant positions for given participant name and all currencies if currency is not provided', async function (test) {
      const params = {
        name: 'fsp1'
      }

      const expected = [
        {
          currency: 'USD',
          value: 0,
          updatedTime: '2018-08-14T04:01:55.000Z'
        },
        {
          currency: 'EUR',
          value: 200,
          updatedTime: '2018-08-14T15:15:44.000Z'
        },
        {
          currency: 'ZAR',
          value: 200,
          updatedTime: '2018-08-14T15:33:27.000Z'
        },
        {
          currency: 'INR',
          value: 200.75,
          updatedTime: '2018-08-14T15:34:16.000Z'
        }
      ]
      const positionReturn = [
        {
          currency: 'USD',
          value: 0,
          updatedTime: '2018-08-14T04:01:55.000Z'
        },
        {
          currency: 'EUR',
          value: 200,
          updatedTime: '2018-08-14T15:15:44.000Z'
        },
        {
          currency: 'ZAR',
          value: 200,
          updatedTime: '2018-08-14T15:33:27.000Z'
        },
        {
          currency: 'INR',
          value: 200.75,
          updatedTime: '2018-08-14T15:34:16.000Z'
        }
      ]

      Participant.getPositions.withArgs(params.name, {}).returns(Promise.resolve(positionReturn))
      const result = await Handler.getPositions(createRequest({ params }))
      test.deepEqual(result, expected, 'The results match')
      test.end()
    })

    handlerTest.test('getPositions should throw error', async function (test) {
      const params = {
        name: 'invalid'
      }
      const query = {
        currency: 'USD'
      }

      Participant.getPositions.withArgs(params.name, query).throws(new Error('Test error'))

      try {
        await Handler.getPositions(createRequest({ params, query }))
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.ok(e instanceof FSPIOPError)
        test.equal(e.message, 'Test error')
        test.end()
      }
    })

    handlerTest.test('getAccounts should be called with the provided params and query', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const query = {
        currency: 'USD'
      }
      Participant.getAccounts.withArgs(params.name, query).returns(Promise.resolve(true))
      const result = await Handler.getAccounts(createRequest({ params, query }))
      test.ok(result, 'Result returned')
      test.ok(Participant.getAccounts.calledOnce, 'Participant.getAccounts called once')
      test.end()
    })

    handlerTest.test('getAccounts should throw error', async function (test) {
      const params = {
        name: 'invalid'
      }
      const query = {
        currency: 'USD'
      }

      Participant.getAccounts.withArgs(params.name, query).throws(new Error('Test error'))

      try {
        await Handler.getAccounts(createRequest({ params, query }))
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.ok(e instanceof FSPIOPError)
        test.equal(e.message, 'Test error')
        test.end()
      }
    })

    handlerTest.test('updateAccount should be called with the provided params and payload, and log when activated', async function (test) {
      const payload = {
        isActive: true
      }
      const params = {
        name: 'fsp1',
        id: 1
      }

      const h = {
        response: () => {
          return {
            code: statusCode => {
              test.deepEqual(statusCode, 200)
            }
          }
        }
      }

      try {
        await Handler.updateAccount(createRequest({ payload, params }), h)
        test.ok(Logger.info.withArgs('Participant account has been activated :: {"name":"fsp1","id":1,"isActive":true}').calledOnce, 'Logger.info called once')
        test.end()
      } catch (e) {
        test.fail(`error ${e} was thrown`)
        test.end()
      }
    })

    handlerTest.test('updateAccount should be called with the provided params and payload when isActive is false', async function (test) {
      const payload = {
        isActive: false
      }
      const params = {
        name: 'fsp1',
        id: 1
      }

      const h = {
        response: () => {
          return {
            code: statusCode => {
              test.deepEqual(statusCode, 200)
            }
          }
        }
      }

      try {
        await Handler.updateAccount(createRequest({ payload, params }), h)
        test.ok(Logger.info.withArgs('Participant account has been disabled :: {"name":"fsp1","id":1,"isActive":false}').calledOnce, 'Logger.info called once')
        test.end()
      } catch (e) {
        test.fail(`error ${e} was thrown`)
        test.end()
      }
    })

    handlerTest.test('updateAccount should be called with the provided params and payload, and skip logging when isActive is not part of the payload', async function (test) {
      const payload = {}
      const params = {
        name: 'fsp1',
        id: 1
      }

      const h = {
        response: () => {
          return {
            code: statusCode => {
              test.deepEqual(statusCode, 200)
            }
          }
        }
      }

      try {
        await Handler.updateAccount(createRequest({ payload, params }), h)
        test.notOk(Logger.info.called, 'Logger.info call omitted')
        test.end()
      } catch (e) {
        test.fail(`error ${e} was thrown`)
        test.end()
      }
    })

    handlerTest.test('updateAccount should throw error', async function (test) {
      const payload = {
        isActive: true
      }
      const params = {
        name: 'fsp1',
        id: 1
      }
      const h = {
        response: () => {
          return {
            code: statusCode => {
              test.deepEqual(statusCode, 200)
            }
          }
        }
      }
      Participant.updateAccount.throws(new Error('Test error'))

      try {
        await Handler.updateAccount(createRequest({ payload, params }), h)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.ok(e instanceof FSPIOPError)
        test.equal(e.message, 'Test error')
        test.end()
      }
    })

    handlerTest.test('create a hub account', async function (test) {
      const payload = {
        currency: 'ZAR',
        type: 'HUB_FEE'
      }
      const params = {
        name: 'Hub'
      }
      const participant = {
        participantId: 1,
        name: 'Hub',
        description: '',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z',
        createdBy: 'unknown',
        currencyList: []
      }
      const ledgerAccountType = {
        ledgerAccountTypeId: 5,
        name: 'HUB_FEE',
        description: 'An account to which fees will be charged or collected',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z'
      }
      const accountParams = {
        participantId: participant.participantId,
        currencyId: payload.currency,
        ledgerAccountTypeId: ledgerAccountType.ledgerAccountTypeId,
        isActive: 1
      }
      const participantCurrency = {
        participantCurrencyId: 5,
        participantId: 1,
        currencyId: 'USD',
        ledgerAccountTypeId: 5,
        isActive: 1,
        createdBy: 'unknown',
        createdDate: '2018-07-17T16:04:24.185Z'
      }
      const participantPosition = {
        participantPositionId: 1,
        participantCurrencyId: 1,
        value: 0,
        reservedValue: 0,
        changedDate: '2018-07-17T16:04:24.185Z'
      }
      Participant.getByName.withArgs('Hub').returns(Promise.resolve(participant))
      Participant.getLedgerAccountTypeName.withArgs(payload.type).returns(Promise.resolve(ledgerAccountType))
      Participant.getParticipantAccount.withArgs(accountParams).returns(Promise.resolve(undefined))
      Participant.createHubAccount.withArgs(participant.participantId, payload.currency, ledgerAccountType.ledgerAccountTypeId).returns(Promise.resolve({ participantCurrency, participantPosition }))
      const reply = {
        response: (response) => {
          return {
            code: statusCode => {
              test.deepEqual(response, participantResults[2], 'The results match')
              test.equal(statusCode, 201)
              test.end()
            }
          }
        }
      }
      await Handler.createHubAccount(createRequest({ params, payload }), reply)
    })

    handlerTest.test('fail if hub account in currency already exists', async function (test) {
      const payload = {
        currency: 'ZAR',
        type: 'HUB_FEE'
      }
      const params = {
        name: 'Hub'
      }
      const participant = {
        participantId: 1,
        name: 'Hub',
        description: '',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z',
        createdBy: 'unknown',
        currencyList: []
      }
      const ledgerAccountType = {
        ledgerAccountTypeId: 5,
        name: 'HUB_FEE',
        description: 'An account to which fees will be charged or collected',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z'
      }
      const accountParams = {
        participantId: participant.participantId,
        currencyId: payload.currency,
        ledgerAccountTypeId: ledgerAccountType.ledgerAccountTypeId,
        isActive: 1
      }

      Participant.getByName.withArgs('Hub').returns(Promise.resolve(participant))
      Participant.getLedgerAccountTypeName.withArgs(payload.type).returns(Promise.resolve(ledgerAccountType))
      Participant.getParticipantAccount.withArgs(accountParams).returns(Promise.resolve(true))

      try {
        await Handler.createHubAccount(createRequest({ params, payload }))
      } catch (err) {
        test.ok(err instanceof Error)
        test.equal(err.message, 'Hub account has already been registered.')
        test.end()
      }
    })

    handlerTest.test('fail if create hub account fails', async function (test) {
      const payload = {
        currency: 'ZAR',
        type: 'HUB_FEE'
      }
      const params = {
        name: 'Hub'
      }
      const participant = {
        participantId: 1,
        name: 'Hub',
        description: '',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z',
        createdBy: 'unknown',
        currencyList: []
      }
      const ledgerAccountType = {
        ledgerAccountTypeId: 5,
        name: 'HUB_FEE',
        description: 'An account to which fees will be charged or collected',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z'
      }
      const accountParams = {
        participantId: participant.participantId,
        currencyId: payload.currency,
        ledgerAccountTypeId: ledgerAccountType.ledgerAccountTypeId,
        isActive: 1
      }

      Participant.getByName.withArgs(params.name).returns(Promise.resolve(participant))
      Participant.getLedgerAccountTypeName.withArgs(payload.type).returns(Promise.resolve(ledgerAccountType))
      Participant.getParticipantAccount.withArgs(accountParams).returns(Promise.resolve(null))
      Participant.createHubAccount.withArgs(participant.participantId, payload.currency, ledgerAccountType.ledgerAccountTypeId).returns(Promise.resolve(null))

      try {
        await Handler.createHubAccount(createRequest({ params, payload }))
      } catch (err) {
        test.ok(err instanceof Error)
        test.equal(err.message, 'Participant account and Position create have failed.')
        test.end()
      }
    })

    await handlerTest.test('recordFundsInOut should be called once with the provided params and payload', async function (test) {
      const payload = {
        action: 'recordFundsIn',
        reason: 'ab'
      }
      const params = {
        name: 'dfsp1',
        id: 1,
        transferId: 'a87fc534-ee48-7775-b6a9-ead2955b6413'
      }

      const h = {
        response: () => {
          return {
            code: statusCode => {
              test.deepEqual(statusCode, 202)
            }
          }
        }
      }
      const enums = sandbox.stub()
      enums.withArgs('all').returns({})
      Participant.recordFundsInOut.withArgs(payload, params, {}).resolves()
      try {
        await Handler.recordFunds(createRequest({ payload, params }), h)
        test.end()
      } catch (e) {
        test.fail(`error ${e} was thrown`)
        test.end()
      }
    })

    await handlerTest.test('recordFundsInOut should throw if error occurs', async function (test) {
      const payload = {
        action: 'recordFundsIn',
        reason: 'ab'
      }
      const params = {
        name: 'dfsp1',
        id: 1,
        transferId: 'a87fc534-ee48-7775-b6a9-ead2955b6413'
      }

      const h = {
        response: () => {
          return {
            code: statusCode => {
              test.deepEqual(statusCode, 202)
            }
          }
        }
      }
      Participant.recordFundsInOut.throws(new Error('recordFundsInOut error'))
      try {
        await Handler.recordFunds(createRequest({ payload, params }), h)
        test.fail()
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'recordFundsInOut error')
        test.end()
      }
    })

    handlerTest.test('create a ledger account should throw an error at an invalid account type', async function (test) {
      const payload = {
        currency: 'ZAR',
        type: 'HUB_FEE'
      }
      const params = {
        name: 'fsp1'
      }
      const participant = {
        participantId: 1,
        name: 'fsp1',
        description: '',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z',
        createdBy: 'unknown',
        currencyList: [{ currencyId: 'USD', isActive: 1, ledgerAccountTypeId: 1 }]
      }
      const ledgerAccountType = {
        ledgerAccountTypeId: 4,
        name: 'HUB_FEE',
        description: 'An account to which fees will be charged or collected',
        isActive: 1,
        createdDate: '2018-10-23 14:14:08'
      }
      const accountParams = {
        participantId: participant.participantId,
        currencyId: payload.currency,
        ledgerAccountTypeId: ledgerAccountType.ledgerAccountTypeId,
        isActive: 1
      }
      const participantCurrency = {
        participantId: 1,
        currencyId: 'USD',
        ledgerAccountTypeId: 2,
        isActive: 1,
        createdBy: 'unknown',
        createdDate: '2018-10-23 14:17:07'
      }
      const participantPosition = {
        participantPositionId: 1,
        participantCurrencyId: 1,
        value: 0,
        reservedValue: 0,
        changedDate: '2018-10-23 14:17:07'
      }
      Participant.getByName.withArgs(participantFixtures[0].name).returns(Promise.resolve(participant))
      Participant.getLedgerAccountTypeName.withArgs(payload.type).returns(Promise.resolve(undefined))
      Participant.getParticipantAccount.withArgs(accountParams).returns(Promise.resolve(undefined))
      Participant.createHubAccount.withArgs(participant.participantId, payload.currency, ledgerAccountType.ledgerAccountTypeId).returns(Promise.resolve({ participantCurrency, participantPosition }))
      try {
        await Handler.createHubAccount(createRequest({ params, payload }))
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Ledger account type was not found.')
        test.end()
      }
    })

    handlerTest.test('create a hub account should throw an error if the Participant is invalid', async function (test) {
      const payload = {
        currency: 'ZAR',
        type: 'HUB_FEE'
      }
      const params = {
        name: 'fsp1'
      }
      const participant = {
        participantId: 2,
        name: 'Hub',
        description: '',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z',
        createdBy: 'unknown',
        currencyList: [{ currencyId: 'USD', isActive: 1, ledgerAccountTypeId: 1 }]
      }
      const ledgerAccountType = {
        ledgerAccountTypeId: 4,
        name: 'HUB_FEE',
        description: 'An account to which fees will be charged or collected',
        isActive: 1,
        createdDate: '2018-10-23 14:14:08'
      }
      const accountParams = {
        participantId: participant.participantId,
        currencyId: payload.currency,
        ledgerAccountTypeId: ledgerAccountType.ledgerAccountTypeId,
        isActive: 1
      }
      const participantCurrency = {
        participantId: 1,
        currencyId: 'USD',
        ledgerAccountTypeId: 5,
        isActive: 1,
        createdBy: 'unknown',
        createdDate: '2018-10-23 14:17:07'
      }
      const participantPosition = {
        participantPositionId: 1,
        participantCurrencyId: 1,
        value: 0,
        reservedValue: 0,
        changedDate: '2018-10-23 14:17:07'
      }
      Participant.getByName.withArgs(participantFixtures[2].name).returns(Promise.resolve(participant))
      Participant.getLedgerAccountTypeName.withArgs(payload.type).returns(Promise.resolve(ledgerAccountType))
      Participant.getParticipantAccount.withArgs(accountParams).returns(Promise.resolve(participantCurrency))
      Participant.createHubAccount.withArgs(participant.participantId, payload.currency, ledgerAccountType.ledgerAccountTypeId).returns(Promise.resolve({ participantCurrency, participantPosition }))
      try {
        await Handler.createHubAccount(createRequest({ params, payload }))
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Participant was not found.')
        test.end()
      }
    })
    handlerTest.test('create a ledger account should throw an error if creation fails ', async function (test) {
      const payload = {
        currency: 'AED',
        type: 'SETTLEMENT'
      }
      const params = {
        name: 'fsp1'
      }
      const participant = {
        participantId: 1,
        name: 'fsp1',
        description: '',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z',
        createdBy: 'unknown',
        currencyList: [{ currencyId: 'USD', isActive: 1, ledgerAccountTypeId: 1 }]
      }
      const ledgerAccountType = {
        ledgerAccountTypeId: 4,
        name: 'HUB_FEE',
        description: 'An account to which fees will be charged or collected',
        isActive: 1,
        createdDate: '2018-10-23 14:14:08'
      }
      const accountParams = {
        participantId: participant.participantId,
        currencyId: payload.currency,
        ledgerAccountTypeId: ledgerAccountType.ledgerAccountTypeId,
        isActive: 1
      }
      Participant.getByName.withArgs(participantFixtures[0].name).returns(Promise.resolve(participant))
      Participant.getLedgerAccountTypeName.withArgs(payload.type).returns(Promise.resolve(ledgerAccountType))
      Participant.getParticipantAccount.withArgs(accountParams).returns(Promise.resolve(undefined))
      Participant.createHubAccount.withArgs(participant.participantId, payload.currency, ledgerAccountType.ledgerAccountTypeId).returns(Promise.resolve(undefined))
      try {
        await Handler.createHubAccount(createRequest({ params, payload }))
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'The requested hub operator account type is not allowed.')
        test.end()
      }
    })
    handlerTest.test('create a ledger account should !!! ', async function (test) {
      const payload = {
        currency: 'AED',
        type: 'HUB_FEE'
      }
      const params = {
        name: 'fsp1'
      }
      const participant = {
        participantId: 2,
        name: 'fsp1',
        description: '',
        isActive: 1,
        createdDate: '2018-07-17T16:04:24.185Z',
        createdBy: 'unknown',
        currencyList: [{ currencyId: 'USD', isActive: 1, ledgerAccountTypeId: 1 }]
      }
      const ledgerAccountType = {
        ledgerAccountTypeId: 4,
        name: 'HUB_FEE',
        description: 'An account to which fees will be charged or collected',
        isActive: 1,
        createdDate: '2018-10-23 14:14:08'
      }
      const accountParams = {
        participantId: participant.participantId,
        currencyId: payload.currency,
        ledgerAccountTypeId: ledgerAccountType.ledgerAccountTypeId,
        isActive: 1
      }
      const participantCurrency = {
        participantId: 1,
        currencyId: 'USD',
        ledgerAccountTypeId: 2,
        isActive: 1,
        createdBy: 'unknown',
        createdDate: '2018-10-23 14:17:07'
      }
      const participantPosition = {
        participantPositionId: 1,
        participantCurrencyId: 1,
        value: 0,
        reservedValue: 0,
        changedDate: '2018-10-23 14:17:07'
      }
      Participant.getByName.withArgs(participantFixtures[0].name).returns(Promise.resolve(participant))
      Participant.getLedgerAccountTypeName.withArgs(payload.type).returns(Promise.resolve(ledgerAccountType))
      Participant.getParticipantAccount.withArgs(accountParams).returns(Promise.resolve(undefined))
      Participant.createHubAccount.withArgs(participant.participantId, payload.currency, ledgerAccountType.ledgerAccountTypeId).returns(Promise.resolve({ participantCurrency, participantPosition }))
      try {
        await Handler.createHubAccount(createRequest({ params, payload }))
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Endpoint is reserved for creation of Hub account types only.')
        test.end()
      }
    })
    handlerTest.end()
  })

  participantHandlerTest.end()
})
