'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Config = require('../../../src/lib/config')
const Proxyquire = require('proxyquire')
const Plugin = require('../../../src/handlers/api/plugin')
const MetricsPlugin = require('../../../src/api/metrics/plugin')

Test('cli', async (cliTest) => {
  cliTest.beforeEach(test => {
    console.log('start')
    test.end()
  })

  cliTest.afterEach(test => {
    console.log('end')
    test.end()
  })

  cliTest.test('yes', async (test) => {
    test.end()
  })

  cliTest.test('Commander should', async (commanderTest) => {
    let sandbox
    // let Index
    let SetupStub

    commanderTest.beforeEach(test => {
      sandbox = Sinon.createSandbox()

      SetupStub = {
        initialize: sandbox.stub().returns(P.resolve())
      }

      process.argv = []
      Proxyquire.noPreserveCache() // enable no caching for module requires

      test.end()
    })

    commanderTest.afterEach(test => {
      sandbox.restore()
      Proxyquire.preserveCache()

      test.end()
    })

    commanderTest.test('start all Handlers up via all switches', async test => {
      var argv = [
        'node',
        'index.js',
        'handler',
        '--prepare',
        '--position',
        '--get',
        '--fulfil',
        '--timeout',
        '--admin'
      ]

      process.argv = argv

      var Index = Proxyquire('../../../src/handlers/index', {
        '../shared/setup': SetupStub
      })

      var prepareHandler = {
        type: 'prepare',
        enabled: true
      }

      var positionHandler = {
        type: 'position',
        enabled: true
      }

      var getHandler = {
        type: 'get',
        enabled: true
      }

      var fulfilHandler = {
        type: 'fulfil',
        enabled: true
      }

      var timeoutHandler = {
        type: 'timeout',
        enabled: true
      }

      var adminHandler = {
        type: 'admin',
        enabled: true
      }

      var modulesList = [
        prepareHandler,
        positionHandler,
        getHandler,
        fulfilHandler,
        timeoutHandler,
        adminHandler
        // rejectHandler
      ]

      var initOptions = {
        service: 'handler',
        port: Config.PORT,
        modules: [Plugin, MetricsPlugin],
        runMigrations: false,
        handlers: modulesList,
        runHandlers: true
      }

      test.ok(Index)
      test.ok(SetupStub.initialize.calledWith(initOptions))
      test.end()
    })

    commanderTest.test('start all prepare Handlers up with no FSPList provided', async test => {
      var argv = [
        'node',
        'index.js',
        'handler',
        '--prepare',
        '--position'
      ]

      process.argv = argv

      var Index = Proxyquire('../../../src/handlers/index', {
        '../shared/setup': SetupStub
      })

      var prepareHandler = {
        type: 'prepare',
        enabled: true
      }

      var positionHandler = {
        type: 'position',
        enabled: true
      }

      var modulesList = [
        prepareHandler,
        positionHandler
      ]

      var initOptions = {
        service: 'handler',
        port: Config.PORT,
        modules: [Plugin, MetricsPlugin],
        runMigrations: false,
        handlers: modulesList,
        runHandlers: true
      }

      test.ok(Index)
      test.ok(SetupStub.initialize.calledWith(initOptions))
      test.end()
    })

    commanderTest.test('start all position Handlers up with no FSPList provided', async test => {
      var argv = [
        'node',
        'index.js',
        'handler',
        '--position'
      ]

      process.argv = argv

      var Index = Proxyquire('../../../src/handlers/index', {
        '../shared/setup': SetupStub
      })

      var positionHandler = {
        type: 'position',
        enabled: true
      }

      var modulesList = [
        positionHandler
      ]

      var initOptions = {
        service: 'handler',
        port: Config.PORT,
        modules: [Plugin, MetricsPlugin],
        runMigrations: false,
        handlers: modulesList,
        runHandlers: true
      }

      test.ok(Index)
      test.ok(SetupStub.initialize.calledWith(initOptions))
      test.end()
    })

    commanderTest.test('start all prepare Handlers up with an invalid FSPList provided', async test => {
      var argv = [
        'node',
        'index.js',
        'handler',
        '--prepare'
      ]

      process.argv = argv

      var Index = Proxyquire('../../../src/handlers/index', {
        '../shared/setup': SetupStub
      })

      var prepareHandler = {
        type: 'prepare',
        enabled: true
      }

      var modulesList = [
        prepareHandler
      ]

      var initOptions = {
        service: 'handler',
        port: Config.PORT,
        modules: [Plugin, MetricsPlugin],
        runMigrations: false,
        handlers: modulesList,
        runHandlers: true
      }

      test.ok(Index)
      test.ok(SetupStub.initialize.calledWith(initOptions))
      test.end()
    })

    commanderTest.test('start all prepare Handlers up with invalid args', async test => {
      // stub process.exit
      sandbox.stub(process, 'exit')

      var argv = [
        'node',
        'index.js'
      ]

      process.argv = argv

      var Index = Proxyquire('../../../src/handlers/index', {
        '../shared/setup': SetupStub
      })

      test.ok(Index)
      test.notOk(SetupStub.initialize.called)
      test.ok(process.exit.called)
      test.end()
    })

    commanderTest.end()
  })

  cliTest.end()
})
