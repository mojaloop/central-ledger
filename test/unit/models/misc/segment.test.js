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

 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const Model = require('../../../../src/models/misc/segment')

Test('Segment model', async (segmentTest) => {
  let sandbox

  segmentTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.segment = {
      findOne: sandbox.stub()
    }

    Db.from = (table) => {
      return Db[table]
    }

    t.end()
  })

  segmentTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  segmentTest.test('getByParams should', getByParamsTest => {
    getByParamsTest.test('return the segment', async (test) => {
      try {
        const params = {
          segmentType: 'timeout',
          enumeration: 0,
          tableName: 'transferStateChange'
        }

        const segment = {
          segmentId: 1,
          segmentType: 'timeout',
          enumeration: 0,
          tableName: 'transferStateChange',
          value: 4,
          changedDate: '2018-10-10 21:57:00'
        }
        Db.segment.findOne.withArgs(params).returns(segment)
        const result = await Model.getByParams(params)
        test.deepEqual(result, segment, 'Results Match')
        test.end()
      } catch (e) {
        Logger.error(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    getByParamsTest.test('should throw error', async (test) => {
      const params = {
        segmentType: 'timeout',
        enumeration: 0,
        tableName: 'transferStateChange'
      }

      Db.segment.findOne.withArgs(params).throws(new Error())
      try {
        await Model.getByParams(params)
        test.fail('Should throw')
        test.end()
      } catch (e) {
        Logger.error(e)
        test.ok(e instanceof Error)
        test.end()
      }
    })

    getByParamsTest.end()
  })

  segmentTest.end()
})
