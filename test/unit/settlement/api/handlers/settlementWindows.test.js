/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
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
 * Valentin Genev <valentin.genev@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Mockgen = require('../../../data/mockgen.js')
const Base = require('../../base')
const Enums = require('../../../../../src/settlement/models/lib/enums')
const { logger } = require('../../../../../src/settlement/shared/logger')
const settlementWindows = require('../../../../../src/settlement/domain/settlementWindow/index')
const Db = require('../../../../../src/settlement/lib/db')
const ProxyCache = require('../../../../../src/lib/proxyCache')
const ServerSetup = require('../../../../../src/settlement/shared/setup')
const HandlerRoutes = require('../../../../../src/settlement/api/handlerRoutes')
const getPort = async () => (await import('get-port')).default()

/**
 * Test for /settlementWindows
 */
/**
   * summary: Returns Settlement Windows as per parameter(s).
   * description:
   * parameters: participantId, state, fromDateTime, toDateTime
   * produces: application/json
   * responses: 200, 400, 401, 404, 415, default
   */

Test('/settlementWindows', async (settlementWindowTest) => {
  let server
  let sandbox
  settlementWindowTest.beforeEach(async t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Db, 'connect').returns(Promise.resolve({}))
    server = await Base.setup()
    t.end()
  })

  settlementWindowTest.afterEach(async t => {
    await server.stop()
    sandbox.restore()
    t.end()
  })
  await settlementWindowTest.test('test getSettlementWindowsByParams get operation', async (t) => {
    sandbox.stub(Enums, 'settlementWindowStates').returns({})
    sandbox.stub(settlementWindows, 'getByParams').returns({
      settlementWindowId: 8,
      state: 'CLOSED',
      reason: '8th window closed',
      createdDate: '2018-09-01T15:02:34.000Z',
      changedDate: '2018-09-01T16:24:37.000Z'
    })
    try {
      const requests = new Promise((resolve, reject) => {
        Mockgen().requests({
          path: '/settlementWindows',
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

  await settlementWindowTest.test('test getSettlementWindowsByParams get operation throws', async (t) => {
    sandbox.stub(Enums, 'settlementWindowStates').returns({})
    sandbox.stub(settlementWindows, 'getByParams').throws()
    try {
      const requests = new Promise((resolve, reject) => {
        Mockgen().requests({
          path: '/settlementWindows',
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
  await settlementWindowTest.test('test getHealth operation', async (t) => {
    sandbox.stub(ProxyCache, 'getCache').returns({
      connect: sandbox.stub(),
      disconnect: sandbox.stub(),
      healthCheck: sandbox.stub().resolves()
    })
    try {
      const response = await server.inject({
        method: 'get',
        url: '/v2/health'
      })
      t.ok(response, 'health response returned')
      t.ok([200, 502].includes(response.statusCode), 'health status returned')
      t.end()
    } catch (e) {
      logger.error(`testing error ${e}`)
      t.fail()
      t.end()
    }
  })

  await settlementWindowTest.test('test getHealth operation of the handlers monitoring API', async (t) => {
    sandbox.stub(ProxyCache, 'getCache').returns({
      connect: sandbox.stub(),
      disconnect: sandbox.stub(),
      healthCheck: sandbox.stub().resolves()
    })
    let handlerServer
    try {
      handlerServer = await ServerSetup.createServer(await getPort(), [HandlerRoutes])
      const response = await handlerServer.inject({
        method: 'get',
        url: '/v2/health'
      })
      t.ok(response, 'health response returned')
      t.ok([200, 502].includes(response.statusCode), 'health status returned')
    } catch (e) {
      logger.error(`testing error ${e}`)
      t.fail()
    }
    if (handlerServer) {
      await handlerServer.stop()
    }
    t.end()
  })

  await settlementWindowTest.end()
})
