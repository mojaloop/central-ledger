'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const EventEmitter = require('events').EventEmitter
const WS = require('ws')
const Index = require('../../../../src/api/sockets')
const SocketManager = require('../../../../src/api/sockets/socketManager')
const Events = require('../../../../src/lib/events')
const WebSocket = require('../../../../src/api/sockets/websocket')
const ParticipantTransfers = require('../../../../src/api/sockets/participantTransfers')

const assertEvent = (assert, message, event, resource, relatedResources) => {
  assert.equal(message.jsonrpc, '2.0')
  assert.equal(message.id, null)
  assert.equal(message.method, 'notify')
  const params = message.params
  assert.equal(params.event, event)
  assert.ok(params.id)
  assert.deepEqual(params.resource, resource)
  if (relatedResources) {
    assert.deepEqual(params.related_resources, relatedResources)
  } else {
    assert.equal(params.hasOwnProperty('related_resources'), false)
  }
}

Test('Socket Module', moduleTest => {
  let sandbox
  let socketManager

  const mockServer = (listener = {}, serverTag = 'api') => {
    const server = {
      listener
    }
    return server
  }

  moduleTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(WS, 'Server')
    socketManager = {
      send: sandbox.stub()
    }
    sandbox.stub(SocketManager, 'create')
    sandbox.stub(Events)
    SocketManager.create.returns(socketManager)
    sandbox.stub(WebSocket, 'initialize')
    sandbox.stub(ParticipantTransfers, 'initialize')
    test.end()
  })

  moduleTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  moduleTest.test('register should', registerTest => {
    registerTest.test('create new instance of WS.Server', async function (test) {
      const listener = {}

      WS.Server.withArgs(Sinon.match({ server: listener })).returns(new EventEmitter())

      Index.plugin.register(mockServer(listener), {}, {})
      test.ok(WS.Server.called)
      test.end()
    })

    registerTest.test('listen for WS connection events', async function (test) {
      const wsServer = {
        on: sandbox.stub()
      }
      WS.Server.returns(wsServer)

      Index.plugin.register(mockServer(), {}, {})
      test.ok(wsServer.on.calledWith('connection'))
      test.end()
    })

    registerTest.test('Wire up event handlers', async function (test) {
      WS.Server.returns(new EventEmitter())
      Index.plugin.register(mockServer(), {}, {})
      test.ok(Events.onTransferExecuted.called)
      test.ok(Events.onTransferPrepared.called)
      test.end()
    })

    registerTest.end()
  })

  moduleTest.test('on socket connection should', connectionTest => {
    connectionTest.test('initialize WebSocket if url is /websocket', async function (test) {
      const ws = {
        upgradeReq: {
          url: '/websocket'
        }
      }
      const wsServer = new EventEmitter()
      WS.Server.returns(wsServer)
      Index.plugin.register(mockServer(), {}, {})
      wsServer.emit('connection', ws)
      test.ok(WebSocket.initialize.calledWith(ws, Sinon.match(socketManager)))
      test.notOk(ParticipantTransfers.initialize.called)
      test.end()
    })

    connectionTest.test('initialize ParticipantTransfers if url is not /websocket', async function (test) {
      const url = '/notwebsocket'
      const ws = {
        upgradeReq: {
          url
        }
      }
      const wsServer = new EventEmitter()
      WS.Server.returns(wsServer)

      Index.plugin.register(mockServer(), {}, {})
      wsServer.emit('connection', ws)
      test.ok(ParticipantTransfers.initialize.calledWith(ws, url, Sinon.match(socketManager)))
      test.notOk(WebSocket.initialize.called)
      test.end()
    })

    connectionTest.end()
  })

  moduleTest.test('Events should', async function (eventsTest) {
    eventsTest.beforeEach(test => {
      WS.Server.returns(new EventEmitter())
      test.end()
    })

    eventsTest.test('onTransferPrepared should do nothing if transfer credits and debits are empty', async function (test) {
      const message = { resource: {} }
      Events.onTransferPrepared.yields(message)
      Index.plugin.register(mockServer(), {}, {})
      test.equal(socketManager.send.callCount, 0)
      test.end()
    })

    eventsTest.test('onTransferPrepared should send message to socket manager for each participant', async function (test) {
      const creditParticipant = 'http://credit-participant'
      const debitParticipant = 'http://debit-participant'
      const transfer = {
        credits: [
          { participant: creditParticipant }
        ],
        debits: [
          { participant: debitParticipant }
        ]
      }
      const message = { resource: transfer }
      Events.onTransferPrepared.yields(message)
      Index.plugin.register(mockServer(), {}, {})
      const creditParticipantSendArgs = socketManager.send.firstCall.args
      test.equal(creditParticipantSendArgs[0], creditParticipant)
      assertEvent(test, creditParticipantSendArgs[1], 'transfer.create', transfer)

      const debitParticipantSendArgs = socketManager.send.secondCall.args
      test.equal(debitParticipantSendArgs[0], debitParticipant)
      assertEvent(test, debitParticipantSendArgs[1], 'transfer.create', transfer)
      test.end()
    })

    eventsTest.test('onTransferExecuted should do nothing if transfer credits and debits are empty', async function (test) {
      const message = { resource: {} }
      Events.onTransferExecuted.yields(message)
      Index.plugin.register(mockServer(), {}, {})
      test.equal(socketManager.send.callCount, 0)
      test.end()
    })

    eventsTest.test('onTransferExecuted should send message to socket manager for each participant', async function (test) {
      const creditParticipant = 'http://credit-participant'
      const debitParticipant = 'http://debit-participant'
      const transfer = {
        credits: [
          { participant: creditParticipant }
        ],
        debits: [
          { participant: debitParticipant }
        ]
      }
      const relatedResources = { execution_condition_fulfillment: 'aaaa' }
      const message = { resource: transfer, related_resources: relatedResources }
      Events.onTransferExecuted.yields(message)
      Index.plugin.register(mockServer(), {}, {})
      const creditParticipantSendArgs = socketManager.send.firstCall.args
      test.equal(creditParticipantSendArgs[0], creditParticipant)
      assertEvent(test, creditParticipantSendArgs[1], 'transfer.update', transfer, relatedResources)

      const debitParticipantSendArgs = socketManager.send.secondCall.args
      test.equal(debitParticipantSendArgs[0], debitParticipant)
      assertEvent(test, debitParticipantSendArgs[1], 'transfer.update', transfer, relatedResources)
      test.end()
    })

    eventsTest.test('onTransferRejected should do nothing if transfer credits and debits are empty', async function (test) {
      const message = { resource: {} }
      Events.onTransferRejected.yields(message)
      Index.plugin.register(mockServer(), {}, {})
      test.equal(socketManager.send.callCount, 0)
      test.end()
    })

    eventsTest.test('onTransferRejected should send message to socket manager for each participant', async function (test) {
      const creditParticipant = 'http://credit-participant'
      const debitParticipant = 'http://debit-participant'
      const transfer = {
        credits: [
          { participant: creditParticipant }
        ],
        debits: [
          { participant: debitParticipant }
        ]
      }
      const message = { resource: transfer }
      Events.onTransferRejected.yields(message)
      Index.plugin.register(mockServer(), {}, {})
      const creditParticipantSendArgs = socketManager.send.firstCall.args
      test.equal(creditParticipantSendArgs[0], creditParticipant)
      assertEvent(test, creditParticipantSendArgs[1], 'transfer.update', transfer)

      const debitParticipantSendArgs = socketManager.send.secondCall.args
      test.equal(debitParticipantSendArgs[0], debitParticipant)
      assertEvent(test, debitParticipantSendArgs[1], 'transfer.update', transfer)
      test.end()
    })

    eventsTest.test('onMessageSent should send message to socket manager for to participant', async function (test) {
      const toParticipant = 'http://to-participant'
      const fromParticipant = 'http://from-participant'
      const data = { something: 'test' }
      const message = {
        to: toParticipant,
        from: fromParticipant,
        data
      }
      Events.onMessageSent.yields(message)
      Index.plugin.register(mockServer(), {}, {})
      const args = socketManager.send.firstCall.args
      test.equal(args[0], toParticipant)
      assertEvent(test, args[1], 'message.send', message)
      test.end()
    })

    eventsTest.end()
  })

  moduleTest.end()
})
