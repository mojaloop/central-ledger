'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const JWT = require('../../../../src/domain/security/jwt')
const Handler = require('../../../../src/admin/token/handler')
const Sidecar = require('../../../../src/lib/sidecar')

Test('token handler', handlerTest => {
  let sandbox

  handlerTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(JWT)
    sandbox.stub(Sidecar, 'logRequest')
    test.end()
  })

  handlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  handlerTest.test('create should', createTest => {
    createTest.test('create token from user key', test => {
      const userKey = 'user-key'
      const account = { accountId: 1 }
      const token = 'generated-token'
      JWT.create.withArgs(userKey).returns(P.resolve(token))
      const request = {
        auth: {
          credentials: account
        },
        payload: {
          key: userKey
        }
      }

      const reply = (response) => {
        test.deepEqual(response, { token })
        test.ok(Sidecar.logRequest.calledWith(request))
        test.end()
      }

      Handler.create(request, reply)
    })

    createTest.test('reply with error if thrown', test => {
      const error = new Error()
      JWT.create.returns(P.reject(error))

      const reply = (response) => {
        test.equal(response, error)
        test.end()
      }

      Handler.create({ auth: { credentials: {} }, payload: { key: 'key' } }, reply)
    })

    createTest.end()
  })

  handlerTest.end()
})
