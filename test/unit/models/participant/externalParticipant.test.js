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
process.env.LOG_LEVEL = 'debug'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')

const model = require('#src/models/participant/externalParticipant')
const Db = require('#src/lib/db')
const { TABLE_NAMES, DB_ERROR_CODES } = require('#src/shared/constants')

const { tryCatchEndTest } = require('#test/util/helpers')
const { mockExternalParticipantDto } = require('#test/fixtures')

const EP_TABLE = TABLE_NAMES.externalParticipant

const isFSPIOPError = (err, message) => err.name === 'FSPIOPError' &&
  err.message === message &&
  err.cause.includes(message)

Test('externalParticipant Model Tests -->', (epmTest) => {
  let sandbox

  epmTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()

    const dbStub = sandbox.stub(Db)
    Db.from = table => dbStub[table]
    Db[EP_TABLE] = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      destroy: sandbox.stub()
    }
    t.end()
  })

  epmTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  epmTest.test('should create externalParticipant in DB', tryCatchEndTest(async (t) => {
    const data = mockExternalParticipantDto({ id: null, createdDate: null })
    Db[EP_TABLE].insert.withArgs(data).resolves(true)
    const result = await model.create(data)
    t.ok(result)
  }))

  epmTest.test('should return null in case duplicateEntry error', tryCatchEndTest(async (t) => {
    Db[EP_TABLE].insert.rejects({ code: DB_ERROR_CODES.duplicateEntry })
    const result = await model.create({})
    t.equals(result, null)
  }))

  epmTest.test('should reformat DB error into SPIOPError on create', tryCatchEndTest(async (t) => {
    const dbError = new Error('DB error')
    Db[EP_TABLE].insert.rejects(dbError)
    const err = await model.create({})
      .catch(e => e)
    t.true(isFSPIOPError(err, dbError.message))
  }))

  epmTest.test('should get externalParticipant by name from DB', tryCatchEndTest(async (t) => {
    const data = mockExternalParticipantDto()
    Db[EP_TABLE].findOne.withArgs({ name: data.name }).resolves(data)
    const result = await model.getByName(data.name)
    t.deepEqual(result, data)
  }))

  epmTest.test('should get externalParticipant by id', tryCatchEndTest(async (t) => {
    const id = 'id123'
    const data = { name: 'extFsp', proxyId: '123' }
    Db[EP_TABLE].findOne.withArgs({ externalParticipantId: id }).resolves(data)
    const result = await model.getById(id)
    t.deepEqual(result, data)
  }))

  epmTest.test('should get all externalParticipants by id', tryCatchEndTest(async (t) => {
    const ep = mockExternalParticipantDto()
    Db[EP_TABLE].find.withArgs({}).resolves([ep])
    const result = await model.getAll()
    t.deepEqual(result, [ep])
  }))

  epmTest.test('should delete externalParticipant record by name', tryCatchEndTest(async (t) => {
    const name = 'extFsp'
    Db[EP_TABLE].destroy.withArgs({ name }).resolves(true)
    const result = await model.destroyByName(name)
    t.ok(result)
  }))

  epmTest.test('should delete externalParticipant record by id', tryCatchEndTest(async (t) => {
    const id = 123
    Db[EP_TABLE].destroy.withArgs({ externalParticipantId: id }).resolves(true)
    const result = await model.destroyById(id)
    t.ok(result)
  }))

  epmTest.end()
})
