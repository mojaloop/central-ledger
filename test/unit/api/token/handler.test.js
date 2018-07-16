'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Handler = require('../../../../src/api/token/handler')
const TokenService = require('../../../../src/domain/token')
const Sidecar = require('../../../../src/lib/sidecar')

Test('token handler', handlerTest => {
  let sandbox

  handlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(TokenService)
    sandbox.stub(Sidecar, 'logRequest')
    test.end()
  })

  handlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  handlerTest.test('create should', createTest => {
    createTest.test('create token from auth credentials', async function (test) {
      const token = { token: 'token' }
      const participant = { participantId: 1 }
      TokenService.create.withArgs(participant).returns(P.resolve(token))
      const request = {
        auth: {
          credentials: participant
        }
      }

      const response = await Handler.create(request, {})
      test.equal(response, token)
      test.ok(Sidecar.logRequest.calledWith(request))
      test.end()
    })

    createTest.test('reply with error if thrown', async function (test) {
      const error = new Error()
      TokenService.create.returns(P.reject(error))
      try {
        await Handler.create({ auth: { credentials: {} } }, {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    createTest.end()
  })

  handlerTest.end()
})
