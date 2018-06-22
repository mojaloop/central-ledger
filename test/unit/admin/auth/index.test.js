'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Config = require('../../../../src/lib/config')
const Permissions = require('../../../../src/domain/security/permissions')
const AdminStrategy = require('../../../../src/admin/auth/admin')
const TokenStrategy = require('../../../../src/admin/auth/token')

const AuthModule = require('../../../../src/admin/auth')

Test('Auth module', authTest => {
  let enableTokenAuth

  authTest.beforeEach(test => {
    enableTokenAuth = Config.ENABLE_TOKEN_AUTH
    test.end()
  })

  authTest.afterEach(test => {
    Config.ENABLE_TOKEN_AUTH = enableTokenAuth
    test.end()
  })

  authTest.test('should be named "admin auth"', test => {
    test.equal(AuthModule.plugin.name, 'admin auth')
    test.end()
  })

  authTest.test('register should', registerTest => {
    registerTest.test('add AdminStrategy to server auth strategies', async function (test) {
      const strategySpy = Sinon.spy()
      const server = {
        auth: {
          strategy: strategySpy
        }
      }

      await AuthModule.plugin.register(server, {}, {})
      test.ok(strategySpy.calledWith(AdminStrategy.scheme, 'basic', Sinon.match({ validate: AdminStrategy.validate })))
      test.end()
    })

    registerTest.test('add TokenStrategy to server auth strategies', test => {
      const strategySpy = Sinon.spy()
      const server = {
        auth: {
          strategy: strategySpy
        }
      }

      AuthModule.plugin.register(server, {}, {})
      test.ok(strategySpy.calledWith(TokenStrategy.scheme, 'hapi-now-auth', Sinon.match({ validate: TokenStrategy.validate })))
      test.end()
    })

    registerTest.end()
  })

  authTest.test('tokenAuth should', tokenAuthTest => {
    tokenAuthTest.test('return token if ENABLE_TOKEN_AUTH true and no permission', test => {
      Config.ENABLE_TOKEN_AUTH = true
      test.equal(AuthModule.tokenAuth(), TokenStrategy.name)
      test.end()
    })

    tokenAuthTest.test('return false if ENABLE_TOKEN_AUTH is false', test => {
      Config.ENABLE_TOKEN_AUTH = false
      test.equal(AuthModule.tokenAuth(), false)
      test.end()
    })

    tokenAuthTest.test('return token auth and permission scope if permission provided', test => {
      Config.ENABLE_TOKEN_AUTH = true
      const permission = Permissions.PARTICIPANTS_LIST
      const result = AuthModule.tokenAuth(permission)

      test.deepEqual(result, { strategy: TokenStrategy.name, scope: permission.key })

      test.end()
    })
    tokenAuthTest.end()
  })

  authTest.end()
})
