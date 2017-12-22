'use strict'

const src = '../../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Moment = require('moment')
const Uuid = require('uuid4')
const Db = require(`${src}/db`)
const UrlParser = require(`${src}/lib/urlparser`)
const TransfersReadModel = require(`${src}/domain/transfer/models/transfers-read-model`)
const TransferState = require(`${src}/domain/transfer/state`)

Test('transfer model', modelTest => {
  let sandbox

  modelTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()

    Db.transfers = {
      insert: sandbox.stub(),
      find: sandbox.stub(),
      update: sandbox.stub(),
      truncate: sandbox.stub(),
      query: sandbox.stub()
    }

    sandbox.stub(UrlParser, 'idFromTransferUri')
    t.end()
  })

  modelTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  modelTest.test('saveTransfer should', saveTransferTest => {
    let transferRecord = {
      transferUuid: Uuid(),
      state: TransferState.PREPARED,
      ledger: 'http://central-ledger.example',
      debitAccountId: 1,
      debitAmount: '50',
      creditAccountId: 2,
      creditAmount: '50',
      executionCondition: 'ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0',
      expiresAt: '2015-06-16T00:00:01.000Z',
      preparedDate: Moment(1474471273588)
    }

    saveTransferTest.test('insert transfer and return newly created record', test => {
      let saved = { transferUuid: transferRecord.transferUuid }

      Db.transfers.insert.returns(P.resolve(saved))

      TransfersReadModel.saveTransfer(transferRecord)
        .then(s => {
          test.equal(s, saved)
          test.ok(Db.transfers.insert.calledWith(transferRecord))
          test.end()
        })
    })

    saveTransferTest.end()
  })

  modelTest.test('updateTransfer should', updateTransferTest => {
    updateTransferTest.test('update transfer record', test => {
      let transferId = Uuid()
      let fields = { state: TransferState.EXECUTED, fulfillment: 'oAKAAA' }
      let updatedTransfer = { transferUuid: transferId }

      Db.transfers.update = sandbox.stub().returns(P.resolve(updatedTransfer))

      TransfersReadModel.updateTransfer(transferId, fields)
        .then(u => {
          test.equal(u, updatedTransfer)
          test.ok(Db.transfers.update.calledWith({ transferUuid: transferId }, fields))
          test.end()
        })
    })

    updateTransferTest.end()
  })

  modelTest.test('truncateTransfers should', truncateTest => {
    truncateTest.test('destroy all transfers records', test => {
      Db.transfers.truncate.returns(P.resolve())

      TransfersReadModel.truncateTransfers()
        .then(() => {
          test.ok(Db.transfers.truncate.calledOnce)
          test.end()
        })
    })

    truncateTest.end()
  })

  modelTest.test('getByIdShould', getByIdTest => {
    getByIdTest.test('find transfer by transferUuid', test => {
      let id = Uuid()
      let transfer = { id: id }

      let builderStub = sandbox.stub()
      let joinDebitStub = sandbox.stub()
      let joinCreditStub = sandbox.stub()
      let selectStub = sandbox.stub()
      let firstStub = sandbox.stub()

      builderStub.where = sandbox.stub()

      Db.transfers.query.callsArgWith(0, builderStub)
      Db.transfers.query.returns(P.resolve(transfer))

      builderStub.where.returns({
        innerJoin: joinCreditStub.returns({
          innerJoin: joinDebitStub.returns({
            select: selectStub.returns({
              first: firstStub
            })
          })
        })
      })

      TransfersReadModel.getById(id)
        .then(found => {
          test.equal(found, transfer)
          test.ok(builderStub.where.withArgs({ transferUuid: id }).calledOnce)
          test.ok(joinCreditStub.withArgs('accounts AS ca', 'transfers.creditAccountId', 'ca.accountId').calledOnce)
          test.ok(joinDebitStub.withArgs('accounts AS da', 'transfers.debitAccountId', 'da.accountId').calledOnce)
          test.ok(selectStub.withArgs('transfers.*', 'ca.name AS creditAccountName', 'da.name AS debitAccountName').calledOnce)
          test.ok(firstStub.calledOnce)
          test.end()
        })
    })

    getByIdTest.end()
  })

  modelTest.test('getAllShould', getAllTest => {
    getAllTest.test('return all transfers', test => {
      const transferId1 = Uuid()
      const transferId2 = Uuid()
      const transfers = [{ transferUuid: transferId1 }, { transferUuid: transferId2 }]

      let builderStub = sandbox.stub()
      let joinDebitStub = sandbox.stub()
      let selectStub = sandbox.stub()

      builderStub.innerJoin = sandbox.stub()

      Db.transfers.query.callsArgWith(0, builderStub)
      Db.transfers.query.returns(P.resolve(transfers))

      builderStub.innerJoin.returns({
        innerJoin: joinDebitStub.returns({
          select: selectStub
        })
      })

      TransfersReadModel.getAll()
        .then(found => {
          test.equal(found, transfers)
          test.ok(builderStub.innerJoin.withArgs('accounts AS ca', 'transfers.creditAccountId', 'ca.accountId').calledOnce)
          test.ok(joinDebitStub.withArgs('accounts AS da', 'transfers.debitAccountId', 'da.accountId').calledOnce)
          test.ok(selectStub.withArgs('transfers.*', 'ca.name AS creditAccountName', 'da.name AS debitAccountName').calledOnce)
          test.end()
        })
    })
    getAllTest.end()
  })

  modelTest.test('findExpired should', findExpiredTest => {
    findExpiredTest.test('find transfer by state and expires_at', test => {
      let transfer1 = { id: Uuid() }
      let transfer2 = { id: Uuid() }
      let expiredTransfers = [transfer1, transfer2]
      let expirationDate = new Date()

      Db.transfers.find.returns(P.resolve(expiredTransfers))

      TransfersReadModel.findExpired(expirationDate)
        .then(found => {
          test.equal(found, expiredTransfers)
          test.ok(Db.transfers.find.calledWith({ state: TransferState.PREPARED, 'expiresAt <': expirationDate.toISOString() }))
          test.end()
        })
    })

    findExpiredTest.test('default expires_at date', test => {
      let transfer1 = { id: Uuid() }
      let transfer2 = { id: Uuid() }
      let expiredTransfers = [transfer1, transfer2]

      let expirationDate = new Date()
      sandbox.stub(Moment, 'utc')
      Moment.utc.returns(expirationDate)

      Db.transfers.find.returns(P.resolve(expiredTransfers))

      TransfersReadModel.findExpired()
        .then(found => {
          test.equals(found, expiredTransfers)
          test.ok(Db.transfers.find.calledWith({ state: TransferState.PREPARED, 'expiresAt <': expirationDate.toISOString() }))
          test.end()
        })
    })

    findExpiredTest.end()
  })

  modelTest.end()
})
