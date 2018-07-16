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
    sandbox = Sinon.createSandbox()
    sandbox.stub(JWT)
    sandbox.stub(Sidecar, 'logRequest')
    test.end()
  })

  handlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  handlerTest.test('create should', createTest => {
    createTest.test('create token from party key', async function (test) {
      const userKey = 'party-key'
      const participant = { participantId: 1 }
      const token = 'generated-token'
      JWT.create.withArgs(userKey).returns(P.resolve(token))
      const request = {
        auth: {
          credentials: participant
        },
        payload: {
          key: userKey
        }
      }

      const response = await Handler.create(request, {})
      test.deepEqual(response, token)
      test.ok(Sidecar.logRequest.calledWith(request))
      test.end()
    })

    createTest.test('reply with error if thrown', async function (test) {
      const error = new Error()
      JWT.create.returns(P.reject(error))

      try {
        await Handler.create({ auth: { credentials: {} }, payload: { key: 'key' } }, {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    createTest.end()
  })

  handlerTest.end()
})
