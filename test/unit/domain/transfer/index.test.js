'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const TransferQueries = require('../../../../src/domain/transfer/queries')
const SettleableTransfersReadModel = require(`${src}/models/settleable-transfers-read-model`)
const SettlementModel = require(`${src}/models/settlement`)
const Events = require('../../../../src/lib/events')
const Commands = require('../../../../src/domain/transfer/commands')
const Service = require('../../../../src/domain/transfer')
const TransferState = require('../../../../src/domain/transfer/state')
const TransferTranslator = require('../../../../src/domain/transfer/translator')
const RejectionType = require(`${src}/domain/transfer/rejection-type`)
const Errors = require('../../../../src/errors')

const createTransfer = (transferId = '3a2a1d9e-8640-4d2d-b06c-84f2cd613204') => {
  return {
    id: transferId,
    ledger: 'ledger',
    credits: [],
    debits: [],
    execution_condition: '',
    expires_at: ''
  }
}

Test('Transfer Service tests', serviceTest => {
  let sandbox

  serviceTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(TransferQueries, 'findExpired')
    sandbox.stub(TransferQueries, 'getById')
    sandbox.stub(TransferQueries, 'getAll')
    sandbox.stub(SettleableTransfersReadModel, 'getSettleableTransfers')
    sandbox.stub(SettlementModel, 'generateId')
    sandbox.stub(SettlementModel, 'create')
    sandbox.stub(TransferTranslator, 'toTransfer')
    sandbox.stub(TransferTranslator, 'fromRequestToDatabase')
    sandbox.stub(Events, 'emitTransferRejected')
    sandbox.stub(Events, 'emitTransferExecuted')
    sandbox.stub(Events, 'emitTransferPrepared')
    sandbox.stub(Commands, 'settle')
    sandbox.stub(Commands, 'reject')
    sandbox.stub(Commands, 'fulfil')
    sandbox.stub(Commands, 'prepare')
    t.end()
  })

  serviceTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  serviceTest.test('getById should', getByIdTest => {
    getByIdTest.test('return result from read model', test => {
      const id = Uuid()
      const transfer = {}
      const transferPromise = P.resolve(transfer)
      TransferQueries.getById.withArgs(id).returns(transferPromise)
      test.equal(Service.getById(id), transferPromise)
      test.end()
    })
    getByIdTest.end()
  })

  serviceTest.test('getAll should', getByIdTest => {
    getByIdTest.test('return result from read model', test => {
      const transfer = {}
      const transferPromise = P.resolve(transfer)
      TransferQueries.getAll.returns(transferPromise)
      test.equal(Service.getAll(), transferPromise)
      test.end()
    })
    getByIdTest.end()
  })

  serviceTest.test('getFulfillment should', getFulfillmentTest => {
    getFulfillmentTest.test('throw TransferNotFoundError if transfer does not exists', test => {
      const id = Uuid()
      TransferQueries.getById.withArgs(id).returns(P.resolve(null))
      Service.getFulfillment(id)
        .then(() => {
          test.fail('Expected exception')
        })
        .catch(Errors.TransferNotFoundError, e => {
          test.equal(e.message, 'This transfer does not exist')
        })
        .catch(e => {
          test.fail('Expected TransferNotFoundError')
        })
        .then(test.end)
    })

    getFulfillmentTest.test('throw TransferNotConditionError if transfer does not have execution_condition', test => {
      const id = Uuid()
      const model = { id }
      TransferQueries.getById.withArgs(id).returns(P.resolve(model))

      Service.getFulfillment(id)
        .then(() => {
          test.fail('expected exception')
        })
        .catch(Errors.TransferNotConditionalError, e => {
          test.pass()
        })
        .catch(e => {
          test.fail('Exepected TransferNotConditionalError')
        })
        .then(test.end)
    })

    getFulfillmentTest.test('throw AlreadyRolledBackError if transfer rejected', test => {
      const id = Uuid()
      const transfer = { id, executionCondition: 'condition', state: TransferState.REJECTED }
      TransferQueries.getById.withArgs(id).returns(P.resolve(transfer))

      Service.getFulfillment(id)
        .then(() => {
          test.fail('expected exception')
        })
        .catch(Errors.AlreadyRolledBackError, e => {
          test.pass()
        })
        .catch(e => {
          test.fail('Exepected AlreadyRolledBackError')
        })
        .then(test.end)
    })

    getFulfillmentTest.test('throw MissingFulfillmentError if transfer does not have fulfilment', test => {
      const id = Uuid()
      const transfer = { id, executionCondition: 'condition', state: TransferState.EXECUTED }
      TransferQueries.getById.withArgs(id).returns(P.resolve(transfer))

      Service.getFulfillment(id)
        .then(() => {
          test.fail('expected exception')
        })
        .catch(Errors.MissingFulfillmentError, e => {
          test.equal(e.message, 'This transfer has not yet been fulfilled')
        })
        .catch(e => {
          test.fail('Exepected MissingFulfillmentError')
        })
        .then(test.end)
    })

    getFulfillmentTest.test('return transfer fulfilment', test => {
      const id = Uuid()
      const fulfilment = 'fulfilment'
      const transfer = { id, fulfilment, executionCondition: 'condition', state: TransferState.EXECUTED }
      TransferQueries.getById.returns(P.resolve(transfer))
      Service.getFulfillment(id)
        .then(result => {
          test.equal(result, fulfilment)
          test.end()
        })
    })
    getFulfillmentTest.end()
  })

  serviceTest.test('rejectExpired should', rejectTest => {
    rejectTest.test('find expired transfers and reject them', test => {
      const transfers = [{ transferId: 1 }, { transferId: 2 }]
      TransferQueries.findExpired.returns(P.resolve(transfers))
      transfers.forEach((x, i) => {
        Commands.reject.onCall(i).returns(P.resolve({ alreadyRejected: false, transfer: x }))
        TransferTranslator.toTransfer.onCall(i).returns({ id: x.transferId })
      })
      Service.rejectExpired()
        .then(x => {
          transfers.forEach(t => {
            test.ok(Commands.reject.calledWith({ id: t.transferId, rejection_reason: RejectionType.EXPIRED }))
          })
          test.deepEqual(x, transfers.map(t => t.transferId))
          test.end()
        })
    })
    rejectTest.end()
  })

  serviceTest.test('settle should', settleTest => {
    settleTest.test('find settalble transfers and settle them', test => {
      let settlementId = Uuid()
      SettlementModel.generateId.returns(settlementId)
      SettlementModel.create.withArgs(settlementId).returns(P.resolve({ settlementId: settlementId, settledDate: 0 }))

      let transfers = [{ transferId: 1 }, { transferId: 2 }]
      SettleableTransfersReadModel.getSettleableTransfers.returns(P.resolve(transfers))

      transfers.forEach((x, i) => {
        Commands.settle.onCall(i).returns(P.resolve({ id: x.id }))
      })

      Service.settle()
        .then(x => {
          transfers.forEach(t => {
            test.ok(Commands.settle.calledWith({ id: t.transferId, settlement_id: settlementId }))
          })
          test.deepEqual(x, transfers)
          test.end()
        })
    })

    settleTest.test('return empty array if no settleable transfers exist', test => {
      let settlementId = Uuid()
      SettlementModel.generateId.returns(settlementId)
      SettlementModel.create.withArgs(settlementId).returns(P.resolve({ settlementId: settlementId, settledDate: 0 }))

      SettleableTransfersReadModel.getSettleableTransfers.returns(P.resolve([]))

      Service.settle()
        .then(x => {
          test.deepEqual(x, [])
          test.end()
        })
    })

    settleTest.end()
  })

  serviceTest.test('prepare should', prepareTest => {
    prepareTest.test('execute prepare function', test => {
      const payload = { id: 'payload id' }
      const proposedTransfer = { id: 'transfer id' }
      TransferTranslator.fromRequestToDatabase.withArgs(payload).returns(proposedTransfer)

      const preparedTransfer = { id: 'prepared transfer' }
      const prepareResult = { existing: false, transfer: preparedTransfer }
      Commands.prepare.withArgs(proposedTransfer).returns(P.resolve(prepareResult))

      const expectedTransfer = { id: 'expected transfer' }
      TransferTranslator.toTransfer.withArgs(preparedTransfer).returns(expectedTransfer)

      Service.prepare(payload)
        .then(result => {
          test.equal(result.existing, prepareResult.existing)
          test.equal(result.transfer, expectedTransfer)
          test.ok(Commands.prepare.calledWith(proposedTransfer))
          test.end()
        })
    })

    prepareTest.test('Emit transfer prepared event', test => {
      const payload = { id: 'payload id' }
      const proposedTransfer = { id: 'transfer id' }
      TransferTranslator.fromRequestToDatabase.withArgs(payload).returns(proposedTransfer)

      const preparedTransfer = { id: 'prepared transfer' }
      const prepareResult = { existing: false, transfer: preparedTransfer }
      Commands.prepare.withArgs(proposedTransfer).returns(P.resolve(prepareResult))

      const expectedTransfer = { id: 'expected transfer' }
      TransferTranslator.toTransfer.withArgs(preparedTransfer).returns(expectedTransfer)

      Service.prepare(payload)
        .then(result => {
          test.ok(Events.emitTransferPrepared.calledWith(expectedTransfer))
          test.end()
        })
    })

    prepareTest.end()
  })

  serviceTest.test('fulfil should', fulfillTest => {
    fulfillTest.test('execute fulfil command', function (assert) {
      let fulfilment = 'oAKAAA'
      let transferId = '3a2a1d9e-8640-4d2d-b06c-84f2cd613204'
      let expandedId = 'http://central-ledger/transfers/' + transferId
      TransferTranslator.toTransfer.returns({ id: expandedId })
      let payload = { id: transferId, fulfilment }
      let transfer = createTransfer(transferId)
      transfer.id = transferId
      Commands.fulfil.withArgs(payload).returns(P.resolve(transfer))
      Service.fulfil(payload)
        .then(result => {
          assert.equal(result.id, expandedId)
          assert.ok(Commands.fulfil.calledWith(payload))
          assert.end()
        })
    })

    fulfillTest.test('Emit transfer executed event', t => {
      let fulfilment = 'oAKAAA'
      let transferId = '3a2a1d9e-8640-4d2d-b06c-84f2cd613204'
      let expandedId = 'http://central-ledger/transfers/' + transferId
      TransferTranslator.toTransfer.returns({ id: expandedId })
      let payload = { id: transferId, fulfilment }
      let transfer = createTransfer(transferId)
      Commands.fulfil.withArgs(payload).returns(P.resolve(transfer))
      Service.fulfil(payload)
        .then(result => {
          let emitArgs = Events.emitTransferExecuted.firstCall.args
          let args0 = emitArgs[0]
          t.equal(args0.id, expandedId)
          let args1 = emitArgs[1]
          t.equal(args1.execution_condition_fulfillment, fulfilment)
          t.end()
        })
    })

    fulfillTest.test('reject and throw error if transfer is expired', assert => {
      let fulfilment = 'oAKAAA'
      let transfer = createTransfer()
      let payload = { id: transfer.id, fulfilment }

      Commands.fulfil.withArgs(payload).returns(P.reject(new Errors.ExpiredTransferError()))
      Commands.reject.returns(P.resolve({ transfer }))
      Service.fulfil(payload)
        .then(() => {
          assert.fail('Expected exception')
          assert.end()
        })
        .catch(e => {
          assert.ok(Commands.reject.calledWith({ id: transfer.id, rejection_reason: RejectionType.EXPIRED }))
          assert.equal(e.name, 'UnpreparedTransferError')
          assert.end()
        })
    })

    fulfillTest.end()
  })

  serviceTest.test('reject should', rejectTest => {
    rejectTest.test('execute reject command', test => {
      const rejectionReason = 'some reason'
      const transferId = Uuid()
      const cleanTransfer = {}
      const transfer = { id: transferId }
      const payload = { id: transferId, rejection_reason: rejectionReason }
      Commands.reject.withArgs(payload).returns(P.resolve({ alreadyRejected: false, transfer }))
      TransferTranslator.toTransfer.withArgs(transfer).returns(cleanTransfer)

      Service.reject(payload)
        .then(result => {
          test.deepEqual(result.transfer, cleanTransfer)
          test.equal(result.alreadyRejected, false)
          test.ok(Commands.reject.calledWith(payload))
          test.end()
        })
    })

    rejectTest.test('emit transfer rejected event if transfer not already rejected', test => {
      const transfer = {}
      Commands.reject.returns(P.resolve({ alreadyRejected: false, transfer }))
      const cleanTransfer = { id: Uuid() }
      TransferTranslator.toTransfer.withArgs(transfer).returns(cleanTransfer)
      Service.reject({})
        .then(result => {
          test.deepEqual(result.transfer, cleanTransfer)
          test.equal(result.alreadyRejected, false)
          test.ok(Events.emitTransferRejected.calledWith(cleanTransfer))
          test.end()
        })
    })

    rejectTest.test('not emit transfer rejected event if transfer already rejected', test => {
      const transfer = {}
      Commands.reject.returns(P.resolve({ alreadyRejected: true, transfer }))
      const cleanTransfer = { id: Uuid() }
      TransferTranslator.toTransfer.withArgs(transfer).returns(cleanTransfer)
      Service.reject({})
        .then(result => {
          test.deepEqual(result.transfer, cleanTransfer)
          test.equal(result.alreadyRejected, true)
          test.notOk(Events.emitTransferRejected.calledWith(cleanTransfer))
          test.end()
        })
    })

    rejectTest.end()
  })

  serviceTest.end()
})
