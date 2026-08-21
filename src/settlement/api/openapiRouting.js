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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/
'use strict'

/**
 * Routing helpers shared by the settlement API and the settlement handlers
 * monitoring API, both of which are served by OpenapiBackend.
 */

/**
 * Base path the API is served under. It mirrors the `servers` url of the
 * OpenAPI document (formerly the Swagger 2.0 `basePath`).
 *
 * @param {object} api OpenAPIBackend instance
 * @returns {string} base path, e.g. '/v2'
 */
const getBasePath = (api) => api.definition.servers[0].url.replace(/\/$/, '')

/**
 * Request handler. The base path is stripped from the request path, as the
 * paths of the OpenAPI document are relative to its `servers` url.
 *
 * @param {object} api OpenAPIBackend instance
 * @param {object} req Request
 * @param {object} h   Response handle
 */
const handleRequest = (api, req, h) => api.handleRequest(
  {
    method: req.method,
    path: req.path.slice(getBasePath(api).length),
    body: req.payload,
    query: req.query,
    headers: req.headers
  }, req, h)

/**
 * Fail fast when the API definition declares an operation with no handler.
 *
 * `OpenapiBackend.initialise` runs openapi-backend non-strict, so an operation it has no
 * handler for is dispatched to `notFound`. An operationId added to the definition but never
 * wired into the handlers map would therefore answer 404 at runtime rather than failing at
 * startup - the filesystem-based routing this replaced could not drift that way.
 *
 * @param {object} api Initialised OpenAPIBackend instance
 * @throws {Error} If the definition declares an operation with no registered handler
 */
const assertHandlersRegistered = (api) => {
  const unhandled = api.getOperations()
    .filter(({ operationId }) => typeof api.handlers[operationId] !== 'function')
    .map(({ method, path, operationId }) => `${method.toUpperCase()} ${path} (operationId: ${operationId})`)

  if (unhandled.length > 0) {
    throw new Error(`OpenAPI definition declares operations with no registered handler: ${unhandled.join(', ')}`)
  }
}

module.exports = {
  getBasePath,
  handleRequest,
  assertHandlersRegistered
}
