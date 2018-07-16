'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const Db = require('../../../../../src/db')
const Model = require('../../../../../src/domain/security/models/party')

Test('Party model', modelTest => {
  let sandbox

  modelTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()

    Db.party = {
      insert: sandbox.stub(),
      update: sandbox.stub(),
      find: sandbox.stub(),
      findOne: sandbox.stub(),
      destroy: sandbox.stub()
    }

    test.end()
  })

  modelTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  modelTest.test('getAll should', getAllTest => {
    getAllTest.test('find all party in db', test => {
      const party = [{}, {}]
      Db.party.find.returns(P.resolve(party))

      Model.getAll()
        .then(result => {
          test.deepEqual(result, party)
          test.ok(Db.party.find.calledWith({}))
          test.end()
        })
    })

    getAllTest.end()
  })

  modelTest.test('getById should', getByIdTest => {
    getByIdTest.test('select first party by id', test => {
      const partyId = Uuid()
      const party = { firstName: 'Dave' }

      Db.party.findOne.returns(P.resolve(party))

      Model.getById(partyId)
        .then(result => {
          test.equal(result, party)
          test.ok(Db.party.findOne.calledWith({ partyId }))
          test.end()
        })
    })

    getByIdTest.end()
  })

  modelTest.test('getByKey should', getByKeyTest => {
    getByKeyTest.test('select first party by key', test => {
      const key = Uuid()
      const party = { firstName: 'Dave' }

      Db.party.findOne.returns(P.resolve(party))

      Model.getByKey(key)
        .then(result => {
          test.equal(result, party)
          test.ok(Db.party.findOne.calledWith({ key }))
          test.end()
        })
    })

    getByKeyTest.end()
  })

  modelTest.test('remove should', removeTest => {
    removeTest.test('destroy party in db', test => {
      const partyId = Uuid()

      Db.party.destroy.returns(P.resolve(1))

      Model.remove(partyId)
        .then(result => {
          test.equal(result, 1)
          test.ok(Db.party.destroy.calledWith({ partyId }))
          test.end()
        })
    })

    removeTest.end()
  })

  modelTest.test('save should', saveTest => {
    saveTest.test('insert party in db if partyId not defined', test => {
      const party = { firstName: 'Dave' }

      Db.party.insert.returns(P.resolve(party))

      Model.save(party)
        .then(result => {
          test.deepEqual(result, party)
          test.ok(Db.party.insert.calledWith(sandbox.match(party)))
          test.end()
        })
    })

    saveTest.test('update party in db if partyId defined', test => {
      const partyId = Uuid()
      const party = { partyId, firstName: 'Dave' }

      Db.party.update.returns(P.resolve(party))

      Model.save(party)
        .then(result => {
          test.deepEqual(result, party)
          test.ok(Db.party.update.calledWith({ partyId }, party))
          test.end()
        })
    })
    saveTest.end()
  })

  modelTest.end()
})

