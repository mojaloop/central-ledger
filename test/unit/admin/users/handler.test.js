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

  handlerTest.test('create should createUser in service', async function (test) {
    const user = {firstName: 'dave'}

    SecurityService.createUser.returns(P.resolve(user))

    const request = {
      payload: user
    }

    const response = await Handler.create(request, {})
    test.equal(response, user)
    test.ok(Sidecar.logRequest.calledWith(request))
    test.end()
  })

  handlerTest.test('getAll should get all users from service', async function (test) {
    const users = [{}, {}]
    SecurityService.getAllUsers.returns(P.resolve(users))

    const response = await Handler.getAll({}, {})
    test.equal(response, users)
    test.end()
  })

  handlerTest.test('getById should get user by id from service', async function (test) {
    const user = {firstName: 'Dave'}
    const userId = Uuid()
    SecurityService.getUserById.withArgs(userId).returns(P.resolve(user))

    const response = await Handler.getById({params: {id: userId}}, {})
    test.equal(response, user)
    test.end()
  })

  handlerTest.test('remove should deleteUser in service and return empty', async function (test) {
    const userId = Uuid()

    SecurityService.deleteUser.returns(P.resolve({}))

    const request = {params: {id: userId}}

    const response = await Handler.remove(request, {})
    test.deepEqual(response, {})
    test.ok(Sidecar.logRequest.calledWith(request))
    test.ok(SecurityService.deleteUser.calledWith(userId))
    test.end()
  })

  handlerTest.test('update should update user by id', async function (test) {
    const userId = Uuid()
    const details = {firstName: 'Dave'}
    const user = {lastName: 'Superuser'}

    SecurityService.updateUser.returns(P.resolve(user))
    const request = {
      params: {id: userId},
      payload: details
    }

    const response = await Handler.update(request, {})
    test.deepEqual(response, user)
    test.ok(Sidecar.logRequest.calledWith(request))
    test.ok(SecurityService.updateUser.calledWith(userId, details))
    test.end()
  })

  handlerTest.test('getRoles should return roles from service', async function (test) {
    const roles = [{}, {}]
    const userId = Uuid()
    SecurityService.getUserRoles.withArgs(userId).returns(P.resolve(roles))

    const response = await Handler.getRoles({params: {id: userId}}, {})
    test.deepEqual(response, roles)
    test.end()
  })

  handlerTest.test('updateRoles should update roles in service', async function (test) {
    const updatedRoles = [{}, {}]
    const roleIds = [Uuid(), Uuid()]
    const userId = Uuid()

    SecurityService.updateUserRoles.withArgs(userId, roleIds).returns(P.resolve(updatedRoles))
    const request = {
      params: {id: userId},
      payload: roleIds
    }

    const response = await Handler.updateRoles(request, {})
    test.deepEqual(response, updatedRoles)
    test.ok(Sidecar.logRequest.calledWith(request))
    test.end()
  })

  handlerTest.end()
})

