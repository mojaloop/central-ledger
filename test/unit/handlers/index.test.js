'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Config = require('../../../src/lib/config')
const Proxyquire = require('proxyquire')
const Plugin = require('../../../src/handlers/api/plugin')
const MetricsPlugin = require('../../../src/api/metrics/plugin')
const Logger = require('@mojaloop/central-services-logger')

Test('cli', async (cliTest) => {
  let sandbox

  cliTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Logger, 'isDebugEnabled').value(true)
    console.log('start')
    test.end()
  })

  cliTest.afterEach(test => {
    console.log('end')
    sandbox.restore()
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
        initialize: sandbox.stub().returns(Promise.resolve())
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
      const argv = [
        'node',
        'index.js',
        'handler',
        '--prepare',
        '--position',
        '--get',
        '--fulfil',
        '--timeout',
        '--admin',
        '--bulkprepare',
        '--bulkfulfil',
        '--bulkprocessing'
      ]

      process.argv = argv

      const Index = Proxyquire('../../../src/handlers/index', {
        '../shared/setup': SetupStub
      })

      const prepareHandler = {
        type: 'prepare',
        enabled: true
      }

      const positionHandler = {
        type: 'position',
        enabled: true
      }

      const getHandler = {
        type: 'get',
        enabled: true
      }

      const fulfilHandler = {
        type: 'fulfil',
        enabled: true
      }

      const timeoutHandler = {
        type: 'timeout',
        enabled: true
      }

      const adminHandler = {
        type: 'admin',
        enabled: true
      }

      const bulkprepareHandler = {
        type: 'bulkprepare',
        enabled: true
      }

      const bulkfulfilHandler = {
        type: 'bulkfulfil',
        enabled: true
      }

      const bulkprocessingHandler = {
        type: 'bulkprocessing',
        enabled: true
      }

      const modulesList = [
        prepareHandler,
        positionHandler,
        getHandler,
        fulfilHandler,
        timeoutHandler,
        adminHandler,
        bulkprepareHandler,
        bulkfulfilHandler,
        bulkprocessingHandler
        // rejectHandler
      ]

      const initOptions = {
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
      const argv = [
        'node',
        'index.js',
        'handler',
        '--prepare',
        '--position'
      ]

      process.argv = argv

      const Index = Proxyquire('../../../src/handlers/index', {
        '../shared/setup': SetupStub
      })

      const prepareHandler = {
        type: 'prepare',
        enabled: true
      }

      const positionHandler = {
        type: 'position',
        enabled: true
      }

      const modulesList = [
        prepareHandler,
        positionHandler
      ]

      const initOptions = {
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
      const argv = [
        'node',
        'index.js',
        'handler',
        '--position'
      ]

      process.argv = argv

      const Index = Proxyquire('../../../src/handlers/index', {
        '../shared/setup': SetupStub
      })

      const positionHandler = {
        type: 'position',
        enabled: true
      }

      const modulesList = [
        positionHandler
      ]

      const initOptions = {
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
      const argv = [
        'node',
        'index.js',
        'handler',
        '--prepare'
      ]

      process.argv = argv

      const Index = Proxyquire('../../../src/handlers/index', {
        '../shared/setup': SetupStub
      })

      const prepareHandler = {
        type: 'prepare',
        enabled: true
      }

      const modulesList = [
        prepareHandler
      ]

      const initOptions = {
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

      const argv = [
        'node',
        'index.js'
      ]

      process.argv = argv

      const Index = Proxyquire('../../../src/handlers/index', {
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
