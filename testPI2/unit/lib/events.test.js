'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const TransferTranslator = require('../../../src/domain/transfer/translator')
const EventsPath = '../../../src/lib/events'

Test('events', eventTest => {
  let sandbox
  let Events

  eventTest.beforeEach(t => {
    Events = require(EventsPath)
    sandbox = Sinon.sandbox.create()
    sandbox.stub(TransferTranslator, 'toTransfer')
    t.end()
  })

  eventTest.afterEach(t => {
    delete require.cache[require.resolve(EventsPath)]
    sandbox.restore()
    t.end()
  })

  eventTest.test('emitTransferPrepared should', (emitTest) => {
    emitTest.test('publish transfer prepared event', (t) => {
      let spy = Sinon.spy()
      Events.onTransferPrepared(spy)
      let transfer = {id: 12}
      TransferTranslator.toTransfer.returns(transfer)
      Events.emitTransferPrepared(transfer)
      t.ok(spy.calledWith({resource: transfer}))
      t.end()
    })

    emitTest.test('not push transfer executed event', (t) => {
      let spy = Sinon.spy()
      Events.onTransferExecuted(spy)
      let transfer = {id: 12}
      TransferTranslator.toTransfer.returns(transfer)
      Events.emitTransferPrepared({})
      t.notOk(spy.called)
      t.end()
    })

    emitTest.test('not push transfer rejected event', (t) => {
      let spy = Sinon.spy()
      Events.onTransferRejected(spy)
      let transfer = {id: 12}
      TransferTranslator.toTransfer.returns(transfer)
      Events.emitTransferPrepared({})
      t.notOk(spy.called)
      t.end()
    })

    emitTest.end()
  })

  eventTest.test('emitTransferExecuted should', (emitTest) => {
    emitTest.test('publish transfer executed event', (t) => {
      let spy = Sinon.spy()
      Events.onTransferExecuted(spy)
      let transfer = {id: 12}
      TransferTranslator.toTransfer.returns(transfer)
      let relatedResources = {execution_condition_fulfillment: 'oAKAAA'}
      Events.emitTransferExecuted(transfer, relatedResources)
      t.ok(spy.calledWith({resource: transfer, related_resources: relatedResources}))
      t.end()
    })

    emitTest.test('not push transfer prepared event', (t) => {
      let spy = Sinon.spy()
      Events.onTransferPrepared(spy)
      let transfer = {id: 12}
      TransferTranslator.toTransfer.returns(transfer)
      Events.emitTransferExecuted({})
      t.notOk(spy.called)
      t.end()
    })

    emitTest.test('not push transfer rejected event', (t) => {
      let spy = Sinon.spy()
      Events.onTransferRejected(spy)
      let transfer = {id: 12}
      TransferTranslator.toTransfer.returns(transfer)
      Events.emitTransferExecuted({})
      t.notOk(spy.called)
      t.end()
    })

    emitTest.end()
  })

  eventTest.test('emitTransferRejected should', (emitTest) => {
    emitTest.test('publish transfer rejected event', (t) => {
      let spy = Sinon.spy()
      Events.onTransferRejected(spy)
      let transfer = {id: 12}
      TransferTranslator.toTransfer.returns(transfer)
      let resource = {id: 12}
      let relatedResources = {execution_condition_fulfillment: 'oAKAAA'}
      Events.emitTransferRejected(resource, relatedResources)
      t.ok(spy.calledWith({resource: transfer, related_resources: relatedResources}))
      t.end()
    })

    emitTest.test('not push transfer prepared event', (t) => {
      let spy = Sinon.spy()
      Events.onTransferPrepared(spy)
      Events.emitTransferRejected({})
      t.notOk(spy.called)
      t.end()
    })

    emitTest.test('not push transfer executed event', (t) => {
      let spy = Sinon.spy()
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
