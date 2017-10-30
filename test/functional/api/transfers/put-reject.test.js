'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

const amount = '25.00'

Test('PUT /transfers/:id/reject', putTest => {
  putTest.test('should reject a transfer', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.account1Name, amount), Fixtures.buildDebitOrCredit(Base.account2Name, amount))

    const message = Fixtures.rejectionMessage()
    Base.prepareTransfer(transferId, transfer)
      .then(() => {
        Base.rejectTransfer(transferId, message, { name: Base.account2Name, password: Base.account2Password })
          .expect(201)
          .expect('Content-Type', /json/)
          .then(res => {
            test.deepEqual(res.body, message)
            test.end()
          })
      })
  })

  putTest.test('should return reason when rejecting a rejected transfer', test => {
    const reason = Fixtures.rejectionMessage()

    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.account1Name, amount), Fixtures.buildDebitOrCredit(Base.account2Name, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => Base.rejectTransfer(transferId, reason, { name: Base.account2Name, password: Base.account2Password }))
      .then(() => {
        Base.rejectTransfer(transferId, reason, { name: Base.account2Name, password: Base.account2Password })
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.deepEqual(res.body, reason)
            test.end()
          })
      })
  })

  putTest.test('should return error when rejecting fulfulled transfer', test => {
    const reason = Fixtures.rejectionMessage()
    const transferId = Fixtures.generateTransferId()
    const fulfillment = 'oAKAAA'

    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.account1Name, amount), Fixtures.buildDebitOrCredit(Base.account2Name, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => Base.fulfillTransfer(transferId, fulfillment))
      .then(() => {
        Base.rejectTransfer(transferId, reason, { name: Base.account2Name, password: Base.account2Password })
          .expect(400)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.id, 'InvalidModificationError')
            test.equal(res.body.message, 'Transfers in state executed may not be rejected')
            test.end()
          })
      })
  })

  putTest.test('should return error when rejecting unconditional transfer', test => {
    const reason = Fixtures.rejectionMessage()
    const transferId = Fixtures.generateTransferId()
    const fulfillment = 'oAKAAA'

    const transfer = Fixtures.buildUnconditionalTransfer(transferId, Fixtures.buildDebitOrCredit(Base.account1Name, amount), Fixtures.buildDebitOrCredit(Base.account2Name, amount))

    Base.prepareTransfer(transferId, transfer)
      .then(() => Base.fulfillTransfer(transferId, fulfillment))
      .then(() => {
        Base.rejectTransfer(transferId, reason, { name: Base.account2Name, password: Base.account2Password })
          .expect(422)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.id, 'TransferNotConditionalError')
            test.equal(res.body.message, 'Transfer is not conditional')
            test.end()
          })
      })
  })

  putTest.end()
})
