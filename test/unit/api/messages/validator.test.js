'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Config = require('../../../../src/lib/config')
const InvalidBodyError = require('@mojaloop/central-services-error-handling').InvalidBodyError
const ValidationError = require('../../../../src/errors').ValidationError
const Participants = require('../../../../src/domain/participant')
const Validator = require('../../../../src/api/messages/validator')

Test('messages request validator', validatorTest => {
  let sandbox

  validatorTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Participants, 'exists')
    Participants.exists.returns(P.resolve({}))
    test.end()
  })

  validatorTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  validatorTest.test('validate should', validateTest => {
    validateTest.test('return InvalidBodyError if ledger does not match Config.HOSTNAME', test => {
      const ledgerValue = 'not host name'
      const request = { ledger: ledgerValue }
      Validator.validate(request)
        .catch(InvalidBodyError, e => {
          test.deepEqual(e.payload.validationErrors, [{ message: 'ledger is not valid for this ledger', params: { key: 'ledger', value: ledgerValue } }])
          test.end()
        })
    })

    validateTest.test('return InvalidBodyError if to participant not found', test => {
      const toParticipant = 'http://to-participant'
      const fromParticipant = 'http://from-participant'
      const request = { ledger: Config.HOSTNAME, to: toParticipant, from: fromParticipant }
      Participants.exists.withArgs(toParticipant).returns(P.reject(new ValidationError('Participant does not exist')))

      Validator.validate(request)
        .catch(InvalidBodyError, e => {
          test.deepEqual(e.payload.validationErrors, [{ message: 'Participant does not exist', params: { key: 'to', value: toParticipant } }])
          test.end()
        })
    })

    validateTest.test('return InvalidBodyError if from participant not found', test => {
      const toParticipant = 'http://to-participant'
      const fromParticipant = 'http://from-participant'
      const request = { ledger: Config.HOSTNAME, to: toParticipant, from: fromParticipant }
      Participants.exists.withArgs(fromParticipant).returns(P.reject(new ValidationError('Participant does not exist')))

      Validator.validate(request)
        .catch(InvalidBodyError, e => {
          test.deepEqual(e.payload.validationErrors, [{ message: 'Participant does not exist', params: { key: 'from', value: fromParticipant } }])
          test.end()
        })
    })

    validateTest.test('return request', test => {
      const toParticipant = 'http://to-participant'
      const fromParticipant = 'http://from-participant'
      const request = { ledger: Config.HOSTNAME, to: toParticipant, from: fromParticipant }
      Validator.validate(request)
        .then(r => {
          test.deepEqual(r, request)
          test.end()
        })
    })

    validateTest.end()
  })
  validatorTest.end()
})
