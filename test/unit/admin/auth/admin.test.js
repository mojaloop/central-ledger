'use strict'

const Test = require('tapes')(require('tape'))
const Config = require('../../../../src/lib/config')
const AdminAuth = require('../../../../src/admin/auth/admin')

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

  authTest.test('scheme should be simple', test => {
    test.equal(AdminAuth.scheme, 'simple')
    test.end()
  })

  authTest.test('validate should', validateTest => {
    validateTest.test('return false if config admin_key not set', async function (test) {
      Config.ADMIN_SECRET = 'admin'

      const response = await AdminAuth.validate({}, 'admin', 'admin', {})
      test.notOk(response.credentials)
      test.equal(response.isValid, false)
      test.end()
    })

    validateTest.test('return false if config admin_secret not set', async function (test) {
      Config.ADMIN_KEY = 'admin'

      const response = await AdminAuth.validate({}, 'admin', 'admin', {})
      test.notOk(response.credentials)
      test.equal(response.isValid, false)
      test.end()
    })

    validateTest.test('return false if admin key or secret is empty string', async function (test) {
      Config.ADMIN_KEY = ''
      Config.ADMIN_SECRET = ''

      const response = await AdminAuth.validate({}, '', '', {})
      test.notOk(response.credentials)
      test.equal(response.isValid, false)
      test.end()
    })

    validateTest.test('return false if username does not equal admin key', async function (test) {
      Config.ADMIN_KEY = 'admin'
      Config.ADMIN_SECRET = 'admin'

      const response = await AdminAuth.validate({}, 'ADMIN', 'admin', {})
      test.notOk(response.credentials)
      test.equal(response.isValid, false)
      test.end()
    })

    validateTest.test('return false if username does not equal admin key', async function (test) {
      Config.ADMIN_KEY = 'admin'
      Config.ADMIN_SECRET = 'admin'

      const response = await AdminAuth.validate({}, 'admin', 'ADMIN', {})
      test.notOk(response.credentials)
      test.equal(response.isValid, false)
      test.end()
    })

    validateTest.test('return is_admin if username matches admin key and password matches admin secret', async function (test) {
      const adminKey = 'some key'
      const adminSecret = 'some secret'

      Config.ADMIN_KEY = adminKey
      Config.ADMIN_SECRET = adminSecret

      const response = await AdminAuth.validate({}, adminKey, adminSecret, {})
      test.equal(response.isValid, true)
      test.ok(response.credentials)
      test.equal(response.credentials.is_admin, true)
      test.end()
    })

    validateTest.end()
  })

  authTest.end()
})
