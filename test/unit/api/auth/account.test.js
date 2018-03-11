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

  authTest.test('scheme should be simple', test => {
    test.equal(AccountAuth.scheme, 'simple')
    test.end()
  })

  authTest.test('validate should', validateTest => {
    validateTest.test('return false if password missing', async function (test) {
      const response = await AccountAuth.validate({}, 'username', '', {})
      test.notOk(response.credentials)
      test.equal(response.isValid, false)
      test.end()
    })

    validateTest.test('return false if password cannot be verified', async function (test) {
      const name = 'name'
      const password = 'password'
      AccountService.verify.withArgs(name, password).returns(P.reject({}).catch(() => { console.log('error occurred') }))
      const response = await AccountAuth.validate({}, name, password, {})
      test.notOk(response.credentials)
      test.equal(response.isValid, false)
      test.end()
    })

    validateTest.test('return true if user is configured admin', async function (test) {
      const adminName = 'admin'
      const adminSecret = 'admin'
      Config.ADMIN_KEY = adminName
      Config.ADMIN_SECRET = adminSecret
      const response = await AccountAuth.validate({}, adminName, adminSecret, {})
      test.equal(response.isValid, true)
      test.equal(response.credentials.is_admin, true)
      test.equal(response.credentials.name, adminName)
      test.equal(await AccountService.verify.callCount, 0)
      test.end()
    })

    validateTest.test('return true and account if password verified', async function (test) {
      const name = 'name'
      const password = 'password'
      const account = { name, password }
      AccountService.verify.withArgs(name, password).returns(P.resolve(account))
      const response = await AccountAuth.validate({}, name, password, {})
      test.equal(response.isValid, true)
      test.equal(response.credentials, account)
      test.end()
    })

    validateTest.end()
  })

  authTest.end()
})
