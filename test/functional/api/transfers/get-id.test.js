'use strict'

const Test = require('tape')
const Moment = require('moment')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')
const TransferState = require('../../../../src/domain/transfer/state')

const amount = '50.00'

Test('GET /transfers/:id', getTest => {
  getTest.test('should return prepared transfer details', test => {
    const transferId = Fixtures.generateTransferId()
    const memo = {
      prop1: 'value',
      prop2: {
        nested: 'value'
      }
    }
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount, memo), Fixtures.buildDebitOrCredit(Base.participant2Name, amount, memo))

    Base.prepareTransfer(transferId, transfer)
      .delay(500)
      .then(() => {
        Base.getTransfer(transferId)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.id, transfer.id)
            test.equal(res.body.ledger, transfer.ledger)
            test.equal(res.body.debits[0].participant, transfer.debits[0].participant)
            test.equal(res.body.debits[0].amount, amount)
            test.deepEqual(res.body.debits[0].memo, memo)
            test.equal(res.body.credits[0].participant, transfer.credits[0].participant)
            test.equal(res.body.credits[0].amount, amount)
            test.deepEqual(res.body.credits[0].memo, memo)
            test.equal(res.body.execution_condition, transfer.execution_condition)
            test.equal(res.body.expires_at, transfer.expires_at)
            test.equal(res.body.state, TransferState.PREPARED)
            test.ok(res.body.timeline.prepared_at)
            test.equal(res.body.timeline.hasOwnProperty('executed_at'), false)
            test.equal(res.body.timeline.hasOwnProperty('rejected_at'), false)
            test.end()
          })
      })
  })

  getTest.test('should return executed transfer details', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => Base.fulfillTransfer(transferId, 'oAKAAA'))
      .then(() => {
        Base.getTransfer(transferId)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.id, transfer.id)
            test.equal(res.body.ledger, transfer.ledger)
            test.equal(res.body.debits[0].participant, transfer.debits[0].participant)
            test.equal(res.body.debits[0].amount, amount)
            test.equal(res.body.credits[0].participant, transfer.credits[0].participant)
            test.equal(res.body.credits[0].amount, amount)
            test.equal(res.body.execution_condition, transfer.execution_condition)
            test.equal(res.body.expires_at, transfer.expires_at)
            test.equal(res.body.state, TransferState.EXECUTED)
            test.ok(res.body.timeline.prepared_at)
            test.ok(res.body.timeline.executed_at)
            test.equal(res.body.timeline.hasOwnProperty('rejected_at'), false)
            test.ok(Moment(res.body.timeline.prepared_at).isSameOrBefore(res.body.timeline.executed_at))
            test.end()
          })
      })
  })

  getTest.test('should return manually rejected transfer details', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount))
    const message = Fixtures.rejectionMessage()

    Base.prepareTransfer(transferId, transfer)
      .then(() => Base.rejectTransfer(transferId, message, { name: Base.participant2Name, password: Base.participant2Password }))
      .then(() => {
        Base.getTransfer(transferId)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.id, transfer.id)
            test.equal(res.body.ledger, transfer.ledger)
            test.equal(res.body.debits[0].participant, transfer.debits[0].participant)
            test.equal(res.body.debits[0].amount, amount)
            test.equal(res.body.credits[0].participant, transfer.credits[0].participant)
            test.equal(res.body.credits[0].amount, amount)
            test.equal(res.body.credits[0].rejected, true)
            test.deepEqual(res.body.credits[0].rejection_message, message)
            test.equal(res.body.execution_condition, transfer.execution_condition)
            test.equal(res.body.expires_at, transfer.expires_at)
            test.equal(res.body.state, TransferState.REJECTED)
            test.equal(res.body.rejection_reason, 'cancelled')
            test.ok(res.body.timeline.prepared_at)
            test.equal(res.body.timeline.hasOwnProperty('executed_at'), false)
            test.ok(res.body.timeline.rejected_at)
            test.ok(Moment(res.body.timeline.prepared_at).isSameOrBefore(res.body.timeline.rejected_at))
            test.end()
          })
      })
  })

  getTest.test('should return expired transfer details', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount), Fixtures.getMomentToExpire())

    Base.prepareTransfer(transferId, transfer)
      .delay(1000)
      .then(() => Base.postAdmin('/webhooks/reject-expired-transfers', {}))
      .then(() => {
        Base.getTransfer(transferId)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.id, transfer.id)
            test.equal(res.body.ledger, transfer.ledger)
            test.equal(res.body.debits[0].participant, transfer.debits[0].participant)
            test.equal(res.body.debits[0].amount, amount)
            test.equal(res.body.credits[0].participant, transfer.credits[0].participant)
            test.equal(res.body.credits[0].amount, amount)
            test.equal(res.body.credits[0].rejected, false)
            test.equal(res.body.credits[0].hasOwnProperty('rejection_message'), false)
            test.equal(res.body.execution_condition, transfer.execution_condition)
            test.equal(res.body.expires_at, transfer.expires_at)
            test.equal(res.body.state, TransferState.REJECTED)
            test.equal(res.body.rejection_reason, 'expired')
            test.ok(res.body.timeline.prepared_at)
            test.equal(res.body.timeline.hasOwnProperty('executed_at'), false)
            test.ok(res.body.timeline.rejected_at)
            test.ok(Moment(res.body.timeline.prepared_at).isSameOrBefore(res.body.timeline.rejected_at))
            test.end()
          })
      })
  })

  getTest.test('should return unconditional transfer details', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildUnconditionalTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => {
        Base.getTransfer(transferId)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.id, transfer.id)
            test.equal(res.body.ledger, transfer.ledger)
            test.equal(res.body.debits[0].participant, transfer.debits[0].participant)
            test.equal(res.body.debits[0].amount, amount)
            test.equal(res.body.credits[0].participant, transfer.credits[0].participant)
            test.equal(res.body.credits[0].amount, amount)
            test.notOk(res.body.hasOwnProperty('execution_condition'))
            test.notOk(res.body.hasOwnProperty('expires_at'))
            test.equal(res.body.state, TransferState.EXECUTED)
            test.ok(res.body.timeline.prepared_at)
            test.ok(res.body.timeline.executed_at)
            test.equal(res.body.timeline.hasOwnProperty('rejected_at'), false)
            test.end()
          })
      })
  })
  getTest.end()
})
