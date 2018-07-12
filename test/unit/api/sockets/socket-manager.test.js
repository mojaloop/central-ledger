'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const EventEmitter = require('events').EventEmitter
const SocketManager = require('../../../../src/api/sockets/socketManager')
const RequestLogger = require('../../../../src/lib/requestLogger')

Test('SocketManager', managerTest => {
  let manager
  let sandbox

  managerTest.beforeEach(test => {
    manager = SocketManager.create()
    sandbox = Sinon.createSandbox()
    sandbox.stub(RequestLogger, 'logWebsocket')
    test.end()
  })

  managerTest.afterEach(test => {
    manager = null
    sandbox.restore()
    test.end()
  })

  managerTest.test('add should', addTest => {
    addTest.test('add socket to socket listeners', test => {
      const participantName = 'http://test/participants/dfsp1'
      const socket = Sinon.stub()
      socket.once = Sinon.spy()
      test.deepEqual(manager._sockets, [])
      manager.add(socket, participantName)
      test.deepEqual(manager._sockets, [socket])
      test.end()
    })

    addTest.test('add multiple participant to socket', test => {
      const participantUris = ['one', 'two', 'three']
      const socket = {
        once: Sinon.spy()
      }

      test.deepEqual(manager._sockets, [])
      test.notOk(socket.participant)

      manager.add(socket, ...participantUris)
      test.deepEqual(manager._sockets, [socket])
      test.deepEqual(socket.participant, participantUris)
      test.end()
    })

    addTest.test('close socket if participant length is 0', test => {
      const participant = ['one', 'two', 'three']
      let closeCallCount = 0
      const socket = new EventEmitter()
      socket.close = () => {
        socket.emit('close')
        closeCallCount++
      }

      manager.add(socket, ...participant)
      test.deepEqual(manager._sockets, [socket])
      test.deepEqual(socket.participant, participant)

      manager.add(socket, ...[])
      test.deepEqual(manager._sockets, [])
      test.equal(closeCallCount, 1)
      test.end()
    })

    addTest.test('not add socket if previously added', test => {
      const participantName = 'http://test/participants/dfsp1'
      const socket = Sinon.stub()
      socket.once = Sinon.spy()
      test.deepEqual(manager._sockets, [])
      manager.add(socket, participantName)
      test.deepEqual(manager._sockets, [socket])
      manager.add(socket, participantName)
      test.deepEqual(manager._sockets, [socket])
      test.end()
    })

    addTest.test('listen to close event of added socket', test => {
      const participantName = 'http://test/participants/dfsp1'
      const socket = Sinon.stub()
      socket.once = Sinon.spy()
      manager.add(socket, participantName)
      test.ok(socket.once.calledWith('close'))
      test.end()
    })

    addTest.test('remove socket when closed', test => {
      const participantName = 'http://test/participants/dfsp1'
      const socket = new EventEmitter()
      manager.add(socket, participantName)
      test.deepEqual(manager._sockets, [socket])
      socket.emit('close')
      test.deepEqual(manager._sockets, [])
      test.end()
    })

    addTest.end()
  })

  managerTest.test('send should', sendTest => {
    sendTest.test('send message to each connected socket', test => {
      const participantName = 'http://test/participants/dfsp1'
      const message = { value: 'message' }
      const socket = {
        once: Sinon.spy(),
        send: Sinon.spy()
      }

      manager.add(socket, participantName)
      test.equal(socket.send.called, false)

      manager.send(participantName, message)
      test.ok(socket.send.calledWith(Sinon.match(JSON.stringify(message))))
      test.end()
    })

    sendTest.test('not send message to wrong participant', test => {
      const participantName = 'http://test/participants/dfsp1'
      const wrongParticipantName = participantName + '1'
      const socket = {
        once: Sinon.spy(),
        send: Sinon.spy()
      }

      manager.add(socket, participantName)
      test.equal(socket.send.called, false)
      manager.send(wrongParticipantName, {})
      test.equal(socket.send.called, false)
      test.end()
    })

    sendTest.test('log sent message', test => {
      const name = 'http://test/participants/dfsp1'
      const message = { value: 'message' }
      const socket = {
        once: Sinon.spy(),
        send: Sinon.spy()
      }

      manager.add(socket, name)
      test.equal(socket.send.called, false)

      manager.send(name, message)

      const logArgs = RequestLogger.logWebsocket.firstCall.args[0]

      test.equal(logArgs, JSON.stringify({ name, message }))
      test.end()
    })

    sendTest.end()
  })

  managerTest.end()
})
