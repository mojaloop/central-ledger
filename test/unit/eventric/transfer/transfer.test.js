'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Uuid = require('uuid4')
const TransferState = require('../../../../src/domain/transfer/state')
const Transfer = require('../../../../src/eventric/transfer/transfer')
const executionCondition = 'ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0'

Test('transfer', transferTest => {
  transferTest.test('create should', createTransferTest => {
    createTransferTest.test('emit TransferPrepared event', test => {
      const transfer = new Transfer()

      const emitDomainEvent = Sinon.stub()
      transfer.$emitDomainEvent = emitDomainEvent

      const payload = {
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/bob',
            amount: '50'
          }
        ],
        execution_condition: executionCondition,
        expires_at: '2015-06-16T00:00:01.000Z'
      }

      transfer.create(payload)

      const emitDomainEventArgs = emitDomainEvent.firstCall.args
      test.equal(emitDomainEventArgs[0], 'TransferPrepared')
      test.deepEqual(emitDomainEventArgs[1], payload)
      test.end()
    })

    createTransferTest.test('emit TransferExecuted event for unconditional transfer', test => {
      const transfer = new Transfer()
      const emitDomainEvent = Sinon.stub()
      transfer.$emitDomainEvent = emitDomainEvent

      const payload = {
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/bob',
            amount: '50'
          }
        ]
      }

      transfer.create(payload)
      test.equal(emitDomainEvent.callCount, 2)

      const firstCallArgs = emitDomainEvent.firstCall.args
      test.equal(firstCallArgs[0], 'TransferPrepared')
      test.deepEqual(firstCallArgs[1], payload)

      const secondCallArgs = emitDomainEvent.secondCall.args
      test.equal(secondCallArgs[0], 'TransferExecuted')
      test.deepEqual(secondCallArgs[1], {})

      test.end()
    })

    createTransferTest.end()
  })

  transferTest.test('fulfill should', fulfillTransferTest => {
    fulfillTransferTest.test('emit TransferExecuted event', test => {
      const transfer = new Transfer()
      transfer.execution_condition = executionCondition
      transfer.state = TransferState.PREPARED

      const emitDomainEvent = Sinon.stub()
      transfer.$emitDomainEvent = emitDomainEvent

      const fulfillment = 'oAKAAA'

      transfer.fulfill({ fulfillment })

      const emitDomainEventArgs = emitDomainEvent.firstCall.args
      test.equal(emitDomainEventArgs[0], 'TransferExecuted')
      test.deepEqual(emitDomainEventArgs[1], { fulfillment: fulfillment })
      test.end()
    })

    fulfillTransferTest.end()
  })

  transferTest.test('reject should', rejectTest => {
    rejectTest.test('Emit TransferRejected event', t => {
      const transfer = new Transfer()
      const emitDomainEvent = Sinon.stub()
      transfer.$emitDomainEvent = emitDomainEvent

      const rejectionReason = 'something bad happened'

      transfer.reject({ rejection_reason: rejectionReason })

      t.ok(emitDomainEvent.calledWith('TransferRejected', Sinon.match({ rejection_reason: rejectionReason })))
      t.end()
    })
    rejectTest.end()
  })

  transferTest.test('settle should', rejectTest => {
    rejectTest.test('Emit TransferSettled event', t => {
      const transfer = new Transfer()
      const emitDomainEvent = Sinon.stub()
      transfer.$emitDomainEvent = emitDomainEvent

      const settlementId = Uuid()

      transfer.settle({ settlement_id: settlementId })

      t.ok(emitDomainEvent.calledWith('TransferSettled', Sinon.match({ settlement_id: settlementId })))
      t.end()
    })
    rejectTest.end()
  })

  transferTest.test('handleTransferPrepared should', handleTransferPreparedTest => {
    handleTransferPreparedTest.test('set transfer properties', t => {
      const transfer = new Transfer()
      const transferId = Uuid()
      const event = {
        aggregate: {
          id: transferId
        },
        payload: {
          ledger: 'ledger',
          debits: 'debits',
          credits: 'credits',
          execution_condition: 'execution_condition',
          expires_at: 'expires_at'
        },
        timestamp: 1480460976239
      }
      transfer.handleTransferPrepared(event)
      t.equal(transfer.id, transferId)
      t.equal(transfer.ledger, 'ledger')
      t.equal(transfer.debits, 'debits')
      t.equal(transfer.credits, 'credits')
      t.equal(transfer.execution_condition, 'execution_condition')
      t.equal(transfer.expires_at, 'expires_at')
      t.equal(transfer.state, TransferState.PREPARED)
      t.deepEquals(transfer.timeline, { prepared_at: '2016-11-29T23:09:36.239Z' })
      t.end()
    })

    handleTransferPreparedTest.test('set state to PREPARED if unconditional transfer', t => {
      const transfer = new Transfer()
      const transferId = Uuid()
      const event = {
        aggregate: {
          id: transferId
        },
        payload: {
          ledger: 'ledger',
          debits: 'debits',
          credits: 'credits'
        },
        timestamp: 1480460976239
      }
      transfer.handleTransferPrepared(event)
      t.equal(transfer.id, transferId)
      t.equal(transfer.ledger, 'ledger')
      t.equal(transfer.debits, 'debits')
      t.equal(transfer.credits, 'credits')
      t.notOk(transfer.execution_condition)
      t.notOk(transfer.expires_at)
      t.equal(transfer.state, TransferState.PREPARED)
      t.deepEquals(transfer.timeline, { prepared_at: '2016-11-29T23:09:36.239Z' })
      t.end()
    })

    handleTransferPreparedTest.end()
  })

  transferTest.test('handleTransferExecuted should', handleTest => {
    handleTest.test('set transfer properties', t => {
      const transfer = new Transfer()
      const fulfillment = 'test'
      t.notOk(transfer.state)
      t.notOk(transfer.fulfillment)

      const result = transfer.handleTransferExecuted({
        payload: {
          fulfillment: fulfillment
        },
        timestamp: 1480460976239
      })

      t.deepEqual(result, transfer)
      t.equal(transfer.state, TransferState.EXECUTED)
      t.equal(transfer.fulfillment, fulfillment)
      t.equal(transfer.timeline.executed_at, '2016-11-29T23:09:36.239Z')
      t.end()
    })
    handleTest.end()
  })

  transferTest.test('handleTransferRejected should', handleTest => {
    handleTest.test('set rejection_reason to expired and state to rejected and update timeline when expired', test => {
      const time = new Date().getTime()
      const transfer = new Transfer()
      const reason = 'expired'

      test.notOk(transfer.state)
      test.notOk(transfer.timeline)
      test.notOk(transfer.rejection_reason)

      const result = transfer.handleTransferRejected({
        timestamp: time,
        payload: { rejection_reason: reason }
      })
      test.deepEqual(result, transfer)
      test.equal(transfer.rejection_reason, reason)
      test.equal(transfer.state, TransferState.REJECTED)
      test.equal(transfer.timeline.rejected_at, new Date(time).toISOString())
      test.end()
    })

    handleTest.test('set rejection_reason to cancelled and state to rejected and update timeline when cancelled', test => {
      const time = new Date().getTime()
      const transfer = new Transfer()
      const reason = 'cancelled'

      test.notOk(transfer.state)
      test.notOk(transfer.timeline)
      test.notOk(transfer.rejection_reason)

      const result = transfer.handleTransferRejected({
        timestamp: time,
        payload: { rejection_reason: reason, message: 'some cancellation' }
      })

      test.deepEqual(result, transfer)
      test.equal(transfer.rejection_reason, reason)
      test.equal(transfer.state, TransferState.REJECTED)
      test.equal(transfer.timeline.rejected_at, new Date(time).toISOString())
      test.end()
    })

    handleTest.test('set credit rejected and message when cancelled', test => {
      const transfer = new Transfer()
      const reason = 'cancelled'
      const message = 'some cancellation'

      transfer.credits = [{
        account: 'account1',
        amount: 10
      }]

      test.notOk(transfer.credits[0].rejected)
      test.notOk(transfer.credits[0].rejection_message)

      transfer.handleTransferRejected({
        timestamp: new Date().getTime(),
        payload: { rejection_reason: reason, message: message }
      })

      test.equal(transfer.credits[0].rejected, true)
      test.equal(transfer.credits[0].rejection_message, message)
      test.end()
    })

    handleTest.test('set message to empty if null', test => {
      const transfer = new Transfer()
      const reason = 'cancelled'

      transfer.credits = [{
        account: 'account1',
        amount: 10
      }]

      test.notOk(transfer.credits[0].rejected)
      test.notOk(transfer.credits[0].rejection_message)

      transfer.handleTransferRejected({
        timestamp: new Date().getTime(),
        payload: { rejection_reason: reason }
      })

      test.equal(transfer.credits[0].rejected, true)
      test.equal(transfer.credits[0].rejection_message, '')
      test.end()
    })

    handleTest.test('not set credit rejected and message when expired', test => {
      const transfer = new Transfer()
      const reason = 'expired'

      transfer.credits = [{
        account: 'account1',
        amount: 10
      }]

      test.notOk(transfer.credits[0].rejected)
      test.notOk(transfer.credits[0].rejection_message)

      transfer.handleTransferRejected({
        timestamp: new Date().getTime(),
        payload: { rejection_reason: reason }
      })

      test.notOk(transfer.credits[0].rejected)
      test.notOk(transfer.credits[0].rejection_message)
      test.end()
    })

    handleTest.test('set transfer rejection_reason and state and return transfer', t => {
      const transfer = new Transfer()
      const rejectionReason = 'Another bad apple'
      t.notOk(transfer.state)
      t.notOk(transfer.rejection_reason)

      const result = transfer.handleTransferRejected({
        timestamp: new Date().getTime(),
        payload: { rejection_reason: rejectionReason }
      })

      t.deepEqual(result, transfer)
      t.equal(transfer.state, TransferState.REJECTED)
      t.equal(transfer.rejection_reason, rejectionReason)
      t.end()
    })

    handleTest.test('update timeline rejected_at', t => {
      const time = new Date().getTime()
      const transfer = new Transfer()
      const result = transfer.handleTransferRejected({
        timestamp: time,
        payload: { rejection_reason: 'not again' }
      })

      t.equal(result.timeline.rejected_at, new Date(time).toISOString())
      t.end()
    })
    handleTest.end()
  })

  transferTest.test('handleTransferSettled should', handleTest => {
    handleTest.test('set state to settled and return transfer', t => {
      const transfer = new Transfer()
      const settlementId = Uuid()

      const result = transfer.handleTransferSettled({
        timestamp: new Date().getTime(),
        payload: { settlement_id: settlementId }
      })

      t.deepEqual(result, transfer)
      t.equal(transfer.state, TransferState.SETTLED)
      t.equal(transfer.settlement_id, settlementId)
      t.end()
    })
    handleTest.end()
  })

  transferTest.end()
})
