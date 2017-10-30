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
    getRolesTest.test('return roles from SecurityService', test => {
      const roles = [{ name: 'role1' }, { name: 'role2' }]
      SecurityService.getAllRoles.returns(P.resolve(roles))
      const reply = (response) => {
        test.deepEqual(response, roles)
        test.end()
      }

      Handler.getRoles({}, reply)
    })

    getRolesTest.test('return error if SecurityService getAllRoles throws', test => {
      const error = new Error()
      SecurityService.getAllRoles.returns(P.reject(error))
      const reply = (response) => {
        test.deepEqual(response, error)
        test.end()
      }

      Handler.getRoles({}, reply)
    })

    getRolesTest.end()
  })

  handlerTest.test('createRole should', createTest => {
    createTest.test('create role in SecurityService', test => {
      const role = { name: 'test', permissions: ['PERMISSION1', 'PERMISSION2'] }
      SecurityService.createRole.withArgs(role).returns(P.resolve(role))

      const request = {
        payload: role
      }

      const reply = (response) => {
        test.deepEqual(response, role)
        test.ok(Sidecar.logRequest.calledWith(request))
        test.end()
      }

      Handler.createRole(request, reply)
    })

    createTest.end()
  })

  handlerTest.test('updateRole should', updateTest => {
    updateTest.test('update role in SecurityService', test => {
      const roleId = Uuid()
      const role = { roleId, name: 'test', permissions: ['PERMISSION1', 'PERMISSION2'] }
      const payload = { name: 'test' }
      SecurityService.updateRole.withArgs(roleId, payload).returns(P.resolve(role))

      const request = {
        payload,
        params: {
          id: roleId
        }
      }

      const reply = (response) => {
        test.deepEqual(response, role)
        test.ok(Sidecar.logRequest.calledWith(request))
        test.end()
      }

      Handler.updateRole(request, reply)
    })

    updateTest.end()
  })

  handlerTest.test('deleteRole should', deleteTest => {
    deleteTest.test('delete role in security service and return 204', test => {
      const roleId = Uuid()
      SecurityService.deleteRole.withArgs(roleId).returns(P.resolve())

      const request = {
        params: { id: roleId }
      }

      const reply = response => {
        test.notOk(response)
        test.ok(Sidecar.logRequest.calledWith(request))
        return {
          code: statusCode => {
            test.equal(statusCode, 204)
            test.end()
          }
        }
      }

      Handler.deleteRole(request, reply)
    })

    deleteTest.test('reply with error if SecurityService throws', test => {
      const error = new Error()
      SecurityService.deleteRole.returns(P.reject(error))

      const reply = response => {
        test.equal(response, error)
        test.end()
      }

      const request = {
        params: { id: Uuid() }
      }

      Handler.deleteRole(request, reply)
    })

    deleteTest.end()
  })

  handlerTest.end()
})
