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

const Test = require('tape')
const Base = require('../../base')
const AdminRoutes = require('../../../../src/api/routes')
const Sinon = require('sinon')
const Enum = require('../../../../src/lib/enum')
const P = require('bluebird')

Test('test root routes - health', async function (assert) {
  let req = Base.buildRequest({ url: '/health', method: 'GET' })
  const server = await Base.setup(AdminRoutes)
  const res = await server.inject(req)
  assert.ok(res)
  await server.stop()
  assert.end()
})

Test('test root routes - enums', async function (assert) {
  let sandbox = Sinon.createSandbox()

  sandbox.stub(Enum, 'all').returns(P.resolve({}))
  let req = Base.buildRequest({ url: '/enums', method: 'GET' })
  const server = await Base.setup(AdminRoutes)
  const res = await server.inject(req)
  assert.ok(res)
  sandbox.restore()
  await server.stop()
  assert.end()
})

Test('test root routes - /', async function (assert) {
  let req = Base.buildRequest({ url: '/', method: 'GET' })
  const server = await Base.setup(AdminRoutes)
  const res = await server.inject(req)
  assert.ok(res)
  await server.stop()
  assert.end()
})
