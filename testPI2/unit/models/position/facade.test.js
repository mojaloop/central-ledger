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
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
const Model = require('../../../../src/models/position/facade')

Test('Position facade', async (positionFacadeTest) => {
  let sandbox
  let clock
  let now = new Date()

  positionFacadeTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.participant = {
      query: sandbox.stub()
    }
    clock = Sinon.useFakeTimers(now.getTime())
    t.end()
  })

  positionFacadeTest.afterEach(t => {
    sandbox.restore()
    clock.restore()
    t.end()
  })

  await positionFacadeTest.test('getParticipantPositionByParticipantIdAndCurrencyId should', async (test) => {
    try {
      const participantId = 1
      const currencyId = 'USD'
      let builderStub = sandbox.stub()
      let participantCurrencyStub = sandbox.stub()
      let participantPositionStub = sandbox.stub()
      let selectStub = sandbox.stub()

      builderStub.where = sandbox.stub()
      Db.participant.query.callsArgWith(0, builderStub)

      builderStub.where.returns({
        innerJoin: participantCurrencyStub.returns({
          innerJoin: participantPositionStub.returns({
            select: selectStub.returns(1)
          })
        })
      })

      let found = await Model.getParticipantPositionByParticipantIdAndCurrencyId(participantId, currencyId)
      test.equal(found, 1, 'retrive the record')
      test.ok(builderStub.where.withArgs({
        'participant.participantId': participantId,
        'pc.currencyId': currencyId
      }).calledOnce, 'query builder called once')
      test.ok(participantCurrencyStub.withArgs('participantCurrency AS pc', 'pc.participantId', 'participant.participantId').calledOnce, 'participantCurrency inner joined')
      test.ok(participantPositionStub.withArgs('participantPosition AS pp', 'pp.participantCurrencyId', 'pc.participantCurrencyId').calledOnce, 'participantPosition inner joined')
      test.ok(selectStub.withArgs(
        'participant.*',
        'pc.*',
        'pp.*'
      ).calledOnce, 'select all columns from participant, participantCurrency and participantPosition')
      test.end()
    } catch (err) {
      Logger.error(`getParticipantPositionByParticipantIdAndCurrencyId failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionFacadeTest.test('getParticipantPositionByParticipantIdAndCurrencyId should', async (test) => {
    try {
      const participantId = 1
      const currencyId = 'USD'
      Db.participant.query.throws(new Error())

      await Model.getParticipantPositionByParticipantIdAndCurrencyId(participantId, currencyId)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`getParticipantPositionByParticipantIdAndCurrencyId failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await positionFacadeTest.test('getParticipantLimitByParticipantIdAndCurrencyId should', async (test) => {
    try {
      const participantId = 1
      const currencyId = 'USD'
      let builderStub = sandbox.stub()
      let participantCurrencyStub = sandbox.stub()
      let participantLimitStub = sandbox.stub()
      let selectStub = sandbox.stub()

      builderStub.where = sandbox.stub()
      Db.participant.query.callsArgWith(0, builderStub)

      builderStub.where.returns({
        innerJoin: participantCurrencyStub.returns({
          innerJoin: participantLimitStub.returns({
            select: selectStub.returns(1)
          })
        })
      })

      let found = await Model.getParticipantLimitByParticipantIdAndCurrencyId(participantId, currencyId)
      test.equal(found, 1, 'retrive the record')
      test.ok(builderStub.where.withArgs({
        'participant.participantId': participantId,
        'pc.currencyId': currencyId
      }).calledOnce, 'query builder called once')
      test.ok(participantCurrencyStub.withArgs('participantCurrency AS pc', 'pc.participantId', 'participant.participantId').calledOnce, 'participantCurrency inner joined')
      test.ok(participantLimitStub.withArgs('participantLimit AS pl', 'pl.participantCurrencyId', 'pl.participantCurrencyId').calledOnce, 'participantLimit inner joined')
      test.ok(selectStub.withArgs(
        'participant.*',
        'pc.*',
        'pl.*'
      ).calledOnce, 'select all columns from participant, participantCurrency and participantLimit')
      test.end()
    } catch (err) {
      Logger.error(`getParticipantLimitByParticipantIdAndCurrencyId failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionFacadeTest.test('getParticipantLimitByParticipantIdAndCurrencyId should', async (test) => {
    try {
      const participantId = 1
      const currencyId = 'USD'
      Db.participant.query.throws(new Error())

      await Model.getParticipantLimitByParticipantIdAndCurrencyId(participantId, currencyId)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`getParticipantLimitByParticipantIdAndCurrencyId failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await positionFacadeTest.test('changeParticipantPositionTransaction should', async changeParticipantPositionTransaction => {
    try {
      const participantCurrencyId = 'USD'
      let isIncrease
      const amount = 100
      const transferStateChange = {
        transferId: 't1',
        transferStateId: 'state',
        reason: null,
        createdDate: now
      }
      const participantPosition = {
        participantPositionId: 1,
        value: 1000,
        reservedValue: 0
      }
      const insertedTransferStateChange = {
        transferStateChangeId: 1
      }

      await changeParticipantPositionTransaction.test('use a transaction to update database when position is increasing', async (test) => {
        try {
          isIncrease = true

          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          knexStub.returns({
            transacting: sandbox.stub().returns({
              where: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns({
                  select: sandbox.stub().returns({
                    first: sandbox.stub().returns(participantPosition)
                  }),
                  first: sandbox.stub().returns({
                    orderBy: sandbox.stub().returns(insertedTransferStateChange)
                  })
                }),
                update: sandbox.stub()
              }),
              insert: sandbox.stub()
            })
          })

          await Model.changeParticipantPositionTransaction(participantCurrencyId, isIncrease, amount, transferStateChange)
          test.pass('completed successfully')
          test.ok(knexStub.withArgs('participantPosition').calledTwice, 'knex called with participantPosition twice')
          test.ok(knexStub.withArgs('transferStateChange').calledTwice, 'knex called with transferStateChange twice')
          test.ok(knexStub.withArgs('participantPositionChange').calledOnce, 'knex called with participantPositionChange once')
          test.end()
        } catch (err) {
          Logger.error(`changeParticipantPositionTransaction failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await changeParticipantPositionTransaction.test('use a transaction to update database when position is decreasing', async (test) => {
        try {
          isIncrease = false

          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          knexStub.returns({
            transacting: sandbox.stub().returns({
              where: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns({
                  select: sandbox.stub().returns({
                    first: sandbox.stub().returns(participantPosition)
                  }),
                  first: sandbox.stub().returns({
                    orderBy: sandbox.stub().returns(insertedTransferStateChange)
                  })
                }),
                update: sandbox.stub()
              }),
              insert: sandbox.stub()
            })
          })

          await Model.changeParticipantPositionTransaction(participantCurrencyId, isIncrease, amount, transferStateChange)
          test.pass('completed successfully')
          test.ok(knexStub.withArgs('participantPosition').calledTwice, 'knex called with participantPosition twice')
          test.ok(knexStub.withArgs('transferStateChange').calledTwice, 'knex called with transferStateChange twice')
          test.ok(knexStub.withArgs('participantPositionChange').calledOnce, 'knex called with participantPositionChange once')
          test.end()
        } catch (err) {
          Logger.error(`changeParticipantPositionTransaction failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await changeParticipantPositionTransaction.test('rollback and throw error', async (test) => {
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.rollback = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          knexStub.throws(new Error())

          await Model.changeParticipantPositionTransaction(participantCurrencyId, isIncrease, amount, transferStateChange)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`changeParticipantPositionTransaction failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await changeParticipantPositionTransaction.end()
    } catch (err) {
      Logger.error(`changeParticipantPositionTransaction failed with error - ${err}`)
      changeParticipantPositionTransaction.fail()
      await changeParticipantPositionTransaction.end()
    }
  })

  await positionFacadeTest.end()
})
