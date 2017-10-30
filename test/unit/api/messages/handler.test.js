'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Handler = require('../../../../src/api/messages/handler')
const Validator = require('../../../../src/api/messages/validator')
const Events = require('../../../../src/lib/events')
const Sidecar = require('../../../../src/lib/sidecar')

Test('Message Handler', handlerTest => {
  let sandbox

  handlerTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Validator, 'validate')
    sandbox.stub(Events, 'sendMessage')
    sandbox.stub(Sidecar, 'logRequest')
    Validator.validate.returns(P.resolve({}))
    test.end()
  })

  handlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  handlerTest.test('sendMessage should', sendTest => {
    sendTest.test('respond with error if validator fails', test => {
      const error = new Error()
      Validator.validate.returns(P.reject(error))

      Handler.sendMessage({}, (response) => {
        test.equal(response, error)
        test.end()
      })
    })

    sendTest.test('send message', test => {
      const message = {
        to: '',
        from: '',
        data: {}
      }
      const request = {
        payload: message
      }
      Validator.validate.withArgs(request.payload).returns(P.resolve(message))
      Handler.sendMessage(request, () => {
        test.ok(Events.sendMessage.calledWith(message))
        test.ok(Sidecar.logRequest.calledWith(request))
        return {
          code: () => {
            test.end()
          }
        }
      })
    })

    sendTest.test('reply with 201', test => {
      const reply = (response) => {
        return {
          code: (statusCode) => {
            test.notOk(response)
            test.equal(statusCode, 201)
            test.end()
          }
        }
      }
      Handler.sendMessage({}, reply)
    })

    sendTest.end()
  })

  handlerTest.end()
})
