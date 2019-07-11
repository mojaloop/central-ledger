'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const TransferObjectTransform = require('../../../src/domain/transfer/transform')
const EventsPath = '../../../src/lib/events'

Test('events', eventTest => {
  let sandbox
  let Events

  eventTest.beforeEach(t => {
    Events = require(EventsPath)
    sandbox = Sinon.createSandbox()
    sandbox.stub(TransferObjectTransform, 'toTransfer')
    t.end()
  })

  eventTest.afterEach(t => {
    delete require.cache[require.resolve(EventsPath)]
    sandbox.restore()
    t.end()
  })

  eventTest.test('emitTransferPrepared should', (emitTest) => {
    emitTest.test('publish transfer prepared event', (t) => {
      const spy = Sinon.spy()
      Events.onTransferPrepared(spy)
      const transfer = { id: 12 }
      TransferObjectTransform.toTransfer.returns(transfer)
      Events.emitTransferPrepared(transfer)
      t.ok(spy.calledWith({ resource: transfer }))
      t.end()
    })

    emitTest.test('not push transfer executed event', (t) => {
      const spy = Sinon.spy()
      Events.onTransferExecuted(spy)
      const transfer = { id: 12 }
      TransferObjectTransform.toTransfer.returns(transfer)
      Events.emitTransferPrepared({})
      t.notOk(spy.called)
      t.end()
    })

    emitTest.test('not push transfer rejected event', (t) => {
      const spy = Sinon.spy()
      Events.onTransferRejected(spy)
      const transfer = { id: 12 }
      TransferObjectTransform.toTransfer.returns(transfer)
      Events.emitTransferPrepared({})
      t.notOk(spy.called)
      t.end()
    })

    emitTest.end()
  })

  eventTest.test('emitTransferExecuted should', (emitTest) => {
    emitTest.test('publish transfer executed event', (t) => {
      const spy = Sinon.spy()
      Events.onTransferExecuted(spy)
      const transfer = { id: 12 }
      TransferObjectTransform.toTransfer.returns(transfer)
      const relatedResources = { execution_condition_fulfilment: 'oAKAAA' }
      Events.emitTransferExecuted(transfer, relatedResources)
      t.ok(spy.calledWith({ resource: transfer, related_resources: relatedResources }))
      t.end()
    })

    emitTest.test('not push transfer prepared event', (t) => {
      const spy = Sinon.spy()
      Events.onTransferPrepared(spy)
      const transfer = { id: 12 }
      TransferObjectTransform.toTransfer.returns(transfer)
      Events.emitTransferExecuted({})
      t.notOk(spy.called)
      t.end()
    })

    emitTest.test('not push transfer rejected event', (t) => {
      const spy = Sinon.spy()
      Events.onTransferRejected(spy)
      const transfer = { id: 12 }
      TransferObjectTransform.toTransfer.returns(transfer)
      Events.emitTransferExecuted({})
      t.notOk(spy.called)
      t.end()
    })

    emitTest.end()
  })

  eventTest.test('emitTransferRejected should', (emitTest) => {
    emitTest.test('publish transfer rejected event', (t) => {
      const spy = Sinon.spy()
      Events.onTransferRejected(spy)
      const transfer = { id: 12 }
      TransferObjectTransform.toTransfer.returns(transfer)
      const resource = { id: 12 }
      const relatedResources = { execution_condition_fulfilment: 'oAKAAA' }
      Events.emitTransferRejected(resource, relatedResources)
      t.ok(spy.calledWith({ resource: transfer, related_resources: relatedResources }))
      t.end()
    })

    emitTest.test('not push transfer prepared event', (t) => {
      const spy = Sinon.spy()
      Events.onTransferPrepared(spy)
      Events.emitTransferRejected({})
      t.notOk(spy.called)
      t.end()
    })

    emitTest.test('not push transfer executed event', (t) => {
      const spy = Sinon.spy()
      Events.onTransferExecuted(spy)
      Events.emitTransferRejected({})
      t.notOk(spy.called)
      t.end()
    })

    emitTest.end()
  })

  eventTest.test('sendMessage should', sendTest => {
    sendTest.test('publish message.send event', test => {
      const spy = Sinon.spy()
      Events.onMessageSent(spy)
      const message = {}
      Events.sendMessage(message)
      test.ok(spy.calledWith(message))
      test.end()
    })
    sendTest.end()
  })

  eventTest.test('emailSettlementCsv should', sendTest => {
    sendTest.test('publish message.send event', test => {
      const spy = Sinon.spy()
      Events.onEmailSettlementCsv(spy)
      const message = {}
      Events.emailSettlementCsv(message)
      test.ok(spy.calledWith(message))
      test.end()
    })
    sendTest.end()
  })

  eventTest.end()
})
