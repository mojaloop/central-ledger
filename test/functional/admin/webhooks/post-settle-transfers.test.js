'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')
const Config = require('../../../../src/lib/config')

Test('POST /webhooks/settle-transfers', settleTest => {
  settleTest.test('should settle transfer and fee', async function (test) {
    Config.LEDGER_ACCOUNT_NAME = 'LedgerParticipantName'
    let transferId = Fixtures.generateTransferId()
    let transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, '101.00'), Fixtures.buildDebitOrCredit(Base.participant2Name, '101.00'))
    const charge = {
      name: 'settleChargeName',
      charge_type: 'fee',
      rate_type: 'flat',
      rate: '1.00',
      minimum: '100.00',
      maximum: '102.00',
      code: '003',
      is_active: true,
      payerParticipantId: 'sender',
      payeeParticipantId: 'receiver'
    }

    const response = { fee: [{ amount: { currency_code: 'TZS', description: Base.participant1Name, value: charge.rate }, destination: { participant_number: Base.participant2ParticipantNumber, routing_number: Base.participant2RoutingNumber }, source: { participant_number: Base.participant1ParticipantNumber, routing_number: Base.participant1RoutingNumber } }], transfers: [{ amount: { currency_code: 'TZS', description: Base.participant1Name, value: '101.00' }, destination: { participant_number: Base.participant2ParticipantNumber, routing_number: Base.participant2RoutingNumber }, source: { participant_number: Base.participant1ParticipantNumber, routing_number: Base.participant1RoutingNumber } }] }
    await Base.createCharge(charge)
    await Base.prepareTransfer(transferId, transfer)
    await Base.fulfillTransfer(transferId, 'oAKAAA')
    const res = await Base.postAdmin('/webhooks/settle-transfers', {})
    test.deepEqual(res.body, response)
    test.end()
  })

  settleTest.end()
})
