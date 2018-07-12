'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')
const Config = require('../../../../src/lib/config')
const Util = require('../../../../src/lib/util')

Test('return the list of charge in a charge quote', test => {
  const charge1Name = 'a' + Fixtures.generateRandomName()
  const charge2Name = 'b' + Fixtures.generateRandomName()
  const charge3Name = 'c' + Fixtures.generateRandomName()

  const charge = Fixtures.buildCharge(charge1Name, 'percent', '001')
  const charge2 = Fixtures.buildCharge(charge2Name, 'flat', '002')
  const charge3 = Fixtures.buildCharge(charge3Name, 'flat', '003')
  charge3.payerParticipantId = 'ledger'
  charge3.payeeParticipantId = 'sender'

  Config.AMOUNT.SCALE = 2

  const amount = 50.00

  Base.createCharge(charge)
    .then(() => Base.createCharge(charge2))
    .then(() => {
      Base.postApi('/charge/quote', { amount: amount })
        .expect(200)
        .expect('Content-Type', /json/)
        .then(res => {
          test.equal(2, res.body.length)

          test.equal(charge.name, res.body[0].name)
          test.equal(Util.formatAmount(charge.rate * amount), res.body[0].amount)
          test.equal(charge.charge_type, res.body[0].charge_type)
          test.equal(charge.code, res.body[0].code)

          test.equal(charge2.name, res.body[1].name)
          test.equal(charge2.rate, res.body[1].amount)
          test.equal(charge2.charge_type, res.body[1].charge_type)
          test.equal(charge2.code, res.body[1].code)

          test.end()
        })
    })
})
