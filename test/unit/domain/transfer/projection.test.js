'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const Moment = require('moment')
const Logger = require('@mojaloop/central-services-shared').Logger
const UrlParser = require('../../../../src/lib/urlparser')
const AccountService = require('../../../../src/domain/account')
const TransferState = require('../../../../src/domain/transfer/state')
const TransferRejectionType = require('../../../../src/domain/transfer/rejection-type')
const TransfersReadModel = require('../../../../src/domain/transfer/models/transfers-read-model')
const TransfersProjection = require('../../../../src/domain/transfer/projection')

const hostname = 'http://some-host'
const executionCondition = 'ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0'

Test('Transfers-Projection', transfersProjectionTest => {
  let sandbox

  transfersProjectionTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(TransfersReadModel, 'saveTransfer')
    sandbox.stub(TransfersReadModel, 'updateTransfer')
    sandbox.stub(TransfersReadModel, 'truncateTransfers')
    sandbox.stub(UrlParser, 'nameFromAccountUri')
    sandbox.stub(AccountService, 'getByName')
    sandbox.stub(Logger, 'error')
    t.end()
  })

  transfersProjectionTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  transfersProjectionTest.test('Initialize should', initTest => {
    initTest.test('truncate read model and call done', t => {
      TransfersReadModel.truncateTransfers.returns(P.resolve())

      let done = sandbox.stub()

      TransfersProjection.initialize({}, done)
        .then(result => {
          t.ok(done.calledOnce)
          t.end()
        })
    })

    initTest.test('log error thrown by truncateReadModel', t => {
      let error = new Error()
      TransfersReadModel.truncateTransfers.returns(P.reject(error))

      let done = sandbox.stub()

      TransfersProjection.initialize({}, done)
        .then(result => {
          t.notOk(done.called)
          t.ok(Logger.error.calledWith('Error truncating read model', error))
          t.end()
        })
    })

    initTest.end()
  })

  transfersProjectionTest.test('handleTransferPrepared should', preparedTest => {
    const dfsp1Account = { accountId: 1, name: 'dfsp1', url: `${hostname}/accounts/dfsp1` }
    const dfsp2Account = { accountId: 2, name: 'dfsp2', url: `${hostname}/accounts/dfsp2` }

    const event = {
      id: 1,
      name: 'TransferPrepared',
      payload: {
        ledger: `${hostname}`,
        debits: [{
          account: dfsp1Account.url,
          amount: '50'
        }],
        credits: [{
          account: dfsp2Account.url,
          amount: '50'
        }],
        execution_condition: executionCondition,
        expires_at: '2015-06-16T00:00:01.000Z'
      },
      aggregate: {
        id: Uuid(),
        name: 'Transfer'
      },
      context: 'Ledger',
      timestamp: 1474471273588
    }

    preparedTest.test('save transfer to read model', test => {
      UrlParser.nameFromAccountUri.withArgs(dfsp1Account.url).returns(dfsp1Account.name)
      UrlParser.nameFromAccountUri.withArgs(dfsp2Account.url).returns(dfsp2Account.name)
      AccountService.getByName.withArgs(dfsp1Account.name).returns(Promise.resolve(dfsp1Account))
      AccountService.getByName.withArgs(dfsp2Account.name).returns(Promise.resolve(dfsp2Account))
      TransfersReadModel.saveTransfer.returns(P.resolve({}))

      TransfersProjection.handleTransferPrepared(event)
      test.ok(TransfersReadModel.saveTransfer.calledWith(Sinon.match({
        transferUuid: event.aggregate.id,
        state: TransferState.PREPARED,
        ledger: event.payload.ledger,
        debitAccountId: dfsp1Account.accountId,
        debitAmount: event.payload.debits[0].amount,
        debitMemo: JSON.stringify(undefined),
        creditAccountId: dfsp2Account.accountId,
        creditAmount: event.payload.credits[0].amount,
        creditMemo: JSON.stringify(undefined),
        executionCondition: event.payload.execution_condition,
        cancellationCondition: undefined,
        rejectReason: undefined,
        expiresAt: new Date(event.payload.expires_at),
        additionalInfo: undefined,
        preparedDate: new Date(event.timestamp)
      })))
      test.end()
    })

    preparedTest.test('log error', t => {
      UrlParser.nameFromAccountUri.withArgs(dfsp1Account.url).returns(dfsp1Account.name)
      UrlParser.nameFromAccountUri.withArgs(dfsp2Account.url).returns(dfsp2Account.name)
      AccountService.getByName.withArgs(dfsp1Account.name).returns(Promise.resolve(dfsp1Account))
      AccountService.getByName.withArgs(dfsp2Account.name).returns(Promise.resolve(dfsp2Account))

      const error = new Error()
      TransfersReadModel.saveTransfer.returns(P.reject(error))

      TransfersProjection.handleTransferPrepared(event)
      t.ok(Logger.error.calledWith('Error handling TransferPrepared event', error))
      t.end()
    })

    preparedTest.end()
  })

  transfersProjectionTest.test('handleTransferExecuted should', executedTest => {
    let event = {
      id: 2,
      name: 'TransferExecuted',
      payload: {
        ledger: `${hostname}`,
        debits: [{
          account: `${hostname}/accounts/dfsp1`,
          amount: '50'
        }],
        credits: [{
          account: `${hostname}/accounts/dfsp2`,
          amount: '50'
        }],
        execution_condition: executionCondition,
        expires_at: '2015-06-16T00:00:01.000Z',
        fulfillment: 'oAKAAA'
      },
      aggregate: {
        id: Uuid(),
        name: 'Transfer'
      },
      context: 'Ledger',
      timestamp: 1474471284081
    }

    executedTest.test('update transfer in read model', assert => {
      TransfersReadModel.updateTransfer.returns(P.resolve({}))

      TransfersProjection.handleTransferExecuted(event)
      assert.ok(TransfersReadModel.updateTransfer.calledWith(event.aggregate.id, Sinon.match({
        state: TransferState.EXECUTED,
        fulfillment: event.payload.fulfillment,
        executedDate: Moment(event.timestamp)
      })))
      assert.end()
    })

    executedTest.test('log error', t => {
      const error = new Error()
      TransfersReadModel.updateTransfer.returns(P.reject(error))

      TransfersProjection.handleTransferExecuted(event)
      t.ok(Logger.error.calledWith('Error handling TransferExecuted event', error))
      t.end()
    })

    executedTest.end()
  })

  transfersProjectionTest.test('handleTransferRejected should', rejectedTest => {
    const createEvent = () => ({
      id: 2,
      name: 'TransferRejected',
      payload: {
        rejection_reason: TransferRejectionType.EXPIRED
      },
      aggregate: {
        id: Uuid(),
        name: 'Transfer'
      },
      context: 'Ledger',
      timestamp: 1474471286000
    })

    rejectedTest.test('update transfer in read model when expired', test => {
      TransfersReadModel.updateTransfer.returns(P.resolve({}))
      const event = createEvent()
      TransfersProjection.handleTransferRejected(event)
      const args = TransfersReadModel.updateTransfer.firstCall.args
      const id = args[0]
      const fields = args[1]

      test.equal(id, event.aggregate.id)
      test.equal(fields.state, TransferState.REJECTED)
      test.equal(fields.rejectionReason, TransferRejectionType.EXPIRED)
      test.equal(fields.rejectedDate.toISOString(), Moment(event.timestamp).toISOString())
      test.equal(fields.hasOwnProperty('creditRejected'), false)
      test.equal(fields.hasOwnProperty('creditRejectionMessage'), false)
      test.end()
    })

    rejectedTest.test('update transfer in read model when cancelled', test => {
      const message = 'some cancellation reason'
      const event = createEvent()
      event.payload.rejection_reason = TransferRejectionType.CANCELLED
      event.payload.message = message

      TransfersReadModel.updateTransfer.returns(P.resolve({}))
      TransfersProjection.handleTransferRejected(event)
      const args = TransfersReadModel.updateTransfer.firstCall.args
      const id = args[0]
      const fields = args[1]

      test.equal(id, event.aggregate.id)
      test.equal(fields.state, TransferState.REJECTED)
      test.equal(fields.rejectionReason, TransferRejectionType.CANCELLED)
      test.equal(fields.rejectedDate.toISOString(), Moment(event.timestamp).toISOString())
      test.equal(fields.creditRejected, 1)
      test.equal(fields.creditRejectionMessage, message)
      test.end()
    })

    rejectedTest.test('default credit rejection_message to empty if message is null', test => {
      const event = createEvent()
      event.payload.rejection_reason = TransferRejectionType.CANCELLED

      TransfersReadModel.updateTransfer.returns(P.resolve({}))
      TransfersProjection.handleTransferRejected(event)
      const args = TransfersReadModel.updateTransfer.firstCall.args
      const id = args[0]
      const fields = args[1]

      test.equal(id, event.aggregate.id)
      test.equal(fields.state, TransferState.REJECTED)
      test.equal(fields.rejectionReason, TransferRejectionType.CANCELLED)
      test.equal(fields.rejectedDate.toISOString(), Moment(event.timestamp).toISOString())
      test.equal(fields.creditRejected, 1)
      test.equal(fields.creditRejectionMessage, '')
      test.end()
    })

    rejectedTest.test('log error', t => {
      const error = new Error()
      TransfersReadModel.updateTransfer.returns(P.reject(error))

      TransfersProjection.handleTransferRejected(createEvent())
      t.ok(Logger.error.calledWith('Error handling TransferRejected event', error))
      t.end()
    })

    rejectedTest.end()
  })

  transfersProjectionTest.end()
})
