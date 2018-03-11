'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')
const Config = require('../../../../src/lib/config')

Test('POST /webhooks/settle-transfers', settleTest => {
  settleTest.test('should settle transfer and fees', async function (test) {
    Config.LEDGER_ACCOUNT_NAME = 'LedgerAccountName'
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
    await Base.createCharge(charge)
    await Base.prepareTransfer(transferId, transfer)
    await Base.fulfillTransfer(transferId, 'oAKAAA')
    const res = await Base.postAdmin('/webhooks/settle-transfers', {})
    test.deepEqual(res.body, response)
    test.end()
  })

  settleTest.end()
})
