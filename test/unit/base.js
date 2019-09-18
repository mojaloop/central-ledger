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
 --------------
 ******/

'use strict'

const ServerSetup = require('../../src/shared/setup')
// const Logger = require('@mojaloop/central-services-logger')

const setupServer = async (ApiRoutes) => {
  const server = await ServerSetup.createServer(3000, [ApiRoutes])
  return server
}

exports.setup = (ApiRoutes) => {
  return setupServer(ApiRoutes)
}

exports.buildRequest = (options) => {
  return {
    url: options.url,
    method: options.method || 'GET',
    payload: options.payload || '',
    headers: options.headers || {},
    auth: {
      credentials: {
        username: 'admin',
        password: 'admin'
      },
      strategy: 'simple'
    }
  }
}

exports.assertBadRequestError = (assert, response, validationErrors) => {
  assert.equal(response.statusCode, 400)
  assert.equal(response.result.id, 'BadRequestError')
  assert.equal(response.result.message, validationErrors)
}

exports.assertInvalidBodyError = (assert, response, validationErrors) => {
  assert.equal(response.statusCode, 400)
  assert.equal(response.result.id, 'InvalidBodyError')
  assert.equal(response.result.message, validationErrors)
}

exports.assertInvalidUriParameterError = (assert, response, validationErrors) => {
  assert.equal(response.statusCode, 400)
  assert.equal(response.result.id, 'BadRequestError')
  assert.equal(response.result.message, validationErrors)
}

exports.assertInvalidHeaderError = (assert, response, validationErrors) => {
  assert.equal(response.statusCode, 400)
  assert.equal(response.result.id, 'InvalidHeaderError')
  assert.equal(response.result.message, 'Error validating one or more headers')
  assert.deepEqual(response.result.validationErrors, validationErrors)
}

exports.assertUnsupportedMediaTypeError = (assert, response, validationErrors) => {
  assert.equal(response.statusCode, 415)
  assert.equal(response.result.id, 'UnsupportedMediaTypeError')
  assert.equal(response.result.message, validationErrors)
}
