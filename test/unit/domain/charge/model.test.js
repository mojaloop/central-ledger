'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Model = require(`${src}/domain/charge/model`)
const Db = require(`${src}/db`)

Test('charge model', modelTest => {
  let sandbox

  modelTest.beforeEach((t) => {
    sandbox = Sinon.createSandbox()

    Db.charge = {
      insert: sandbox.stub(),
      update: sandbox.stub(),
      find: sandbox.stub(),
      findOne: sandbox.stub()
    }

    t.end()
  })

  modelTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  modelTest.test('getAll should', getAllTest => {
    getAllTest.test('return exception if db query throws', test => {
      const error = new Error()

      Db.charge.find.returns(P.reject(error))

      Model.getAll()
        .then(() => {
          test.fail('Should have thrown error')
        })
        .catch(err => {
          test.equal(err, error)
          test.ok(Db.charge.find.calledWith({ isActive: true }, { order: 'name asc' }))
          test.end()
        })
    })

    getAllTest.test('return all charge ordered by name', test => {
      const charge1Name = 'charge1'
      const charge2Name = 'charge2'
      const charge = [{ name: charge1Name }, { name: charge2Name }]

      Db.charge.find.returns(P.resolve(charge))

      Model.getAll()
        .then((found) => {
          test.equal(found, charge)
          test.ok(Db.charge.find.calledWith({ isActive: true }, { order: 'name asc' }))
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    getAllTest.end()
  })

  modelTest.test('getByName should', getByNameTest => {
    getByNameTest.test('return exception if db query throws', test => {
      const error = new Error()
      const name = 'charge1'

      Db.charge.findOne.returns(P.reject(error))

      Model.getByName(name)
        .then(() => {
          test.fail('Should have thrown error')
        })
        .catch(err => {
          test.equal(err, error)
          test.ok(Db.charge.findOne.calledWith({ name }))
          test.end()
        })
    })

    getByNameTest.test('returns a charge with the given name', test => {
      const name = 'charge1'
      const charge = { name }

      Db.charge.findOne.returns(P.resolve(charge))

      Model.getByName(name)
        .then((found) => {
          test.equal(found, charge)
          test.ok(Db.charge.findOne.calledWith({ name }))
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    getByNameTest.end()
  })

  modelTest.test('getAllSenderAsPayer should', getAllSenderAsPayerTest => {
    getAllSenderAsPayerTest.test('return exception if db query throws', test => {
      const error = new Error()

      Db.charge.find.returns(P.reject(error))

      Model.getAllSenderAsPayer()
        .then(() => {
          test.fail('Should have thrown error')
        })
        .catch(err => {
          test.equal(err, error)
          test.ok(Db.charge.find.calledWith({ payerParticipantId: 'sender', isActive: true }, { order: 'name asc' }))
          test.end()
        })
    })

    getAllSenderAsPayerTest.test('return all charge ordered by name', test => {
      const charge = [{ name: 'charge1' }, { name: 'charge2' }, { name: 'charge3' }]

      Db.charge.find.returns(P.resolve(charge))

      Model.getAllSenderAsPayer()
        .then((found) => {
          test.equal(found, charge)
          test.ok(Db.charge.find.calledWith({ payerParticipantId: 'sender', isActive: true }, { order: 'name asc' }))
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    getAllSenderAsPayerTest.end()
  })

  modelTest.test('create should', createTest => {
    createTest.test('save payload and return new charge', test => {
      let name = 'charge'
      let charge = { name }

      Db.charge.insert.returns(P.resolve(charge))

      const payload = { name }

      Model.create(payload)
        .then(created => {
          const insertArg = Db.charge.insert.firstCall.args[0]
          test.notEqual(insertArg, payload)
          test.equal(created, charge)
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('update should', updateTest => {
    updateTest.test('save everything but name and return updated charge', test => {
      let name = 'charge'
      let charge = {
        chargeId: 1,
        name
      }

      const payload = {
        name: 'charge_b',
        minimum: '1.00',
        maximum: '100.00',
        code: '002',
        is_active: true
      }

      const fields = {
        name: payload.name,
        minimum: payload.minimum,
        maximum: payload.maximum,
        code: payload.code,
        isActive: payload.is_active
      }

      const updatedCharge = {
        chargeId: 1,
        name: payload.name
      }

      Db.charge.update.returns(P.resolve(updatedCharge))

      Model.update(charge, payload)
        .then(updated => {
          test.ok(Db.charge.update.calledWith({ chargeId: charge.chargeId }, fields))
          test.equal(updated, updatedCharge)
          test.end()
        })
    })

    updateTest.end()
  })

  modelTest.end()
})

