'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const TransferReadModel = require('../../../../src/domain/transfer/models/transfers-read-model')
const TransferQueries = require('../../../../src/domain/transfer/queries')

Test('Transfer Queries tests', queriesTest => {
  let sandbox

  queriesTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(TransferReadModel, 'findExpired')
    sandbox.stub(TransferReadModel, 'getById')
    sandbox.stub(TransferReadModel, 'getAll')
    t.end()
  })

  queriesTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  queriesTest.test('getById should', getByIdTest => {
    getByIdTest.test('return result from read model', test => {
      const id = Uuid()
      const transfer = {}
      const transferPromise = P.resolve(transfer)
      TransferReadModel.getById.withArgs(id).returns(transferPromise)
      test.equal(TransferQueries.getById(id), transferPromise)
      test.end()
    })
    getByIdTest.end()
  })

  queriesTest.test('getAll should', getAllTest => {
    getAllTest.test('return result from read model', test => {
      const transfer = {}
      const transferPromise = P.resolve(transfer)
      TransferReadModel.getAll.returns(transferPromise)
      test.equal(TransferQueries.getAll(), transferPromise)
      test.end()
    })
    getAllTest.end()
  })

  queriesTest.test('findExpired should', findExpiredTest => {
    findExpiredTest.test('find expired transfers', test => {
      let transfers = [{ transferUuid: 1 }, { transferUuid: 2 }]
      TransferReadModel.findExpired.returns(P.resolve(transfers))

      TransferQueries.findExpired()
        .then(expiredTransfers => {
          test.deepEqual(expiredTransfers, transfers)
          test.end()
        })
    })
    findExpiredTest.end()
  })

  queriesTest.end()
})
