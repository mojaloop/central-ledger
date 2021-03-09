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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const Model = require('../../../../src/models/participant/participantCurrency')

Test('Participant Currency model', async (participantCurrencyTest) => {
  let sandbox

  participantCurrencyTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.participantCurrency = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      destroy: sandbox.stub(),
      update: sandbox.stub()
    }
    Db.from = (table) => {
      return Db[table]
    }
    t.end()
  })

  participantCurrencyTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await participantCurrencyTest.test('create currency for fake participant', async (assert) => {
    Db.participantCurrency.insert.withArgs({ participantId: 3, currencyId: 'FAKE', createdBy: 'unknown' }).throws(new Error('message'))
    try {
      const r = await Model.create({ participantId: 3, currencyId: 'FAKE', createdBy: 'unknown' })
      assert.comment(r)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error)
    }
    assert.end()
  })

  await participantCurrencyTest.test('create participant Currency', async (assert) => {
    try {
      const participantId = 1
      const ledgerAccountTypeId = 1
      const currencyId = 'USD'
      const isActive = true
      const createdBy = 'unknown'
      Db.participantCurrency.insert.withArgs({ participantId, currencyId, ledgerAccountTypeId, isActive, createdBy }).returns(1)
      const result = await Model.create(participantId, currencyId, ledgerAccountTypeId)
      assert.equal(result, 1, `returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`create participant currency failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantCurrencyTest.test('create participant currency should throw an error', async (assert) => {
    Db.participantCurrency.insert.throws(new Error('message'))
    try {
      const r = await Model.create({ participantId: 1, currencyId: 'USD', createdBy: 'unknown' })
      assert.comment(r)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error)
      Logger.error(`create participant currency failed with error - ${err}`)
      assert.pass('Error thrown')
    }
    assert.end()
  })

  await participantCurrencyTest.test('getAll', async (assert) => {
    try {
      Db.participantCurrency.find.returns([{
        participantCurrencyId: 1,
        participantId: 1,
        currencyId: 'USD',
        isActive: 1
      }, {
        participantCurrencyId: 2,
        participantId: 2,
        currencyId: 'GBP',
        isActive: 1
      }])
      const expected = [{
        participantCurrencyId: 1,
        participantId: 1,
        currencyId: 'USD',
        isActive: 1
      }, {
        participantCurrencyId: 2,
        participantId: 2,
        currencyId: 'GBP',
        isActive: 1
      }]
      const result = await Model.getAll()
      assert.equal(JSON.stringify(result), JSON.stringify(expected))
      assert.end()
    } catch (err) {
      Logger.error(`getAll() failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantCurrencyTest.test('getById', async (assert) => {
    try {
      Db.participantCurrency.findOne.withArgs({ participantCurrencyId: 1 }).returns({
        participantCurrencyId: 1,
        participantId: 1,
        currencyId: 'USD',
        isActive: 1
      })
      const expected = {
        participantCurrencyId: 1,
        participantId: 1,
        currencyId: 'USD',
        isActive: 1
      }
      const result = await Model.getById(1)
      assert.equal(JSON.stringify(result), JSON.stringify(expected))
      assert.end()
    } catch (err) {
      Logger.error(`get participant currency by Id failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantCurrencyTest.test('getById should fail', async (test) => {
    try {
      Db.participantCurrency.findOne.withArgs({ participantCurrencyId: 1 }).throws(new Error())
      await Model.getById(1)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`get participant currency by Id failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await participantCurrencyTest.test('update', async (assert) => {
    try {
      Db.participantCurrency.update.withArgs({ participantCurrencyId: 1 }, { isActive: 1 }).returns(1)
      const result = await Model.update(1, 1)
      assert.equal(1, result)
      assert.end()
    } catch (err) {
      Logger.error(`get participant currency by Id failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantCurrencyTest.test('update should fail', async (test) => {
    try {
      Db.participantCurrency.update.withArgs({ participantCurrencyId: 1 }, { isActive: 1 }).throws(new Error())
      await Model.update(1, 1)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`get participant currency by Id failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await participantCurrencyTest.test('getByParticipantId', async (assert) => {
    try {
      Db.participantCurrency.find.returns([{
        participantCurrencyId: 1,
        participantId: 1,
        currencyId: 'USD',
        isActive: 1
      },
      {
        participantCurrencyId: 2,
        participantId: 1,
        currencyId: 'EUR',
        isActive: 1
      }
      ])
      const expected = [
        {
          participantCurrencyId: 1,
          participantId: 1,
          currencyId: 'USD',
          isActive: 1
        },
        {
          participantCurrencyId: 2,
          participantId: 1,
          currencyId: 'EUR',
          isActive: 1
        }
      ]
      const result = await Model.getByParticipantId(1, 1)
      assert.equal(JSON.stringify(result), JSON.stringify(expected))
      assert.end()
    } catch (err) {
      Logger.error(`get participant currency by participant Id failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantCurrencyTest.test('getByParticipantId should fail', async (test) => {
    try {
      Db.participantCurrency.find.withArgs({ participantId: 1 }).throws(new Error())
      await Model.getByParticipantId(1)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`get participant currency by participant Id failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await participantCurrencyTest.test('destroyByParticipantId', async (assert) => {
    try {
      Db.participantCurrency.destroy.withArgs({ participantId: 1 }).returns(Promise.resolve(true))
      const result = await Model.destroyByParticipantId(1)
      assert.equal(result, true)
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`destroy participant failed with error - ${err}`)
      sandbox.restore()
      assert.fail()
      assert.end()
    }
  })

  await participantCurrencyTest.test('destroyByParticipantId should throw an error', async (test) => {
    try {
      Db.participantCurrency.destroy.withArgs({ participantId: 1 }).throws(new Error())
      const result = await Model.destroyByParticipantId(1)
      test.equal(result, true)
      test.fail('Error not thrown')
      sandbox.restore()
      test.end()
    } catch (err) {
      Logger.error(`destroy participant failed with error - ${err}`)
      test.pass('Error thrown')
      sandbox.restore()
      test.end()
    }
  })

  participantCurrencyTest.end()
})
