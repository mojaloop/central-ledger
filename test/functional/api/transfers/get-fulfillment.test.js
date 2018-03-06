'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('GET /transfers/:id/fulfillment', getTest => {
  getTest.test('should return fulfillment for transfer', async function (test) {
    const fulfillment = 'oAKAAA'
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.account1Name, '25'), Fixtures.buildDebitOrCredit(Base.account2Name, '25'))

    await Base.prepareTransfer(transferId, transfer)
    await Base.fulfillTransfer(transferId, fulfillment)
    const res = await Base.getFulfillment(transferId)
    test.equal(res.text, fulfillment)
    test.end()
  })

  getTest.test('should return error is transfer does not exist', test => {
    const transferId = Fixtures.generateTransferId()

    Base.getFulfillment(transferId)
          .expect(404)
          .then(res => {
            test.equal(res.body.id, 'TransferNotFoundError')
            test.equal(res.body.message, 'This transfer does not exist')
            test.end()
          })
  })

  getTest.test('should return error when retrieving fulfillment if transfer not executed', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.account1Name, '50'), Fixtures.buildDebitOrCredit(Base.account2Name, '50'))

    Base.prepareTransfer(transferId, transfer)
      .then(() => {
        Base.getFulfillment(transferId)
          .expect(404)
          .then(res => {
            test.equal(res.body.id, 'MissingFulfillmentError')
            test.equal(res.body.message, 'This transfer has not yet been fulfilled')
            test.end()
          })
      })
  })

  getTest.test('should return error when retrieving fulfillment of rejected transfer', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.account1Name, '50'), Fixtures.buildDebitOrCredit(Base.account2Name, '50'))

    Base.prepareTransfer(transferId, transfer)
      .then(() => Base.rejectTransfer(transferId, Fixtures.rejectionMessage(), { name: Base.account2Name, password: Base.account2Password }))
      .then(() => {
        Base.getFulfillment(transferId)
          .expect(422)
          .then(res => {
            test.equal(res.body.id, 'AlreadyRolledBackError')
            test.equal(res.body.message, 'This transfer has already been rejected')
            test.end()
          })
      })
      .catch(e => test.end())
  })

  getTest.test('should return error if transfer not conditional', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildUnconditionalTransfer(transferId, Fixtures.buildDebitOrCredit(Base.account1Name, '50'), Fixtures.buildDebitOrCredit(Base.account2Name, '50'))

    Base.prepareTransfer(transferId, transfer)
      .then(() => {
        Base.getFulfillment(transferId)
          .expect(422)
          .then(res => {
            test.equal(res.body.id, 'TransferNotConditionalError')
            test.equal(res.body.message, 'Transfer is not conditional')
            test.end()
          })
      })
  })

  getTest.end()
})
