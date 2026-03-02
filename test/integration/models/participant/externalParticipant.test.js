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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

const Test = require('tape')
const externalParticipant = require('#src/models/participant/externalParticipant')
const config = require('../../../../src/lib/config')
const db = require('#src/lib/db')

const fixtures = require('#test/fixtures')
const { tryCatchEndTest } = require('#test/util/helpers')

Test('externalParticipant Model Tests -->', (epModelTest) => {
  epModelTest.test('setup', tryCatchEndTest(async (t) => {
    await db.connect(config.DATABASE)
    t.ok(db.getKnex())
    t.pass('setup is done')
  }))

  epModelTest.test('should throw error on inserting a record without related proxyId in participant table', tryCatchEndTest(async (t) => {
    const err = await externalParticipant.create({ proxyId: 0, name: 'name' })
      .catch(e => e)
    const isDbError = err.extensions && err.extensions.some(ext => ext.key === 'system' && ext.value.includes('db'))
    const isInternalError = err.apiErrorCode && err.apiErrorCode.code === '2001'
    t.ok(isDbError && isInternalError)
  }))

  epModelTest.test('should not throw error on inserting a record, if the name already exists', tryCatchEndTest(async (t) => {
    const { participantId } = await db.from('participant').findOne({})
    const name = `epName-${Date.now()}`
    const data = fixtures.mockExternalParticipantDto({
      name,
      proxyId: participantId,
      id: null,
      createdDate: null
    })
    const created = await externalParticipant.create(data)
    t.ok(created)

    const result = await externalParticipant.create(data)
    t.equals(result, null)
  }))

  epModelTest.test('teardown', tryCatchEndTest(async (t) => {
    await db.disconnect()
    t.pass('connections are closed')
  }))

  epModelTest.end()
})
