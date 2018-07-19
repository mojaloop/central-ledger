'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')

const Logger = require('@mojaloop/central-services-shared').Logger
const Handler = require('../../../../src/admin/participants/handler')
const Sidecar = require('../../../../src/lib/sidecar')
const Participant = require('../../../../src/domain/participant')

const createRequest = ({ payload, params, query }) => {
  const requestPayload = payload || {}
  const requestParams = params || {}
  const requestQuery = query || {}
  return {
    payload: requestPayload,
    params: requestParams,
    query: requestQuery,
    server: {
      log: () => { }
    }
  }
}

Test('Participant Handler', participantHandlerTest => {
  let sandbox

  const participantFixtures = [
    {
      participantId: 1,
      name: 'fsp1',
      currency: 'USD',
      isActive: 1,
      createdDate: '2018-07-17T16:04:24.185Z',
      currencyList: [{ currencyId: 'USD', isActive: 1 }]
    },
    {
      participantId: 2,
      name: 'fsp2',
      currency: 'EUR',
      isActive: 1,
      createdDate: '2018-07-17T16:04:24.185Z',
      currencyList: [{ currencyId: 'EUR', isActive: 1 }]
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
      currencies: [{ currency: 'USD', isActive: 1 }]
    },
    {
      name: 'fsp2',
      id: 'http://central-ledger/participants/fsp2',
      created: '2018-07-17T16:04:24.185Z',
      isActive: 1,
      links: {
        self: 'http://central-ledger/participants/fsp2'
      },
      currencies: [{ currency: 'EUR', isActive: 1 }]
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

  participantHandlerTest.test('Handler Test', handlerTest => {
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

      const participantCurrencyId = 1
      const currencyList = { currencyId: 'USD', isActive: 1 }

      Participant.getByName.withArgs(participantFixtures[0].name).returns(P.resolve(null))
      Participant.create.withArgs(payload).returns(P.resolve(participant.participantId))
      Participant.getById.withArgs(participant.participantId).returns(P.resolve(participant))
      Participant.createParticipantCurrency.withArgs(participant.participantId, payload.currency).returns(P.resolve(participantCurrencyId))
      Participant.getParticipantCurrencyById.withArgs(participantCurrencyId).returns(P.resolve(currencyList))
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
        endpoint: {
          type: 'FSIOP_CALLBACK_URL',
          value: 'http://localhost:3001/participants/dfsp1/notification1'
        }
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
        endpoint: {
          type: 'FSIOP_CALLBACK_URL',
          value: 'http://localhost:3001/participants/dfsp1/notification1'
        }
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
        type: 'FSIOP_CALLBACK_URL'
      }
      const endpoint = {
        type: 'FSIOP_CALLBACK_URL',
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }
      const endpointReturn = [{
        name: 'FSIOP_CALLBACK_URL',
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }]
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
          name: 'FSIOP_CALLBACK_URL',
          value: 'http://localhost:3001/participants/dfsp1/notification1'
        },
        {
          name: 'ALARM_NOTIFICATION_URL',
          value: 'http://localhost:3001/participants/dfsp1/notification2'
        }
      ]
      const endpointsResult = [
        {
          type: 'FSIOP_CALLBACK_URL',
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

    handlerTest.test('getEndpoint should throw error', async function (test) {
      const params = {
        name: 'fsp1'
      }
      const query = {
        type: 'FSIOP_CALLBACK_URL'
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

    handlerTest.end()
  })

  participantHandlerTest.end()
})
