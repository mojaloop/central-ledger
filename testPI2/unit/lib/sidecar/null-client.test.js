'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Logger = require('@mojaloop/central-services-shared').Logger
const NullClient = require(`${src}/lib/sidecar/null-client`)

Test('Null SidecarClient', nullSidecarTest => {
  let sandbox

  nullSidecarTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Logger)
    t.end()
  })

  nullSidecarTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  nullSidecarTest.test('create should', createTest => {
    createTest.test('create new null client', test => {
      let client = NullClient.create()
      test.ok(client)
      test.end()
    })

    createTest.end()
  })

  nullSidecarTest.test('connect should', connectTest => {
    connectTest.test('log and return resolved promise immediately', test => {
      let client = NullClient.create()

      client.connect()
        .then(() => {
          test.ok(Logger.debug.calledWith('Sidecar disabled: connecting in NullClient'))
          test.end()
        })
    })

    connectTest.end()
  })

  nullSidecarTest.test('write should', writeTest => {
    writeTest.test('log message', test => {
      let client = NullClient.create()

      let msg = 'This is a test'
      client.write(msg)
      test.ok(Logger.debug.calledWith(`Sidecar disabled: writing message ${msg} in NullClient`))
      test.end()
    })

    writeTest.end()
  })

  nullSidecarTest.end()
})
