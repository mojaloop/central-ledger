'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Config = require('../../../../src/lib/config')
const InvalidBodyError = require('@mojaloop/central-services-error-handling').InvalidBodyError
const ValidationError = require('../../../../src/errors').ValidationError
const Accounts = require('../../../../src/domain/account')
const Validator = require('../../../../src/api/messages/validator')

Test('messages request validator', validatorTest => {
  let sandbox

  validatorTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Accounts, 'exists')
    Accounts.exists.returns(P.resolve({}))
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

    validateTest.test('return InvalidBodyError if to account not found', test => {
      const toAccount = 'http://to-account'
      const fromAccount = 'http://from-account'
      const request = { ledger: Config.HOSTNAME, to: toAccount, from: fromAccount }
      Accounts.exists.withArgs(toAccount).returns(P.reject(new ValidationError('Account does not exist')))

      Validator.validate(request)
        .catch(InvalidBodyError, e => {
          test.deepEqual(e.payload.validationErrors, [{ message: 'Account does not exist', params: { key: 'to', value: toAccount } }])
          test.end()
        })
    })

    validateTest.test('return InvalidBodyError if from account not found', test => {
      const toAccount = 'http://to-account'
      const fromAccount = 'http://from-account'
      const request = { ledger: Config.HOSTNAME, to: toAccount, from: fromAccount }
      Accounts.exists.withArgs(fromAccount).returns(P.reject(new ValidationError('Account does not exist')))

      Validator.validate(request)
        .catch(InvalidBodyError, e => {
          test.deepEqual(e.payload.validationErrors, [{ message: 'Account does not exist', params: { key: 'from', value: fromAccount } }])
          test.end()
        })
    })

    validateTest.test('return request', test => {
      const toAccount = 'http://to-account'
      const fromAccount = 'http://from-account'
      const request = { ledger: Config.HOSTNAME, to: toAccount, from: fromAccount }
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
