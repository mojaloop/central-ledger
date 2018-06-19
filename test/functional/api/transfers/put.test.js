'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')
const TransferState = require('../../../../src/domain/transfer/state')
const Moment = require('moment')
const Config = require('../../../../src/lib/config')
const amount = '50.00'

const prepareTransfer = (transferId, transfer) => {
  return Base.putApi(`/transfers/${transferId}`, transfer)
}

Test('PUT /transfers', putTest => {
  putTest.test('should prepare a transfer', test => {
    const transferId = Fixtures.generateTransferId()
    const memo = { interledger: 'blah', path: 'blah' }
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount, memo))

    prepareTransfer(transferId, transfer)
      .expect(201)
      .expect('Content-Type', /json/)
      .then(res => {
        test.equal(res.body.id, transfer.id)
        test.equal(res.body.ledger, transfer.ledger)
        test.equal(res.body.debits[0].participant, transfer.debits[0].participant)
        test.equal(res.body.debits[0].amount, amount)
        test.equal(res.body.debits[0].hasOwnProperty('memo'), false)
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

  putTest.test('should prepare and execute unconditional transfer', test => {
    const transferId = Fixtures.generateTransferId()
    const memo = { interledger: 'blah', path: 'blah' }
    const transfer = Fixtures.buildUnconditionalTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount, memo), Fixtures.buildDebitOrCredit(Base.participant2Name, amount))

    prepareTransfer(transferId, transfer)
      .expect(201)
      .expect('Content-Type', /json/)
      .then(res => {
        test.equal(res.body.id, transfer.id)
        test.equal(res.body.ledger, transfer.ledger)
        test.equal(res.body.debits[0].participant, transfer.debits[0].participant)
        test.equal(res.body.debits[0].amount, amount)
        test.deepEqual(res.body.debits[0].memo, memo)
        test.equal(res.body.credits[0].participant, transfer.credits[0].participant)
        test.equal(res.body.credits[0].amount, amount)
        test.equal(res.body.credits[0].hasOwnProperty('memo'), false)
        test.equal(res.body.hasOwnProperty('execution_condition'), false)
        test.equal(res.body.hasOwnProperty('expires_at'), false)
        test.equal(res.body.state, TransferState.EXECUTED)
        test.ok(res.body.timeline.prepared_at)
        test.ok(res.body.timeline.executed_at)
        test.equal(res.body.timeline.hasOwnProperty('rejected_at'), false)
        test.end()
      })
  })

  putTest.test('should not throw error on optimistic transfer with repeat id', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildUnconditionalTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount, { interledger: 'blah', path: 'blah' }), Fixtures.buildDebitOrCredit(Base.participant2Name, amount, { interledger: 'blah', path: 'blah' }))

    Base.prepareTransfer(transferId, transfer)
      .then(() =>
        prepareTransfer(transferId, transfer)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.id, transfer.id)
            test.equal(res.body.state, TransferState.EXECUTED)
            test.ok(res.body.timeline.prepared_at)
            test.ok(res.body.timeline.executed_at)
            test.end()
          })
      )
  })

  putTest.test('should return transfer details when preparing existing transfer', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => {
        prepareTransfer(transferId, transfer)
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
            test.equal(res.body.state, TransferState.PREPARED)
            test.ok(res.body.timeline.prepared_at)
            test.equal(res.body.timeline.hasOwnProperty('executed_at'), false)
            test.equal(res.body.timeline.hasOwnProperty('rejected_at'), false)
            test.end()
          })
      })
  })

  putTest.test('should return error when preparing existing transfer with changed properties', test => {
    let transferId = Fixtures.generateTransferId()
    let transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => {
        transfer.credits.push(Fixtures.buildDebitOrCredit(Base.participant1Name, amount))

        prepareTransfer(transferId, transfer)
          .expect(400)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.id, 'InvalidModificationError')
            test.equal(res.body.message, 'Transfer may not be modified in this way')
            test.end()
          })
      })
  })

  putTest.test('return error when preparing fulfilled transfer', test => {
    let transferId = Fixtures.generateTransferId()
    let transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => Base.fulfillTransfer(transferId, 'oAKAAA'))
      .then(() => {
        prepareTransfer(transferId, transfer)
          .expect(400)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.id, 'InvalidModificationError')
            test.equal(res.body.message, 'Transfer may not be modified in this way')
            test.end()
          })
      })
  })

  putTest.test('return error when preparing transfer with expired date', test => {
    const transferId = Fixtures.generateTransferId()
    const expiredDate = Moment.utc().add(-10, 'minutes')
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount), expiredDate)

    Base.prepareTransfer(transferId, transfer)
      .then(() => Base.fulfillTransfer(transferId, 'oAKAAA'))
      .then(() => {
        prepareTransfer(transferId, transfer)
          .expect(422)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.id, 'ValidationError')
            test.equal(res.body.message, `expires_at date: ${expiredDate.toISOString()} has already expired.`)
            test.end()
          })
      })
  })

  putTest.test('return error when preparing transfer with ledger participant as sender', test => {
    const transferId = Fixtures.generateTransferId()
    Config.LEDGER_ACCOUNT_NAME = 'LedgerParticipantName'
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Config.LEDGER_ACCOUNT_NAME, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => Base.fulfillTransfer(transferId, 'oAKAAA'))
      .then(() => {
        prepareTransfer(transferId, transfer)
          .expect(422)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.id, 'ValidationError')
            test.equal(res.body.message, `Participant ${Config.LEDGER_ACCOUNT_NAME} not found`)
            test.end()
          })
      })
  })

  putTest.test('return error when preparing transfer with ledger participant as receiver', test => {
    const transferId = Fixtures.generateTransferId()
    Config.LEDGER_ACCOUNT_NAME = 'LedgerParticipantName'
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Config.LEDGER_ACCOUNT_NAME, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => Base.fulfillTransfer(transferId, 'oAKAAA'))
      .then(() => {
        prepareTransfer(transferId, transfer)
          .expect(422)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.id, 'ValidationError')
            test.equal(res.body.message, `Participant ${Config.LEDGER_ACCOUNT_NAME} not found`)
            test.end()
          })
      })
  })

  putTest.end()
})
