'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Model = require('../../../../src/domain/charge/model')
const ChargeService = require('../../../../src/domain/charge')
const Decimal = require('decimal.js')
const NotFoundError = require('../../../../src/errors').NotFoundError

function createCharge (name = 'charge', rateType = 'percent', minimum = null, maximum = null) {
  return {
    name,
    chargeType: 'fee',
    rateType: rateType,
    rate: '0.50',
    minimum,
    maximum,
    code: '001',
    is_active: true
  }
}

Test('Charge service', serviceTest => {
  let sandbox

  serviceTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Model)
    test.end()
  })

  serviceTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  serviceTest.test('create should', createTest => {
    createTest.test('add charge in model', test => {
      const charge = {
        name: 'charge',
        chargeType: 'charge_type',
        rateType: 'rate_type',
        rate: '1.00',
        minimum: '0.25',
        maximum: '100.00',
        code: 1,
        is_active: true
      }
      Model.create.returns(P.resolve({}))
      ChargeService.create(charge)
        .then(() => {
          test.ok(Model.create.calledWith(charge))
          test.end()
        })
    })

    createTest.end()
  })

  serviceTest.test('update should', updateTest => {
    updateTest.test('update charge in model', test => {
      const charge = {
        name: 'charge',
        chargeType: 'charge_type',
        rateType: 'rate_type',
        rate: '1.00',
        minimum: '0.25',
        maximum: '100.00',
        code: 1,
        is_active: true
      }

      const payload = {
        name: 'charge_b'
      }
      Model.getByName.returns(P.resolve(charge))
      Model.update.returns(P.resolve({}))
      ChargeService.update(charge.name, payload)
        .then(() => {
          test.ok(Model.update.calledWith(charge, payload))
          test.end()
        })
    })

    updateTest.test('throw a not found error when charge does not exist', test => {
      const charge = {
        name: 'charge'
      }

      const payload = {
        name: 'charge_b'
      }
      Model.getByName.returns(P.resolve(null))
      Model.update.returns(P.resolve({}))
      ChargeService.update(charge.name, payload)
        .catch(NotFoundError, e => {
          test.equal(e.message, 'The charge could not be found')
          test.end()
        })
    })

    updateTest.end()
  })

  serviceTest.test('getByName should', getByNameTest => {
    getByNameTest.test('getByName from Model', test => {
      const charge = {}
      Model.getByName.returns(P.resolve(charge))
      ChargeService.getByName()
        .then(result => {
          test.equal(result, charge)
          test.end()
        })
    })

    getByNameTest.end()
  })

  serviceTest.test('getAll should', getAllTest => {
    getAllTest.test('getAll from Model', test => {
      const all = []
      Model.getAll.returns(P.resolve(all))
      ChargeService.getAll()
        .then(result => {
          test.equal(result, all)
          test.end()
        })
    })

    getAllTest.end()
  })

  serviceTest.test('getAllForTransfer should', getAllTest => {
    getAllTest.test('getAllForTransfer from Model', test => {
      const charge1 = createCharge('acharge1', 'percent')
      const charge2 = createCharge('bcharge2', 'flat')
      const charge3 = createCharge('ccharge3', 'flat', '0.00', '100.00')
      const charge = [charge1, charge2, charge3]

      Model.getAll.returns(P.resolve(charge))
      const transfer = {
        payerAmount: '1.00'
      }
      ChargeService.getAllForTransfer(transfer)
        .then(result => {
          test.deepEqual(result, charge)
          test.end()
        })
    })
    getAllTest.end()
  })

  serviceTest.test('quote should', getAllTest => {
    getAllTest.test('return charge quotes from Model', test => {
      const charge1 = createCharge('acharge1')
      const charge2 = createCharge('bcharge2', 'flat')
      const charge3 = createCharge('ccharge3', 'flat', '50.00', '100.00')
      const charge = [charge1, charge2, charge3]

      const amount = 20.00
      const transaction = {
        'amount': amount
      }
      Model.getAllSenderAsPayer.returns(P.resolve(charge))
      ChargeService.quote(transaction)
        .then(result => {
          test.equal(result.length, 2)
          test.equal(result[0].name, charge1.name)
          test.equal(result[0].code, charge1.code)
          test.equal(result[0].charge_type, charge1.chargeType)
          test.equal(result[0].amount, new Decimal(charge1.rate * amount).valueOf())
          test.equal(result[1].name, charge2.name)
          test.equal(result[1].code, charge2.code)
          test.equal(result[1].charge_type, charge2.chargeType)
          test.equal(result[1].amount, new Decimal(charge2.rate).valueOf())
          test.end()
        })
    })

    getAllTest.end()
  })

  serviceTest.end()
})

