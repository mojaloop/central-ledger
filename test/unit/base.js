'use strict'

const ServerSetup = require('../../src/shared/setup')
const ApiAuth = require('../../src/api/auth')
const ApiRoutes = require('../../src/api/routes')
// const Logger = require('@mojaloop/central-services-shared').Logger

const setupServer = async () => {
  const server = await ServerSetup.createServer(3000, [ApiAuth, ApiRoutes])
  return server
}

exports.setup = () => {
  return setupServer()
}

exports.buildRequest = (options) => {
  return {
    url: options.url,
    method: options.method || 'GET',
    payload: options.payload || '',
    headers: options.headers || {},
    credentials: {
      username: 'admin',
      password: 'admin'
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
