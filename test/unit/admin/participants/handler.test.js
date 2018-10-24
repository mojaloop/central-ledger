'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')

const Logger = require('@mojaloop/central-services-shared').Logger
const Handler = require('../../../../src/admin/participants/handler')
const Sidecar = require('../../../../src/lib/sidecar')
const Participant = require('../../../../src/domain/participant')

const createRequest = ({ payload, params, query }) => {
  let sandbox = Sinon.createSandbox()
  const requestPayload = payload || {}
  const requestParams = params || {}
  const requestQuery = query || {}
  let enums = sandbox.stub()
  enums.withArgs('ledgerAccountType').returns({POSITION: 1, SETTLEMENT: 2})
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
        { currencyId: 'USD', ledgerAccountTypeId: 1, isActive: 1 },
        { currencyId: 'USD', ledgerAccountTypeId: 2, isActive: 1 }
      ]
    },
    {
      participantId: 2,
      name: 'fsp2',
      currency: 'EUR',
      isActive: 1,
      createdDate: '2018-07-17T16:04:24.185Z',
      currencyList: [
        { currencyId: 'EUR', ledgerAccountTypeId: 1, isActive: 1 },
        { currencyId: 'EUR', ledgerAccountTypeId: 2, isActive: 1 }
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
      currencies: [
        { currency: 'USD', ledgerAccountTypeId: 1, isActive: 1 },
        { currency: 'USD', ledgerAccountTypeId: 2, isActive: 1 }
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
      currencies: [
        { currency: 'EUR', ledgerAccountTypeId: 1, isActive: 1 },
        { currency: 'EUR', ledgerAccountTypeId: 2, isActive: 1 }
      ]
    }
  ]

  participantHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Sidecar)
    sandbox.stub(Logger)
    sandbox.stub(Participant)
    test.end()
  })

  participantHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  participantHandlerTest.test('Handler Test', async handlerTest => {
    handlerTest.test('getAll should return all the participants', async function (test) {
      Participant.getAll.returns(P.resolve(participantFixtures))
      const result = await Handler.getAll(createRequest({}))
      test.deepEqual(result, participantResults, 'The results match')
      test.end()
    })

    handlerTest.test('getByName should return the participant', async function (test) {
      Participant.getByName.withArgs(participantFixtures[0].name).returns(P.resolve(participantFixtures[0]))
      const result = await Handler.getByName(createRequest({ params: { name: participantFixtures[0].name } }))
      test.deepEqual(result, participantResults[0], 'The results match')
      test.end()
    })

    handlerTest.test('getByName should throw error', async function (test) {
      Participant.getByName.withArgs(participantFixtures[0].name).returns(P.resolve(null))
      try {
        await Handler.getByName(createRequest({ params: { name: participantFixtures[0].name } }))
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'The requested resource could not be found.')
        test.end()
      }
    })

    handlerTest.test('update should update and return the participant', async function (test) {
      Participant.update.withArgs(participantFixtures[0].name, { isActive: 1 }).returns(P.resolve(participantFixtures[0]))
      const result = await Handler.update(createRequest({ params: { name: participantFixtures[0].name }, payload: { isActive: 1 } }))
      test.deepEqual(result, participantResults[0], 'The results match')
      test.end()
    })

    handlerTest.test('update should throw error', async function (test) {
      Participant.update.withArgs(participantFixtures[0].name, { isActive: 1 }).throws(new Error())
      try {
        await Handler.update(createRequest({ params: { name: participantFixtures[0].name }, payload: { isActive: 1 } }))
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Bad Request')
        test.end()
      }
    })

    handlerTest.test('create should create and return the new participant', async function (test) {
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
      const currencyList1 = { currencyId: 'USD', ledgerAccountTypeId: 1, isActive: 1 }
      const currencyList2 = { currencyId: 'USD', ledgerAccountTypeId: 2, isActive: 1 }

      Participant.getByName.withArgs(participantFixtures[0].name).returns(P.resolve(null))
      Participant.create.withArgs(payload).returns(P.resolve(participant.participantId))
      Participant.getById.withArgs(participant.participantId).returns(P.resolve(participant))
      Participant.createParticipantCurrency.withArgs(participant.participantId, payload.currency, 1).returns(P.resolve(participantCurrencyId1))
      Participant.createParticipantCurrency.withArgs(participant.participantId, payload.currency, 2).returns(P.resolve(participantCurrencyId2))
      Participant.getParticipantCurrencyById.withArgs(participantCurrencyId1).returns(P.resolve(currencyList1))
      Participant.getParticipantCurrencyById.withArgs(participantCurrencyId2).returns(P.resolve(currencyList2))
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

    handlerTest.test('create should fail if the participant exists', async function (test) {
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

      Participant.getByName.withArgs(participantFixtures[0].name).returns(P.resolve(participant))
      try {
        await Handler.create(createRequest({ payload }))
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Participant currency has already been registered')
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

      Participant.getByName.withArgs(participantFixtures[0].name).returns(P.resolve(participant))
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
      Participant.getByName.withArgs(participantFixtures[0].name).returns(P.resolve(null))
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

      Participant.addEndpoint.withArgs(params.name, payload).returns(P.resolve(1))
      const reply = {
        response: (response) => {
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

      Participant.addEndpoint.withArgs(params.name, payload).throws(new Error())

      try {
        await Handler.addEndpoint(createRequest({ params, payload }))
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Bad Request')
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
      Participant.getEndpoint.withArgs(params.name, query.type).returns(P.resolve(endpointReturn))
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
      Participant.getEndpoint.withArgs(params.name, query.type).returns(P.resolve(endpointReturn))
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

      Participant.getAllEndpoints.withArgs(params.name).returns(P.resolve(endpoints))
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

      Participant.getAllEndpoints.withArgs(params.name).returns(P.resolve(endpoints))
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
      Participant.getEndpoint.withArgs(params.name, query.type).throws(new Error())

      try {
        await Handler.getEndpoint(createRequest({ params, query }))
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Bad Request')
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

      Participant.addLimitAndInitialPosition.withArgs(params.name, payload).returns(P.resolve(1))
      const reply = {
        response: (response) => {
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

      Participant.addLimitAndInitialPosition.withArgs(params.name, payload).returns(P.resolve(1))
      const reply = {
        response: (response) => {
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

      Participant.addLimitAndInitialPosition.withArgs(params.name, payload).throws(new Error())

      try {
        await Handler.addLimitAndInitialPosition(createRequest({ params, payload }))
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Bad Request')
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
            value: 1000000
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
      Participant.getLimits.withArgs(params.name, query).returns(P.resolve(limitReturn))
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
      Participant.getLimits.withArgs(params.name, query).returns(P.resolve([]))
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
          value: 1000000
        }
      }, {
        currency: 'EUR',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 5000000
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
      Participant.getLimits.withArgs(params.name, query).returns(P.resolve(limitReturn))
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
          value: 1000000
        }
      }]
      const limitReturn = [{
        name: 'NET_DEBIT_CAP',
        value: 1000000
      }]
      Participant.getLimits.withArgs(params.name, query).returns(P.resolve(limitReturn))
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
            value: 1000000
          }
        }
      ]
      const limitReturn = [{
        currencyId: 'USD',
        name: 'NET_DEBIT_CAP',
        value: 1000000
      }]
      Participant.getLimits.withArgs(params.name, query).returns(P.resolve(limitReturn))
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
      Participant.getLimits.withArgs(params.name, query).throws(new Error())

      try {
        await Handler.getLimits(createRequest({ params, query }))
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Bad Request')
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
          value: 10000000
        }
      }
      let participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: payload.limit.value,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1
      }

      const expected = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        }
      }

      Participant.adjustLimits.withArgs(params.name, payload).returns(P.resolve({ participantLimit }))
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

      Participant.adjustLimits.withArgs(params.name, payload).throws(new Error())

      try {
        await Handler.adjustLimits(createRequest({ params, payload }))
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Bad Request')
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
      Participant.getPositions.withArgs(params.name, query).returns(P.resolve(positionReturn))
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

      Participant.getPositions.withArgs(params.name, {}).returns(P.resolve(positionReturn))
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

      Participant.getPositions.withArgs(params.name, query).throws(new Error())

      try {
        await Handler.getPositions(createRequest({ params, query }))
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Bad Request')
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
      Participant.getAccounts.withArgs(params.name, query).returns(P.resolve(true))
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

      Participant.getAccounts.withArgs(params.name, query).throws(new Error())

      try {
        await Handler.getAccounts(createRequest({ params, query }))
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Bad Request')
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
        response: (response) => {
          return {
            code: statusCode => {
              test.deepEqual(statusCode, 202)
            }
          }
        }
      }

      let enums = sandbox.stub()
      enums.withArgs('all').returns({})
      Participant.recordFundsInOut.withArgs(payload, params, {}).resolves()
      try {
        await Handler.recordFunds(createRequest({payload, params}), h)
        test.end()
      } catch (e) {
        test.fail(`error ${e} was thrown`)
        test.end()
      }
    })

    await handlerTest.test('recordFundsInOut should throw', async function (test) {
      const payload = {
        action: 'any',
        reason: ''
      }
      const params = {
        name: 'dfsp1',
        id: 1,
        transferId: 'a87fc534-ee48-7775-b6a9-ead2955b6413'
      }

      const error = new Error('error')

      const h = {
        response: response => {
          return {
            code: () => {
              return test.deepEqual(response, error)
            }
          }
        }
      }

      let enums = sandbox.stub()
      enums.withArgs('all').returns({enums: 'a'})
      Participant.recordFundsInOut.withArgs(payload, params, undefined).throws(error)
      try {
        await Handler.recordFunds(createRequest({payload, params}), h)
        test.fail('error not thrown')
        test.end()
      } catch (e) {
        test.end()
      }
    })

    handlerTest.end()
  })

  participantHandlerTest.end()
})
