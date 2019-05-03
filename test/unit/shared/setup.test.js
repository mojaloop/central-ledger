'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Config = require('../../../src/lib/config')
const Proxyquire = require('proxyquire')

Test('setup', setupTest => {
  let sandbox
  let uuidStub
  let oldHostName
  let oldDatabaseUri
  let hostName = 'http://test.com'
  let databaseUri = 'some-database-uri'
  let Setup
  let DbStub
  let SidecarStub
  let MigratorStub
  let RegisterHandlersStub
  let requestLoggerStub
  let PluginsStub
  let HapiStub
  let UrlParserStub
  let serverStub
  // let KafkaCronStub

  setupTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()

    PluginsStub = {
      registerPlugins: sandbox.stub().returns(P.resolve())
    }

    serverStub = {
      connection: sandbox.stub(),
      register: sandbox.stub(),
      method: sandbox.stub(),
      ext: sandbox.stub(),
      start: sandbox.stub(),
      info: {
        uri: sandbox.stub()
      }
    }

    HapiStub = {
      Server: sandbox.stub().returns(serverStub)
    }

    UrlParserStub = {
      idFromTransferUri: sandbox.stub()
    }

    requestLoggerStub = {
      logRequest: sandbox.stub().returns(P.resolve()),
      logResponse: sandbox.stub().returns(P.resolve())
    }

    SidecarStub = {
      connect: sandbox.stub().returns(P.resolve())
    }

    DbStub = {
      connect: sandbox.stub().returns(P.resolve()),
      disconnect: sandbox.stub().returns(P.resolve())
    }

    uuidStub = sandbox.stub()

    MigratorStub = {
      migrate: sandbox.stub().returns(P.resolve())
    }

    RegisterHandlersStub = {
      registerAllHandlers: sandbox.stub().returns(P.resolve()),
      transfers: {
        registerPrepareHandler: sandbox.stub().returns(P.resolve()),
        registerGetHandler: sandbox.stub().returns(P.resolve()),
        registerFulfilHandler: sandbox.stub().returns(P.resolve())
        // registerRejectHandler: sandbox.stub().returns(P.resolve())
      },
      positions: {
        registerPositionHandler: sandbox.stub().returns(P.resolve())
      },
      timeouts: {
        registerAllHandlers: sandbox.stub().returns(P.resolve()),
        registerTimeoutHandler: sandbox.stub().returns(P.resolve())
      },
      admin: {
        registerAdminHandlers: sandbox.stub().returns(P.resolve())
      }
    }

    // KafkaCronStub = {
    //   Cron: {
    //     start: sandbox.stub().returns(P.resolve()),
    //     stop: sandbox.stub().returns(P.resolve()),
    //     isRunning: sandbox.stub().returns(P.resolve())
    //   }
    // }

    const ConfigStub = Config
    ConfigStub.HANDLERS_API_DISABLED = false
    ConfigStub.HANDLERS_CRON_DISABLED = false

    Setup = Proxyquire('../../../src/shared/setup', {
      'uuid4': uuidStub,
      '../handlers/register': RegisterHandlersStub,
      '../lib/db': DbStub,
      '../lib/migrator': MigratorStub,
      '../lib/sidecar': SidecarStub,
      '../lib/requestLogger': requestLoggerStub,
      './plugins': PluginsStub,
      '../lib/urlParser': UrlParserStub,
      'hapi': HapiStub,
      '../lib/config': ConfigStub
      // '../handlers/lib/kafka': KafkaCronStub
    })

    oldHostName = Config.HOSTNAME
    oldDatabaseUri = Config.DATABASE_URI
    Config.DATABASE_URI = databaseUri
    Config.HOSTNAME = hostName

    test.end()
  })

  setupTest.afterEach(test => {
    sandbox.restore()

    Config.HOSTNAME = oldHostName
    Config.DATABASE_URI = oldDatabaseUri

    test.end()
  })

  setupTest.test('createServer should', async (createServerTest) => {
    createServerTest.test('throw Boom error on fail', async (test) => {
      const errorToThrow = new Error('Throw Boom error')

      const HapiStubThrowError = {
        Server: sandbox.stub().callsFake((opt) => {
          opt.routes.validate.failAction(sandbox.stub(), sandbox.stub(), errorToThrow)
        })
      }

      Setup = Proxyquire('../../../src/shared/setup', {
        'uuid4': uuidStub,
        '../handlers/register': RegisterHandlersStub,
        '../lib/db': DbStub,
        '../lib/migrator': MigratorStub,
        '../lib/sidecar': SidecarStub,
        '../lib/requestLogger': requestLoggerStub,
        './plugins': PluginsStub,
        '../lib/urlParser': UrlParserStub,
        'hapi': HapiStubThrowError,
        '../lib/config': Config
        // '../handlers/lib/kafka': KafkaCronStub
      })

      Setup.createServer(200, []).then(() => {
        test.fail('Should not have successfully created server')
        test.end()
      }).catch(err => {
        test.ok(err instanceof Error)
        test.end()
      })
    })
    createServerTest.end()
  })

  setupTest.test('initialize should', async (initializeTest) => {
    initializeTest.test('connect to sidecar', async (test) => {
      const service = 'api'

      Setup.initialize({ service }).then(s => {
        test.ok(DbStub.connect.calledWith(databaseUri))
        test.ok(SidecarStub.connect.calledWith(service))
        test.notOk(MigratorStub.migrate.called)
        test.equal(s, serverStub)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.test('connect to db and return hapi server for "api"', async (test) => {
      const service = 'api'

      Setup.initialize({ service }).then(s => {
        test.ok(DbStub.connect.calledWith(databaseUri))
        test.notOk(MigratorStub.migrate.called)
        test.equal(s, serverStub)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.test('connect to db and return hapi server for "admin"', async (test) => {
      const service = 'admin'

      Setup.initialize({ service }).then(s => {
        test.ok(DbStub.connect.calledWith(databaseUri))
        test.notOk(MigratorStub.migrate.called)
        test.equal(s, serverStub)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.test('connect to db and return hapi server for "handler"', async (test) => {
      const service = 'handler'

      Setup.initialize({ service }).then(s => {
        test.ok(DbStub.connect.calledWith(databaseUri))
        test.notOk(MigratorStub.migrate.called)
        test.equal(s, serverStub)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.test('return throw an exception for server "undefined"', async (test) => {
      const service = 'undefined'

      Setup.initialize({ service }).then(s => {
        test.ok(DbStub.connect.calledWith(databaseUri))
        test.notOk(MigratorStub.migrate.called)
        test.equal(s, serverStub)
        test.end()
      }).catch(err => {
        test.ok(err.message === `No valid service type ${service} found!`)
        test.end()
      })
    })

    initializeTest.test('run migrations if runMigrations flag enabled', async (test) => {
      const service = 'api'

      Setup.initialize({ service, runMigrations: true }).then(() => {
        test.ok(DbStub.connect.calledWith(databaseUri))
        test.ok(MigratorStub.migrate.called)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.test('run Handlers if runHandlers flag enabled and start API', async (test) => {
      const service = 'handler'

      Setup.initialize({ service, runHandlers: true }).then((s) => {
        test.ok(RegisterHandlersStub.registerAllHandlers.called)
        test.equal(s, serverStub)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.test('run Handlers if runHandlers flag enabled and cronjobs are enabled and start API and do register cronJobs', async (test) => {
      Setup = Proxyquire('../../../src/shared/setup', {
        'uuid4': uuidStub,
        '../handlers/register': RegisterHandlersStub,
        '../lib/db': DbStub,
        '../lib/migrator': MigratorStub,
        '../lib/sidecar': SidecarStub,
        '../lib/requestLogger': requestLoggerStub,
        './plugins': PluginsStub,
        '../lib/urlParser': UrlParserStub,
        'hapi': HapiStub,
        '../lib/config': Config
        // '../handlers/lib/kafka': KafkaCronStub
      })

      const service = 'handler'

      Setup.initialize({ service, runHandlers: true }).then((s) => {
        test.ok(RegisterHandlersStub.registerAllHandlers.called)
        // test.ok(KafkaCronStub.Cron.start.called)
        test.equal(s, serverStub)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.test('run Handlers if runHandlers flag enabled and cronjobs are disabled and start API but dont register cronJobs', async (test) => {
      const ConfigStub = Config
      ConfigStub.HANDLERS_CRON_DISABLED = true

      Setup = Proxyquire('../../../src/shared/setup', {
        'uuid4': uuidStub,
        '../handlers/register': RegisterHandlersStub,
        '../lib/db': DbStub,
        '../lib/migrator': MigratorStub,
        '../lib/sidecar': SidecarStub,
        '../lib/requestLogger': requestLoggerStub,
        './plugins': PluginsStub,
        '../lib/urlParser': UrlParserStub,
        'hapi': HapiStub,
        '../lib/config': ConfigStub
        // '../handlers/lib/kafka': KafkaCronStub
      })

      const service = 'handler'

      Setup.initialize({ service, runHandlers: true }).then((s) => {
        test.ok(RegisterHandlersStub.registerAllHandlers.called)
        // test.ok(!KafkaCronStub.Cron.start.called)
        test.equal(s, serverStub)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.test('run Handlers if runHandlers flag enabled and dont start API', async (test) => {
      const ConfigStub = Config
      ConfigStub.HANDLERS_CRON_DISABLED = false
      ConfigStub.HANDLERS_API_DISABLED = true

      Setup = Proxyquire('../../../src/shared/setup', {
        'uuid4': uuidStub,
        '../handlers/register': RegisterHandlersStub,
        '../lib/db': DbStub,
        '../lib/migrator': MigratorStub,
        '../lib/sidecar': SidecarStub,
        '../lib/requestLogger': requestLoggerStub,
        './plugins': PluginsStub,
        '../lib/urlParser': UrlParserStub,
        'hapi': HapiStub,
        '../lib/config': Config
        // '../handlers/lib/kafka': KafkaCronStub
      })

      const service = 'handler'

      sandbox.stub(Config, 'HANDLERS_API_DISABLED').returns(true)
      Setup.initialize({ service, runHandlers: true }).then((s) => {
        test.ok(RegisterHandlersStub.registerAllHandlers.called)
        test.equal(s, undefined)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.test('do not initialize instrumentation if INSTRUMENTATION_METRICS_DISABLED is true', async (test) => {
      const ConfigStub = Config
      ConfigStub.HANDLERS_CRON_DISABLED = false
      ConfigStub.HANDLERS_API_DISABLED = true
      ConfigStub.INSTRUMENTATION_METRICS_DISABLED = true

      Setup = Proxyquire('../../../src/shared/setup', {
        'uuid4': uuidStub,
        '../handlers/register': RegisterHandlersStub,
        '../lib/db': DbStub,
        '../lib/migrator': MigratorStub,
        '../lib/sidecar': SidecarStub,
        '../lib/requestLogger': requestLoggerStub,
        './plugins': PluginsStub,
        '../lib/urlParser': UrlParserStub,
        'hapi': HapiStub,
        '../lib/config': Config
        // '../handlers/lib/kafka': KafkaCronStub
      })

      const service = 'handler'

      sandbox.stub(Config, 'HANDLERS_API_DISABLED').returns(true)
      sandbox.stub(Config, 'INSTRUMENTATION_METRICS_DISABLED').returns(true)
      Setup.initialize({ service, runHandlers: true }).then((s) => {
        test.ok(RegisterHandlersStub.registerAllHandlers.called)
        test.equal(s, undefined)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.test('run invalid Handler if runHandlers flag enabled with handlers[] populated', async (test) => {
      const service = 'api'

      const fspList = ['dfsp1', 'dfsp2']

      const prepareHandler = {
        type: 'prepare',
        enabled: true,
        fspList
      }

      const positionHandler = {
        type: 'position',
        enabled: true,
        fspList
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

      const getHandler = {
        type: 'get',
        enabled: true
      }

      const unknownHandler = {
        type: 'undefined',
        enabled: true
      }

      const modulesList = [
        prepareHandler,
        positionHandler,
        fulfilHandler,
        timeoutHandler,
        adminHandler,
        getHandler,
        unknownHandler
        // rejectHandler
      ]

      Setup.initialize({ service, runHandlers: true, handlers: modulesList }).then(() => {
        test.fail('Expected exception to be thrown')
        test.end()
      }).catch(err => {
        console.log(err)
        test.ok(RegisterHandlersStub.transfers.registerPrepareHandler.called)
        test.ok(RegisterHandlersStub.transfers.registerFulfilHandler.called)
        test.ok(RegisterHandlersStub.positions.registerPositionHandler.called)
        test.ok(RegisterHandlersStub.timeouts.registerTimeoutHandler.called)
        test.ok(RegisterHandlersStub.admin.registerAdminHandlers.called)
        test.ok(RegisterHandlersStub.transfers.registerGetHandler.called)
        test.ok(err.message === `Handler Setup - ${JSON.stringify(unknownHandler)} is not a valid handler to register!`)
        test.end()
      })
    })

    initializeTest.test('run disabled Handler if runHandlers flag enabled with handlers[] populated', async (test) => {
      const service = 'api'

      const fspList = ['dfsp1', 'dfsp2']

      const prepareHandler = {
        type: 'prepare',
        enabled: true,
        fspList
      }

      const positionHandler = {
        type: 'position',
        enabled: false,
        fspList
      }

      const fulfilHandler = {
        type: 'fulfil',
        enabled: true
      }

      const timeoutHandler = {
        type: 'timeout',
        enabled: true
      }

      const getHandler = {
        type: 'get',
        enabled: true
      }

      const modulesList = [
        prepareHandler,
        positionHandler,
        fulfilHandler,
        timeoutHandler,
        getHandler
        // rejectHandler
      ]

      Setup.initialize({ service, runHandlers: true, handlers: modulesList }).then(() => {
        test.ok(RegisterHandlersStub.transfers.registerPrepareHandler.called)
        test.ok(RegisterHandlersStub.transfers.registerFulfilHandler.called)
        test.notOk(RegisterHandlersStub.positions.registerPositionHandler.called)
        test.ok(RegisterHandlersStub.timeouts.registerTimeoutHandler.called)
        test.ok(RegisterHandlersStub.transfers.registerGetHandler.called)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.test('run specific Handlers if runHandlers flag enabled with handlers[] populated', async (test) => {
      const service = 'api'

      const fspList = ['dfsp1', 'dfsp2']

      const prepareHandler = {
        type: 'prepare',
        enabled: true,
        fspList
      }

      const positionHandler = {
        type: 'position',
        enabled: true,
        fspList
      }

      const fulfilHandler = {
        type: 'fulfil',
        enabled: true
      }

      const timeoutHandler = {
        type: 'timeout',
        enabled: true
      }

      const getHandler = {
        type: 'get',
        enabled: true
      }

      const modulesList = [
        prepareHandler,
        positionHandler,
        fulfilHandler,
        timeoutHandler,
        getHandler
        // rejectHandler
      ]

      Setup.initialize({ service, runHandlers: true, handlers: modulesList }).then(() => {
        test.ok(RegisterHandlersStub.transfers.registerPrepareHandler.called)
        test.ok(RegisterHandlersStub.transfers.registerFulfilHandler.called)
        test.ok(RegisterHandlersStub.positions.registerPositionHandler.called)
        test.ok(RegisterHandlersStub.timeouts.registerTimeoutHandler.called)
        test.ok(RegisterHandlersStub.transfers.registerGetHandler.called)
        // test.ok(KafkaCronStub.Cron.start.calledOnce)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.test('run specific Handlers if runHandlers flag enabled with handlers[] populated with CronJob disabled', async (test) => {
      const ConfigStub = Config
      ConfigStub.HANDLERS_CRON_DISABLED = true
      ConfigStub.HANDLERS_API_DISABLED = false

      Setup = Proxyquire('../../../src/shared/setup', {
        'uuid4': uuidStub,
        '../handlers/register': RegisterHandlersStub,
        '../lib/db': DbStub,
        '../lib/migrator': MigratorStub,
        '../lib/sidecar': SidecarStub,
        '../lib/requestLogger': requestLoggerStub,
        './plugins': PluginsStub,
        '../lib/urlParser': UrlParserStub,
        'hapi': HapiStub,
        '../lib/config': Config
        // '../handlers/lib/kafka': KafkaCronStub
      })

      const service = 'api'

      const fspList = ['dfsp1', 'dfsp2']

      const prepareHandler = {
        type: 'prepare',
        enabled: true,
        fspList
      }

      const positionHandler = {
        type: 'position',
        enabled: true,
        fspList
      }

      const fulfilHandler = {
        type: 'fulfil',
        enabled: true
      }

      const modulesList = [
        prepareHandler,
        positionHandler,
        fulfilHandler
        // rejectHandler
      ]

      Setup.initialize({ service, runHandlers: true, handlers: modulesList }).then(() => {
        test.ok(RegisterHandlersStub.transfers.registerPrepareHandler.called)
        test.ok(RegisterHandlersStub.transfers.registerFulfilHandler.called)
        test.ok(RegisterHandlersStub.positions.registerPositionHandler.called)
        // test.ok(!KafkaCronStub.Cron.start.called)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.end()
  })

  setupTest.end()
})
