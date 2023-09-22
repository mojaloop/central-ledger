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

 * Kevin Leyow <kevin.leyow@infitx.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Model = require('../../../../src/models/position/batch')
const Logger = require('@mojaloop/central-services-logger')

Test('Batch model', async (positionBatchTest) => {
  let sandbox

  positionBatchTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.participantCurrency = {}
    Db.participantPosition = {}
    Db.transferStateChange = {}
    Db.participantPositionChange = {}

    Db.from = (table) => {
      return Db[table]
    }

    t.end()
  })

  positionBatchTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await positionBatchTest.test('init knex and unset', async (test) => {
    sandbox.stub(Db, 'getKnex')
    const knexStub = sandbox.stub()
    const trxStub = sandbox.stub()
    trxStub.commit = sandbox.stub()
    knexStub.transaction = sandbox.stub().returns(trxStub)
    Db.getKnex.returns(knexStub)
    await Model._initKnex()
    await Model._initKnex()
    Model._unsetKnex()
    test.pass()
    test.end()
  })

  await positionBatchTest.test('startDbTransaction returns transaction', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().returns(trxStub)
      Db.getKnex.returns(knexStub)

      const trx = await Model.startDbTransaction()
      test.pass('completed successfully')
      test.ok(trx)
      Model._unsetKnex()
      test.end()
    } catch (err) {
      Logger.error(`getAllParticipantCurrency failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionBatchTest.test('getAllParticipantCurrency with trx', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        transacting: sandbox.stub().returns({
          select: sandbox.stub().returns({})
        })
      })

      await Model.getAllParticipantCurrency(trxStub)
      test.pass('completed successfully')
      test.ok(knexStub.withArgs('participantCurrency').calledOnce, 'knex called with participantCurrency once')
      Model._unsetKnex()
      test.end()
    } catch (err) {
      Logger.error(`getAllParticipantCurrency failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionBatchTest.test('getAllParticipantCurrency without trx', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        select: sandbox.stub().returns({})
      })

      await Model.getAllParticipantCurrency()
      test.pass('completed successfully')
      test.ok(knexStub.withArgs('participantCurrency').calledOnce, 'knex called with participantCurrency once')
      Model._unsetKnex()
      test.end()
    } catch (err) {
      Logger.error(`getAllParticipantCurrency failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionBatchTest.test('getLatestTransferStateChangesByTransferIdList', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')

      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        transacting: sandbox.stub().returns({
          whereIn: sandbox.stub().returns({
            orderBy: sandbox.stub().returns({
              select: sandbox.stub().returns([{ transferId: 1 }, { transferId: 2 }, { transferId: 2 }])
            })
          })
        })
      })

      await Model._initKnex()
      await Model.getLatestTransferStateChangesByTransferIdList(trxStub, [1, 2])
      test.pass('completed successfully')
      test.ok(knexStub.withArgs('transferStateChange').calledOnce, 'knex called with transferStateChange once')
      Model._unsetKnex()
      test.end()
    } catch (err) {
      Logger.error(`getLatestTransferStateChangesByTransferIdList failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionBatchTest.test('getLatestTransferStateChangesByTransferIdList should re throw db error', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')

      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        transacting: sandbox.stub().returns({
          whereIn: sandbox.stub().returns({
            orderBy: sandbox.stub().returns({
              select: sandbox.stub().throws(new Error())
            })
          })
        })
      })

      await Model._initKnex()
      try {
        await Model.getLatestTransferStateChangesByTransferIdList(trxStub, [1, 2])
        test.fail('should throw error')
      } catch (err) {
        test.pass('completed successfully')
      }
      Model._unsetKnex()
      test.end()
    } catch (err) {
      Logger.error(`getLatestTransferStateChangesByTransferIdList failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionBatchTest.test('getPositionsByAccountIdsForUpdate', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')

      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        transacting: sandbox.stub().returns({
          whereIn: sandbox.stub().returns({
            forUpdate: sandbox.stub().returns({
              select: sandbox.stub().returns([{ participantCurrencyId: 1 }, { participantCurrencyId: 2 }])
            })
          })
        })
      })
      await Model._initKnex()
      await Model.getPositionsByAccountIdsForUpdate(trxStub, [1, 2])
      test.pass('completed successfully')
      test.ok(knexStub.withArgs('participantPosition').calledOnce, 'knex called with transferStateChange once')
      Model._unsetKnex()
      test.end()
    } catch (err) {
      Logger.error(`getPositionsByAccountIdsForUpdate failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionBatchTest.test('updateParticipantPosition', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')

      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        transacting: sandbox.stub().returns({
          where: sandbox.stub().returns({
            update: sandbox.stub().returns({
            })
          })
        })
      })

      await Model._initKnex()
      await Model.updateParticipantPosition(trxStub, 1, 1, null)
      test.pass('completed successfully')
      test.ok(knexStub.withArgs('participantPosition').calledOnce, 'knex called with transferStateChange once')
      Model._unsetKnex()
      test.end()
    } catch (err) {
      Logger.error(`updateParticipantPosition failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionBatchTest.test('updateParticipantPosition participantPositionReservedValue set', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')

      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        transacting: sandbox.stub().returns({
          where: sandbox.stub().returns({
            update: sandbox.stub().returns({
            })
          })
        })
      })

      await Model._initKnex()
      await Model.updateParticipantPosition(trxStub, 1, 1, 1)
      test.pass('completed successfully')
      test.ok(knexStub.withArgs('participantPosition').calledOnce, 'knex called with transferStateChange once')
      Model._unsetKnex()
      test.end()
    } catch (err) {
      Logger.error(`updateParticipantPosition failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionBatchTest.test('bulkInsertTransferStateChanges', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')

      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.batchInsert = sandbox.stub().returns({
        transacting: sandbox.stub().returns({
          where: sandbox.stub().returns({
            update: sandbox.stub().returns({})
          })
        })
      })
      Db.getKnex.returns(knexStub)

      await Model._initKnex()
      await Model.bulkInsertTransferStateChanges(trxStub, 1, 1, null)
      test.pass('completed successfully')
      test.ok(knexStub.batchInsert.withArgs('transferStateChange').calledOnce, 'knex called with transferStateChange once')
      Model._unsetKnex()
      test.end()
    } catch (err) {
      Logger.error(`bulkInsertTransferStateChanges failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionBatchTest.test('bulkInsertParticipantPositionChanges', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')

      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.batchInsert = sandbox.stub().returns({
        transacting: sandbox.stub().returns({
          where: sandbox.stub().returns({
            update: sandbox.stub().returns({})
          })
        })
      })
      Db.getKnex.returns(knexStub)

      await Model._initKnex()
      await Model.bulkInsertParticipantPositionChanges(trxStub, 1, 1, null)
      test.pass('completed successfully')
      test.ok(knexStub.batchInsert.withArgs('participantPositionChange').calledOnce, 'knex called with transferStateChange once')
      Model._unsetKnex()
      test.end()
    } catch (err) {
      Logger.error(`bulkInsertParticipantPositionChanges failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  positionBatchTest.end()
})