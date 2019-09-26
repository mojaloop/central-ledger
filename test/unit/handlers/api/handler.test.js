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
const Sinon = require('sinon')
const Handler = require('../../../../src/handlers/api/routes')
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const MigrationLockModel = require('../../../../src/models/misc/migrationLock')

function createRequest (routes) {
  const value = routes || []
  return {
    server: {
      table: () => {
        return [{ table: value }]
      }
    }
  }
}

Test('route handler', (handlerTest) => {
  let sandbox

  handlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()

    test.end()
  })

  handlerTest.afterEach(test => {
    sandbox.restore()

    test.end()
  })

  handlerTest.test('health should', healthTest => {
    healthTest.test('return status ok', async assert => {
      // Arrange
      sandbox.stub(MigrationLockModel, 'getIsMigrationLocked').returns(false)
      sandbox.stub(Consumer, 'isConnected').returns(Promise.resolve())
      const jp = require('jsonpath')
      const healthHandler = jp.query(Handler, '$[?(@.path=="/health")]')

      const reply = {
        response: (response) => {
          assert.equal(response.status, 'OK')
          return {
            code: (statusCode) => {
              // Assert
              assert.equal(statusCode, 200)
              assert.end()
            }
          }
        }
      }

      // Act
      if (Array.isArray(healthHandler) && healthHandler.length === 1) {
        healthHandler[0].handler(createRequest(), reply)
      } else {
        assert.fail('No health status handler found')
        assert.end()
      }
    })

    healthTest.end()
  })

  handlerTest.end()
})
