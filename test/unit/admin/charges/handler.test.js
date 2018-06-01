'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const Config = require('../../../../src/lib/config')
const Handler = require('../../../../src/admin/charge/handler')
const Charge = require('../../../../src/domain/charge')
const Sidecar = require('../../../../src/lib/sidecar')
const Errors = require('../../../../src/errors')

function createCharge (name = 'charge') {
  return {
    name,
    charge_type: 'charge_type',
    rate_type: 'rate_type',
    rate: '1.00',
    minimum: '0.25',
    maximum: '100.00',
    code: '001',
    is_active: true,
    payerParticipantId: 'ledger',
    payeeParticipantId: 'sender'
  }
}

Test('charge handler', handlerTest => {
  let sandbox
  let originalHostName
  let hostname = 'http://some-host'

  handlerTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    originalHostName = Config.HOSTNAME
    Config.HOSTNAME = hostname
    sandbox.stub(Charge, 'getAll')
    sandbox.stub(Charge, 'create')
    sandbox.stub(Charge, 'update')
    sandbox.stub(Charge, 'getByName')
    sandbox.stub(Sidecar, 'logRequest')
    t.end()
  })

  handlerTest.afterEach(t => {
    Config.HOSTNAME = originalHostName
    sandbox.restore()
    t.end()
  })

  handlerTest.test('getAll should', getAllTest => {
    getAllTest.test('get all charge and format list', async function (test) {
      const charge1 = createCharge('charge1')
      const charge2 = createCharge('charge2')

      const charge = [charge1, charge2]

      Charge.getAll.returns(P.resolve(charge))

      const output = await Handler.getAll({}, {})
      test.equal(output.length, 2)
      const item1 = output[0]
      test.equal(item1.name, charge1.name)
      test.equal(item1.id, charge1.chargeId)
      test.equal(item1.charge_type, charge1.chargeType)
      test.equal(item1.rate_type, charge1.rateType)
      test.equal(item1.rate, charge1.rate)
      test.equal(item1.minimum, charge1.minimum)
      test.equal(item1.maximum, charge1.maximum)
      test.equal(item1.code, charge1.code)
      test.equal(item1.is_active, charge1.isActive)
      test.equal(item1.created, charge1.createdDate)
      const item2 = output[1]
      test.equal(item2.name, charge2.name)
      test.equal(item2.id, charge2.chargeId)
      test.equal(item2.charge_type, charge2.chargeType)
      test.equal(item2.rate_type, charge2.rateType)
      test.equal(item2.rate, charge2.rate)
      test.equal(item2.minimum, charge2.minimum)
      test.equal(item2.maximum, charge2.maximum)
      test.equal(item2.code, charge2.code)
      test.equal(item2.is_active, charge2.isActive)
      test.equal(item2.created, charge2.createdDate)
      test.end()
    })

    getAllTest.test('reply with error if Charge services throws an error', async function (test) {
      const error = new Error()
      Charge.getAll.returns(P.reject(error))
      try {
        await Handler.getAll({}, {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    getAllTest.end()
  })

  handlerTest.test('create should', createTest => {
    createTest.test('create a charge', async function (test) {
      const charge = createCharge()

      const payload = {
        name: 'charge',
        chargeType: 'charge',
        rateType: 'rate',
        rate: '1',
        minimum: '1',
        maximum: '100',
        code: '1',
        is_active: true,
        payerParticipantId: 'ledger',
        payeeParticipantId: 'sender'
      }

      Charge.getByName.withArgs(payload.name).returns(P.resolve(null))
      Charge.create.withArgs(payload).returns(P.resolve(charge))

      const reply = {
        response: (output) => {
          test.equal(output.name, charge.name)
          test.equal(output.id, charge.chargeId)
          test.equal(output.charge_type, charge.chargeType)
          test.equal(output.rate_type, charge.rateType)
          test.equal(output.rate, charge.rate)
          test.equal(output.minimum, charge.minimum)
          test.equal(output.maximum, charge.maximum)
          test.equal(output.code, charge.code)
          test.equal(output.is_active, charge.isActive)
          test.equal(output.created, charge.createdDate)
          test.ok(Sidecar.logRequest.calledWith({payload}))
          return {
            code: (statusCode) => {
              test.equal(statusCode, 201)
              test.end()
            }
          }
        }
      }

      await Handler.create({payload}, reply)
    })

    createTest.test('reply with error if Charge services throws', async function (test) {
      const payload = {
        name: 'charge',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        minimum: '1.00',
        maximum: '100.00',
        code: '001',
        is_active: true,
        payerParticipantId: 'ledger',
        payeeParticipantId: 'sender'
      }

      Charge.getByName.withArgs(payload.name).returns(P.resolve(null))
      const error = new Error()

      Charge.create.withArgs(payload).returns(P.reject(error))

      try {
        await Handler.create({payload}, {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    createTest.test('reply with validation error if payerParticipantId and payeeParticipantId match', async function (test) {
      const charge = createCharge('charge')
      charge.payerParticipantId = 'ledger'
      charge.payeeParticipantId = 'ledger'

      const payload = {
        name: 'charge',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        minimum: '1.00',
        maximum: '100.00',
        code: '001',
        is_active: true,
        payerParticipantId: 'ledger',
        payeeParticipantId: 'ledger'
      }

      Charge.getByName.withArgs(payload.name).returns(P.resolve(null))
      Charge.create.withArgs(payload).returns(P.resolve(charge))

      try {
        await Handler.create({payload}, {})
      } catch (e) {
        test.equal(e.name, 'ValidationError')
        test.equal(e.payload.message, 'Payer and payeeParticipantId should be set to \'sender\', \'receiver\', or \'ledger\' and should not have the same value.')
        test.end()
      }
    })

    createTest.test('reply with already exists error if a charge with the given name already exists', async function (test) {
      const charge = createCharge('charge')
      charge.payerParticipantId = 'sender'
      charge.payeeParticipantId = 'receiver'

      const payload = {
        name: 'charge',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        minimum: '1.00',
        maximum: '100.00',
        code: '001',
        is_active: true,
        payerParticipantId: 'sender',
        payeeParticipantId: 'receiver'
      }

      Charge.getByName.withArgs(payload.name).returns(P.resolve(charge))
      try {
        await Handler.create({payload}, {})
      } catch (e) {
        test.equal(e.name, 'RecordExistsError')
        test.equal(e.payload.message, 'The charge has already been created')
        test.end()
      }
    })

    createTest.end()
  })

  handlerTest.test('update should', updateTest => {
    updateTest.test('update a charge', async function (test) {
      const charge = {
        name: 'charge_b',
        charge_type: 'fee',
        rate_type: 'flat',
        rate: '1.00',
        minimum: '10',
        maximum: '5',
        code: '2',
        is_active: false,
        payerParticipantId: 'ledger',
        payeeParticipantId: 'sender'
      }

      const payload = {
        name: 'charge_b',
        chargeType: 'fee',
        minimum: '10',
        maximum: '5',
        code: '2',
        is_active: false
      }

      const request = {
        payload: payload,
        params: {name: 'charge_b'}
      }

      Charge.getByName.withArgs(request.payload.name).returns(P.resolve(null))
      Charge.getByName.withArgs(charge.name).returns(P.resolve(charge))
      Charge.update.withArgs(request.params.name, payload).returns(P.resolve(charge))

      const response = await Handler.update(request, {})
      test.equal(response.name, charge.name)
      test.equal(response.id, charge.chargeId)
      test.equal(response.charge_type, charge.chargeType)
      test.equal(response.rate_type, charge.rateType)
      test.equal(response.rate, charge.rate)
      test.equal(response.minimum, charge.minimum)
      test.equal(response.maximum, charge.maximum)
      test.equal(response.code, charge.code)
      test.equal(response.is_active, charge.isActive)
      test.equal(response.created, charge.createdDate)
      test.ok(Sidecar.logRequest.calledWith(request))
      test.end()
    })

    updateTest.test('reply with error if Charge services throws Validation Error', async function (test) {
      const error = new Errors.ValidationError('Charge names need to be the values')

      const charge = {
        name: 'charge_b',
        charge_type: 'fee',
        rate_type: 'flat',
        rate: '1.00',
        minimum: '10',
        maximum: '5',
        code: '2',
        is_active: false,
        payerParticipantId: 'ledger',
        payeeParticipantId: 'sender'
      }

      const payload = {
        name: 'charge_b',
        chargeType: 'fee',
        minimum: '10',
        maximum: '5',
        code: '2',
        is_active: false
      }

      const request = {
        payload: payload,
        params: {name: 'charge_c'}
      }

      Charge.getByName.withArgs(request.payload.name).returns(P.resolve(null))
      Charge.getByName.withArgs(charge.name).returns(P.resolve(charge))
      Charge.update.withArgs(request.params.name, payload).returns(P.resolve(charge))
      try {
        await Handler.update(request, {})
      } catch (e) {
        test.deepEqual(e, error)
        test.end()
      }
    })

    updateTest.test('reply with error if Charge services throws Record Exists Error', async function (test) {
      const error = new Errors.RecordExistsError('No record currently exists with the name charge')

      const payload = {
        name: 'charge',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        minimum: '1.00',
        maximum: '100.00',
        code: '001',
        is_active: true,
        payerParticipantId: 'ledger',
        payeeParticipantId: 'sender'
      }

      const request = {
        payload: payload,
        params: {name: 'name'}
      }

      Charge.getByName.withArgs(payload.name).returns(P.resolve(null))
      Charge.update.withArgs(request.params.name, payload).returns(P.reject(error))
      try {
        await Handler.update(request, {})
      } catch (e) {
        test.deepEqual(e, error)
        test.end()
      }
    })

    updateTest.test('reply with error if Charge services throws Record Exists Error', async function (test) {
      const error = new Errors.RecordExistsError('No record currently exists with the name name')

      const payload = {
        name: 'name',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        minimum: '1.00',
        maximum: '100.00',
        code: '001',
        is_active: true,
        payerParticipantId: 'ledger',
        payeeParticipantId: 'sender'
      }

      const request = {
        payload: payload,
        params: {name: 'name'}
      }

      Charge.getByName.withArgs(payload.name).returns(P.resolve(null))
      Charge.update.withArgs(request.params.name, payload).returns(P.reject(error))
      try {
        await Handler.update(request, {})
      } catch (e) {
        test.deepEqual(e, error)
        test.end()
      }
    })

    updateTest.test('reply with already exists error if a charge with the given name already exists', async function (test) {
      const charge = createCharge('charge')
      charge.payerParticipantId = 'sender'
      charge.payeeParticipantId = 'receiver'

      const payload = {
        name: 'charge',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        minimum: '1.00',
        maximum: '100.00',
        code: '001',
        is_active: true,
        payerParticipantId: 'sender',
        payeeParticipantId: 'receiver'
      }

      const request = {
        payload: payload,
        params: {name: 'name'}
      }

      Charge.getByName.withArgs(payload.name).returns(P.resolve(charge))
      try {
        await Handler.create(request, {})
      } catch (e) {
        test.equal(e.name, 'RecordExistsError')
        test.equal(e.payload.message, 'The charge has already been created')
        test.end()
      }
    })

    updateTest.end()
  })

  handlerTest.end()
})
