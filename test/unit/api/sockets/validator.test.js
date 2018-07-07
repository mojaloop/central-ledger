'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Validator = require('../../../../src/api/sockets/validator')
const ParticipantService = require('../../../../src/domain/participant')

Test('subscription validator', validatorTest => {
  let sandbox

  validatorTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(ParticipantService, 'exists')
    test.end()
  })

  validatorTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  validatorTest.test('validateSubscriptionRequest should', requestTest => {
    requestTest.test('throw error if request is not valid json', test => {
      Validator.validateSubscriptionRequest('', (err, result) => {
        test.equal(err.payload.id, 'InvalidSubscriptionRequestError')
        test.equal(err.payload.message, 'Invalid subscription request')
        test.equal(err.payload.validationErrors[0].message, 'Unexpected end of JSON input')
        test.end()
      })
    })

    requestTest.test('throw error if id is not present', test => {
      Validator.validateSubscriptionRequest('{}', (err, result) => {
        test.equal(err.payload.id, 'InvalidSubscriptionRequestError')
        test.equal(err.payload.message, 'Invalid subscription request')
        test.equal(err.payload.validationErrors[0].message, 'id is required')
        test.end()
      })
    })

    requestTest.test('throw error if jsonrpc is not present', test => {
      const request = JSON.stringify({ id: 1 })
      Validator.validateSubscriptionRequest(request, (err, result) => {
        test.equal(err.payload.id, 'InvalidSubscriptionRequestError')
        test.equal(err.payload.message, 'Invalid subscription request')
        test.equal(err.payload.validationErrors[0].message, 'jsonrpc is required')
        test.end()
      })
    })

    requestTest.test('throw error if jsonrpc is not 2.0', test => {
      const request = JSON.stringify({ id: 1, jsonrpc: '0.2' })
      Validator.validateSubscriptionRequest(request, (err, result) => {
        test.equal(err.payload.id, 'InvalidSubscriptionRequestError')
        test.equal(err.payload.message, 'Invalid subscription request')
        test.equal(err.payload.validationErrors[0].message, 'jsonrpc must be one of [2.0]')
        test.end()
      })
    })

    requestTest.test('throw error if method is not present', test => {
      const request = JSON.stringify({ id: 1, jsonrpc: '2.0' })
      Validator.validateSubscriptionRequest(request, (err, result) => {
        test.equal(err.payload.id, 'InvalidSubscriptionRequestError')
        test.equal(err.payload.message, 'Invalid subscription request')
        test.equal(err.payload.validationErrors[0].message, 'method is required')
        test.end()
      })
    })

    requestTest.test('throw error if method is not "subscribe_participant"', test => {
      const request = JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'not subscribe participant' })
      Validator.validateSubscriptionRequest(request, (err, result) => {
        test.equal(err.payload.id, 'InvalidSubscriptionRequestError')
        test.equal(err.payload.message, 'Invalid subscription request')
        test.equal(err.payload.validationErrors[0].message, 'method must be one of [subscribe_participant]')
        test.end()
      })
    })

    requestTest.test('throw error if params is not present', test => {
      const request = JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'subscribe_participant' })
      Validator.validateSubscriptionRequest(request, (err, result) => {
        test.equal(err.payload.id, 'InvalidSubscriptionRequestError')
        test.equal(err.payload.message, 'Invalid subscription request')
        test.equal(err.payload.validationErrors[0].message, 'params is required')
        test.end()
      })
    })

    requestTest.test('throw error if params.participant is not present', test => {
      const request = JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'subscribe_participant', params: {} })
      Validator.validateSubscriptionRequest(request, (err, result) => {
        test.equal(err.payload.id, 'InvalidSubscriptionRequestError')
        test.equal(err.payload.message, 'Invalid subscription request')
        const validationError = err.payload.validationErrors[0]
        test.equal(validationError.message, 'participant is required')
        test.equal(validationError.params.key, 'participant')
        test.end()
      })
    })

    requestTest.test('throw error if participant not parseable uri', test => {
      const participant = ['test1']
      const request = JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'subscribe_participant', params: { participant: participant } })
      Validator.validateSubscriptionRequest(request, (err, result) => {
        test.equal(err.payload.id, 'InvalidSubscriptionRequestError')
        test.equal(err.payload.message, 'Invalid subscription request')
        const validationError = err.payload.validationErrors[0]
        test.equal(validationError.message, '0 must be a valid uri')
        test.equal(validationError.params.key, 0)
        test.equal(validationError.params.value, 'test1')
        test.end()
      })
    })

    requestTest.test('throw error if participant does not exist', test => {
      const errorMessage = 'error message'
      ParticipantService.exists.returns(P.reject(new Error(errorMessage)))
      const participantUrl = 'http://central-ledger/participants/dfsp1'
      const participant = [participantUrl]
      const request = JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'subscribe_participant', params: { participant } })
      Validator.validateSubscriptionRequest(request, (err, result) => {
        test.equal(err.payload.id, 'InvalidSubscriptionRequestError')
        test.equal(err.payload.message, 'Invalid subscription request')
        const validationError = err.payload.validationErrors[0]
        test.equal(validationError.message, errorMessage)
        test.end()
      })
    })

    requestTest.test('return id, jsonrpc and participant if valid', test => {
      const participant = {}
      ParticipantService.exists.returns(P.resolve(participant))
      const participants = ['http://ledger1/participants/test1', 'http://ledger1/participants/test2']
      const request = JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'subscribe_participant', params: { participant: participant, eventType: '*' } })
      Validator.validateSubscriptionRequest(request, (err, result) => {
        test.notOk(err)
        test.equal(result.id, 1)
        test.equal(result.jsonrpc, '2.0')
        test.deepEqual(result.participantUris, participants)
        test.end()
      })
    })
    requestTest.end()
  })
  validatorTest.end()
})
