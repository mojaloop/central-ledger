'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const SecurityService = require('../../../../src/domain/security')
const Handler = require('../../../../src/admin/users/handler')
const Sidecar = require('../../../../src/lib/sidecar')

Test('User handler', handlerTest => {
  let sandbox

  handlerTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(SecurityService)
    sandbox.stub(Sidecar, 'logRequest')
    test.end()
  })

  handlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  handlerTest.test('create should createUser in service', test => {
    const user = { firstName: 'dave' }

    SecurityService.createUser.returns(P.resolve(user))

    const request = {
      payload: user
    }

    const reply = (response) => {
      test.equal(response, user)
      test.ok(Sidecar.logRequest.calledWith(request))
      test.end()
    }

    Handler.create(request, reply)
  })

  handlerTest.test('getAll should get all users from service', test => {
    const users = [{}, {}]
    SecurityService.getAllUsers.returns(P.resolve(users))

    const reply = (response) => {
      test.equal(response, users)
      test.end()
    }

    Handler.getAll({}, reply)
  })

  handlerTest.test('getById should get user by id from service', test => {
    const user = { firstName: 'Dave' }
    const userId = Uuid()
    SecurityService.getUserById.withArgs(userId).returns(P.resolve(user))

    const reply = (response) => {
      test.equal(response, user)
      test.end()
    }

    Handler.getById({ params: { id: userId } }, reply)
  })

  handlerTest.test('remove should deleteUser in service and return empty', test => {
    const userId = Uuid()

    SecurityService.deleteUser.returns(P.resolve({}))

    const request = { params: { id: userId } }
    const reply = (response) => {
      test.deepEqual(response, {})
      test.ok(Sidecar.logRequest.calledWith(request))
      test.ok(SecurityService.deleteUser.calledWith(userId))
      test.end()
    }

    Handler.remove(request, reply)
  })

  handlerTest.test('update should update user by id', test => {
    const userId = Uuid()
    const details = { firstName: 'Dave' }
    const user = { lastName: 'Superuser' }

    SecurityService.updateUser.returns(P.resolve(user))
    const request = {
      params: { id: userId },
      payload: details
    }

    const reply = (response) => {
      test.deepEqual(response, user)
      test.ok(Sidecar.logRequest.calledWith(request))
      test.ok(SecurityService.updateUser.calledWith(userId, details))
      test.end()
    }

    Handler.update(request, reply)
  })

  handlerTest.test('getRoles should return roles from service', test => {
    const roles = [{}, {}]
    const userId = Uuid()
    SecurityService.getUserRoles.withArgs(userId).returns(P.resolve(roles))

    const reply = (response) => {
      test.deepEqual(response, roles)
      test.end()
    }

    Handler.getRoles({ params: { id: userId } }, reply)
  })

  handlerTest.test('updateRoles should update roles in service', test => {
    const updatedRoles = [{}, {}]
    const roleIds = [Uuid(), Uuid()]
    const userId = Uuid()

    SecurityService.updateUserRoles.withArgs(userId, roleIds).returns(P.resolve(updatedRoles))

    const reply = (response) => {
      test.deepEqual(response, updatedRoles)
      test.ok(Sidecar.logRequest.calledWith(request))
      test.end()
    }

    const request = {
      params: { id: userId },
      payload: roleIds
    }

    Handler.updateRoles(request, reply)
  })

  handlerTest.end()
})

