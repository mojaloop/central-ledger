'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Logger = require('@mojaloop/central-services-shared').Logger
const ExecutedTransfers = require(`${src}/models/executed-transfers`)
const SettledTransfers = require(`${src}/models/settled-transfers`)
const SettleableTransfersProjection = require(`${src}/eventric/transfer/settleable-transfers-projection`)

Test('Transfers-Projection', transfersProjectionTest => {
  let sandbox

  transfersProjectionTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(ExecutedTransfers, 'create')
    sandbox.stub(SettledTransfers, 'create')
    sandbox.stub(ExecutedTransfers, 'truncate')
    sandbox.stub(SettledTransfers, 'truncate')
    sandbox.stub(Logger, 'error')
    t.end()
  })

  transfersProjectionTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  transfersProjectionTest.test('Initialize should', initTest => {
    initTest.test('truncate SettledTransfers and ExecutedTransfers and call done', t => {
      ExecutedTransfers.truncate.returns(P.resolve())
      SettledTransfers.truncate.returns(P.resolve())

      let done = sandbox.stub()

      SettleableTransfersProjection.initialize({}, done)
        .then(result => {
          t.ok(done.calledOnce)
          t.end()
        })
    })

    initTest.test('log error thrown by truncateReadModel', t => {
      let error = new Error()
      ExecutedTransfers.truncate.returns(P.reject(error))

      let done = sandbox.stub()

      SettleableTransfersProjection.initialize({}, done)
        .then(result => {
          t.notOk(done.called)
          t.ok(Logger.error.calledWith('Error truncating read model', error))
          t.end()
        })
    })

    initTest.end()
  })

  transfersProjectionTest.test('handleTransferExecuted should', executedTest => {
    executedTest.test('createExecutedTransfer', t => {
      let event = { aggregate: { id: 'uuid' } }

      ExecutedTransfers.create.withArgs({ id: event.aggregate.id }).returns(P.resolve())

      SettleableTransfersProjection.handleTransferExecuted(event)
      t.ok(ExecutedTransfers.create.calledOnce)
      t.end()
    })

    executedTest.test('log error', t => {
      let error = new Error()
      let event = { aggregate: { id: 'uuid' } }

      ExecutedTransfers.create.withArgs({ id: event.aggregate.id }).returns(P.reject(error))

      SettleableTransfersProjection.handleTransferExecuted(event)
      t.ok(Logger.error.calledWith('Error handling TransferExecuted event', error))
      t.end()
    })

    executedTest.end()
  })

  transfersProjectionTest.test('handleTransferSettled should', settledTest => {
    settledTest.test('createSettledTransfer', t => {
      let event = { aggregate: { id: 'uuid' }, payload: { settlement_id: 'uuid' } }

      SettledTransfers.create.withArgs({ id: event.aggregate.id, settlementId: event.payload.settlement_id }).returns(P.resolve())

      SettleableTransfersProjection.handleTransferSettled(event)
      t.ok(SettledTransfers.create.calledOnce)
      t.end()
    })

    settledTest.test('log error', t => {
      let error = new Error()
      let event = { aggregate: { id: 'uuid' }, payload: { settlement_id: 'uuid' } }
      SettledTransfers.create.withArgs({ id: event.aggregate.id, settlementId: event.payload.settlement_id }).returns(P.reject(error))

      SettleableTransfersProjection.handleTransferSettled(event)
      t.ok(Logger.error.calledWith('Error handling TransferSettled event', error))
      t.end()
    })

    settledTest.end()
  })

  transfersProjectionTest.end()
})
