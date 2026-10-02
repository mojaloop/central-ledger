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
const { getBasePath, assertHandlersRegistered, preOperationHandler } = require('../../../../src/settlement/api/openapiRouting')

const operation = (method, path, operationId) => ({ method, path, operationId })

Test('settlement openapiRouting', (openapiRoutingTest) => {
  openapiRoutingTest.test('getBasePath strips a trailing slash from the servers url', test => {
    test.equal(getBasePath({ definition: { servers: [{ url: '/v2' }] } }), '/v2', 'returns the base path')
    test.equal(getBasePath({ definition: { servers: [{ url: '/v2/' }] } }), '/v2', 'trailing slash removed')
    test.end()
  })

  openapiRoutingTest.test('assertHandlersRegistered accepts a fully wired api', test => {
    const api = {
      getOperations: () => [operation('get', '/health', 'getHealth')],
      handlers: { getHealth: () => {} }
    }
    test.doesNotThrow(() => assertHandlersRegistered(api), 'no error is thrown')
    test.end()
  })

  openapiRoutingTest.test('assertHandlersRegistered throws naming operations with no handler', test => {
    const api = {
      getOperations: () => [
        operation('get', '/health', 'getHealth'),
        operation('post', '/settlements', 'createSettlement'),
        operation('get', '/unnamed', undefined)
      ],
      handlers: { getHealth: () => {} }
    }

    try {
      assertHandlersRegistered(api)
      test.fail('expected assertHandlersRegistered to throw')
    } catch (err) {
      test.ok(err.message.includes('POST /settlements (operationId: createSettlement)'), 'the unhandled operation is named')
      test.ok(err.message.includes('GET /unnamed (operationId: undefined)'), 'an operation with no operationId is reported')
      test.notOk(err.message.includes('/health'), 'the handled operation is not reported')
    }
    test.end()
  })

  openapiRoutingTest.test('preOperationHandler copies coerced parameters onto the hapi request', test => {
    // The settlement definition declares id/sid/pid/aid and participantId as integers.
    // openapi-backend coerces them during validation but re-parses the path afterwards,
    // so handlers reading request.params would otherwise still see strings.
    const req = { params: { sid: '1', pid: '2' }, query: { participantId: '3' }, payload: undefined }
    const context = {
      validation: { coerced: { params: { sid: 1, pid: 2 }, query: { participantId: 3 } } },
      request: { body: { settlementWindows: [{ id: 7 }] } }
    }

    preOperationHandler(context, req)

    test.strictEqual(req.params.sid, 1, 'sid coerced to a number')
    test.strictEqual(req.params.pid, 2, 'pid coerced to a number')
    test.strictEqual(req.query.participantId, 3, 'query parameter coerced to a number')
    test.deepEqual(req.payload, { settlementWindows: [{ id: 7 }] }, 'payload taken from the validated request body')
    test.end()
  })

  openapiRoutingTest.test('preOperationHandler leaves the request untouched when nothing was coerced', test => {
    // A central-services-shared version that does not enable coerceTypes yields no
    // coerced parameters; the handler must then be a no-op rather than throwing.
    const req = { params: { id: '42' }, query: { state: 'OPEN' }, payload: { keep: true } }

    preOperationHandler({}, req)
    test.strictEqual(req.params.id, '42', 'params unchanged')
    test.strictEqual(req.query.state, 'OPEN', 'query unchanged')
    test.deepEqual(req.payload, { keep: true }, 'payload unchanged')

    preOperationHandler({ validation: {}, request: {} }, req)
    test.strictEqual(req.params.id, '42', 'params unchanged when validation carries no coerced values')
    test.deepEqual(req.payload, { keep: true }, 'payload unchanged when the request carries no body')
    test.end()
  })

  openapiRoutingTest.test('preOperationHandler copies params and query independently', test => {
    const req = { params: { id: '5' }, query: { state: 'OPEN' }, payload: undefined }

    preOperationHandler({ validation: { coerced: { params: { id: 5 } } }, request: {} }, req)
    test.strictEqual(req.params.id, 5, 'params coerced')
    test.strictEqual(req.query.state, 'OPEN', 'query left alone when only params were coerced')

    preOperationHandler({ validation: { coerced: { query: { limit: 10 } } }, request: {} }, req)
    test.strictEqual(req.query.limit, 10, 'query merged, not replaced')
    test.strictEqual(req.query.state, 'OPEN', 'existing query values preserved')
    test.end()
  })

  openapiRoutingTest.end()
})
