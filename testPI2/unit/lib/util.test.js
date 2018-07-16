/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

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
