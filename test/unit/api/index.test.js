'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')

const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../src/lib/config')
const Routes = require('../../../src/api/routes')
const Auth = require('../../../src/api/auth')
const Sockets = require('../../../src/api/sockets')
const Worker = require('../../../src/api/worker')
const Account = require('../../../src/domain/account')
const Setup = require('../../../src/shared/setup')

Test('Api index', indexTest => {
  let sandbox

  indexTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Setup)
    sandbox.stub(Logger)
    sandbox.stub(Account, 'createLedgerAccount')
    test.end()
  })

  indexTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  indexTest.test('export should', exportTest => {
    exportTest.test('initialize server', async function (test) {
      const server = {
        start: sandbox.stub(),
        info: {
          uri: ''
        }
      }
      server.start.returns(P.resolve({}))
      Setup.initialize.returns(P.resolve(server))

      await require('../../../src/api/index')
      test.ok(Setup.initialize.calledWith({
        service: 'api',
        port: Config.PORT,
        modules: [Auth, Routes, Sockets, Worker],
        runMigrations: true
      }))
      test.end()
    })
    exportTest.end()
  })

  indexTest.end()
})
