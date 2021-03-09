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

const Handler = require('../../../../src/api/root/handler')
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const MigrationLockModel = require('../../../../src/models/misc/migrationLock')
const {
  createRequest,
  unwrapResponse
} = require('../../../util/helpers')

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
    handlerTest.test('getHealth returns the detailed health check', async function (test) {
      // Arrange
      sandbox.stub(MigrationLockModel, 'getIsMigrationLocked').returns(false)
      sandbox.stub(Consumer, 'getListOfTopics').returns(['admin'])
      sandbox.stub(Consumer, 'isConnected').returns(Promise.resolve())
      const schema = Joi.compile({
        status: Joi.string().valid('OK').required(),
        uptime: Joi.number().required(),
        startTime: Joi.date().iso().required(),
        versionNumber: Joi.string().required(),
        services: Joi.array().required()
      })
      const expectedStatus = 200
      const expectedServices = [
        { name: 'datastore', status: 'OK' },
        { name: 'broker', status: 'OK' }
      ]

      // Act
      const {
        responseBody,
        responseCode
      } = await unwrapResponse((reply) => Handler.getHealth(createRequest({}), reply))

      // Assert
      const validationResult = Joi.attempt(responseBody, schema) // We use Joi to validate the results as they rely on timestamps that are variable
      test.equal(validationResult.error, undefined, 'The response matches the validation schema')
      test.deepEqual(responseCode, expectedStatus, 'The response code matches')
      test.deepEqual(responseBody.services, expectedServices, 'The sub-services are correct')
      test.end()
    })

    handlerTest.end()
  })

  rootHandlerTest.end()
})
