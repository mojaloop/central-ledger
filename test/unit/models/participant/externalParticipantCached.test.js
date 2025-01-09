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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/
process.env.CLEDG_CACHE__CACHE_ENABLED = 'true'
process.env.CLEDG_CACHE__EXPIRES_IN_MS = `${120 * 1000}`
process.env.LOG_LEVEL = 'debug'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')

const model = require('#src/models/participant/externalParticipantCached')
const cache = require('#src/lib/cache')
const db = require('#src/lib/db')
const { TABLE_NAMES } = require('#src/shared/constants')

const { tryCatchEndTest } = require('#test/util/helpers')
const { mockExternalParticipantDto } = require('#test/fixtures')

const EP_TABLE = TABLE_NAMES.externalParticipant

Test('externalParticipantCached Model Tests -->', (epCachedTest) => {
  let sandbox

  const name = `extFsp-${Date.now()}`
  const mockEpList = [
    mockExternalParticipantDto({ name, createdDate: null })
  ]

  epCachedTest.beforeEach(async t => {
    sandbox = Sinon.createSandbox()

    const dbStub = sandbox.stub(db)
    db.from = table => dbStub[table]
    db[EP_TABLE] = {
      find: sandbox.stub().resolves(mockEpList),
      findOne: sandbox.stub(),
      insert: sandbox.stub(),
      destroy: sandbox.stub()
    }

    model.initialize()
    await cache.initCache()
    t.end()
  })

  epCachedTest.afterEach(async t => {
    sandbox.restore()
    await cache.destroyCache()
    cache.dropClients()
    t.end()
  })

  epCachedTest.test('should return undefined if no data by query in cache', tryCatchEndTest(async (t) => {
    const fakeName = `${Date.now()}`
    const data = await model.getById(fakeName)
    t.equal(data, undefined)
  }))

  epCachedTest.test('should get externalParticipant by name from cache', tryCatchEndTest(async (t) => {
    // db[EP_TABLE].find = sandbox.stub()
    const data = await model.getByName(name)
    t.deepEqual(data, mockEpList[0])
  }))

  epCachedTest.test('should get externalParticipant by ID from cache', tryCatchEndTest(async (t) => {
    const id = mockEpList[0].externalParticipantId
    const data = await model.getById(id)
    t.deepEqual(data, mockEpList[0])
  }))

  epCachedTest.test('should get all externalParticipants from cache', tryCatchEndTest(async (t) => {
    const data = await model.getAll()
    t.deepEqual(data, mockEpList)
  }))

  epCachedTest.test('should invalidate cache', tryCatchEndTest(async (t) => {
    let data = await model.getByName(name)
    t.deepEqual(data, mockEpList[0])

    await model.invalidateCache()

    db[EP_TABLE].find = sandbox.stub().resolves([])
    data = await model.getByName(name)
    t.equal(data, undefined)
  }))

  epCachedTest.test('should invalidate cache during create', tryCatchEndTest(async (t) => {
    await model.create({})

    db[EP_TABLE].find = sandbox.stub().resolves([])
    const data = await model.getByName(name)
    t.equal(data, undefined)
  }))

  epCachedTest.test('should invalidate cache during destroyById', tryCatchEndTest(async (t) => {
    let data = await model.getByName(name)
    t.deepEqual(data, mockEpList[0])

    await model.destroyById('id')

    db[EP_TABLE].find = sandbox.stub().resolves([])
    data = await model.getByName(name)
    t.equal(data, undefined)
  }))

  epCachedTest.test('should invalidate cache during destroyByName', tryCatchEndTest(async (t) => {
    let data = await model.getByName(name)
    t.deepEqual(data, mockEpList[0])

    await model.destroyByName('name')

    db[EP_TABLE].find = sandbox.stub().resolves([])
    data = await model.getByName(name)
    t.equal(data, undefined)
  }))

  epCachedTest.end()
})
