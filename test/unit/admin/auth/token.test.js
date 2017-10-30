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
    validateTest.test('should yield error if token verification fails', test => {
      JWT.verify.returns(Promise.reject(new Error('Invalid token')))
      const cb = (err, verified) => {
        test.equal(err.message, 'Invalid token')
        test.equal(verified, false)
        test.end()
      }

      TokenAuth.validate({}, '', cb)
    })

    validateTest.test('should pass if token verification passes', test => {
      const userId = Uuid()
      const user = { userId }
      const roles = [{ permissions: ['ONE', 'TWO', 'THREE'] }, { permissions: ['ONE', 'FOUR', 'FIVE'] }]
      const token = 'some.jwt.token'
      JWT.verify.withArgs(token).returns(Promise.resolve({ user, roles }))

      const cb = (err, verified, credentials) => {
        test.notOk(err)
        test.equal(verified, true)
        test.deepEqual(credentials, { userId, scope: [ 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE' ] })
        test.end()
      }

      TokenAuth.validate({}, token, cb)
    })

    validateTest.end()
  })

  tokenTest.end()
})
