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

 - Lewis Daly <lewis@vesselstech.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Joi = require('joi')
const Sinon = require('sinon')
const P = require('bluebird')

const Handler = require('../../../../src/api/root/handler')
const Kafka = require('../../../../src/handlers/lib/kafka/index')
const MigrationLockModel = require('../../../../src/models/misc/migrationLock')

/* Helper Functions */

/**
 * Create a mock request handler
 * @param {*} param0
 */
const createRequest = ({ payload, params, query }) => {
  const requestPayload = payload || {}
  const requestParams = params || {}
  const requestQuery = query || {}

  return {
    payload: requestPayload,
    params: requestParams,
    query: requestQuery,
    server: {
      log: () => { },
      methods: {

      }
    }
  }
}

/**
 * unwrapResponse
 *
 * Use this function to unwrap the innner response body and code from an async Handler
 */
const unwrapResponse = async (asyncFunction) => {
  let responseBody
  let responseCode
  const nestedReply = {
    response: (response) => {
      responseBody = response
      return {
        code: statusCode => {
          responseCode = statusCode
        }
      }
    }
  }
  await asyncFunction(nestedReply)

  return {
    responseBody,
    responseCode
  }
}

Test('Root', rootHandlerTest => {
  let sandbox

  rootHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()

    test.end()
  })

  rootHandlerTest.afterEach(test => {
    sandbox.restore()

    test.end()
  })

  rootHandlerTest.test('Handler Test', async handlerTest => {
    handlerTest.test('getSubServiceHealth gets subservice health for datastore', async test => {
      // Arrange
      sandbox.stub(MigrationLockModel, 'getIsMigrationLocked').returns(false)
      const expected = { name: 'datastore', status: 'OK' }

      // Act
      const result = await Handler.getSubServiceHealth('datastore')

      // Assert
      test.deepEqual(result, expected, 'Service return correct response')
      test.end()
    })

    handlerTest.test('getSubServiceHealth fails for datastore that is locked', async test => {
      // Arrange
      sandbox.stub(MigrationLockModel, 'getIsMigrationLocked').returns(true)
      const expected = { name: 'datastore', status: 'DOWN' }

      // Act
      const result = await Handler.getSubServiceHealth('datastore')

      // Assert
      test.deepEqual(result, expected, 'Service return correct response')
      test.end()
    })

    handlerTest.test('getSubServiceHealth gets subservice health for broker', async test => {
      // Arrange
      sandbox.stub(Kafka.Consumer, 'isConsumerConnected').returns(P.resolve())
      const expected = { name: 'broker', status: 'OK' }

      // Act
      const result = await Handler.getSubServiceHealth('broker')

      // Assert
      test.deepEqual(result, expected, 'Service return correct response')
      test.end()
    })

    handlerTest.test('getSubServiceHealth fails for unknown service', async test => {
      // Arrange
      const serviceName = 'bogus_service'

      // Act
      try {
        await Handler.getSubServiceHealth(serviceName)
        test.fail('Error not thrown')
      } catch (err) {
        // Assert
        test.ok(err instanceof Error)
        test.equal(err.message, `Service: bogus_service not found.`)
        test.end()
      }
    })

    handlerTest.test('evaluateServiceHealth passes if nothing is down', async function (test) {
      // Arrange
      const services = [
        { name: 'datastore', status: 'OK' },
        { name: 'broker', status: 'OK' }
      ]
      const expected = true

      // Act
      const result = Handler.evaluateServiceHealth(services)

      // Assert
      test.equal(result, expected, 'Service should be healthy')
      test.end()
    })

    handlerTest.test('evaluateServiceHealth fails if anything is down', async function (test) {
      // Arrange
      const services = [
        { name: 'datastore', status: 'OK' },
        { name: 'broker', status: 'DOWN' }
      ]
      const expected = false

      // Act
      const result = Handler.evaluateServiceHealth(services)

      // Assert
      test.equal(result, expected, 'Service should be healthy')
      test.end()
    })

    handlerTest.test('getHealth returns the detailed health check', async function (test) {
      // Arrange
      sandbox.stub(MigrationLockModel, 'getIsMigrationLocked').returns(false)
      sandbox.stub(Kafka.Consumer, 'isConsumerConnected').returns(P.resolve())
      const schema = {
        status: Joi.string().valid('OK').required(),
        uptime: Joi.number().required(),
        startTime: Joi.date().iso().required(),
        versionNumber: Joi.string().required(),
        services: Joi.array().required()
      }
      const expectedStatus = 200
      const expectedServices = [
        { name: 'datastore', status: 'OK' },
        { name: 'broker', status: 'OK' }
      ]

      // Act
      const {
        responseBody,
        responseCode
      } = await unwrapResponse((reply) => Handler.getHealth(createRequest({ query: { detailed: true } }), reply))

      // Assert
      const validationResult = Joi.validate(responseBody, schema) // We use Joi to validate the results as they rely on timestamps that are variable
      test.equal(validationResult.error, null, 'The response matches the validation schema')
      test.deepEqual(responseCode, expectedStatus, 'The response code matches')
      test.deepEqual(responseBody.services, expectedServices, 'The sub-services are correct')
      test.end()
    })

    handlerTest.test('detailed health check fails if sub-service is DOWN', async function (test) {
      // Arrange
      sandbox.stub(MigrationLockModel, 'getIsMigrationLocked').returns(false)
      sandbox.stub(Kafka.Consumer, 'isConsumerConnected').returns(P.reject()) // Kafka will be down
      const schema = {
        status: Joi.string().valid('DOWN').required(),
        uptime: Joi.number().required(),
        startTime: Joi.date().iso().required(),
        versionNumber: Joi.string().required(),
        services: Joi.array().required()
      }
      const expectedStatus = 502
      const expectedServices = [
        { name: 'datastore', status: 'OK' },
        { name: 'broker', status: 'DOWN' }
      ]

      // Act
      const {
        responseBody,
        responseCode
      } = await unwrapResponse((reply) => Handler.getHealth(createRequest({ query: { detailed: true } }), reply))

      // Assert
      const validationResult = Joi.validate(responseBody, schema) // We use Joi to validate the results as they rely on timestamps that are variable
      test.equal(validationResult.error, null, 'The response matches the validation schema')
      test.deepEqual(responseCode, expectedStatus, 'The response code matches')
      test.deepEqual(responseBody.services, expectedServices, 'The sub-services are correct')
      test.end()
    })

    handlerTest.end()
  })

  rootHandlerTest.end()
})
