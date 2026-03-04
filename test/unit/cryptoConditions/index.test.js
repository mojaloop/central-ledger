'use strict'

const assert = require('node:assert')
const Test = require('tapes')(require('tape'))

const conditions = require('../../../src/cryptoConditions/index.js')

Test('conditions', conditionsTest => {
  conditionsTest.test('it parses a valid condition correctly', test => {
    const condition = 'sQaSwqzbjSlSYzllZs1O9Njv9b46yoEHmPqk3d4e46s'
    conditions.validateCondition(condition)
    test.end()
  })

  conditionsTest.test('it fails on undefined', test => {
    try {
      conditions.validateCondition(undefined)
      test.fail('Should have thrown.')
    } catch (err) {
      assert.equal(err.message, 'Condition not defined.')
    } finally {
      test.end()
    }
  })

  conditionsTest.test('it fails on an empty string', test => {
    try {
      conditions.validateCondition('')
      test.fail('Should have thrown.')
    } catch (err) {
      assert.equal(err.message, 'Condition not defined.')
    } finally {
      test.end()
    }
  })

  conditionsTest.test('it fails on a short condition string', test => {
    try {
      conditions.validateCondition('test_invalid_condition')
      test.fail('Should have thrown.')
    } catch (err) {
      assert.equal(err.message, 'Expected condition to have length of 32, found: 16.')
    } finally {
      test.end()
    }
  })

  conditionsTest.test('it fails on a long condition string', test => {
    try {
      conditions.validateCondition('7f3a9c2d8e1b4f6a0c5d7e9f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b')
      test.fail('Should have thrown.')
    } catch (err) {
      assert.equal(err.message, 'Expected condition to have length of 32, found: 48.')
    } finally {
      test.end()
    }
  })

  conditionsTest.end()
})
