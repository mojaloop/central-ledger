'use strict'

const Test = require('tapes')(require('tape'))
const Config = require('../../../../src/lib/config')
const AdminAuth = require('../../../../src/admin/auth/admin')

const invalid = (test) => {
  return (err, isValid) => {
    test.notOk(err)
    test.equal(isValid, false)
    test.end()
  }
}

Test('admin auth module', authTest => {
  let originalAdminKey
  let originalAdminSecret

  authTest.beforeEach(test => {
    originalAdminKey = Config.ADMIN_KEY
    originalAdminSecret = Config.ADMIN_SECRET
    test.end()
  })

  authTest.afterEach(test => {
    Config.ADMIN_KEY = originalAdminKey
    Config.ADMIN_SECRET = originalAdminSecret
    test.end()
  })

  authTest.test('name should be admin', test => {
    test.equal(AdminAuth.name, 'admin')
    test.end()
  })

  authTest.test('scheme should be basic', test => {
    test.equal(AdminAuth.scheme, 'basic')
    test.end()
  })

  authTest.test('validate should', validateTest => {
    validateTest.test('return false if config admin_key not set', test => {
      Config.ADMIN_SECRET = 'admin'

      AdminAuth.validate({}, 'admin', 'admin', invalid(test))
    })

    validateTest.test('return false if config admin_secret not set', test => {
      Config.ADMIN_KEY = 'admin'

      AdminAuth.validate({}, 'admin', 'admin', invalid(test))
    })

    validateTest.test('return false if admin key or secret is empty string', test => {
      Config.ADMIN_KEY = ''
      Config.ADMIN_SECRET = ''

      AdminAuth.validate({}, '', '', invalid(test))
    })

    validateTest.test('return false if username does not equal admin key', test => {
      Config.ADMIN_KEY = 'admin'
      Config.ADMIN_SECRET = 'admin'

      AdminAuth.validate({}, 'ADMIN', 'admin', invalid(test))
    })

    validateTest.test('return false if username does not equal admin key', test => {
      Config.ADMIN_KEY = 'admin'
      Config.ADMIN_SECRET = 'admin'

      AdminAuth.validate({}, 'admin', 'ADMIN', invalid(test))
    })

    validateTest.test('return is_admin if username matches admin key and password matches admin secret', test => {
      const adminKey = 'some key'
      const adminSecret = 'some secret'

      Config.ADMIN_KEY = adminKey
      Config.ADMIN_SECRET = adminSecret

      const cb = (err, isValid, credentials) => {
        test.notOk(err)
        test.equal(isValid, true)
        test.ok(credentials)
        test.equal(credentials.is_admin, true)
        test.end()
      }

      AdminAuth.validate({}, adminKey, adminSecret, cb)
    })

    validateTest.end()
  })

  authTest.end()
})
