'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')
const TransferState = require('../../../../src/domain/transfer/state')
const fulfillment = 'oAKAAA'

const amount = '25.00'

Test('PUT /transfer/:id/fulfillment', putTest => {
  putTest.test('should fulfill a transfer', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => {
        Base.fulfillTransfer(transferId, fulfillment)
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
            test.end()
          })
      })
  })

  putTest.test('should return error when fulfilling non-existing transfer', test => {
    const transferId = Fixtures.generateTransferId()

    Base.fulfillTransfer(transferId, fulfillment)
      .expect(404)
      .then(res => {
        test.equal(res.body.id, 'NotFoundError')
        test.equal(res.body.message, 'The requested resource could not be found.')
        test.end()
      })
  })

  putTest.test('should return fulfillment when fulfilling already fulfilled transfer', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => Base.fulfillTransfer(transferId, fulfillment))
      .then(() => {
        Base.fulfillTransfer(transferId, fulfillment)
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
            test.end()
          })
      })
  })

  putTest.test('should return error when fulfilling expired transfer', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount), Fixtures.getMomentToExpire())

    Base.prepareTransfer(transferId, transfer)
      .delay(1000)
      .then(() => {
        Base.fulfillTransfer(transferId, fulfillment)
          .expect(422)
          .expect('Content-Type', 'application/json; charset=utf-8')
          .then(res => {
            test.equal(res.body.id, 'UnpreparedTransferError')
            test.equal(res.body.message, 'The provided entity is syntactically correct, but there is a generic semantic problem with it.')
            test.end()
          })
      })
  })

  putTest.test('should return error when fulfilling unconditional transfer', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildUnconditionalTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => {
        Base.fulfillTransfer(transferId, fulfillment)
          .expect(422)
          .expect('Content-Type', 'application/json; charset=utf-8')
          .then(res => {
            test.equal(res.body.id, 'TransferNotConditionalError')
            test.equal(res.body.message, 'Transfer is not conditional')
            test.end()
          })
      })
  })

  putTest.test('should return error when fulfilling rejected transfer', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount), Fixtures.getMomentToExpire())

    Base.prepareTransfer(transferId, transfer)
      .then(() => Base.rejectTransfer(transferId, Fixtures.rejectionMessage(), { name: Base.participant2Password, password: Base.participant2Password }))
      .then(() => {
        Base.fulfillTransfer(transferId, fulfillment)
          .expect(400)
          .expect('Content-Type', 'application/json; charset=utf-8')
          .then(res => {
            test.equal(res.body.id, 'InvalidModificationError')
            test.equal(res.body.message, 'Transfers in state rejected may not be executed')
            test.end()
          })
      })
  })

  putTest.test('should return error when fulfillment is invalid', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => {
        Base.fulfillTransfer(transferId, 'garbage')
          .expect(400)
          .expect('Content-Type', 'application/json; charset=utf-8')
          .then(res => {
            test.equal(res.body.id, 'InvalidBodyError')
            test.end()
          })
      })
  })

  putTest.test('should return error when fulfullment is incorrect', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, amount), Fixtures.buildDebitOrCredit(Base.participant2Name, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => {
        Base.fulfillTransfer(transferId, 'oCKAIOwXK5OtXlY79JMscOEkUDTDVGfvLv1NZOv4GWg0Z-K_')
          .expect(422)
          .expect('Content-Type', 'application/json; charset=utf-8')
          .then(res => {
            test.equal(res.body.id, 'UnmetConditionError')
            test.end()
          })
      })
  })

  putTest.end()
})
