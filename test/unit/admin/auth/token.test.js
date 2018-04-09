'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Promise = require('bluebird')
const Uuid = require('uuid4')
const JWT = require('../../../../src/domain/security/jwt')
const TokenAuth = require('../../../../src/admin/auth/token')

Test('token auth strategy', tokenTest => {
  let sandbox

  tokenTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(JWT)
    test.end()
  })

  tokenTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  tokenTest.test('validate should', validateTest => {
    validateTest.test('should yield error if token verification fails', async function (test) {
      await JWT.verify.returns(Promise.reject(new Error('Invalid token')))
      const response = await TokenAuth.validate({}, '', {})
      test.equal(response.e.message, 'Invalid token')
      test.equal(response.verified, false)
      test.end()
    })

    validateTest.test('should yield error if token verification fails', async function (test) {
      await JWT.verify.returns(Promise.resolve(null))
      const response = await TokenAuth.validate({}, '', {})
      test.equal(response.e.message, 'Invalid token')
      test.equal(response.verified, false)
      test.end()
    })

    validateTest.test('should pass if token verification passes', async function (test) {
      const userId = Uuid()
      const user = { userId }
      const roles = [{ permissions: ['ONE', 'TWO', 'THREE'] }, { permissions: ['ONE', 'FOUR', 'FIVE'] }]
      const token = 'some.jwt.token'
      await JWT.verify.withArgs(token).returns(Promise.resolve({ user, roles }))

      const response = await TokenAuth.validate({}, token, {})
      test.equal(response.isValid, true)
      test.deepEqual(response.credentials, { userId, scope: [ 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE' ] })
      test.end()
    })

    validateTest.end()
  })

  tokenTest.end()
})
