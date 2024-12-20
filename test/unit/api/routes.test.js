/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
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
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 - Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tape')
const Base = require('../base')
const ApiRoutes = require('../../../src/api/routes')
const ProxyCache = require('#src/lib/proxyCache')
const Sinon = require('sinon')

Test('test health', async function (assert) {
  const sandbox = Sinon.createSandbox()
  sandbox.stub(ProxyCache, 'getCache').returns({
    connect: sandbox.stub(),
    disconnect: sandbox.stub(),
    healthCheck: sandbox.stub().resolves()
  })
  const req = Base.buildRequest({ url: '/health', method: 'GET' })
  const server = await Base.setup(ApiRoutes)
  const res = await server.inject(req)
  assert.ok(res)
  await server.stop()
  sandbox.restore()
  assert.end()
})
