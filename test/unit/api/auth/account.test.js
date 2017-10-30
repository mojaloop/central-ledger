'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Config = require('../../../../src/lib/config')
const AccountService = require('../../../../src/domain/account')
const AccountAuth = require('../../../../src/api/auth/account')
const Logger = require('@mojaloop/central-services-shared').Logger

Test('account auth module', authTest => {
  let sandbox

  authTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(AccountService)
    sandbox.stub(Logger)
    t.end()
  })

  authTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  authTest.test('name should be account', test => {
    test.equal(AccountAuth.name, 'account')
    test.end()
  })

  authTest.test('scheme should be basic', test => {
    test.equal(AccountAuth.scheme, 'basic')
    test.end()
  })

  authTest.test('validate should', validateTest => {
    validateTest.test('return false if password missing', test => {
      const cb = (err, isValid) => {
        test.notOk(err)
        test.equal(isValid, false)
        test.end()
      }

      AccountAuth.validate({}, 'username', '', cb)
    })

    validateTest.test('return false if password cannot be verified', test => {
      const name = 'name'
      const password = 'password'
      AccountService.verify.withArgs(name, password).returns(P.reject({}))

      const cb = (err, isValid) => {
        test.notOk(err)
        test.equal(isValid, false)
        test.end()
      }

      AccountAuth.validate({}, name, password, cb)
    })

    validateTest.test('return true if user is configured admin', test => {
      const adminName = 'admin'
      const adminSecret = 'admin'
      Config.ADMIN_KEY = adminName
      Config.ADMIN_SECRET = adminSecret

      const cb = (err, isValid, credentials) => {
        test.notOk(err)
        test.equal(isValid, true)
        test.equal(credentials.is_admin, true)
        test.equal(credentials.name, adminName)
        test.equal(AccountService.verify.callCount, 0)
        test.end()
      }

      AccountAuth.validate({}, adminName, adminSecret, cb)
    })

    validateTest.test('return true and account if password verified', test => {
      const name = 'name'
      const password = 'password'
      const account = { name, password }
      AccountService.verify.withArgs(name, password).returns(P.resolve(account))

      const cb = (err, isValid, credentials) => {
        test.notOk(err)
        test.equal(isValid, true)
        test.equal(credentials, account)
        test.end()
      }

      AccountAuth.validate({}, name, password, cb)
    })

    validateTest.end()
  })

  authTest.end()
})
