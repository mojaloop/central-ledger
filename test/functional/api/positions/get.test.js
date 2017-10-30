'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('GET /positions', getTest => {
  getTest.test('should return net positions', test => {
    let fulfillment = 'oAKAAA'
    let account1Name = Fixtures.generateAccountName()
    let account2Name = Fixtures.generateAccountName()
    let account3Name = Fixtures.generateAccountName()
    let account4Name = Fixtures.generateAccountName()

    let transfer1Id = Fixtures.generateTransferId()
    let transfer2Id = Fixtures.generateTransferId()
    let transfer3Id = Fixtures.generateTransferId()

    const chargePayload = Fixtures.buildCharge(Fixtures.generateRandomName(), 'flat', '006')
    chargePayload.minimum = '129.00'
    chargePayload.maximum = '131.00'
    chargePayload.rate = '1.00'

    Base.createAccount(account1Name)
      .then(() => Base.createAccount(account2Name))
      .then(() => Base.createAccount(account3Name))
      .then(() => Base.createAccount(account4Name))
      .then(() => Base.createCharge(chargePayload))
      .then(() => Base.prepareTransfer(transfer1Id, Fixtures.buildTransfer(transfer1Id, Fixtures.buildDebitOrCredit(account1Name, '130'), Fixtures.buildDebitOrCredit(account2Name, '130'))))
      .then(() => Base.fulfillTransfer(transfer1Id, fulfillment))
      .then(() => Base.prepareTransfer(transfer2Id, Fixtures.buildTransfer(transfer2Id, Fixtures.buildDebitOrCredit(account1Name, '130'), Fixtures.buildDebitOrCredit(account3Name, '130'))))
      .then(() => Base.fulfillTransfer(transfer2Id, fulfillment))
      .then(() => Base.prepareTransfer(transfer3Id, Fixtures.buildTransfer(transfer3Id, Fixtures.buildDebitOrCredit(account3Name, '130'), Fixtures.buildDebitOrCredit(account2Name, '130'))))
      .then(() => Base.fulfillTransfer(transfer3Id, fulfillment))
      .then(() => {
        Base.getApi('/positions')
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.deepEqual(Fixtures.findAccountPositions(res.body.positions, account1Name), Fixtures.buildAccountPosition(account1Name, 260, 0, 2, 0))
            test.deepEqual(Fixtures.findAccountPositions(res.body.positions, account2Name), Fixtures.buildAccountPosition(account2Name, 0, 260, 0, 2))
            test.deepEqual(Fixtures.findAccountPositions(res.body.positions, account3Name), Fixtures.buildAccountPosition(account3Name, 130, 130, 1, 1))
            test.deepEqual(Fixtures.findAccountPositions(res.body.positions, account4Name), Fixtures.buildAccountPosition(account4Name, 0, 0, 0, 0))
            test.end()
          })
      })
  })
  getTest.end()
})

Test('GET /positions/{name}', getTestAccount => {
  getTestAccount.test('should return net positions for account', test => {
    let fulfillment = 'oAKAAA'
    let account1Name = Fixtures.generateAccountName()
    let account2Name = Fixtures.generateAccountName()
    let account3Name = Fixtures.generateAccountName()

    let transfer1Id = Fixtures.generateTransferId()
    let transfer2Id = Fixtures.generateTransferId()

    const chargePayload = Fixtures.buildCharge(Fixtures.generateRandomName(), 'flat', '005')
    chargePayload.minimum = '0.00'
    chargePayload.maximum = '10.00'

    Base.createAccount(account1Name)
      .then(() => Base.createAccount(account2Name))
      .then(() => Base.createAccount(account3Name))
      .then(() => Base.createCharge(chargePayload))
      .then(() => Base.prepareTransfer(transfer1Id, Fixtures.buildTransfer(transfer1Id, Fixtures.buildDebitOrCredit(account1Name, '10'), Fixtures.buildDebitOrCredit(account2Name, '10'))))
      .then(() => Base.fulfillTransfer(transfer1Id, fulfillment))
      .then(() => Base.prepareTransfer(transfer2Id, Fixtures.buildTransfer(transfer2Id, Fixtures.buildDebitOrCredit(account1Name, '10'), Fixtures.buildDebitOrCredit(account3Name, '10'))))
      .then(() => Base.fulfillTransfer(transfer2Id, fulfillment))
      .then(() => {
        Base.getApi(`/positions/${account1Name}`)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.account, `http://central-ledger/accounts/${account1Name}`)
            test.equal(res.body.fees.payments, '1')
            test.equal(res.body.fees.receipts, '0')
            test.equal(res.body.fees.net, '-1')
            test.equal(res.body.transfers.payments, '20')
            test.equal(res.body.transfers.receipts, '0')
            test.equal(res.body.transfers.net, '-20')
            test.equal(res.body.net, '-21')
            test.end()
          })
      })
  })

  getTestAccount.end()
})
