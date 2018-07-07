'use strict'

const Test = require('tape')
const Fixtures = require('../../../fixtures')
const Model = require('../../../../src/domain/charge/model')

function createChargePayload (name) {
  return {
    name,
    charge_type: 'fee',
    rate_type: 'flat',
    rate: '1.00',
    minimum: '0.25',
    maximum: '100.00',
    code: '1',
    is_active: true,
    payerParticipantId: 'receiver',
    payeeParticipantId: 'sender'
  }
}

Test('charge model', modelTest => {
  modelTest.test('create should', createTest => {
    createTest.test('create a new charge', test => {
      const chargeName = Fixtures.generateRandomName()
      const payload = createChargePayload(chargeName)

      Model.create(payload)
        .then((charge) => {
          test.equal(charge.name, payload.name)
          test.equal(charge.chargeType, payload.charge_type)
          test.equal(charge.rateType, payload.rate_type)
          test.equal(charge.rate, payload.rate)
          test.equal(charge.minimum, payload.minimum)
          test.equal(charge.maximum, payload.maximum)
          test.equal(charge.code, payload.code)
          test.equal(charge.isActive, payload.is_active)
          test.ok(charge.createdDate)
          test.ok(charge.chargeId)
          test.end()
        })
    })

    createTest.end()
  })

  Test('charge model', modelTest => {
    modelTest.test('update should', updateTest => {
      updateTest.test('update a new charge', test => {
        const chargeName = Fixtures.generateRandomName()
        const payload = createChargePayload(chargeName)
        const updatePayload = {
          name: Fixtures.generateRandomName(),
          charge_type: 'fee',
          minimum: '150.00',
          maximum: '151.00',
          is_active: false
        }

        Model.create(payload)
          .then((charge) => Model.update(charge, updatePayload))
          .then((updatedCharge) => {
            test.equal(updatedCharge.name, updatePayload.name)
            test.equal(updatedCharge.chargeType, updatePayload.charge_type)
            test.equal(updatedCharge.rateType, payload.rate_type)
            test.equal(updatedCharge.rate, payload.rate)
            test.equal(updatedCharge.minimum, updatePayload.minimum)
            test.equal(updatedCharge.maximum, updatePayload.maximum)
            test.equal(updatedCharge.code, payload.code)
            test.equal(updatedCharge.isActive, updatePayload.is_active)
            test.ok(updatedCharge.createdDate)
            test.ok(updatedCharge.chargeId)
            test.end()
          })
      })

      updateTest.end()
    })
  })

  modelTest.test('getAll should', getAllTest => {
    getAllTest.test('return all charge', test => {
      const charge1Name = Fixtures.generateRandomName()
      const charge2Name = Fixtures.generateRandomName()

      const chargePayload1 = createChargePayload(charge1Name)
      const chargePayload2 = createChargePayload(charge2Name)

      Model.create(chargePayload1)
        .then(() => Model.create(chargePayload2))
        .then(() => Model.getAll())
        .then((charge) => {
          test.ok(charge.length > 0)
          test.ok(charge.find(a => a.name === charge1Name))
          test.ok(charge.find(a => a.name === charge2Name))
          test.end()
        })
    })

    getAllTest.end()
  })

  modelTest.test('getAllSenderAsPayer should', getAllTest => {
    getAllTest.test('return all charge where the sender is the payerParticipantId', test => {
      const charge1Name = Fixtures.generateRandomName()
      const charge2Name = Fixtures.generateRandomName()
      const charge3Name = Fixtures.generateRandomName()

      const chargePayload1 = createChargePayload(charge1Name)
      const chargePayload2 = createChargePayload(charge2Name)
      const chargePayload3 = createChargePayload(charge3Name)
      chargePayload3.payerParticipantId = 'sender'
      chargePayload3.payeeParticipantId = 'receiver'

      Model.create(chargePayload1)
        .then(() => Model.create(chargePayload2))
        .then(() => Model.create(chargePayload3))
        .then(() => Model.getAllSenderAsPayer())
        .then((charge) => {
          test.ok(charge.length === 1)
          test.ok(charge.find(a => a.name === charge3Name))
          test.end()
        })
    })

    getAllTest.end()
  })

  modelTest.end()
})
