'use strict'

const Test = require('tape')
const Fixtures = require('../../../../fixtures')
const Model = require('../../../../../src/domain/security/models/users')

const createUser = (key = Fixtures.generateRandomName()) => ({
  key,
  firstName: 'Dave',
  lastName: 'Super',
  email: 'superdave@test.com'
})

Test('users model', usersTest => {
  usersTest.test('save should', saveTest => {
    saveTest.test('save new user', test => {
      const user = createUser()

      Model.save(user)
        .then(result => {
          test.ok(result.userId)
          test.equal(result.firstName, user.firstName)
          test.equal(result.lastName, user.lastName)
          test.equal(result.email, user.email)
          test.equal(result.key, user.key)
          test.equal(result.isActive, true)
          test.ok(result.createdDate)
          test.end()
        })
    })

    saveTest.test('save existing user', test => {
      const user = createUser()

      Model.save(user)
        .then(result => {
          test.ok(result.userId)
          result.firstName = 'Another name'
          return result
        })
        .then(existing => {
          Model.save(existing)
            .then(result => {
              test.equal(result.firstName, 'Another name')
              test.end()
            })
        })
    })

    saveTest.end
  })

  usersTest.test('getAll should', getAllTest => {
    getAllTest.test('return all users', test => {
      const user1 = createUser()
      const user2 = createUser()

      Model.save(user1)
      .then(() => Model.save(user2))
      .then(() => Model.getAll())
      .then(results => {
        test.ok(results.length >= 2)
        test.end()
      })
    })

    getAllTest.end()
  })

  usersTest.test('getById should', getByIdTest => {
    getByIdTest.test('return user', test => {
      const user = createUser()
      Model.save(user)
        .then(result => Model.getById(result.userId))
        .then(saved => {
          test.equal(saved.firstName, user.firstName)
          test.equal(saved.lastName, user.lastName)
          test.equal(saved.key, user.key)
          test.equal(saved.email, user.email)
          test.ok(saved.createdDate)
          test.end()
        })
    })

    getByIdTest.end()
  })

  usersTest.test('getByKey should', getByKeyTest => {
    getByKeyTest.test('return user', test => {
      const user = createUser()
      Model.save(user)
        .then(result => Model.getByKey(result.key))
        .then(saved => {
          test.equal(saved.firstName, user.firstName)
          test.equal(saved.lastName, user.lastName)
          test.equal(saved.key, user.key)
          test.equal(saved.email, user.email)
          test.ok(saved.createdDate)
          test.end()
        })
    })
    getByKeyTest.end()
  })

  usersTest.end()
})
