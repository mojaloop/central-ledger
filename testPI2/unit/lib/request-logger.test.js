'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Logger = require('@mojaloop/central-services-shared').Logger
const Util = require('util')
const RequestLogger = require('../../../src/lib/request-logger')

Test('logger', loggerTest => {
  let sandbox

  loggerTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Logger, 'info')
    sandbox.stub(Util, 'inspect')

    test.end()
  })

  loggerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  loggerTest.test('request should', requestTest => {
    requestTest.test('send info message to the serviceslogger', test => {
      const request = {
        headers: { traceid: '123456' },
        method: 'post',
        url: { path: '/participants' },
        query: { token: '1234' },
        body: 'this is the body'
      }
      RequestLogger.logRequest(request)
      test.ok(Logger.info.calledThrice)
      const args = Logger.info.firstCall.args
      const args2 = Logger.info.secondCall.args
      const args3 = Logger.info.thirdCall.args
      test.equal(args[0], `L1p-Trace-Id=${request.headers.traceid} - Method: ${request.method} Path: ${request.url.path} Query: ${JSON.stringify(request.query)}`)
      test.equal(args2[0], `L1p-Trace-Id=${request.headers.traceid} - Headers: ${JSON.stringify(request.headers)}`)
      test.equal(args3[0], `L1p-Trace-Id=${request.headers.traceid} - Body: ${request.body}`)
      test.end()
    })

    requestTest.test('not log body if not present', test => {
      const request = {
        headers: { traceid: '123456' },
        method: 'post',
        url: { path: '/participants' },
        query: { token: '1234' }
      }
      RequestLogger.logRequest(request)
      test.ok(Logger.info.calledTwice)
      test.end()
    })

    requestTest.end()
  })

  loggerTest.test('response should', responseTest => {
    responseTest.test('send info message to the serviceslogger', test => {
      const request = {
        headers: { traceid: '123456' },
        response: { source: 'this is the response', statusCode: '200' }
      }
      RequestLogger.logResponse(request)
      const args = Logger.info.firstCall.args
      test.equal(args[0], `L1p-Trace-Id=${request.headers.traceid} - Response: ${JSON.stringify(request.response.source)} Status: ${request.response.statusCode}`)
      test.end()
    })

    responseTest.test('not send info message to the serviceslogger', test => {
      const request = {
        headers: { traceid: '123456' }
      }
      RequestLogger.logResponse(request)
      test.notOk(Logger.info.called)
      test.end()
    })

    responseTest.test('use util.inspect if JSON.stringify throws', test => {
      const request = {
        headers: { traceid: '123456' },
        response: { source: { body: 'this is the response' }, statusCode: '200' }
      }
      request.response.source.circular = request.response
      RequestLogger.logResponse(request)
      const args = Util.inspect.firstCall.args
      test.equal(args[0], request.response.source)
      test.end()
    })
    responseTest.end()
  })

  loggerTest.test('websocket should', requestTest => {
    requestTest.test('send info message to the serviceslogger', test => {
      const request = {
        body: 'this is the body'
      }
      RequestLogger.logWebsocket(request)
      const args = Logger.info.firstCall.args
      test.equal(args[0], `Websocket: ${request}`)
      test.end()
    })
    requestTest.end()
  })

  loggerTest.end()
})
