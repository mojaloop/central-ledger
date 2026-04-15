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
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const { logger } = require('../../../../../src/settlement/shared/logger')
const Model = require('../../../../../src/settlement/models/transferSettlement/facade')
const Db = require('../../../../../src/settlement/lib/db')
const TransferFacade = require('../../../../../src/models/transfer/facade')

const recordsToInsert = [{
  transferId: '42a874d4-82a4-4471-a3fc-3dfeb6f7cb93',
  participantCurrencyId: 13,
  transferParticipantRoleTypeId: 1,
  ledgerEntryTypeId: 2,
  amount: '1.27'
},
{
  transferId: '42a874d4-82a4-4471-a3fc-3dfeb6f7cb93',
  participantCurrencyId: 14,
  transferParticipantRoleTypeId: 2,
  ledgerEntryTypeId: 2,
  amount: '-1.27'
}]
const ledgerEntry = {
  transferId: '42a874d4-82a4-4471-a3fc-3dfeb6f7cb93',
  ledgerAccountTypeId: 'INTERCHANGE_FEE',
  ledgerEntryTypeId: 'INTERCHANGE_FEE',
  amount: '1.27',
  currency: 'TZS',
  payerFspId: 'testfsp1',
  payeeFspId: 'testfsp2'
}
const expectedParticipantPositionChangeRecords = [
  {
    participantPositionId: 130,
    value: 39.37,
    reservedValue: 0,
    transferStateChangeId: 4581
  },
  {
    participantPositionId: 129,
    value: -39.37,
    reservedValue: 0,
    transferStateChangeId: 4581
  }
]
Test('TransferSettlement facade', async (transferSettlementTest) => {
  let sandbox
  let knexStub
  let trxStub

  transferSettlementTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.settlementModel = {
      find: sandbox.stub()
    }

    Db.from = (table) => {
      return Db[table]
    }
    trxStub = {
      get commit () {

      },
      get rollback () {

      }
    }
    knexStub = {
      insert: sandbox.stub().returnsThis(),
      increment: sandbox.stub().returnsThis(),
      raw: sandbox.stub().returnsThis(),
      transaction: sandbox.stub().callsArgWith(0, trxStub),
      select: sandbox.stub().returnsThis(),
      from: sandbox.stub().returnsThis(),
      innerJoin: sandbox.stub().returnsThis(),
      leftOuterJoin: sandbox.stub().returnsThis(),
      where: sandbox.stub().returnsThis(),
      whereIn: sandbox.stub().returnsThis(),
      andWhere: sandbox.stub().returnsThis(),
      orWhere: sandbox.stub().returnsThis(),
      transacting: sandbox.stub(),
      union: sandbox.stub().returnsThis(),
      on: sandbox.stub().returnsThis(),
      andOn: sandbox.stub().returnsThis(),
      update: sandbox.stub().returnsThis(),
      joinRaw: sandbox.stub().returnsThis()
    }
    t.end()
  })

  transferSettlementTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await transferSettlementTest.test('insertLedgerEntry, when everything is fine, should', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')

      knexStub.transacting.onCall(0).resolves(recordsToInsert)
      knexStub.transacting.onCall(1).resolves(1)
      knexStub.transacting.onCall(2).resolves(1)
      knexStub.transacting.onCall(3).resolves(1)

      knexStub.transacting.onCall(4).resolves([{
        transferStateChangeId: 4581
      }])
      knexStub.transacting.onCall(5).resolves([
        {
          participantPositionId: 130,
          value: 39.37,
          reservedValue: 0
        },
        {
          participantPositionId: 129,
          value: -39.37,
          reservedValue: 0
        }
      ])
      knexStub.transacting.onCall(6).resolves(1)
      const knexFunc = sandbox.stub().returns(knexStub)
      Object.assign(knexFunc, knexStub)
      Db.getKnex.returns(knexFunc)

      const transferId = '42a874d4-82a4-4471-a3fc-3dfeb6f7cb93'
      await Model.insertLedgerEntry(ledgerEntry, transferId, trxStub)
      test.deepEqual(knexStub.insert.getCalls()[0].args[0], recordsToInsert, 'insert the records to transferParticipant table')
      test.deepEqual(knexStub.where.getCalls()[2].args[2], 13, 'increment the value of ParticipantPosition for ParticipantCurrency')
      test.deepEqual(knexStub.where.getCalls()[3].args[2], 14, 'increment the value of ParticipantPosition for ParticipantCurrency')
      test.deepEqual(knexStub.increment.getCalls()[0].args[0], 'value', 'increment the value of ParticipantPosition')
      test.deepEqual(knexStub.increment.getCalls()[0].args[1], '1.27', 'increment the value of ParticipantPosition')
      test.deepEqual(knexStub.increment.getCalls()[1].args[0], 'value', 'increment the value of ParticipantPosition')
      test.deepEqual(knexStub.increment.getCalls()[1].args[1], '-1.27', 'increment the value of ParticipantPosition')

      test.deepEqual(knexStub.insert.getCalls()[1].args[0], expectedParticipantPositionChangeRecords, 'insert the records to ParticipantPositionChange table')

      test.end()
    } catch (err) {
      console.log(err)
      test.fail(`should have not throw an error ${err}`)
      test.end()
    }
  })

  await transferSettlementTest.test('insertLedgerEntry throw error, when nothing to insert', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')

      knexStub.transacting.onCall(0).resolves(null)
      knexStub.transacting.onCall(1).resolves(1)
      knexStub.transacting.onCall(2).resolves(1)
      knexStub.transacting.onCall(3).resolves(1)

      knexStub.transacting.onCall(4).resolves([{
        transferStateChangeId: 4581
      }])
      knexStub.transacting.onCall(5).resolves([
        {
          participantPositionId: 130,
          value: 39.37,
          reservedValue: 0
        },
        {
          participantPositionId: 129,
          value: -39.37,
          reservedValue: 0
        }
      ])
      knexStub.transacting.onCall(6).resolves(1)
      const knexFunc = sandbox.stub().returns(knexStub)
      Object.assign(knexFunc, knexStub)
      Db.getKnex.returns(knexFunc)

      const transferId = '42a874d4-82a4-4471-a3fc-3dfeb6f7cb93'
      await Model.insertLedgerEntry(ledgerEntry, transferId, trxStub)
      test.fail('should throw an error')

      test.end()
    } catch (err) {
      test.ok(err instanceof Error)
      test.end()
    }
  })

  await transferSettlementTest.test('insertLedgerEntry when participantPosition records are not updated correctly', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      knexStub.transacting.onCall(0).resolves(recordsToInsert)
      knexStub.transacting.onCall(1).resolves(1)
      knexStub.transacting.onCall(2).resolves(0)
      const knexFunc = sandbox.stub().returns(knexStub)
      Object.assign(knexFunc, knexStub)
      Db.getKnex.returns(knexFunc)
      const transferId = '42a874d4-82a4-4471-a3fc-3dfeb6f7cb93'
      await Model.insertLedgerEntry(ledgerEntry, transferId, trxStub)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      test.ok(err instanceof Error, 'should throw an error')
      test.equal(err.message, 'Unable to update participantPosition record for participantCurrencyId: 13', 'should throw Unable to update participantPosition error message')

      test.end()
    }
  })

  await transferSettlementTest.test('insertLedgerEntry when transferStateChange record is not found', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      knexStub.transacting.onCall(0).resolves(recordsToInsert)
      knexStub.transacting.onCall(1).resolves(1)
      knexStub.transacting.onCall(2).resolves(1)
      knexStub.transacting.onCall(3).resolves(1)
      knexStub.transacting.onCall(4).resolves([])
      const knexFunc = sandbox.stub().returns(knexStub)
      Object.assign(knexFunc, knexStub)
      Db.getKnex.returns(knexFunc)
      const transferId = '42a874d4-82a4-4471-a3fc-3dfeb6f7cb93'
      await Model.insertLedgerEntry(ledgerEntry, transferId, trxStub)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      test.ok(err instanceof Error, 'should throw an error')
      test.equal(err.message, 'Unable to find transfer with COMMITTED state for transferId : 42a874d4-82a4-4471-a3fc-3dfeb6f7cb93', 'should throw Unable to find transfer error message')

      test.end()
    }
  })

  await transferSettlementTest.test('insertLedgerEntry when participantPositions records are not found', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      knexStub.transacting.onCall(0).resolves(recordsToInsert)
      knexStub.transacting.onCall(1).resolves(1)
      knexStub.transacting.onCall(2).resolves(1)
      knexStub.transacting.onCall(3).resolves(1)
      knexStub.transacting.onCall(4).resolves([{
        transferStateChangeId: 4581
      }])
      knexStub.transacting.onCall(5).resolves([
        {
          participantPositionId: 130,
          value: 39.37,
          reservedValue: 0
        }
      ])
      const knexFunc = sandbox.stub().returns(knexStub)
      Object.assign(knexFunc, knexStub)
      Db.getKnex.returns(knexFunc)
      const transferId = '42a874d4-82a4-4471-a3fc-3dfeb6f7cb93'
      await Model.insertLedgerEntries([ledgerEntry], transferId, trxStub)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      test.ok(err instanceof Error, 'should throw an error')
      test.equal(err.message, 'Unable to find all participantPosition records for ParticipantCurrency: {13,14}', 'should throw unable to find all participantPosition records error message')

      test.end()
    }
  })

  await transferSettlementTest.test('insertLedgerEntry when transaction is not passed', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')

      knexStub.transacting.onCall(0).resolves(recordsToInsert)
      knexStub.transacting.onCall(1).resolves(1)
      knexStub.transacting.onCall(2).resolves(1)
      knexStub.transacting.onCall(3).resolves(1)

      knexStub.transacting.onCall(4).resolves([{
        transferStateChangeId: 4581
      }])
      knexStub.transacting.onCall(5).resolves([
        {
          participantPositionId: 130,
          value: 39.37,
          reservedValue: 0
        },
        {
          participantPositionId: 129,
          value: -39.37,
          reservedValue: 0
        }
      ])
      knexStub.transacting.onCall(6).resolves(1)
      const knexFunc = sandbox.stub().returns(knexStub)
      Object.assign(knexFunc, knexStub)
      Db.getKnex.returns(knexFunc)

      const transferId = '42a874d4-82a4-4471-a3fc-3dfeb6f7cb93'
      await Model.insertLedgerEntry(ledgerEntry, transferId)
      test.end()
    } catch (err) {
      test.fail('An error was thrown')
      test.end()
    }
  })

  await transferSettlementTest.test('insertLedgerEntry when transaction is not passed and an error is thrown', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')

      knexStub.transacting.onCall(0).resolves(recordsToInsert)
      knexStub.transacting.onCall(1).rejects(new Error('An Error occured while inserting'))
      const knexFunc = sandbox.stub().returns(knexStub)
      Object.assign(knexFunc, knexStub)
      Db.getKnex.returns(knexFunc)

      const transferId = '42a874d4-82a4-4471-a3fc-3dfeb6f7cb93'
      await Model.insertLedgerEntry(ledgerEntry, transferId)
      test.fail('Error not thrown')
    } catch (err) {
      test.ok(err instanceof Error, 'should throw an error')
      test.equal(err.message, 'An Error occured while inserting')
      test.end()
    }
  })

  await transferSettlementTest.test('insertLedgerEntries, when everything is fine, should', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')

      knexStub.transacting.onCall(0).resolves(recordsToInsert)
      knexStub.transacting.onCall(1).resolves(1)
      knexStub.transacting.onCall(2).resolves(1)
      knexStub.transacting.onCall(3).resolves(1)

      knexStub.transacting.onCall(4).resolves([{
        transferStateChangeId: 4581
      }])
      knexStub.transacting.onCall(5).resolves([
        {
          participantPositionId: 130,
          value: 39.37,
          reservedValue: 0
        },
        {
          participantPositionId: 129,
          value: -39.37,
          reservedValue: 0
        }
      ])
      knexStub.transacting.onCall(6).resolves(1)
      const knexFunc = sandbox.stub().returns(knexStub)
      Object.assign(knexFunc, knexStub)
      Db.getKnex.returns(knexFunc)

      const transferId = '42a874d4-82a4-4471-a3fc-3dfeb6f7cb93'
      await Model.insertLedgerEntries([ledgerEntry], transferId, trxStub)
      test.deepEqual(knexStub.insert.getCalls()[0].args[0], recordsToInsert, 'insert the records to transferParticipant table')
      test.deepEqual(knexStub.where.getCalls()[2].args[2], 13, 'increment the value of ParticipantPosition for ParticipantCurrency')
      test.deepEqual(knexStub.where.getCalls()[3].args[2], 14, 'increment the value of ParticipantPosition for ParticipantCurrency')
      test.deepEqual(knexStub.increment.getCalls()[0].args[0], 'value', 'increment the value of ParticipantPosition')
      test.deepEqual(knexStub.increment.getCalls()[0].args[1], '1.27', 'increment the value of ParticipantPosition')
      test.deepEqual(knexStub.increment.getCalls()[1].args[0], 'value', 'increment the value of ParticipantPosition')
      test.deepEqual(knexStub.increment.getCalls()[1].args[1], '-1.27', 'increment the value of ParticipantPosition')

      test.deepEqual(knexStub.insert.getCalls()[1].args[0], expectedParticipantPositionChangeRecords, 'insert the records to ParticipantPositionChange table')

      test.end()
    } catch (err) {
      console.log(err)
      test.fail(`should have not throw an error ${err}`)
      test.end()
    }
  })

  await transferSettlementTest.test('insertLedgerEntries, when transaction is not passed, should', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')

      knexStub.transacting.onCall(0).resolves(recordsToInsert)
      knexStub.transacting.onCall(1).resolves(1)
      knexStub.transacting.onCall(2).resolves(1)
      knexStub.transacting.onCall(3).resolves(1)

      knexStub.transacting.onCall(4).resolves([{
        transferStateChangeId: 4581
      }])
      knexStub.transacting.onCall(5).resolves([
        {
          participantPositionId: 130,
          value: 39.37,
          reservedValue: 0
        },
        {
          participantPositionId: 129,
          value: -39.37,
          reservedValue: 0
        }
      ])
      knexStub.transacting.onCall(6).resolves(1)
      const knexFunc = sandbox.stub().returns(knexStub)
      Object.assign(knexFunc, knexStub)
      Db.getKnex.returns(knexFunc)

      const transferId = '42a874d4-82a4-4471-a3fc-3dfeb6f7cb93'
      await Model.insertLedgerEntries([ledgerEntry], transferId)
      test.end()
    } catch (err) {
      console.log(err)
      test.fail(`should have not throw an error ${err}`)
      test.end()
    }
  })

  await transferSettlementTest.test('insertLedgerEntry when transaction is not passed and an error is thrown', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')

      knexStub.transacting.onCall(0).resolves(recordsToInsert)
      knexStub.transacting.onCall(1).rejects(new Error('An Error occured while inserting'))
      const knexFunc = sandbox.stub().returns(knexStub)
      Object.assign(knexFunc, knexStub)
      Db.getKnex.returns(knexFunc)

      const transferId = '42a874d4-82a4-4471-a3fc-3dfeb6f7cb93'
      await Model.insertLedgerEntries([ledgerEntry], transferId)
      test.fail('Error not thrown')
    } catch (err) {
      test.ok(err instanceof Error, 'should throw an error')
      test.equal(err.message, 'An Error occured while inserting')
      test.end()
    }
  })

  await transferSettlementTest.test('updateTransferSettlement should handle errors', async (test) => {
    try {
      const transferId = '154cbf04-bac7-444d-aa66-76f66126d7f5'
      const status = 'success'
      await Model.updateTransferSettlement(transferId, status)
      test.fail('An error is expected')
      test.end()
    } catch (err) {
      logger.error(`updateTransferSettlement failed with error - ${err}`)
      test.pass('Error expected')
      test.end()
    }
  })

  await transferSettlementTest.test('updateTransferSettlement should handle knex errors', async (test) => {
    try {
      const transferId = '154cbf04-bac7-444d-aa66-76f66126d7f5'
      const status = 'success'
      sandbox.stub(Db, 'getKnex').returns({
        transaction: async (trxFunction) => {
          try {
            await trxFunction(sandbox.stub())
          } catch (err) {
            logger.error(`Got error ${err}`)
            throw err
          }
        }
      })
      await Model.updateTransferSettlement(transferId, status)
      test.fail('An error is expected')
      test.end()
    } catch (err) {
      logger.error(`updateTransferSettlement failed with error - ${err}`)
      test.pass('Error is expected')
      test.end()
    }
  })

  await transferSettlementTest.test('updateTransferSettlement should', async (test) => {
    try {
      const transferId = '154cbf04-bac7-444d-aa66-76f66126d7f5'
      const status = 'success'

      sandbox.stub(Db, 'getKnex')
      const knexFunc = sandbox.stub().returns(knexStub)
      Object.assign(knexFunc, knexStub)
      Db.getKnex.returns(knexFunc)
      knexStub.where.onCall(0).callsArgOn(0, knexStub)
      knexStub.where.onCall(0).returns(knexStub)

      knexStub.andWhere.onCall(0).callsArgOn(0, knexStub)
      knexStub.andWhere.onCall(0).returns(knexStub)
      knexStub.andWhere.onCall(1).returns(knexStub)
      knexStub.insert.onCall(0).callsArgOn(0, knexStub)
      knexStub.insert.onCall(0).returns(knexStub)

      knexStub.union.onCall(0).callsArgOn(0, knexStub)
      knexStub.innerJoin.onCall(6).callsArgOn(1, knexStub)
      knexStub.innerJoin.onCall(6).returns(knexStub)
      knexStub.where.onCall(2).callsArgOn(0, knexStub)
      knexStub.andWhere.onCall(2).callsArgOn(0, knexStub)
      knexStub.innerJoin.onCall(7).callsArgOn(0, knexStub)
      knexStub.innerJoin.onCall(7).returns(knexStub)
      knexStub.where.onCall(4).callsArgOn(0, knexStub)
      knexStub.where.onCall(4).returns(knexStub)
      knexStub.union.onCall(1).callsArgOn(0, knexStub)
      knexStub.union.onCall(1).returns(knexStub)

      knexStub.andWhere.onCall(4).callsArgOn(0, knexStub)
      knexStub.innerJoin.onCall(14).callsArgOn(1, knexStub)
      knexStub.innerJoin.onCall(14).returns(knexStub)
      knexStub.where.onCall(4).callsArgOn(0, knexStub)
      knexStub.where.onCall(4).returns(knexStub)
      knexStub.andWhere.onCall(4).callsArgOn(0, knexStub)
      knexStub.where.onCall(6).callsArgOn(0, knexStub)
      knexStub.where.onCall(6).returns(knexStub)
      knexStub.andWhere.onCall(6).callsArgOn(0, knexStub)

      knexStub.insert.onCall(2).callsArgOn(0, knexStub)
      knexStub.insert.onCall(2).returns(knexStub)
      knexStub.innerJoin.onCall(15).callsArgOn(0, knexStub)
      knexStub.innerJoin.onCall(15).returns(knexStub)

      knexStub.where.onCall(8).callsArgOn(0, knexStub)
      knexStub.where.onCall(8).returns(knexStub)
      knexStub.andWhere.onCall(8).callsArgOn(0, knexStub)
      knexStub.union.onCall(2).callsArgOn(0, knexStub)
      knexStub.union.onCall(2).returns(knexStub)
      knexStub.innerJoin.onCall(22).callsArgOn(1, knexStub)
      knexStub.innerJoin.onCall(22).returns(knexStub)
      knexStub.where.onCall(10).callsArgOn(0, knexStub)
      knexStub.where.onCall(10).returns(knexStub)

      knexStub.andWhere.onCall(10).callsArgOn(0, knexStub)
      knexStub.innerJoin.onCall(23).callsArgOn(1, knexStub)
      knexStub.innerJoin.onCall(23).returns(knexStub)

      await Model.updateTransferSettlement(transferId, status)
      test.ok('update the transfer Settlement')
      // TODO add expectations
      test.end()
    } catch (err) {
      logger.error(`updateTransferSettlement failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferSettlementTest.test('getSettlementModelByTransferId should', async (test) => {
    try {
      const transferId = '154cbf04-bac7-444d-aa66-76f66126d7f5'
      const settlementGranularityName = 'GROSS'
      const settlementModelResult = {
        settlementModelId: 1,
        name: 'CGS',
        isActive: 1,
        settlementGranularityId: 1,
        settlementInterchangeId: 1,
        settlementDelayId: 1,
        currencyId: 'USD',
        ledgerAccountTypeId: 1
      }

      sandbox.stub(Db, 'getKnex')

      const context = sandbox.stub()
      context.on = sandbox.stub().returns({
        andOn: sandbox.stub()
      })
      const join1Stub = sandbox.stub().callsArgOn(1, context)

      const knexStub = sandbox.stub()
      Db.getKnex.returns(knexStub)
      knexStub.returns({
        join: join1Stub.returns({
          join: sandbox.stub().returns({
            join: sandbox.stub().returns({
              where: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    select: sandbox.stub().returns(settlementModelResult)
                  })
                })
              })
            })
          })
        })
      })
      const result = await Model.getSettlementModelByTransferId(transferId, settlementGranularityName)
      test.deepEqual(result, settlementModelResult, 'results match')
      test.end()
    } catch (err) {
      logger.error(`getSettlementModelByTransferId failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferSettlementTest.test('getSettlementModelByTransferId should return default settlement, if it is GROSS', async (test) => {
    try {
      const transferId = '154cbf04-bac7-444d-aa66-76f66126d7f5'
      const settlementGranularityName = 'GROSS'
      const settlementModelResult = {
        settlementModelId: 1,
        name: 'CGS',
        isActive: 1,
        settlementGranularityId: 1,
        settlementInterchangeId: 1,
        settlementDelayId: 1,
        currencyId: null,
        ledgerAccountTypeId: 1
      }

      const transferCurrency = { currencyId: 'USD' }

      sandbox.stub(Db, 'getKnex')

      const context = sandbox.stub()
      context.on = sandbox.stub().returns({
        andOn: sandbox.stub()
      })
      const join1Stub = sandbox.stub().callsArgOn(1, context)
      sandbox.stub(TransferFacade, 'getByIdLight').resolves(transferCurrency)
      const knexStub = sandbox.stub()
      Db.getKnex.returns(knexStub)
      knexStub.returns({
        join: join1Stub.returns({
          join: sandbox.stub().returns({
            join: sandbox.stub().returns({
              where: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    select: sandbox.stub().returns([])
                  })
                })
              })
            })
          })
        })
      })
      Db.settlementModel.find.returns([settlementModelResult])
      const result = await Model.getSettlementModelByTransferId(transferId, settlementGranularityName)
      test.deepEqual(result, [settlementModelResult], 'results match')
      test.end()
    } catch (err) {
      logger.error(`getSettlementModelByTransferId failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferSettlementTest.test('getSettlementModelByTransferId for GROSS settlement should return empty if deferred exist', async (test) => {
    try {
      const transferId = '154cbf04-bac7-444d-aa66-76f66126d7f5'
      const settlementGranularityName = 'GROSS'
      const settlementModelResults = [{
        settlementModelId: 1,
        name: 'CGS',
        isActive: 1,
        settlementGranularityId: 1,
        settlementInterchangeId: 1,
        settlementDelayId: 1,
        currencyId: null,
        ledgerAccountTypeId: 1
      }, {
        settlementModelId: 1,
        name: 'DEFERRED',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2,
        currencyId: 'USD',
        ledgerAccountTypeId: 1
      }]
      const transferCurrency = { currencyId: 'USD' }

      sandbox.stub(Db, 'getKnex')

      const context = sandbox.stub()
      context.on = sandbox.stub().returns({
        andOn: sandbox.stub()
      })
      const join1Stub = sandbox.stub().callsArgOn(1, context)
      sandbox.stub(TransferFacade, 'getByIdLight').resolves(transferCurrency)
      const knexStub = sandbox.stub()
      Db.getKnex.returns(knexStub)
      knexStub.returns({
        join: join1Stub.returns({
          join: sandbox.stub().returns({
            join: sandbox.stub().returns({
              where: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    select: sandbox.stub().returns([])
                  })
                })
              })
            })
          })
        })
      })
      Db.settlementModel.find.resolves(settlementModelResults)
      const result = await Model.getSettlementModelByTransferId(transferId, settlementGranularityName)
      test.deepEqual(result, [], 'results match')
      test.end()
    } catch (err) {
      logger.error(`getSettlementModelByTransferId failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferSettlementTest.test('getSettlementModelByTransferId should return default settlement, if it is NET', async (test) => {
    try {
      const transferId = '154cbf04-bac7-444d-aa66-76f66126d7f5'
      const settlementGranularityName = 'NET'
      const settlementModelResult = {
        settlementModelId: 1,
        name: 'DEFERRED',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 1,
        settlementDelayId: 1,
        currencyId: null,
        ledgerAccountTypeId: 1
      }

      const transferCurrency = { currencyId: 'USD' }

      sandbox.stub(Db, 'getKnex')

      const context = sandbox.stub()
      context.on = sandbox.stub().returns({
        andOn: sandbox.stub()
      })
      const join1Stub = sandbox.stub().callsArgOn(1, context)
      sandbox.stub(TransferFacade, 'getByIdLight').resolves(transferCurrency)
      const knexStub = sandbox.stub()
      Db.getKnex.returns(knexStub)
      knexStub.returns({
        join: join1Stub.returns({
          join: sandbox.stub().returns({
            join: sandbox.stub().returns({
              where: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    select: sandbox.stub().returns([])
                  })
                })
              })
            })
          })
        })
      })
      Db.settlementModel.find.returns([settlementModelResult])
      const result = await Model.getSettlementModelByTransferId(transferId, settlementGranularityName)
      test.deepEqual(result, [settlementModelResult], 'results match')
      test.end()
    } catch (err) {
      logger.error(`getSettlementModelByTransferId failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferSettlementTest.test('getSettlementModelByTransferId for NET settlement should return empty if deferred exist', async (test) => {
    try {
      const transferId = '154cbf04-bac7-444d-aa66-76f66126d7f5'
      const settlementGranularityName = 'NET'
      const settlementModelResults = [{
        settlementModelId: 1,
        name: 'DEFERRED',
        isActive: 1,
        settlementGranularityId: 1,
        settlementInterchangeId: 1,
        settlementDelayId: 1,
        currencyId: null,
        ledgerAccountTypeId: 1
      }, {
        settlementModelId: 1,
        name: 'CGS',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2,
        currencyId: 'USD',
        ledgerAccountTypeId: 1
      }]
      const transferCurrency = { currencyId: 'USD' }

      sandbox.stub(Db, 'getKnex')

      const context = sandbox.stub()
      context.on = sandbox.stub().returns({
        andOn: sandbox.stub()
      })
      const join1Stub = sandbox.stub().callsArgOn(1, context)
      sandbox.stub(TransferFacade, 'getByIdLight').resolves(transferCurrency)
      const knexStub = sandbox.stub()
      Db.getKnex.returns(knexStub)
      knexStub.returns({
        join: join1Stub.returns({
          join: sandbox.stub().returns({
            join: sandbox.stub().returns({
              where: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  where: sandbox.stub().returns({
                    select: sandbox.stub().returns([])
                  })
                })
              })
            })
          })
        })
      })
      Db.settlementModel.find.resolves(settlementModelResults)
      const result = await Model.getSettlementModelByTransferId(transferId, settlementGranularityName)
      test.deepEqual(result, [], 'results match')
      test.end()
    } catch (err) {
      logger.error(`getSettlementModelByTransferId failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferSettlementTest.end()
})
