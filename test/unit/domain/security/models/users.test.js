'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const Db = require('../../../../../src/db')
const Model = require('../../../../../src/domain/security/models/users')

Test('Users model', modelTest => {
  let sandbox

  modelTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()

    Db.users = {
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
    getAllTest.test('find all users in db', test => {
      const users = [{}, {}]
      Db.users.find.returns(P.resolve(users))

      Model.getAll()
        .then(result => {
          test.deepEqual(result, users)
          test.ok(Db.users.find.calledWith({}))
          test.end()
        })
    })

    getAllTest.end()
  })

  modelTest.test('getById should', getByIdTest => {
    getByIdTest.test('select first user by id', test => {
      const userId = Uuid()
      const user = { firstName: 'Dave' }

      Db.users.findOne.returns(P.resolve(user))

      Model.getById(userId)
        .then(result => {
          test.equal(result, user)
          test.ok(Db.users.findOne.calledWith({ userId }))
          test.end()
        })
    })

    getByIdTest.end()
  })

  modelTest.test('getByKey should', getByKeyTest => {
    getByKeyTest.test('select first user by key', test => {
      const key = Uuid()
      const user = { firstName: 'Dave' }

      Db.users.findOne.returns(P.resolve(user))

      Model.getByKey(key)
        .then(result => {
          test.equal(result, user)
          test.ok(Db.users.findOne.calledWith({ key }))
          test.end()
        })
    })

    getByKeyTest.end()
  })

  modelTest.test('remove should', removeTest => {
    removeTest.test('destroy user in db', test => {
      const userId = Uuid()

      Db.users.destroy.returns(P.resolve(1))

      Model.remove(userId)
        .then(result => {
          test.equal(result, 1)
          test.ok(Db.users.destroy.calledWith({ userId }))
          test.end()
        })
    })

    removeTest.end()
  })

  modelTest.test('save should', saveTest => {
    saveTest.test('insert user in db if userId not defined', test => {
      const user = { firstName: 'Dave' }

      Db.users.insert.returns(P.resolve(user))

      Model.save(user)
        .then(result => {
          test.deepEqual(result, user)
          test.ok(Db.users.insert.calledWith(sandbox.match(user)))
          test.end()
        })
    })

    saveTest.test('update user in db if userId defined', test => {
      const userId = Uuid()
      const user = { userId, firstName: 'Dave' }

      Db.users.update.returns(P.resolve(user))

      Model.save(user)
        .then(result => {
          test.deepEqual(result, user)
          test.ok(Db.users.update.calledWith({ userId }, user))
          test.end()
        })
    })
    saveTest.end()
  })

  modelTest.end()
})

