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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/
'use strict'

const OpenapiBackend = require('@mojaloop/central-services-shared').Util.OpenapiBackend
const Path = require('path')
const Handlers = require('./handlers')

/**
 * Base path the settlement handlers API is served under. It mirrors the
 * `servers` url of the OpenAPI document (formerly the Swagger 2.0 `basePath`).
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
 * Handlers monitoring API Routes
 *
 * @param {object} api OpenAPIBackend instance
 */
const APIRoutes = (api) => {
  const basePath = getBasePath(api)
  return [
    {
      method: 'GET',
      path: `${basePath}/health`,
      handler: (req, h) => handleRequest(api, req, h),
      config: {
        id: 'handlers getHealth',
        tags: ['api', 'getHealth'],
        description: 'GET health'
      }
    }
  ]
}

module.exports = {
  plugin: {
    name: 'settlement handler api routes',
    register: async function (server) {
      const api = await OpenapiBackend.initialise(Path.resolve(__dirname, '../interface/swagger-handler.json'), {
        getHealth: Handlers.getHealth,
        validationFail: Handlers.validationFail,
        notFound: Handlers.notFound,
        methodNotAllowed: Handlers.methodNotAllowed
      })
      server.route(APIRoutes(api))
    }
  }
}
