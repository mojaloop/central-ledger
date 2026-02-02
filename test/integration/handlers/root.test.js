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

 * Lewis Daly <lewis@vesselstech.com>
 --------------
 **********/

'use strict'

const Test = require('tape')
const Joi = require('joi')
const Logger = require('@mojaloop/central-services-logger')

const debug = false

/**
 * Integration test for the health check endpoint.
 *
 * This test calls the main service's /health endpoint via HTTP to verify
 * the consumer.isHealthy() implementation from central-services-stream PR #186
 * works correctly with real Kafka consumers that have partition assignments.
 *
 * The main service is started by test-integration.sh before tests run,
 * so its consumers have partition assignments and isHealthy() returns true.
 *
 * We call the HTTP endpoint rather than creating local consumers because:
 * - The main service's consumers already hold all partitions
 * - New consumers in the same group can't get partition assignments
 * - This tests the REAL isHealthy() behavior with actual partition assignments
 */
Test('Root handler test', async handlersTest => {
  const startTime = new Date()
  const serviceUrl = 'http://localhost:3001'

  /* Health Check Tests */

  await handlersTest.test('healthCheck should', async healthCheckTest => {
    await healthCheckTest.test('get the basic health of the service via HTTP', async (test) => {
      // Arrange
      const expectedSchema = Joi.compile({
        status: Joi.string().valid('OK').required(),
        uptime: Joi.number().required(),
        startTime: Joi.date().iso().required(),
        versionNumber: Joi.string().required(),
        services: Joi.array().required()
      })
      const expectedStatus = 200
      const expectedServices = [
        { name: 'datastore', status: 'OK' },
        { name: 'broker', status: 'OK' },
        { name: 'proxyCache', status: 'OK' }
      ]

      // Act - Call the running service's health endpoint via HTTP
      // The main service has consumers with partition assignments (isAssigned: true)
      // so consumer.isHealthy() from central-services-stream returns true
      const response = await fetch(`${serviceUrl}/health`)
      const responseBody = await response.json()
      const responseCode = response.status

      // Assert
      const validationResult = Joi.attempt(responseBody, expectedSchema)
      test.equal(validationResult.error, undefined, 'The response matches the validation schema')
      test.deepEqual(responseCode, expectedStatus, 'The response code matches')
      test.deepEqual(responseBody.services, expectedServices, 'The sub-services are correct')
      test.end()
    })

    healthCheckTest.end()
  })

  await handlersTest.test('teardown', async (assert) => {
    try {
      if (debug) {
        const elapsedTime = Math.round(((new Date()) - startTime) / 100) / 10
        console.log(`root.test.js finished in (${elapsedTime}s)`)
      }
      assert.pass('done')
      assert.end()
    } catch (err) {
      Logger.error(`teardown failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  handlersTest.end()
})
