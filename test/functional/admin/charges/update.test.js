'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('PUT /charges/{name}', putTest => {
  putTest.test('should update a charge', async function (test) {
    const chargeName = Fixtures.generateRandomName()
    const payload = {
      name: chargeName,
      charge_type: 'fee',
      rate_type: 'flat',
      rate: '1.00',
      minimum: '51.00',
      maximum: '100.00',
      code: '003',
      is_active: true,
      payer: 'sender',
      payee: 'receiver'
    }

    const payload2 = {
      name: chargeName,
      charge_type: 'fee',
      is_active: false,
      maximum: '10.00',
      minimum: '100.00',
      code: '002'
    }

    await Base.createCharge(payload)
    const res = await Base.updateCharge(chargeName, payload2)
    test.equal(res.body.name, payload2.name)
    test.equal(res.body.is_active, payload2.is_active)
    test.equal(res.body.charge_type, payload2.charge_type)
    test.equal(res.body.minimum, payload2.minimum)
    test.equal(res.body.maximum, payload2.maximum)
    test.equal(res.body.code, payload2.code)
    test.equal(res.body.rate_type, payload.rate_type)
    test.equal(res.body.rate, payload.rate)
    test.equal(res.body.payer, payload.payer)
    test.equal(res.body.payee, payload.payee)
    test.end()
  })

  putTest.end()
})

Test('PUT /charges/{name}', putTest => {
  putTest.test('should update a charge with null values', async function (test) {
    const chargeName = Fixtures.generateRandomName()
    const payload = {
      name: chargeName,
      charge_type: 'fee',
      rate_type: 'flat',
      rate: '1.00',
      minimum: '51.00',
      maximum: '100.00',
      code: '003',
      is_active: true,
      payer: 'sender',
      payee: 'receiver'
    }

    const payload2 = {
      name: chargeName,
      charge_type: 'fee',
      is_active: false,
      maximum: null,
      minimum: null,
      code: null
    }

    await Base.createCharge(payload)
    const res = await Base.updateCharge(chargeName, payload2)
    test.equal(res.body.name, payload2.name)
    test.equal(res.body.is_active, payload2.is_active)
    test.equal(res.body.charge_type, payload2.charge_type)
    test.equal(res.body.minimum, payload2.minimum)
    test.equal(res.body.maximum, payload2.maximum)
    test.equal(res.body.code, payload2.code)
    test.equal(res.body.rate_type, payload.rate_type)
    test.equal(res.body.rate, payload.rate)
    test.equal(res.body.payer, payload.payer)
    test.equal(res.body.payee, payload.payee)
    test.end()
  })

  putTest.end()
})
