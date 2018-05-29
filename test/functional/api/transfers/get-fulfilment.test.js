'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('GET /transfers/:id/fulfilment', getTest => {
  getTest.test('should return fulfilment for transfer', async function (test) {
    const fulfilment = 'oAKAAA'
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, '25'), Fixtures.buildDebitOrCredit(Base.participant2Name, '25'))

    await Base.prepareTransfer(transferId, transfer)
    await Base.fulfillTransfer(transferId, fulfilment)
    const res = await Base.getFulfillment(transferId)
    test.equal(res.text, fulfilment)
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

  getTest.test('should return error when retrieving fulfilment if transfer not executed', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, '50'), Fixtures.buildDebitOrCredit(Base.participant2Name, '50'))

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

  getTest.test('should return error when retrieving fulfilment of rejected transfer', test => {
    const transferId = Fixtures.generateTransferId()
    const transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, '50'), Fixtures.buildDebitOrCredit(Base.participant2Name, '50'))

    Base.prepareTransfer(transferId, transfer)
      .then(() => Base.rejectTransfer(transferId, Fixtures.rejectionMessage(), { name: Base.participant2Name, password: Base.participant2Password }))
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
    const transfer = Fixtures.buildUnconditionalTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, '50'), Fixtures.buildDebitOrCredit(Base.participant2Name, '50'))

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
