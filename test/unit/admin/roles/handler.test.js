'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const SecurityService = require('../../../../src/domain/security')
const Handler = require('../../../../src/admin/roles/handler')
const Sidecar = require('../../../../src/lib/sidecar')

Test('Security handler', handlerTest => {
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

  handlerTest.test('getRoles should', getRolesTest => {
    getRolesTest.test('return roles from SecurityService', async function (test) {
      const roles = [{name: 'role1'}, {name: 'role2'}]
      SecurityService.getAllRoles.returns(P.resolve(roles))
      const response = await Handler.getRoles({}, {})
      test.deepEqual(response, roles)
      test.end()
    })

    getRolesTest.test('return error if SecurityService getAllRoles throws', async function (test) {
      const error = new Error()
      SecurityService.getAllRoles.returns(P.reject(error))
      try {
        await Handler.getRoles({}, {})
      } catch (e) {
        test.deepEqual(e, error)
        test.end()
      }
    })

    getRolesTest.end()
  })

  handlerTest.test('createRole should', createTest => {
    createTest.test('create role in SecurityService', async function (test) {
      const role = {name: 'test', permissions: ['PERMISSION1', 'PERMISSION2']}
      SecurityService.createRole.withArgs(role).returns(P.resolve(role))

      const request = {
        payload: role
      }

      const response = await Handler.createRole(request, {})
      test.deepEqual(response, role)
      test.ok(Sidecar.logRequest.calledWith(request))
      test.end()
    })

    createTest.end()
  })

  handlerTest.test('updateRole should', updateTest => {
    updateTest.test('update role in SecurityService', async function (test) {
      const roleId = Uuid()
      const role = {roleId, name: 'test', permissions: ['PERMISSION1', 'PERMISSION2']}
      const payload = {name: 'test'}
      SecurityService.updateRole.withArgs(roleId, payload).returns(P.resolve(role))

      const request = {
        payload,
        params: {
          id: roleId
        }
      }

      const response = await Handler.updateRole(request, {})
      test.deepEqual(response, role)
      test.ok(Sidecar.logRequest.calledWith(request))
      test.end()
    })

    updateTest.end()
  })

  handlerTest.test('deleteRole should', deleteTest => {
    deleteTest.test('delete role in security service and return 204', async function (test) {
      const roleId = Uuid()
      SecurityService.deleteRole.withArgs(roleId).returns(P.resolve())

      const request = {
        params: {id: roleId}
      }

      const reply = {
        response: (output) => {
          test.notOk(output)
          test.ok(Sidecar.logRequest.calledWith(request))
          return {
            code: statusCode => {
              test.equal(statusCode, 204)
              test.end()
            }
          }
        }
      }

      await Handler.deleteRole(request, reply)
    })

    deleteTest.test('reply with error if SecurityService throws', async function (test) {
      const error = new Error()
      SecurityService.deleteRole.returns(P.reject(error))

      const request = {
        params: {id: Uuid()}
      }

      try {
        await Handler.deleteRole(request, {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    deleteTest.end()
  })

  handlerTest.end()
})
