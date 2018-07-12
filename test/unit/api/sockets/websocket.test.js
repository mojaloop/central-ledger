'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const EventEmitter = require('events').EventEmitter
const SocketValidator = require('../../../../src/api/sockets/validator')
const WebSocket = require('../../../../src/api/sockets/websocket')
const RequestLogger = require('../../../../src/lib/requestLogger')

Test('WebSocket', socketTest => {
  let sandbox
  let socketManager

  socketTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(SocketValidator, 'validateSubscriptionRequest')
    sandbox.stub(RequestLogger, 'logWebsocket')
    socketManager = {
      add: sandbox.spy()
    }
    test.end()
  })

  socketTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  const createSocket = () => {
    return {
      on: sandbox.spy(),
      send: sandbox.spy()
    }
  }

  socketTest.test('initialize should', initializeTest => {
    initializeTest.test('respond with connect message', test => {
      const socket = createSocket()

      WebSocket.initialize(socket, socketManager)
      const sendArgs = JSON.parse(socket.send.firstCall.args[0])

      test.equal(sendArgs.id, null)
      test.equal(sendArgs.jsonrpc, '2.0')
      test.equal(sendArgs.method, 'connect')
      test.end()
    })

    initializeTest.test('listen for incoming messages on socket', test => {
      const socket = createSocket()

      WebSocket.initialize(socket, socketManager)

      test.ok(socket.on.calledWith('message'))
      test.end()
    })

    initializeTest.test('send error and close socket if subscription request is not valid', test => {
      const socket = new EventEmitter()
      socket.send = sandbox.spy()
      socket.close = sandbox.spy()
      const validationError = {
        payload: {
          id: 'ValidationError',
          message: 'Something bad'
        }
      }

      const request = 'some bad request'
      SocketValidator.validateSubscriptionRequest.withArgs(request).yields(validationError)

      WebSocket.initialize(socket, socketManager)

      socket.emit('message', request)
      test.ok(socket.send.calledWith(JSON.stringify(validationError.payload)))
      test.ok(socket.close.calledOnce)
      test.end()
    })

    initializeTest.test('reply to socket on valid request', test => {
      const socket = new EventEmitter()
      const id = 100
      const jsonrpc = 'jsonrpc'
      const participantUris = ['', '']
      socket.send = sandbox.spy()
      socket.close = sandbox.spy()
      const request = 'some request'
      SocketValidator.validateSubscriptionRequest.withArgs(request).yields(null, { id, jsonrpc, participantUris })

      WebSocket.initialize(socket, socketManager)
      socket.emit('message', request)

      test.ok(socket.send.calledWith(JSON.stringify({ id, jsonrpc, result: participantUris.length })))
      test.notOk(socket.close.called)
      test.end()
    })

    initializeTest.test('add socket to participant listener if more than on participant listed', test => {
      const socket = new EventEmitter()
      socket.send = sandbox.spy()
      const participantUris = ['', '']
      SocketValidator.validateSubscriptionRequest.yields(null, { id: 1, jsonrpc: '2.0', participantUris })

      WebSocket.initialize(socket, socketManager)
      socket.emit('message', 'some request')

      test.ok(socketManager.add.calledWith(socket, ...participantUris))
      test.end()
    })

    initializeTest.test('log out websocket request', test => {
      const socket = new EventEmitter()
      const id = 100
      const jsonrpc = 'jsonrpc'
      const participantUris = ['', '']
      socket.send = sandbox.spy()
      socket.close = sandbox.spy()
      const request = 'some request'
      SocketValidator.validateSubscriptionRequest.withArgs(request).yields(null, { id, jsonrpc, participantUris })

      WebSocket.initialize(socket, socketManager)
      socket.emit('message', request)

      const logArgs = RequestLogger.logWebsocket.firstCall.args[0]

      test.equal(logArgs, request)
      test.end()
    })

    initializeTest.end()
  })

  socketTest.end()
})
