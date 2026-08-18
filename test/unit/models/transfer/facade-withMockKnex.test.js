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

const Database = require('@mojaloop/database-lib/src/database')

const Test = require('tapes')(require('tape'))
const knex = require('knex')
const mockKnex = require('mock-knex')
const Proxyquire = require('proxyquire')

const config = require('../../../../src/lib/config')
const { tryCatchEndTest } = require('#test/util/helpers')

let transferFacade

Test('Transfer facade Tests (with mockKnex) -->', async (transferFacadeTest) => {
  const db = new Database()
  db._knex = knex(config.DATABASE)
  mockKnex.mock(db._knex)

  await db.connect(config.DATABASE)

  // we need to override the singleton Db (from ../lib/db), coz it was already modified by other unit-tests!
  transferFacade = Proxyquire('#src/models/transfer/facade', {
    '../../lib/db': db,
    './transferExtension': Proxyquire('#src/models/transfer/transferExtension', { '../../lib/db': db })
  })

  let tracker // allow to catch and respond to DB queries: https://www.npmjs.com/package/mock-knex#tracker

  await transferFacadeTest.beforeEach(async t => {
    tracker = mockKnex.getTracker()
    tracker.install()
    t.end()
  })

  await transferFacadeTest.afterEach(t => {
    tracker.uninstall()
    t.end()
  })

  await transferFacadeTest.test('getById Method Tests -->', (getByIdTest) => {
    getByIdTest.test('should find zero records', tryCatchEndTest(async (t) => {
      const id = Date.now()

      tracker.on('query', (query) => {
        if (query.bindings[0] === id && query.method === 'first') {
          return query.response(null)
        }
        query.reject(new Error('Mock DB error'))
      })
      const result = await transferFacade.getById(id)
      t.equal(result, null, 'no transfers were found')
    }))

    getByIdTest.test('should find transfer by id', tryCatchEndTest(async (t) => {
      const id = Date.now()
      const mockExtensionList = [id]

      tracker.on('query', (q) => {
        if (q.step === 1 && q.method === 'first' && q.bindings[0] === id) {
          return q.response({})
        }
        if (q.step === 2 && q.method === 'select') { // TransferExtensionModel.getByTransferId() call
          return q.response(mockExtensionList)
        }
        q.reject(new Error('Mock DB error'))
      })

      const result = await transferFacade.getById(id)
      t.ok(result, 'transfers is found')
      t.deepEqual(result.extensionList, mockExtensionList)
    }))

    getByIdTest.end()
  })

  await transferFacadeTest.end()
})
