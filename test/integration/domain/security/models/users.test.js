'use strict'

const Test = require('tape')
const Fixtures = require('../../../../fixtures')
const Model = require('../../../../../src/domain/security/models/party')

const createParty = (key = Fixtures.generateRandomName()) => ({
  key,
  firstName: 'Dave',
  lastName: 'Super',
  email: 'superdave@test.com'
})

Test('party model', partyTest => {
  partyTest.test('save should', saveTest => {
    saveTest.test('save new party', test => {
      const party = createParty()

      Model.save(party)
        .then(result => {
          test.ok(result.partyId)
          test.equal(result.firstName, party.firstName)
          test.equal(result.lastName, party.lastName)
          test.equal(result.email, party.email)
          test.equal(result.key, party.key)
          test.equal(result.isActive, true)
          test.ok(result.createdDate)
          test.end()
        })
    })

    saveTest.test('save existing party', test => {
      const party = createParty()

      Model.save(party)
        .then(result => {
          test.ok(result.partyId)
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

  partyTest.test('getAll should', getAllTest => {
    getAllTest.test('return all party', test => {
      const user1 = createParty()
      const user2 = createParty()

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

  partyTest.test('getById should', getByIdTest => {
    getByIdTest.test('return party', test => {
      const party = createParty()
      Model.save(party)
        .then(result => Model.getById(result.partyId))
        .then(saved => {
          test.equal(saved.firstName, party.firstName)
          test.equal(saved.lastName, party.lastName)
          test.equal(saved.key, party.key)
          test.equal(saved.email, party.email)
          test.ok(saved.createdDate)
          test.end()
        })
    })

    getByIdTest.end()
  })

  partyTest.test('getByKey should', getByKeyTest => {
    getByKeyTest.test('return party', test => {
      const party = createParty()
      Model.save(party)
        .then(result => Model.getByKey(result.key))
        .then(saved => {
          test.equal(saved.firstName, party.firstName)
          test.equal(saved.lastName, party.lastName)
          test.equal(saved.key, party.key)
          test.equal(saved.email, party.email)
          test.ok(saved.createdDate)
          test.end()
        })
    })
    getByKeyTest.end()
  })

  partyTest.end()
})
