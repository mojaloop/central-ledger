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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/
process.env.LOG_LEVEL = 'debug'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const model = require('#src/models/participant/externalParticipant')
const Db = require('#src/lib/db')
const { TABLE_NAMES } = require('#src/shared/constants')

const { tryCatchEndTest } = require('#test/util/helpers')
const { mockExternalParticipantDto } = require('#test/fixtures')

const EP_TABLE = TABLE_NAMES.externalParticipant

Test('externalParticipant Model Tests -->', (epmTest) => {
  let sandbox

  epmTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()

    const dbStub = sandbox.stub(Db)
    Db.from = table => dbStub[table]
    Db[EP_TABLE] = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
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

  epmTest.test('should get externalParticipant by name from DB', tryCatchEndTest(async (t) => {
    const data = mockExternalParticipantDto()
    Db[EP_TABLE].findOne.withArgs({ name: data.name }).resolves(data)
    const result = await model.getOneByName(data.name)
    t.deepEqual(result, data)
  }))

  epmTest.test('should get externalParticipant by name from cache', tryCatchEndTest(async (t) => {
    const name = `extFsp-${Date.now()}`
    const data = mockExternalParticipantDto({ name })
    Db[EP_TABLE].findOne.withArgs({ name }).resolves(data)
    const result = await model.getOneByNameCached(name)
    t.deepEqual(result, data)

    Db[EP_TABLE].findOne = sandbox.stub()
    const cached = await model.getOneByNameCached(name)
    t.deepEqual(cached, data, 'cached externalParticipant')
    t.ok(Db[EP_TABLE].findOne.notCalled, 'db.findOne is called')
  }))

  epmTest.test('should get externalParticipant by id', tryCatchEndTest(async (t) => {
    const id = 'id123'
    const data = { name: 'extFsp', proxyId: '123' }
    Db[EP_TABLE].findOne.withArgs({ externalParticipantId: id }).resolves(data)
    const result = await model.getOneById(id)
    t.deepEqual(result, data)
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
