'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('POST /webhooks/settle-transfers', settleTest => {
  settleTest.test('should settle transfer and fees', test => {
    let transferId = Fixtures.generateTransferId()
    let transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.account1Name, '101.00'), Fixtures.buildDebitOrCredit(Base.account2Name, '101.00'))
    const charge = {
      name: 'settleChargeName',
      charge_type: 'fee',
      rate_type: 'flat',
      rate: '1.00',
      minimum: '100.00',
      maximum: '102.00',
      code: '003',
      is_active: true,
      payer: 'sender',
      payee: 'receiver'
    }

    const response = { fees: [{ amount: { currency_code: 'TZS', description: Base.account1Name, value: charge.rate }, destination: { account_number: Base.account2AccountNumber, routing_number: Base.account2RoutingNumber }, source: { account_number: Base.account1AccountNumber, routing_number: Base.account1RoutingNumber } }], transfers: [{ amount: { currency_code: 'TZS', description: Base.account1Name, value: '101.00' }, destination: { account_number: Base.account2AccountNumber, routing_number: Base.account2RoutingNumber }, source: { account_number: Base.account1AccountNumber, routing_number: Base.account1RoutingNumber } }] }

    Base.createCharge(charge)
      .then(() => Base.prepareTransfer(transferId, transfer))
      .then(() => Base.fulfillTransfer(transferId, 'oAKAAA'))
      .then(() => {
        Base.postAdmin('/webhooks/settle-transfers', {})
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.deepEqual(res.body, response)
            test.end()
          })
      })
  })

  settleTest.end()
})
