'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('POST /charge', putTest => {
  putTest.test('should create a charge', test => {
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
      payerParticipantId: 'sender',
      payeeParticipantId: 'receiver'
    }

    Base.createCharge(payload)
      .expect(201)
      .then((res) => {
        test.equal(res.body.name, payload.name)
        test.equal(res.body.charge_type, payload.charge_type)
        test.equal(res.body.rate_type, payload.rate_type)
        test.equal(res.body.rate, payload.rate)
        test.equal(res.body.minimum, payload.minimum)
        test.equal(res.body.maximum, payload.maximum)
        test.equal(res.body.code, payload.code)
        test.equal(res.body.is_active, payload.is_active)
        test.equal(res.body.payerParticipantId, payload.payerParticipantId)
        test.equal(res.body.payeeParticipantId, payload.payeeParticipantId)
        test.end()
      })
  })

  putTest.end()
})

Test('POST /charge', putTest => {
  putTest.test('should throw an error when creating a duplicate charge', test => {
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
      payerParticipantId: 'sender',
      payeeParticipantId: 'receiver'
    }

    Base.createCharge(payload)
      .expect(201)
      .expect('Content-Type', /json/)
      .then(() => {
        Base.createCharge(payload)
          .expect(422)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.id, 'RecordExistsError')
            test.equal(res.body.message, 'The charge has already been created')
            test.end()
          })
      })
  })

  putTest.end()
})
