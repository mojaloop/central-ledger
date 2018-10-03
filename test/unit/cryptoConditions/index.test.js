'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Conditions = require('../../../src/cryptoConditions')
const Errors = require('../../../src/errors')
const FiveBellsConditions = require('five-bells-condition')

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
        test.assert(error instanceof Errors.ValidationError)
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

  conditionsTest.test('validateFulfilment should', validateFulfilmentTest => {
    validateFulfilmentTest.test('throw InvalidBodyError if five-bells fulfilmentToCondition throws', test => {
      const fulfilment = 'some-fulfilment'
      const condition = 'some-condition'
      const error = new Error('message')
      FiveBellsConditions.fulfillmentToCondition.withArgs(fulfilment).throws(error)
      try {
        Conditions.validateFulfilment(fulfilment, condition)
        test.fail('Should have thrown')
      } catch (error) {
        test.assert(error instanceof Errors.InvalidBodyError)
        test.equal(error.message, 'Invalid fulfilment: message')
      }
      test.end()
    })

    validateFulfilmentTest.test('throw InvalidBodyError if five-bell validateFulfilment throws error', test => {
      const condition = 'some-condition'
      const fulfilment = 'some-fulfilment'
      const error = new Error('message')
      FiveBellsConditions.fulfillmentToCondition.withArgs(fulfilment).returns(condition)
      FiveBellsConditions.validateFulfillment.withArgs(fulfilment, condition).throws(error)
      try {
        Conditions.validateFulfilment(fulfilment, condition)
        test.fail('Should have thrown')
      } catch (error) {
        test.assert(error instanceof Errors.InvalidBodyError)
        test.equal(error.message, 'Invalid fulfilment: message')
      }
      test.end()
    })

    validateFulfilmentTest.test('throw UnmetConditionError if fulfilmentCondition does not equal condition', test => {
      const fulfilment = 'some-fulfilment'
      const condition = 'some-condition'
      FiveBellsConditions.fulfillmentToCondition.withArgs(fulfilment).returns('not' + condition)
      try {
        Conditions.validateFulfilment(fulfilment, condition)
        test.fail('Should have thrown')
      } catch (error) {
        test.assert(error instanceof Errors.UnmetConditionError)
        test.equal(error.message, 'Fulfilment does not match any condition')
      }
      test.end()
    })

    validateFulfilmentTest.test('return true if five-bell fulfilment returns true', test => {
      const condition = 'some-condition'
      const fulfilment = 'some-fulfilment'
      FiveBellsConditions.fulfillmentToCondition.returns(condition)
      FiveBellsConditions.validateFulfillment.withArgs(fulfilment, condition).returns(true)
      test.equal(Conditions.validateFulfilment(fulfilment, condition), true)
      test.end()
    })

    validateFulfilmentTest.end()
  })

  conditionsTest.end()
})
