'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const EventEmitter = require('events')
const Moment = require('moment')
const Config = require(`${src}/lib/config`)
const Proxyquire = require('proxyquire')

Test('Sidecar', sidecarTest => {
  let oldSidecar
  let sidecarSettings = { HOST: 'local', PORT: 1234, CONNECT_TIMEOUT: 10000, RECONNECT_INTERVAL: 2000 }
  let sandbox
  let stubs
  let nullClientCreateStub
  let clientCreateStub

  sidecarTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Moment, 'utc')

    oldSidecar = Config.SIDECAR
    Config.SIDECAR = sidecarSettings
    Config.SIDECAR_DISABLED = false

    nullClientCreateStub = sandbox.stub()
    clientCreateStub = sandbox.stub()

    stubs = { './null-client': { create: nullClientCreateStub }, '@mojaloop/forensic-logging-client': { create: clientCreateStub } }

    t.end()
  })

  sidecarTest.afterEach(t => {
    sandbox.restore()
    Config.SIDECAR = oldSidecar
    t.end()
  })

  sidecarTest.test('import should', importTest => {
    importTest.test('return null client if sidecar disabled', test => {
      Config.SIDECAR_DISABLED = true
      Proxyquire(`${src}/lib/sidecar`, stubs)

      test.notOk(clientCreateStub.called)
      test.ok(nullClientCreateStub.calledOnce)
      test.end()
    })

    importTest.test('return sidecar client if not disabled', test => {
      let sidecarStub = { 'on': sandbox.stub(), 'write': sandbox.stub() }
      clientCreateStub.returns(sidecarStub)

      Proxyquire(`${src}/lib/sidecar`, stubs)

      test.notOk(nullClientCreateStub.called)
      test.ok(clientCreateStub.calledOnce)
      test.ok(clientCreateStub.calledWith(sandbox.match({
        host: sidecarSettings.HOST,
        port: sidecarSettings.PORT,
        connectTimeout: sidecarSettings.CONNECT_TIMEOUT,
        reconnectInterval: sidecarSettings.RECONNECT_INTERVAL
      })))
      test.end()
    })

    importTest.end()
  })

  sidecarTest.test('connect should', connectTest => {
    connectTest.test('call sidecar client connect', test => {
      let sidecarStub = { 'on': sandbox.stub(), 'connect': sandbox.stub() }
      clientCreateStub.returns(sidecarStub)

      let Sidecar = Proxyquire(`${src}/lib/sidecar`, stubs)

      Sidecar.connect()
      test.ok(sidecarStub.connect.calledOnce)
      test.end()
    })

    connectTest.end()
  })

  sidecarTest.test('write should', writeTest => {
    writeTest.test('write to sidecar client', test => {
      let sidecarStub = { 'on': sandbox.stub(), 'write': sandbox.stub() }
      clientCreateStub.returns(sidecarStub)

      let Sidecar = Proxyquire(`${src}/lib/sidecar`, stubs)

      const msg = 'message'
      Sidecar.write(msg)
      test.ok(sidecarStub.write.calledWith(msg))
      test.end()
    })

    writeTest.end()
  })

  sidecarTest.test('logRequest should', logRequestTest => {
    logRequestTest.test('write to sidecar client with request message', test => {
      let sidecarStub = { 'on': sandbox.stub(), 'write': sandbox.stub() }
      clientCreateStub.returns(sidecarStub)

      let Sidecar = Proxyquire(`${src}/lib/sidecar`, stubs)

      let now = new Date()
      Moment.utc.returns(now)

      const request = { method: 'post', url: { path: 'path' }, body: 'body', auth: 'auth' }
      const msgJson = { method: 'post', timestamp: now.toISOString(), url: 'path', body: 'body', auth: 'auth' }
      const msg = JSON.stringify(msgJson)

      Sidecar.logRequest(request)
      test.ok(sidecarStub.write.calledWith(msg))
      test.end()
    })

    logRequestTest.end()
  })

  sidecarTest.test('receiving close event should', closeEventTest => {
    closeEventTest.test('throw error', test => {
      let sidecarStub = new EventEmitter()
      sidecarStub.connect = sandbox.stub()
      clientCreateStub.returns(sidecarStub)

      let Sidecar = Proxyquire(`${src}/lib/sidecar`, stubs)

      Sidecar.connect()

      try {
        sidecarStub.emit('close')
        test.fail('Should have thrown error')
        test.end()
      } catch (err) {
        test.equal(err.message, 'Sidecar connection closed')
        test.end()
      }
    })

    closeEventTest.end()
  })

  sidecarTest.end()
})
