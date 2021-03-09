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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const ParticipantCurrencyModel = require('../../../../src/models/participant/participantCurrencyCached')
const Model = require('../../../../src/models/participant/participantPosition')

Test('Participant Position model', async (participantPositionTest) => {
  let sandbox

  participantPositionTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.participantPosition = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      destroy: sandbox.stub()
    }
    Db.from = (table) => {
      return Db[table]
    }
    t.end()
  })

  participantPositionTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await participantPositionTest.test('getByParticipantCurrencyId', async (assert) => {
    try {
      Db.participantPosition.findOne.withArgs({ participantCurrencyId: 1 }).returns({
        participantPositionId: 1,
        participantCurrencyId: 1,
        value: 0.0,
        reservedValue: 0.0,
        changedDate: '2018-07-19'
      })
      const expected = {
        participantPositionId: 1,
        participantCurrencyId: 1,
        value: 0.0,
        reservedValue: 0.0,
        changedDate: '2018-07-19'
      }
      const result = await Model.getByParticipantCurrencyId(1)
      assert.equal(JSON.stringify(result), JSON.stringify(expected))
      assert.end()
    } catch (err) {
      Logger.error(`getByParticipantCurrencyId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantPositionTest.test('getByParticipantCurrencyId should fail', async (test) => {
    try {
      Db.participantPosition.findOne.withArgs({ participantCurrencyId: 1 }).throws(new Error())
      await Model.getByParticipantCurrencyId(1)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`getByParticipantCurrencyId failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await participantPositionTest.test('destroyByParticipantCurrencyId', async (assert) => {
    try {
      Db.participantPosition.destroy.withArgs({ participantCurrencyId: 1 }).returns(1)
      const result = await Model.destroyByParticipantCurrencyId(1)
      assert.equal(result, 1, 'Results match')
      assert.end()
    } catch (err) {
      Logger.error(`destroyByParticipantCurrencyId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantPositionTest.test('destroyByParticipantCurrencyId should fail', async (test) => {
    try {
      Db.participantPosition.destroy.withArgs({ participantCurrencyId: 1 }).throws(new Error())
      await Model.destroyByParticipantCurrencyId(1)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`destroyByParticipantCurrencyId failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await participantPositionTest.test('destroyByParticipantId should clean all participant account positions', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      Db.getKnex.returns(knexStub)
      sandbox.stub(ParticipantCurrencyModel, 'getByParticipantId')
      ParticipantCurrencyModel.getByParticipantId.withArgs(1).returns(Promise.resolve([{ participantCurrencyId: 1 }]))
      knexStub.withArgs('participantPosition').returns({
        whereIn: sandbox.stub().returns({
          del: sandbox.stub().returns(true)
        })
      })

      const result = await Model.destroyByParticipantId(1)
      test.ok(result)
      test.end()
    } catch (err) {
      test.pass('Error thrown')
      test.end()
    }
  })

  await participantPositionTest.test('destroyByParticipantId should fail', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      Db.getKnex.throws(new Error())
      await Model.destroyByParticipantId(1)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      test.pass('Error thrown')
      test.end()
    }
  })

  await participantPositionTest.test('createParticipantPositionRecords should', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)
      const transactingStub = sandbox.stub()
      const batchInsertStub = sandbox.stub()
      transactingStub.resolves()
      knexStub.batchInsert = batchInsertStub.returns({ transacting: transactingStub })
      const participantPositions = [
        {
          participantPositionId: 1,
          participantCurrencyId: 1,
          value: 0.000,
          reservedValue: 0.000
        },
        {
          participantPositionId: 1,
          participantCurrencyId: 2,
          value: 0.000,
          reservedValue: 0.000
        }
      ]
      await Model.createParticipantPositionRecords(participantPositions, trxStub)
      test.equal(batchInsertStub.callCount, 1, 'call batch insert')
      test.equal(batchInsertStub.lastCall.args[0], 'participantPosition', 'write to the participantPosition table')
      test.deepEqual(batchInsertStub.lastCall.args[1], participantPositions, 'all records should be inserted')
      test.equal(transactingStub.callCount, 1, 'make the database calls as transaction')
      test.equal(transactingStub.lastCall.args[0], trxStub, 'run as transaction')
      test.equal(trxStub.commit.callCount, 0, 'not commit the transaction if transaction is passed')
      test.end()
    } catch (err) {
      Logger.error(`createParticipantPositionRecords failed with error - ${err}`)
      test.fail('Error thrown')
      test.end()
    }
  })

  await participantPositionTest.test('createParticipantPositionRecords should', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = {
        get commit () {

        },
        get rollback () {

        }
      }
      const trxSpyCommit = sandbox.spy(trxStub, 'commit', ['get'])

      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)
      const transactingStub = sandbox.stub()
      const batchInsertStub = sandbox.stub()
      transactingStub.resolves()
      knexStub.batchInsert = batchInsertStub.returns({ transacting: transactingStub })
      const participantPositions = [
        {
          participantPositionId: 1,
          participantCurrencyId: 1,
          value: 0.000,
          reservedValue: 0.000
        },
        {
          participantPositionId: 1,
          participantCurrencyId: 2,
          value: 0.000,
          reservedValue: 0.000
        }
      ]
      await Model.createParticipantPositionRecords(participantPositions)
      test.equal(batchInsertStub.callCount, 1, 'call batch insert')
      test.equal(batchInsertStub.lastCall.args[0], 'participantPosition', 'write to the participantPosition table')
      test.deepEqual(batchInsertStub.lastCall.args[1], participantPositions, 'all records should be inserted')
      test.equal(transactingStub.callCount, 1, 'make the database calls as transaction')
      test.equal(transactingStub.lastCall.args[0], trxStub, 'run as transaction')
      test.equal(trxSpyCommit.get.calledOnce, true, 'commit the transaction if no transaction is passed')

      test.end()
    } catch (err) {
      Logger.error(`createParticipantPositionRecords failed with error - ${err}`)
      test.fail('Error thrown')
      test.end()
    }
  })

  await participantPositionTest.test('createParticipantPositionRecords should', async (test) => {
    let trxStub
    let trxSpyRollBack

    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      trxStub = {
        get commit () {

        },
        get rollback () {

        }
      }
      trxSpyRollBack = sandbox.spy(trxStub, 'rollback', ['get'])

      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)
      const transactingStub = sandbox.stub()
      const batchInsertStub = sandbox.stub()
      transactingStub.rejects(new Error())
      knexStub.batchInsert = batchInsertStub.returns({ transacting: transactingStub })

      const participantPositions = [
        {
          participantPositionId: 1,
          participantCurrencyId: 1,
          value: 0.000,
          reservedValue: 0.000
        },
        {
          participantPositionId: 1,
          participantCurrencyId: 2,
          value: 0.000,
          reservedValue: 0.000
        }
      ]
      await Model.createParticipantPositionRecords(participantPositions)
      test.fail('have thrown an error')
      test.end()
    } catch (err) {
      test.pass('throw an error')
      test.equal(trxSpyRollBack.get.calledOnce, true, 'rollback the transaction if no transaction is passed')
      test.end()
    }
  })

  await participantPositionTest.test('createParticipantCurrencyRecords should', async (test) => {
    let trxStub
    let trxSpyRollBack

    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      trxStub = {
        get commit () {

        },
        get rollback () {

        }
      }
      trxSpyRollBack = sandbox.spy(trxStub, 'rollback', ['get'])

      knexStub.transaction = sandbox.stub().callsArgWith(0, [trxStub, true])
      Db.getKnex.returns(knexStub)
      const transactingStub = sandbox.stub()
      const batchInsertStub = sandbox.stub()
      transactingStub.rejects(new Error())
      knexStub.batchInsert = batchInsertStub.returns({ transacting: transactingStub })

      const participantPositions = [
        {
          participantPositionId: 1,
          participantCurrencyId: 1,
          value: 0.000,
          reservedValue: 0.000
        },
        {
          participantPositionId: 1,
          participantCurrencyId: 2,
          value: 0.000,
          reservedValue: 0.000
        }
      ]
      await Model.createParticipantPositionRecords(participantPositions)
      test.fail('have thrown an error')
      test.end()
    } catch (err) {
      test.pass('throw an error')
      test.equal(trxSpyRollBack.get.calledOnce, false, 'not rollback the transaction if  transaction is passed')
      test.end()
    }
  })

  await participantPositionTest.test('createParticipantCurrencyRecords should', async (test) => {
    try {
      const participantPositions = [
        {
          participantPositionId: 1,
          participantCurrencyId: 1,
          value: 0.000,
          reservedValue: 0.000
        },
        {
          participantPositionId: 1,
          participantCurrencyId: 2,
          value: 0.000,
          reservedValue: 0.000
        }
      ]
      sandbox.stub(Db, 'getKnex')
      Db.getKnex.throws(new Error())
      await Model.createParticipantPositionRecords(participantPositions)
      test.fail('have thrown an error')
      test.end()
    } catch (err) {
      test.pass('throw an error')
      test.end()
    }
  })

  participantPositionTest.end()
})
