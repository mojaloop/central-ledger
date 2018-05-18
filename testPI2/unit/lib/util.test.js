'use strict'

const Test = require('tape')
const Util = require('../../../src/lib/util')

Test('util', utilTest => {
  utilTest.test('formatAmount should', formatAmountTest => {
    formatAmountTest.test('format integer', test => {
      const value = parseInt('100')
      test.equal(Util.formatAmount(value), '100.00')
      test.end()
    })

    formatAmountTest.test('format decimal', test => {
      const value = parseFloat('100.01')
      test.equal(Util.formatAmount(value), '100.01')
      test.end()
    })

    formatAmountTest.test('format string', test => {
      const value = '5.1'
      test.equal(Util.formatAmount(value), '5.10')
      test.end()
    })
    formatAmountTest.end()
  })

  utilTest.test('parseJson should', parseJsonTest => {
    parseJsonTest.test('return null if value null', test => {
      const value = null
      test.notOk(Util.parseJson(value))
      test.end()
    })
    parseJsonTest.test('return value if value not string', test => {
      const value = {}
      test.equal(Util.parseJson(value), value)
      test.end()
    })

    parseJsonTest.test('return value if number', test => {
      const value = 1000
      test.equal(Util.parseJson(value), value)
      test.end()
    })

    parseJsonTest.test('return value if string that is not json', test => {
      const value = 'some really long string'
      test.equal(Util.parseJson(value), value)
      test.end()
    })

    parseJsonTest.test('return object if value is json string', test => {
      const obj = {
        prop1: 'test',
        prop2: {
          'date_time': new Date().toDateString(),
          'number': 1000
        }
      }
      const value = JSON.stringify(obj)

      const result = Util.parseJson(value)
      test.notEqual(result, value)
      test.deepEqual(result, obj)
      test.end()
    })
    parseJsonTest.end()
  })

  utilTest.test('filterUndefined should', filterUndefinedTest => {
    filterUndefinedTest.test('return map with undefined values stripped out', test => {
      const undefinedMap = {}
      const obj1 = {
        prop1: 'test',
        prop2: {
          'date_time': new Date().toDateString(),
          'number': 1000
        },
        prop3: undefinedMap.prop3,
        prop4: null
      }

      const obj2 = {
        prop1: 'test',
        prop2: {
          'date_time': new Date().toDateString(),
          'number': 1000
        },
        prop4: null
      }

      const result = Util.filterUndefined(obj1)
      test.deepEqual(result, obj2)
      test.end()
    })
    filterUndefinedTest.end()
  })

  utilTest.end()
})
