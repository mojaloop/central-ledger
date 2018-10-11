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

 - Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Config = require('../../../../src/lib/config')
const Handler = require('../../../../src/api/metadata/handler')
const apiTags = ['api']

function createRequest (routes) {
  let value = routes || []
  return {
    server: {
      table: () => {
        return [{ table: value }]
      }
    }
  }
}

Test('metadata handler', (handlerTest) => {
  let originalScale
  let originalPrecision
  let originalHostName

  handlerTest.beforeEach(t => {
    originalScale = Config.AMOUNT.SCALE
    originalPrecision = Config.AMOUNT.PRECISION
    originalHostName = Config.HOSTNAME
    Config.AMOUNT.SCALE = 0
    Config.AMOUNT.PRECISION = 0
    Config.HOSTNAME = ''
    t.end()
  })

  handlerTest.afterEach(t => {
    Config.AMOUNT.SCALE = originalScale
    Config.AMOUNT.PRECISION = originalPrecision
    Config.HOSTNAME = originalHostName
    t.end()
  })

  handlerTest.test('health should', (healthTest) => {
    healthTest.test('return status ok', async function (assert) {
      let reply = {
        response: (response) => {
          assert.equal(response.status, 'OK')
          return {
            code: (statusCode) => {
              assert.equal(statusCode, 200)
              assert.end()
            }
          }
        }
      }

      Handler.health(createRequest(), reply)
    })
    healthTest.end()
  })

  handlerTest.test('metadata should', function (metadataTest) {
    metadataTest.test('return 200 httpStatus', async function (t) {
      let reply = {
        response: () => {
          return {
            code: statusCode => {
              t.equal(statusCode, 200)
              t.end()
            }
          }
        }
      }
      await Handler.metadata(createRequest(), reply)
    })

    metadataTest.test('return urls from request.server and append hostname', t => {
      let hostName = 'some-host-name'
      Config.HOSTNAME = hostName
      let request = createRequest([
        { settings: { id: 'first_route', tags: apiTags }, path: '/first' }
      ])

      let reply = {
        response: (response) => {
          t.equal(response.urls['first_route'], `${hostName}/first`)
          return { code: statusCode => { t.end() } }
        }
      }
      Handler.metadata(request, reply)
    })

    metadataTest.test('format url parameters with colons', t => {
      let request = createRequest([
        { settings: { id: 'path', tags: apiTags }, path: '/somepath/{id}' },
        { settings: { id: 'manyargs', tags: apiTags }, path: '/somepath/{id}/{path*}/{test2}/' }
      ])

      let reply = {
        response: (response) => {
          t.equal(response.urls['path'], '/somepath/:id')
          t.equal(response.urls['manyargs'], '/somepath/:id/:path*/:test2/')
          return { code: statusCode => { t.end() } }
        }
      }

      Handler.metadata(request, reply)
    })

    metadataTest.end()
  })

  handlerTest.end()
})
