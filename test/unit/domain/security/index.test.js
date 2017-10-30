'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')

const Errors = require('../../../../src/errors')
const Util = require('../../../../src/lib/util')
const RolesModel = require('../../../../src/domain/security/models/roles')
const UsersModel = require('../../../../src/domain/security/models/users')
const SecurityService = require('../../../../src/domain/security')

Test('SecurityService test', serviceTest => {
  let sandbox

  serviceTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(RolesModel)
    sandbox.stub(UsersModel)
    test.end()
  })

  serviceTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  serviceTest.test('getAllRoles should', getAllRolesTest => {
    getAllRolesTest.test('return all roles from model', test => {
      const roles = [{ name: 'role1' }, { name: 'role2' }]
      RolesModel.getAll.returns(P.resolve(roles))

      SecurityService.getAllRoles()
        .then(result => {
          test.deepEqual(result, roles)
          test.end()
        })
    })

    getAllRolesTest.test('remove createdDate and expand permissions', test => {
      const roles = [{ name: 'role1', createdDate: new Date(), permissions: 'PERMISSION1|PERMISSION2' }]
      RolesModel.getAll.returns(P.resolve(roles))

      SecurityService.getAllRoles()
        .then(result => {
          test.deepEqual(result[0], { name: 'role1', permissions: ['PERMISSION1', 'PERMISSION2'] })
          test.end()
        })
    })

    getAllRolesTest.end()
  })

  serviceTest.test('createRole should', createTest => {
    createTest.test('save role to model', test => {
      const role = { name: 'role1' }
      RolesModel.save.returns(P.resolve(role))

      SecurityService.createRole(role)
        .then(result => {
          test.ok(RolesModel.save.calledWith(Sinon.match(role)))
          test.deepEqual(result, role)
          test.end()
        })
    })

    createTest.test('convert permissions array to string', test => {
      const role = { name: 'role1', permissions: ['PERMISSION1', 'PERMISSION2'] }
      RolesModel.save.returns(P.resolve({}))

      SecurityService.createRole(role)
        .then(result => {
          test.ok(RolesModel.save.calledWith(Sinon.match({ name: 'role1', permissions: 'PERMISSION1|PERMISSION2' })))
          test.end()
        })
    })

    createTest.test('remove createdDate and expand permissions', test => {
      const role = { name: 'role1', createdDate: new Date(), permissions: 'PERMISSION1|PERMISSION2' }
      RolesModel.save.returns(P.resolve(role))

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
      RolesModel.getById.withArgs(roleId).returns(P.resolve(role))
      RolesModel.save.returns(P.resolve({}))
      const newRole = { name: 'role2', permissions: ['PERMISSION3'] }
      SecurityService.updateRole(roleId, newRole)
        .then(result => {
          test.equal(RolesModel.save.callCount, 1)
          const savedRole = RolesModel.save.firstCall.args[0]
          test.equal(savedRole.roleId, roleId)
          test.equal(savedRole.name, newRole.name)
          test.equal(savedRole.permissions, newRole.permissions[0])
          test.equal(savedRole.description, role.description)
          test.end()
        })
    })

    updateTest.test('return NotFoundError if role does not exist', test => {
      const roleId = Uuid()
      RolesModel.getById.withArgs(roleId).returns(P.resolve(null))
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
      RolesModel.remove.withArgs(roleId).returns(P.resolve([{ name: 'role1' }]))
      SecurityService.deleteRole(roleId)
        .then(result => {
          test.equal(RolesModel.remove.callCount, 1)
          test.ok(RolesModel.remove.calledWith(roleId))
          test.end()
        })
    })

    deleteTest.test('throw NotFoundError if no rows deleted', test => {
      const roleId = Uuid()
      RolesModel.remove.returns(P.resolve([]))
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

  serviceTest.test('getAllUsers should', getAllUsersTest => {
    getAllUsersTest.test('return users from model', test => {
      const users = []
      UsersModel.getAll.returns(P.resolve(users))
      SecurityService.getAllUsers()
        .then(results => {
          test.deepEqual(results, users)
          test.end()
        })
    })

    getAllUsersTest.end()
  })

  serviceTest.test('getUserById should', getUserByIdTest => {
    getUserByIdTest.test('return user from model', test => {
      const userId = Uuid()
      const user = {}
      UsersModel.getById.withArgs(userId).returns(P.resolve(user))

      SecurityService.getUserById(userId)
        .then(result => {
          test.equal(result, user)
          test.end()
        })
    })

    getUserByIdTest.test('throw not found error if user null', test => {
      const userId = Uuid()
      UsersModel.getById.returns(P.resolve(null))

      SecurityService.getUserById(userId)
        .then(() => test.fail('Expected NotFoundError'))
        .catch(Errors.NotFoundError, e => {
          test.equal(e.message, 'User does not exist')
          test.end()
        })
        .catch(() => test.fail('Expected NotFoundError'))
    })
    getUserByIdTest.end()
  })

  serviceTest.test('getUserByKey should', getUserByKeyTest => {
    getUserByKeyTest.test('return user from model', test => {
      const userKey = 'key'
      const user = {}
      UsersModel.getByKey.withArgs(userKey).returns(P.resolve(user))

      SecurityService.getUserByKey(userKey)
        .then(result => {
          test.equal(result, user)
          test.end()
        })
    })

    getUserByKeyTest.test('throw not found error if user null', test => {
      const userKey = 'key'
      UsersModel.getByKey.returns(P.resolve(null))

      SecurityService.getUserByKey(userKey)
        .then(() => test.fail('Expected NotFoundError'))
        .catch(Errors.NotFoundError, e => {
          test.equal(e.message, 'User does not exist')
          test.end()
        })
        .catch(() => test.fail('Expected NotFoundError'))
    })

    getUserByKeyTest.end()
  })

  serviceTest.test('getUserRoles should', getUsersRolesTest => {
    getUsersRolesTest.test('return users roles from model', test => {
      const roles = [{ permissions: '' }, { permissions: '' }]
      const userId = Uuid()
      RolesModel.getUserRoles.withArgs(userId).returns(P.resolve(roles))

      SecurityService.getUserRoles(userId)
        .then(result => {
          test.deepEqual(result, roles)
          test.end()
        })
    })

    getUsersRolesTest.end()
  })

  serviceTest.test('createUser should', createUserTest => {
    createUserTest.test('save user to model', test => {
      const savedUser = {}
      UsersModel.save.returns(P.resolve(savedUser))
      const user = {}
      SecurityService.createUser(user)
        .then(result => {
          test.equal(result, savedUser)
          test.ok(UsersModel.save.calledWith(user))
          test.end()
        })
    })
    createUserTest.end()
  })

  serviceTest.test('deleteUser should', deleteUserTest => {
    deleteUserTest.test('throw NotFoundError if user does not exist', test => {
      const userId = Uuid()
      UsersModel.getById.withArgs(userId).returns(P.resolve(null))

      SecurityService.deleteUser(userId)
        .then(() => test.fail('Expected exception'))
        .catch(Errors.NotFoundError, e => {
          test.equal(e.message, 'User does not exist')
          test.end()
        })
        .catch(() => test.fail('Expected NotFoundError'))
    })

    deleteUserTest.test('remove users roles', test => {
      const userId = Uuid()
      UsersModel.getById.returns(P.resolve({}))

      SecurityService.deleteUser(userId)
        .then(() => {
          test.ok(RolesModel.removeUserRoles.calledWith(userId))
          test.end()
        })
    })

    deleteUserTest.test('remove user from model', test => {
      const userId = Uuid()
      UsersModel.getById.returns(P.resolve({}))

      SecurityService.deleteUser(userId)
        .then(() => {
          test.ok(UsersModel.remove.calledWith(userId))
          test.end()
        })
    })

    deleteUserTest.end()
  })

  serviceTest.test('updateUser should', updateUserTest => {
    updateUserTest.test('throw not NotFoundError if user does not exist', test => {
      const userId = Uuid()
      UsersModel.getById.withArgs(userId).returns(P.resolve(null))

      SecurityService.updateUser(userId, {})
        .then(() => test.fail('Expected exception'))
        .catch(Errors.NotFoundError, e => {
          test.equal(e.message, 'User does not exist')
          test.end()
        })
        .catch(() => test.fail('Expected NotFoundError'))
    })

    updateUserTest.test('merge details with user and save to model', test => {
      const userId = Uuid()
      const user = { lastName: 'SuperUser' }
      const details = { firstName: 'Dave' }
      UsersModel.getById.returns(P.resolve(user))

      const expected = Util.merge(user, details)
      UsersModel.save.returns(P.resolve(expected))
      SecurityService.updateUser(userId, details)
        .then(result => {
          test.deepEqual(result, expected)
          test.ok(UsersModel.save.calledWith(expected))
          test.end()
        })
    })

    updateUserTest.end()
  })

  serviceTest.test('updateUserRoles should', updateUserRolesTest => {
    updateUserRolesTest.test('throw NotFoundError if user does not exist', test => {
      const userId = Uuid()
      UsersModel.getById.withArgs(userId).returns(P.resolve(null))

      SecurityService.updateUserRoles(userId, [])
        .then(() => test.fail('Expected error'))
        .catch(Errors.NotFoundError, e => {
          test.equal(e.message, 'User does not exist')
          test.end()
        })
        .catch(() => test.fail('Expected NotFoundError'))
    })

    updateUserRolesTest.test('remove existing user roles', test => {
      const userId = Uuid()
      UsersModel.getById.returns(P.resolve({}))
      const roles = [{ permissions: '' }, { permissions: '' }]
      RolesModel.getUserRoles.withArgs(userId).returns(P.resolve(roles))

      SecurityService.updateUserRoles(userId, [])
        .then(() => {
          test.ok(RolesModel.removeUserRoles.calledWith(userId))
          test.end()
        })
    })

    updateUserRolesTest.test('add each new role to userRoles', test => {
      const userId = Uuid()
      const role1 = Uuid()
      const role2 = Uuid()

      UsersModel.getById.returns(P.resolve({}))
      const roles = [{ permissions: '' }, { permissions: '' }]
      RolesModel.getUserRoles.withArgs(userId).returns(P.resolve(roles))

      SecurityService.updateUserRoles(userId, [ role1, role2 ])
        .then(() => {
          test.ok(RolesModel.addUserRole.calledWith({ userId, roleId: role1 }))
          test.ok(RolesModel.addUserRole.calledWith({ userId, roleId: role2 }))
          test.end()
        })
    })

    updateUserRolesTest.test('return users roles', test => {
      const userId = Uuid()
      UsersModel.getById.returns(P.resolve({}))
      const roles = [{ permissions: '' }, { permissions: '' }]
      RolesModel.getUserRoles.withArgs(userId).returns(P.resolve(roles))
      SecurityService.updateUserRoles(userId, [])
        .then(result => {
          test.deepEqual(result, roles)
          test.end()
        })
    })

    updateUserRolesTest.end()
  })
  serviceTest.end()
})
