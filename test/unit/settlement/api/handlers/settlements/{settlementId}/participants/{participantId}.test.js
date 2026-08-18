/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>

 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Mockgen = require('../../../../../../data/mockgen.js')
const Base = require('../../../../../base')
const Enums = require('../../../../../../../../src/settlement/models/lib/enums')
const { logger } = require('../../../../../../../../src/settlement/shared/logger')
const settlement = require('../../../../../../../../src/settlement/domain/settlement/index')
const Db = require('../../../../../../../../src/settlement/lib/db')

Test('/settlements/{sid}/participants/{pid}', async (settlementTest) => {
  let server
  let sandbox
  settlementTest.beforeEach(async t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Db, 'connect').returns(Promise.resolve({}))
    server = await Base.setup()
    t.end()
  })

  settlementTest.afterEach(async t => {
    await server.stop()
    sandbox.restore()
    t.end()
  })

  await settlementTest.test('test settlements get operation', async (t) => {
    sandbox.stub(Enums, 'settlementWindowStates').returns({})
    sandbox.stub(Enums, 'ledgerAccountTypes').returns({})
    sandbox.stub(settlement, 'getByIdParticipantAccount').returns({})
    try {
      const requests = new Promise((resolve, reject) => {
        Mockgen().requests({
          path: '/settlements/{sid}/participants/{pid}',
          operation: 'get'
        }, function (error, mock) {
          return error ? reject(error) : resolve(mock)
        })
      })

      const mock = await requests

      t.ok(mock)
      t.ok(mock.request)
      // Get the resolved path from mock request
      // Mock request Path templates({}) are resolved using path parameters
      const options = {
        method: 'get',
        url: '/v2' + mock.request.path
      }
      if (mock.request.body) {
        // Send the request body
        options.payload = mock.request.body
      } else if (mock.request.formData) {
        // Send the request form data
        options.payload = mock.request.formData
        // Set the Content-Type as application/x-www-form-urlencoded
        options.headers = options.headers || {}
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }
      // If headers are present, set the headers.
      if (mock.request.headers && mock.request.headers.length > 0) {
        options.headers = mock.request.headers
      }
      const response = await server.inject(options)
      t.equal(response.statusCode, 200, 'Ok response status')
      t.end()
    } catch (e) {
      logger.error(`testing error ${e}`)
      t.fail()
      t.end()
    }
  })

  await settlementTest.test('test settlements get by params throws', async (t) => {
    sandbox.stub(Enums, 'settlementWindowStates').returns({})
    sandbox.stub(Enums, 'ledgerAccountTypes').returns({})
    sandbox.stub(settlement, 'getByIdParticipantAccount').throws()
    try {
      const requests = new Promise((resolve, reject) => {
        Mockgen().requests({
          path: '/settlements/{sid}/participants/{pid}',
          operation: 'get'
        }, function (error, mock) {
          return error ? reject(error) : resolve(mock)
        })
      })

      const mock = await requests

      t.ok(mock)
      t.ok(mock.request)
      // Get the resolved path from mock request
      // Mock request Path templates({}) are resolved using path parameters
      const options = {
        method: 'get',
        url: '/v2' + mock.request.path
      }
      if (mock.request.body) {
        // Send the request body
        options.payload = mock.request.body
      } else if (mock.request.formData) {
        // Send the request form data
        options.payload = mock.request.formData
        // Set the Content-Type as application/x-www-form-urlencoded
        options.headers = options.headers || {}
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }
      // If headers are present, set the headers.
      if (mock.request.headers && mock.request.headers.length > 0) {
        options.headers = mock.request.headers
      }
      const response = await server.inject(options)
      t.equal(response.statusCode, 500, 'Ok response status')
      t.end()
    } catch (e) {
      logger.error(`testing error ${e}`)
      t.fail()
      t.end()
    }
  })

  await settlementTest.test('test settlements put operation :: putById', async (t) => {
    sandbox.stub(Enums, 'ledgerAccountTypes').returns({})
    sandbox.stub(Enums, 'ledgerEntryTypes').returns({})
    sandbox.stub(Enums, 'participantLimitTypes').returns({})
    sandbox.stub(Enums, 'settlementStates').returns({})
    sandbox.stub(Enums, 'settlementWindowStates').returns({})
    sandbox.stub(Enums, 'transferParticipantRoleTypes').returns({})
    sandbox.stub(Enums, 'transferStates').returns({})
    sandbox.stub(settlement, 'putById').returns({})
    try {
      const requests = new Promise((resolve, reject) => {
        Mockgen().requests({
          path: '/settlements/{sid}/participants/{pid}',
          operation: 'put'
        }, function (error, mock) {
          return error ? reject(error) : resolve(mock)
        })
      })

      const mock = await requests

      t.ok(mock)
      t.ok(mock.request)
      // Get the resolved path from mock request
      // Mock request Path templates({}) are resolved using path parameters
      const options = {
        method: 'put',
        url: '/v2' + mock.request.path
      }
      if (mock.request.body) {
        // Send the request body
        options.payload = mock.request.body
      } else if (mock.request.formData) {
        // Send the request form data
        options.payload = mock.request.formData
        // Set the Content-Type as application/x-www-form-urlencoded
        options.headers = options.headers || {}
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }
      // If headers are present, set the headers.
      if (mock.request.headers && mock.request.headers.length > 0) {
        options.headers = mock.request.headers
      }

      delete options.payload.state
      delete options.payload.reason
      delete options.payload.externalReference

      const response = await server.inject(options)
      t.equal(response.statusCode, 200, 'Ok response status')
      t.end()
    } catch (e) {
      logger.error(`testing error ${e}`)
      t.fail()
      t.end()
    }
  })

  await settlementTest.test('test settlements put by params throws', async (t) => {
    sandbox.stub(Enums, 'ledgerAccountTypes').returns({})
    sandbox.stub(Enums, 'ledgerEntryTypes').returns({})
    sandbox.stub(Enums, 'participantLimitTypes').returns({})
    sandbox.stub(Enums, 'settlementStates').returns({})
    sandbox.stub(Enums, 'settlementWindowStates').returns({})
    sandbox.stub(Enums, 'transferParticipantRoleTypes').returns({})
    sandbox.stub(Enums, 'transferStates').returns({})
    sandbox.stub(settlement, 'putById').throws()
    try {
      const requests = new Promise((resolve, reject) => {
        Mockgen().requests({
          path: '/settlements/{sid}/participants/{pid}',
          operation: 'put'
        }, function (error, mock) {
          return error ? reject(error) : resolve(mock)
        })
      })

      const mock = await requests

      t.ok(mock)
      t.ok(mock.request)
      // Get the resolved path from mock request
      // Mock request Path templates({}) are resolved using path parameters
      const options = {
        method: 'put',
        url: '/v2' + mock.request.path
      }
      if (mock.request.body) {
        // Send the request body
        options.payload = mock.request.body
      } else if (mock.request.formData) {
        // Send the request form data
        options.payload = mock.request.formData
        // Set the Content-Type as application/x-www-form-urlencoded
        options.headers = options.headers || {}
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }
      // If headers are present, set the headers.
      if (mock.request.headers && mock.request.headers.length > 0) {
        options.headers = mock.request.headers
      }
      const response = await server.inject(options)
      t.equal(response.statusCode, 500, 'Ok response status')
      t.end()
    } catch (e) {
      logger.error(`testing error ${e}`)
      t.fail()
      t.end()
    }
  })

  await settlementTest.end()
})
