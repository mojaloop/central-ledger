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
    exportTest.test('initialize server', test => {
      const server = {
        start: sandbox.stub(),
        info: {
          uri: ''
        }
      }
      server.start.returns(P.resolve({}))
      Setup.initialize.returns(P.resolve(server))
      Account.createLedgerAccount.returns(P.resolve({}))

      require('../../../src/api/index').then(() => {
        test.ok(Setup.initialize.calledWith({ service: 'api', port: Config.PORT, modules: [Auth, Routes, Sockets, Worker], loadEventric: true, runMigrations: true }))
        test.ok(Account.createLedgerAccount.calledWith(Config.LEDGER_ACCOUNT_NAME, Config.LEDGER_ACCOUNT_PASSWORD))
        test.ok(server.start.called)
        test.ok(Logger.info.called)
        test.end()
      })
    })
    exportTest.end()
  })

  indexTest.end()
})
