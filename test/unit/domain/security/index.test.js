'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')

const Errors = require('../../../../src/errors')
const Util = require('../../../../src/lib/util')
const RoleModel = require('../../../../src/domain/security/models/role')
const PartyModel = require('../../../../src/domain/security/models/party')
const SecurityService = require('../../../../src/domain/security')

Test('SecurityService test', serviceTest => {
  let sandbox

  serviceTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(RoleModel)
    sandbox.stub(PartyModel)
    test.end()
  })

  serviceTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  serviceTest.test('getAllRole should', getAllRoleTest => {
    getAllRoleTest.test('return all role from model', test => {
      const role = [{ name: 'role1' }, { name: 'role2' }]
      RoleModel.getAll.returns(P.resolve(role))

      SecurityService.getAllRole()
        .then(result => {
          test.deepEqual(result, role)
          test.end()
        })
    })

    getAllRoleTest.test('remove createdDate and expand permissions', test => {
      const role = [{ name: 'role1', createdDate: new Date(), permissions: 'PERMISSION1|PERMISSION2' }]
      RoleModel.getAll.returns(P.resolve(role))

      SecurityService.getAllRole()
        .then(result => {
          test.deepEqual(result[0], { name: 'role1', permissions: ['PERMISSION1', 'PERMISSION2'] })
          test.end()
        })
    })

    getAllRoleTest.end()
  })

  serviceTest.test('createRole should', createTest => {
    createTest.test('save role to model', test => {
      const role = { name: 'role1' }
      RoleModel.save.returns(P.resolve(role))

      SecurityService.createRole(role)
        .then(result => {
          test.ok(RoleModel.save.calledWith(Sinon.match(role)))
          test.deepEqual(result, role)
          test.end()
        })
    })

    createTest.test('convert permissions array to string', test => {
      const role = { name: 'role1', permissions: ['PERMISSION1', 'PERMISSION2'] }
      RoleModel.save.returns(P.resolve({}))

      SecurityService.createRole(role)
        .then(result => {
          test.ok(RoleModel.save.calledWith(Sinon.match({ name: 'role1', permissions: 'PERMISSION1|PERMISSION2' })))
          test.end()
        })
    })

    createTest.test('remove createdDate and expand permissions', test => {
      const role = { name: 'role1', createdDate: new Date(), permissions: 'PERMISSION1|PERMISSION2' }
      RoleModel.save.returns(P.resolve(role))

      SecurityService.createRole({})
        .then(result => {
          test.deepEqual(result, { name: 'role1', permissions: ['PERMISSION1', 'PERMISSION2'] })
          test.end()
        })
    })

    createTest.end()
  })

  serviceTest.test('updateRole should', updateTest => {
    updateTest.test('find existing role and update properties', test => {
      const roleId = Uuid()
      const role = { roleId, name: 'role1', permissions: 'PERMISSION1|PERMISSION2', description: 'Some role' }
      RoleModel.getById.withArgs(roleId).returns(P.resolve(role))
      RoleModel.save.returns(P.resolve({}))
      const newRole = { name: 'role2', permissions: ['PERMISSION3'] }
      SecurityService.updateRole(roleId, newRole)
        .then(result => {
          test.equal(RoleModel.save.callCount, 1)
          const savedRole = RoleModel.save.firstCall.args[0]
          test.equal(savedRole.roleId, roleId)
          test.equal(savedRole.name, newRole.name)
          test.equal(savedRole.permissions, newRole.permissions[0])
          test.equal(savedRole.description, role.description)
          test.end()
        })
    })

    updateTest.test('return NotFoundError if role does not exist', test => {
      const roleId = Uuid()
      RoleModel.getById.withArgs(roleId).returns(P.resolve(null))
      SecurityService.updateRole(roleId, { name: 'test' })
        .then(() => test.fail('Expected exception'))
        .catch(Errors.NotFoundError, e => {
          test.equal(e.message, 'Role does not exist')
          test.end()
        })
        .catch(() => test.fail('Expected NotFoundError'))
    })

    updateTest.end()
  })

  serviceTest.test('deleteRole should', deleteTest => {
    deleteTest.test('remove role from model', test => {
      const roleId = Uuid()
      RoleModel.remove.withArgs(roleId).returns(P.resolve([{ name: 'role1' }]))
      SecurityService.deleteRole(roleId)
        .then(result => {
          test.equal(RoleModel.remove.callCount, 1)
          test.ok(RoleModel.remove.calledWith(roleId))
          test.end()
        })
    })

    deleteTest.test('throw NotFoundError if no rows deleted', test => {
      const roleId = Uuid()
      RoleModel.remove.returns(P.resolve([]))
      SecurityService.deleteRole(roleId)
        .then(() => test.fail('expected exception'))
        .catch(Errors.NotFoundError, e => {
          test.equal(e.message, 'Role does not exist')
          test.end()
        })
        .catch(e => test.fail('Expected NotFoundError'))
    })

    deleteTest.end()
  })

  serviceTest.test('getAllParty should', getAllPartyTest => {
    getAllPartyTest.test('return party from model', test => {
      const party = []
      PartyModel.getAll.returns(P.resolve(party))
      SecurityService.getAllParty()
        .then(results => {
          test.deepEqual(results, party)
          test.end()
        })
    })

    getAllPartyTest.end()
  })

  serviceTest.test('getPartyById should', getPartyByIdTest => {
    getPartyByIdTest.test('return party from model', test => {
      const partyId = Uuid()
      const party = {}
      PartyModel.getById.withArgs(partyId).returns(P.resolve(party))

      SecurityService.getPartyById(partyId)
        .then(result => {
          test.equal(result, party)
          test.end()
        })
    })

    getPartyByIdTest.test('throw not found error if party null', test => {
      const partyId = Uuid()
      PartyModel.getById.returns(P.resolve(null))

      SecurityService.getPartyById(partyId)
        .then(() => test.fail('Expected NotFoundError'))
        .catch(Errors.NotFoundError, e => {
          test.equal(e.message, 'Party does not exist')
          test.end()
        })
        .catch(() => test.fail('Expected NotFoundError'))
    })
    getPartyByIdTest.end()
  })

  serviceTest.test('getPartyByKey should', getPartyByKeyTest => {
    getPartyByKeyTest.test('return party from model', test => {
      const userKey = 'key'
      const party = {}
      PartyModel.getByKey.withArgs(userKey).returns(P.resolve(party))

      SecurityService.getPartyByKey(userKey)
        .then(result => {
          test.equal(result, party)
          test.end()
        })
    })

    getPartyByKeyTest.test('throw not found error if party null', test => {
      const userKey = 'key'
      PartyModel.getByKey.returns(P.resolve(null))

      SecurityService.getPartyByKey(userKey)
        .then(() => test.fail('Expected NotFoundError'))
        .catch(Errors.NotFoundError, e => {
          test.equal(e.message, 'Party does not exist')
          test.end()
        })
        .catch(() => test.fail('Expected NotFoundError'))
    })

    getPartyByKeyTest.end()
  })

  serviceTest.test('getPartyRole should', getPartyRoleTest => {
    getPartyRoleTest.test('return party role from model', test => {
      const role = [{ permissions: '' }, { permissions: '' }]
      const partyId = Uuid()
      RoleModel.getPartyRole.withArgs(partyId).returns(P.resolve(role))

      SecurityService.getPartyRole(partyId)
        .then(result => {
          test.deepEqual(result, role)
          test.end()
        })
    })

    getPartyRoleTest.end()
  })

  serviceTest.test('createParty should', createPartyTest => {
    createPartyTest.test('save party to model', test => {
      const savedParty = {}
      PartyModel.save.returns(P.resolve(savedParty))
      const party = {}
      SecurityService.createParty(party)
        .then(result => {
          test.equal(result, savedParty)
          test.ok(PartyModel.save.calledWith(party))
          test.end()
        })
    })
    createPartyTest.end()
  })

  serviceTest.test('deleteParty should', deletePartyTest => {
    deletePartyTest.test('throw NotFoundError if party does not exist', test => {
      const partyId = Uuid()
      PartyModel.getById.withArgs(partyId).returns(P.resolve(null))

      SecurityService.deleteParty(partyId)
        .then(() => test.fail('Expected exception'))
        .catch(Errors.NotFoundError, e => {
          test.equal(e.message, 'Party does not exist')
          test.end()
        })
        .catch(() => test.fail('Expected NotFoundError'))
    })

    deletePartyTest.test('remove party role', test => {
      const partyId = Uuid()
      PartyModel.getById.returns(P.resolve({}))

      SecurityService.deleteParty(partyId)
        .then(() => {
          test.ok(RoleModel.removePartyRole.calledWith(partyId))
          test.end()
        })
    })

    deletePartyTest.test('remove party from model', test => {
      const partyId = Uuid()
      PartyModel.getById.returns(P.resolve({}))

      SecurityService.deleteParty(partyId)
        .then(() => {
          test.ok(PartyModel.remove.calledWith(partyId))
          test.end()
        })
    })

    deletePartyTest.end()
  })

  serviceTest.test('updateParty should', updatePartyTest => {
    updatePartyTest.test('throw not NotFoundError if party does not exist', test => {
      const partyId = Uuid()
      PartyModel.getById.withArgs(partyId).returns(P.resolve(null))

      SecurityService.updateParty(partyId, {})
        .then(() => test.fail('Expected exception'))
        .catch(Errors.NotFoundError, e => {
          test.equal(e.message, 'Party does not exist')
          test.end()
        })
        .catch(() => test.fail('Expected NotFoundError'))
    })

    updatePartyTest.test('merge details with party and save to model', test => {
      const partyId = Uuid()
      const party = { lastName: 'SuperParty' }
      const details = { firstName: 'Dave' }
      PartyModel.getById.returns(P.resolve(party))

      const expected = Util.merge(party, details)
      PartyModel.save.returns(P.resolve(expected))
      SecurityService.updateParty(partyId, details)
        .then(result => {
          test.deepEqual(result, expected)
          test.ok(PartyModel.save.calledWith(expected))
          test.end()
        })
    })

    updatePartyTest.end()
  })

  serviceTest.test('updatePartyRole should', updatePartyRoleTest => {
    updatePartyRoleTest.test('throw NotFoundError if party does not exist', test => {
      const partyId = Uuid()
      PartyModel.getById.withArgs(partyId).returns(P.resolve(null))

      SecurityService.updatePartyRole(partyId, [])
        .then(() => test.fail('Expected error'))
        .catch(Errors.NotFoundError, e => {
          test.equal(e.message, 'Party does not exist')
          test.end()
        })
        .catch(() => test.fail('Expected NotFoundError'))
    })

    updatePartyRoleTest.test('remove existing party role', test => {
      const partyId = Uuid()
      PartyModel.getById.returns(P.resolve({}))
      const role = [{ permissions: '' }, { permissions: '' }]
      RoleModel.getPartyRole.withArgs(partyId).returns(P.resolve(role))

      SecurityService.updatePartyRole(partyId, [])
        .then(() => {
          test.ok(RoleModel.removePartyRole.calledWith(partyId))
          test.end()
        })
    })

    updatePartyRoleTest.test('add each new role to partyRole', test => {
      const partyId = Uuid()
      const role1 = Uuid()
      const role2 = Uuid()

      PartyModel.getById.returns(P.resolve({}))
      const role = [{ permissions: '' }, { permissions: '' }]
      RoleModel.getPartyRole.withArgs(partyId).returns(P.resolve(role))

      SecurityService.updatePartyRole(partyId, [ role1, role2 ])
        .then(() => {
          test.ok(RoleModel.addPartyRole.calledWith({ partyId, roleId: role1 }))
          test.ok(RoleModel.addPartyRole.calledWith({ partyId, roleId: role2 }))
          test.end()
        })
    })

    updatePartyRoleTest.test('return party role', test => {
      const partyId = Uuid()
      PartyModel.getById.returns(P.resolve({}))
      const role = [{ permissions: '' }, { permissions: '' }]
      RoleModel.getPartyRole.withArgs(partyId).returns(P.resolve(role))
      SecurityService.updatePartyRole(partyId, [])
        .then(result => {
          test.deepEqual(result, role)
          test.end()
        })
    })

    updatePartyRoleTest.end()
  })
  serviceTest.end()
})
