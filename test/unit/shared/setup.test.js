'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Config = require('../../../src/lib/config')
const Proxyquire = require('proxyquire')
const MongoUriBuilder = require('mongo-uri-builder')

Test('setup', setupTest => {
  let sandbox
  let uuidStub
  let oldHostName
  let oldMongoDbUsername
  let oldMongoDbPassword
  let oldMongoDbHost
  let oldMongoDbPort
  let oldMongoDbDatabase
  let oldProxyCacheEnabled
  let mongoDbUri
  const hostName = 'http://test.com'
  let Setup
  let DbStub
  let ProxyCacheStub
  let CacheStub
  let ObjStoreStub
  // let ObjStoreStubThrows
  let MigratorStub
  let RegisterHandlersStub
  let PluginsStub
  let HapiStub
  let UrlParserStub
  let serverStub
  let processExitStub
  // let KafkaCronStub

  setupTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    processExitStub = sandbox.stub(process, 'exit')
    PluginsStub = {
      registerPlugins: sandbox.stub().resolves()
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

    DbStub = {
      connect: sandbox.stub().resolves(),
      disconnect: sandbox.stub().resolves()
    }

    ProxyCacheStub = {
      connect: sandbox.stub().returns(Promise.resolve()),
      getCache: sandbox.stub().returns(
        {
          connect: sandbox.stub().returns(Promise.resolve(true)),
          disconnect: sandbox.stub().returns(Promise.resolve(true))
        }
      )
    }

    CacheStub = {
      initCache: sandbox.stub().resolves()
    }

    ObjStoreStub = {
      Db: {
        connect: sandbox.stub().resolves(),
        Mongoose: {
          set: sandbox.stub()
        }
      }
    }
    // ObjStoreStubThrows = {
    //   Db: {
    //     connect: sandbox.stub().throws(new Error('MongoDB unavailable'))
    //   }
    // }

    uuidStub = sandbox.stub()

    MigratorStub = {
      migrate: sandbox.stub().resolves()
    }

    RegisterHandlersStub = {
      registerAllHandlers: sandbox.stub().resolves(),
      transfers: {
        registerPrepareHandler: sandbox.stub().resolves(),
        registerGetHandler: sandbox.stub().resolves(),
        registerFulfilHandler: sandbox.stub().resolves()
        // registerRejectHandler: sandbox.stub().resolves()
      },
      positions: {
        registerPositionHandler: sandbox.stub().resolves()
      },
      positionsBatch: {
        registerPositionHandler: sandbox.stub().resolves()
      },
      timeouts: {
        registerAllHandlers: sandbox.stub().resolves(),
        registerTimeoutHandler: sandbox.stub().resolves()
      },
      admin: {
        registerAdminHandlers: sandbox.stub().resolves()
      },
      bulk: {
        registerBulkPrepareHandler: sandbox.stub().resolves(),
        registerBulkFulfilHandler: sandbox.stub().resolves(),
        registerBulkProcessingHandler: sandbox.stub().resolves(),
        registerBulkGetHandler: sandbox.stub().resolves()
      }
    }
    const ConfigStub = Config
    ConfigStub.HANDLERS_API_DISABLED = false
    ConfigStub.HANDLERS_CRON_DISABLED = false
    ConfigStub.MONGODB_DISABLED = false

    Setup = Proxyquire('../../../src/shared/setup', {
      crypto: {
        randomUUID: uuidStub
      },
      '../handlers/register': RegisterHandlersStub,
      '../lib/db': DbStub,
      '../lib/proxyCache': ProxyCacheStub,
      '../lib/cache': CacheStub,
      '@mojaloop/object-store-lib': ObjStoreStub,
      '../lib/migrator': MigratorStub,
      './plugins': PluginsStub,
      '../lib/urlParser': UrlParserStub,
      '@hapi/hapi': HapiStub,
      '../lib/config': ConfigStub
      // '../handlers/lib/kafka': KafkaCronStub
    })

    oldHostName = Config.HOSTNAME
    oldMongoDbUsername = Config.MONGODB_USER
    oldMongoDbPassword = Config.MONGODB_PASSWORD
    oldMongoDbHost = Config.MONGODB_HOST
    oldMongoDbPort = Config.MONGODB_PORT
    oldMongoDbDatabase = Config.MONGODB_DATABASE
    oldProxyCacheEnabled = Config.PROXY_CACHE_CONFIG.enabled
    Config.HOSTNAME = hostName
    Config.MONGODB_HOST = 'testhost'
    Config.MONGODB_PORT = '1111'
    Config.MONGODB_USER = 'user'
    Config.MONGODB_PASSWORD = 'pass'
    Config.MONGODB_DATABASE = 'mlos'
    Config.PROXY_CACHE_CONFIG.enabled = true
    mongoDbUri = MongoUriBuilder({
      username: Config.MONGODB_USER,
      password: Config.MONGODB_PASSWORD,
      host: Config.MONGODB_HOST,
      port: Config.MONGODB_PORT,
      database: Config.MONGODB_DATABASE
    })

    test.end()
  })

  setupTest.afterEach(test => {
    sandbox.restore()

    Config.HOSTNAME = oldHostName
    Config.MONGODB_HOST = oldMongoDbHost
    Config.MONGODB_PORT = oldMongoDbPort
    Config.MONGODB_USER = oldMongoDbUsername
    Config.MONGODB_PASSWORD = oldMongoDbPassword
    Config.MONGODB_DATABASE = oldMongoDbDatabase
    Config.PROXY_CACHE_CONFIG.enabled = oldProxyCacheEnabled

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
        crypto: {
          randomUUID: uuidStub
        },
        '../handlers/register': RegisterHandlersStub,
        '../lib/db': DbStub,
        '../lib/proxyCache': ProxyCacheStub,
        '../lib/cache': CacheStub,
        '@mojaloop/object-store-lib': ObjStoreStub,
        '../lib/migrator': MigratorStub,
        './plugins': PluginsStub,
        '../lib/urlParser': UrlParserStub,
        '@hapi/hapi': HapiStubThrowError,
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
    initializeTest.test('connect to Database & ObjStore', async (test) => {
      const service = 'api'

      Setup.initialize({ service }).then(s => {
        test.ok(DbStub.connect.calledWith(Config.DATABASE))
        test.ok(ObjStoreStub.Db.connect.calledWith(mongoDbUri))
        test.ok(CacheStub.initCache.called)
        test.notOk(MigratorStub.migrate.called)
        test.equal(s, serverStub)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.test('connect to Database, but NOT too ObjStore', async (test) => {
      const ConfigStub = Config
      ConfigStub.MONGODB_DISABLED = true

      const service = 'api'

      Setup = Proxyquire('../../../src/shared/setup', {
        crypto: {
          randomUUID: uuidStub
        },
        '../handlers/register': RegisterHandlersStub,
        '../lib/db': DbStub,
        '../lib/proxyCache': ProxyCacheStub,
        '../lib/cache': CacheStub,
        '@mojaloop/object-store-lib': ObjStoreStub,
        '../lib/migrator': MigratorStub,
        './plugins': PluginsStub,
        '../lib/urlParser': UrlParserStub,
        '@hapi/hapi': HapiStub,
        '../lib/config': ConfigStub
      })

      Setup.initialize({ service }).then(s => {
        test.ok(DbStub.connect.calledWith(Config.DATABASE))
        test.notOk(ObjStoreStub.Db.connect.called)
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
        test.ok(DbStub.connect.calledWith(Config.DATABASE))
        test.ok(ObjStoreStub.Db.connect.calledWith(mongoDbUri))
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
        test.ok(DbStub.connect.calledWith(Config.DATABASE))
        test.ok(ObjStoreStub.Db.connect.calledWith(mongoDbUri))
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
        test.ok(DbStub.connect.calledWith(Config.DATABASE))
        test.ok(ObjStoreStub.Db.connect.calledWith(mongoDbUri))
        test.notOk(MigratorStub.migrate.called)
        test.equal(s, serverStub)
        test.end()
      }).catch(err => {
        test.fail(`Should have not received an error: ${err}`)
        test.end()
      })
    })

    initializeTest.test('exit the process when service is "undefined"', async (test) => {
      const service = 'undefined'

      Setup.initialize({ service }).then(s => {
        test.ok(DbStub.connect.calledWith(Config.DATABASE))
        test.ok(ObjStoreStub.Db.connect.calledWith(mongoDbUri))
        test.notOk(MigratorStub.migrate.called)
        test.ok(processExitStub.called)
        test.end()
      }).catch(err => {
        test.fail(`Should have exited the process: ${err.message}`)
        test.end()
      })
    })

    initializeTest.test('run migrations if runMigrations flag enabled', async (test) => {
      const service = 'api'

      Setup.initialize({ service, runMigrations: true }).then(() => {
        test.ok(DbStub.connect.calledWith(Config.DATABASE))
        test.ok(ObjStoreStub.Db.connect.calledWith(mongoDbUri))
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
        crypto: {
          randomUUID: uuidStub
        },
        '../handlers/register': RegisterHandlersStub,
        '../lib/db': DbStub,
        '../lib/proxyCache': ProxyCacheStub,
        '../lib/cache': CacheStub,
        '@mojaloop/object-store-lib': ObjStoreStub,
        '../lib/migrator': MigratorStub,
        './plugins': PluginsStub,
        '../lib/urlParser': UrlParserStub,
        '@hapi/hapi': HapiStub,
        '../lib/config': Config
        // '../handlers/lib/kafka': KafkaCronStub
      })

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

    initializeTest.test('run Handlers if runHandlers flag enabled and cronjobs are disabled and start API but dont register cronJobs', async (test) => {
      const ConfigStub = Config
      ConfigStub.HANDLERS_CRON_DISABLED = true

      Setup = Proxyquire('../../../src/shared/setup', {
        crypto: {
          randomUUID: uuidStub
        },
        '../handlers/register': RegisterHandlersStub,
        '../lib/db': DbStub,
        '../lib/proxyCache': ProxyCacheStub,
        '../lib/cache': CacheStub,
        '@mojaloop/object-store-lib': ObjStoreStub,
        '../lib/migrator': MigratorStub,
        './plugins': PluginsStub,
        '../lib/urlParser': UrlParserStub,
        '@hapi/hapi': HapiStub,
        '../lib/config': ConfigStub
        // '../handlers/lib/kafka': KafkaCronStub
      })

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

    initializeTest.test('run Handlers if runHandlers flag enabled and dont start API', async (test) => {
      const ConfigStub = Config
      ConfigStub.HANDLERS_CRON_DISABLED = false
      ConfigStub.HANDLERS_API_DISABLED = true

      Setup = Proxyquire('../../../src/shared/setup', {
        crypto: {
          randomUUID: uuidStub
        },
        '../handlers/register': RegisterHandlersStub,
        '../lib/db': DbStub,
        '../lib/proxyCache': ProxyCacheStub,
        '../lib/cache': CacheStub,
        '@mojaloop/object-store-lib': ObjStoreStub,
        '../lib/migrator': MigratorStub,
        './plugins': PluginsStub,
        '../lib/urlParser': UrlParserStub,
        '@hapi/hapi': HapiStub,
        '../lib/config': ConfigStub
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
        crypto: {
          randomUUID: uuidStub
        },
        '../handlers/register': RegisterHandlersStub,
        '../lib/db': DbStub,
        '../lib/proxyCache': ProxyCacheStub,
        '../lib/cache': CacheStub,
        '@mojaloop/object-store-lib': ObjStoreStub,
        '../lib/migrator': MigratorStub,
        './plugins': PluginsStub,
        '../lib/urlParser': UrlParserStub,
        '@hapi/hapi': HapiStub,
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

      const positionBatchHandler = {
        type: 'positionbatch',
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

      const bulkBrepareHandler = {
        type: 'bulkprepare',
        enabled: true
      }

      const bulkFulfilHandler = {
        type: 'bulkfulfil',
        enabled: true
      }

      const bulkProcessingHandler = {
        type: 'bulkprocessing',
        enabled: true
      }

      const bulkGetHandler = {
        type: 'bulkget',
        enabled: true
      }

      const unknownHandler = {
        type: 'undefined',
        enabled: true
      }

      const modulesList = [
        prepareHandler,
        positionHandler,
        positionBatchHandler,
        fulfilHandler,
        timeoutHandler,
        adminHandler,
        getHandler,
        bulkBrepareHandler,
        bulkFulfilHandler,
        bulkProcessingHandler,
        bulkGetHandler,
        unknownHandler
        // rejectHandler
      ]

      Setup.initialize({ service, runHandlers: true, handlers: modulesList }).then(() => {
        test.ok(RegisterHandlersStub.transfers.registerPrepareHandler.called)
        test.ok(RegisterHandlersStub.transfers.registerFulfilHandler.called)
        test.ok(RegisterHandlersStub.positions.registerPositionHandler.called)
        test.ok(RegisterHandlersStub.positionsBatch.registerPositionHandler.called)
        test.ok(RegisterHandlersStub.timeouts.registerTimeoutHandler.called)
        test.ok(RegisterHandlersStub.admin.registerAdminHandlers.called)
        test.ok(RegisterHandlersStub.transfers.registerGetHandler.called)
        test.ok(RegisterHandlersStub.bulk.registerBulkPrepareHandler.called)
        test.ok(RegisterHandlersStub.bulk.registerBulkFulfilHandler.called)
        test.ok(RegisterHandlersStub.bulk.registerBulkProcessingHandler.called)
        test.ok(RegisterHandlersStub.bulk.registerBulkGetHandler.called)
        test.ok(processExitStub.called)
        test.end()
      }).catch(err => {
        test.fail(`should have exited the process ${err}`)
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
        crypto: {
          randomUUID: uuidStub
        },
        '../handlers/register': RegisterHandlersStub,
        '../lib/db': DbStub,
        '../lib/proxyCache': ProxyCacheStub,
        '../lib/cache': CacheStub,
        '@mojaloop/object-store-lib': ObjStoreStub,
        '../lib/migrator': MigratorStub,
        './plugins': PluginsStub,
        '../lib/urlParser': UrlParserStub,
        '@hapi/hapi': HapiStub,
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
