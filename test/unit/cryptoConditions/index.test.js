'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Conditions = require('../../../src/cryptoConditions')
const FiveBellsConditions = require('five-bells-condition')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

Test('crypto conditions', conditionsTest => {
  let sandbox

  conditionsTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(FiveBellsConditions, 'validateCondition')
    sandbox.stub(FiveBellsConditions, 'validateFulfillment')
    sandbox.stub(FiveBellsConditions, 'fulfillmentToCondition')
    test.end()
  })

  conditionsTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  conditionsTest.test('validateCondition should', validateConditionTest => {
    validateConditionTest.test('throw error if five-bell check throws error', test => {
      const condition = 'some-condition'
      const error = new Error('message')
      FiveBellsConditions.validateCondition.withArgs(condition).throws(error)
      try {
        Conditions.validateCondition(condition)
        test.fail('Should have thrown')
        test.end()
      } catch (error) {
        test.assert(error instanceof ErrorHandler.Factory.FSPIOPError)
        test.equal(error.apiErrorCode.code, ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)
        test.equal(error.message, 'message')
        test.end()
      }
    })

    validateConditionTest.test('return true if five-bell condition returns true', test => {
      const condition = 'some-condition'
      FiveBellsConditions.validateCondition.withArgs(condition).returns(true)
      test.equal(Conditions.validateCondition(condition), true)
      test.end()
    })
    validateConditionTest.end()
  })

  conditionsTest.end()
})
