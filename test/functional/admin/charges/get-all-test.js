'use strict'

const Test = require('tape')
const bluebird = require('bluebird')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

function createChargePayload (name) {
  return {
    name,
    chargeType: 'charge_type',
    rateType: 'rate_type',
    rate: '1.00',
    minimum: '25.00',
    maximum: '100.00',
    code: 1,
    is_active: true
  }
}

Test('GET /charge', getTest => {
  getTest.test('should return all charge', test => {
    const charge1Name = 'a' + Fixtures.generateRandomName()
    const charge2Name = 'b' + Fixtures.generateRandomName()

    const chargePayload1 = createChargePayload(charge1Name)
    const chargePayload2 = createChargePayload(charge2Name)

    bluebird.all([Base.createCharge(chargePayload1), Base.createCharge(chargePayload2)])
    .then(([charge1Res, charge2Res]) => {
      Base.getAdmin('/participants')
        .expect(200)
        .expect('Content-Type', /json/)
        .then(res => {
          test.equal(res.body[0].name, charge1Res.body.name)
          test.equal(res.body[0].created, charge1Res.body.created)
          test.equal(res.body[0].id, charge1Res.body.id)
          test.equal(res.body[1].name, charge2Res.body.name)
          test.equal(res.body[1].created, charge2Res.body.created)
          test.equal(res.body[1].id, charge2Res.body.id)
          test.end()
        })
    })
  })

  getTest.end()
})
