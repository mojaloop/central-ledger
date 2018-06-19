'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const Promise = require('bluebird')
const Fixtures = require('../../../../fixtures')
const PartyModel = require('../../../../../src/domain/security/models/party')
const Model = require('../../../../../src/domain/security/models/role')

const createRole = (name = Fixtures.generateRandomName(), permissions = 'test|test2') => ({ name, permissions })

const createParty = (key = Fixtures.generateRandomName()) => ({
  key,
  firstName: 'Dave',
  lastName: 'Super',
  email: 'superdave@test.com'
})

Test('role model', roleTest => {
  roleTest.test('save should', saveTest => {
    saveTest.test('save role to db', test => {
      const role = createRole()
      Model.save(role)
        .then(result => {
          test.ok(result.roleId)
          test.equal(result.name, role.name)
          test.notOk(result.description)
          test.equal(result.permissions, role.permissions)
          test.end()
        })
    })

    saveTest.test('save existing role', test => {
      const role = createRole()
      Model.save(role)
        .then(result => {
          result.name = 'new name'
          return result
        })
        .then(updatedRole => {
          return Model.save(updatedRole)
            .then(result => {
              test.equal(result.name, 'new name')
              test.end()
            })
        })
    })

    saveTest.end()
  })

  roleTest.test('getById should', getByIdTest => {
    getByIdTest.test('return saved role', test => {
      const role = createRole()
      Model.save(role)
        .then(result => Model.getById(result.roleId))
        .then(saved => {
          test.equal(saved.name, role.name)
          test.equal(saved.permissions, role.permissions)
          test.end()
        })
    })

    getByIdTest.test('return null if no role found', test => {
      Model.getById(Uuid())
        .then(result => {
          test.notOk(result)
          test.end()
        })
    })

    getByIdTest.end()
  })

  roleTest.test('getAll should', getAllTest => {
    getAllTest.test('return all role', test => {
      Model.getAll()
        .then(results => {
          test.ok(results.length > 0)
          test.end()
        })
    })

    getAllTest.end()
  })

  roleTest.test('remove should', removeTest => {
    removeTest.test('destroy role by id', test => {
      const role = createRole()
      Model.save(role)
        .then(result => {
          const roleId = result.roleId
          return Model.getById(roleId)
            .then(r => test.ok(r))
            .then(() => Model.remove(roleId))
            .then(removed => {
              test.ok(removed)
              test.equal(removed.roleId, roleId)
              return Model.getById(roleId)
            })
            .then(r => test.notOk(r))
        })
        .then(test.end)
    })

    removeTest.end()
  })

  roleTest.test('addPartyRole should', addPartyRoleTest => {
    addPartyRoleTest.test('add party role', test => {
      PartyModel.save(createParty())
      .then(userResult => Model.save(createRole())
          .then(role => ({ partyId: userResult.partyId, roleId: role.roleId }))
      )
      .then(userRole => {
        Model.addPartyRole(userRole)
        .then(result => {
          test.deepEqual(result, userRole)
          test.end()
        })
      })
    })

    addPartyRoleTest.end()
  })

  roleTest.test('getPartyRole should', getPartyRoleTest => {
    getPartyRoleTest.test('get role belonging to party', test => {
      Promise.props({
        party: PartyModel.save(createParty()),
        role1: Model.save(createRole()),
        role2: Model.save(createRole()),
        role3: Model.save(createRole())
      })
      .then(result => {
        const party = result.party
        Model.addPartyRole({ partyId: party.partyId, roleId: result.role2.roleId })
          .then(userRole => Model.getPartyRole(party.partyId))
          .then(results => {
            test.deepEqual(results, [ result.role2 ])
            test.end()
          })
      })
    })

    getPartyRoleTest.end()
  })

  roleTest.test('removePartyRole should', removePartyRoleTest => {
    removePartyRoleTest.test('destroy role for party', test => {
      PartyModel.save(createParty())
        .then(userResult => Model.save(createRole())
          .then(role => ({ partyId: userResult.partyId, roleId: role.roleId }))
        )
        .then(userRole => {
          Model.addPartyRole(userRole)
            .then(result => {
              return Model.removePartyRole(userRole.partyId)
                .then(removed => {
                  test.ok(removed)
                  test.equal(removed.partyId, userRole.partyId)
                  test.equal(removed.roleId, userRole.roleId)
                  test.end()
                })
            })
        })
    })

    removePartyRoleTest.end()
  })

  roleTest.end()
})
