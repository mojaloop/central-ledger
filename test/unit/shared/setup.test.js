'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Hapi = require('hapi')
const P = require('bluebird')
const ErrorHandling = require('@mojaloop/central-services-error-handling')
const Migrator = require('../../../src/lib/migrator')
const Db = require('../../../src/db')
const Config = require('../../../src/lib/config')
const Eventric = require('../../../src/eventric')
const Plugins = require('../../../src/shared/plugins')
const RequestLogger = require('../../../src/lib/request-logger')
const UrlParser = require('../../../src/lib/urlparser')
const Sidecar = require('../../../src/lib/sidecar')
const Proxyquire = require('proxyquire')

Test('setup', setupTest => {
  let sandbox
  let uuidStub
  let oldHostName
  let oldDatabaseUri
  let hostName = 'http://test.com'
  let databaseUri = 'some-database-uri'
  let Setup

  setupTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Hapi, 'Server')
    sandbox.stub(Plugins, 'registerPlugins')
    sandbox.stub(Migrator)
    sandbox.stub(Eventric)
    sandbox.stub(UrlParser, 'idFromTransferUri')
    sandbox.stub(RequestLogger, 'logRequest')
    sandbox.stub(RequestLogger, 'logResponse')

    Sidecar.connect = sandbox.stub()
    Db.connect = sandbox.stub()
    Db.disconnect = sandbox.stub()
    uuidStub = sandbox.stub()

    Setup = Proxyquire('../../../src/shared/setup', { 'uuid4': uuidStub })

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

  const createServer = () => {
    const server = {
      connection: sandbox.stub(),
      register: sandbox.stub(),
      ext: sandbox.stub()
    }
    Hapi.Server.returns(server)
    return server
  }

  setupTest.test('createServer should', createServerTest => {
    createServerTest.test('return Hapi Server', test => {
      const server = createServer()

      Setup.createServer().then(s => {
        test.deepEqual(s, server)
        test.end()
      })
    })

    createServerTest.test('setup connection', test => {
      const server = createServer()
      const port = 1234

      Setup.createServer(port).then(() => {
        test.ok(server.connection.calledWith(Sinon.match({
          port,
          routes: {
            validate: ErrorHandling.validateRoutes()
          }
        })))
        test.end()
      })
    })

    createServerTest.test('log request and traceid', test => {
      const server = createServer()
      const port = 1234

      let request = { headers: { traceid: '1234' }, url: { path: '/test' } }
      let reply = { continue: sandbox.stub() }
      server.ext.onFirstCall().callsArgWith(1, request, reply)

      Setup.createServer(port).then(() => {
        test.ok(RequestLogger.logRequest.calledWith(request))
        test.ok(reply.continue.calledOnce)
        test.end()
      })
    })

    createServerTest.test('use transfer id if traceid not found', test => {
      const server = createServer()
      const port = 1234
      const transferId = 'transfer-id'
      const path = '/test'

      UrlParser.idFromTransferUri.returns(transferId)

      let request = { headers: { }, url: { path } }
      let reply = { continue: sandbox.stub() }
      server.ext.onFirstCall().callsArgWith(1, request, reply)

      Setup.createServer(port).then(() => {
        test.ok(RequestLogger.logRequest.calledWith(sandbox.match({
          headers: {
            traceid: transferId
          }
        })))
        test.ok(UrlParser.idFromTransferUri.calledWith(`${hostName}${path}`))
        test.ok(reply.continue.calledOnce)
        test.end()
      })
    })

    createServerTest.test('create new uuid if traceid and transfer id not found', test => {
      const server = createServer()
      const port = 1234
      const uuid = 'new-trace-id'

      uuidStub.returns(uuid)

      let request = { headers: { }, url: { path: '/' } }
      let reply = { continue: sandbox.stub() }
      server.ext.onFirstCall().callsArgWith(1, request, reply)

      Setup.createServer(port).then(() => {
        test.ok(RequestLogger.logRequest.calledWith(sandbox.match({
          headers: {
            traceid: uuid
          }
        })))
        test.ok(reply.continue.calledOnce)
        test.end()
      })
    })

    createServerTest.test('log response', test => {
      const server = createServer()
      const port = 1234

      let request = { headers: { traceid: '1234' } }
      let reply = { continue: sandbox.stub() }
      server.ext.onSecondCall().callsArgWith(1, request, reply)

      Setup.createServer(port).then(() => {
        test.ok(RequestLogger.logResponse.calledWith(request))
        test.ok(reply.continue.calledOnce)
        test.end()
      })
    })

    createServerTest.test('register shared plugins', test => {
      const server = createServer()
      Setup.createServer().then(() => {
        test.ok(Plugins.registerPlugins.calledWith(server))
        test.end()
      })
    })

    createServerTest.test('register provide modules', test => {
      const server = createServer()
      const modules = ['one', 'two']
      Setup.createServer(1234, modules).then(() => {
        test.ok(server.register.calledWith(modules))
        test.end()
      })
    })

    createServerTest.end()
  })

  setupTest.test('initialize should', initializeTest => {
    const setupPromises = () => {
      Migrator.migrate.returns(P.resolve())
      Db.connect.returns(P.resolve())
      Eventric.getContext.returns(P.resolve())
      Sidecar.connect.returns(P.resolve())
      return createServer()
    }

    initializeTest.test('connect to sidecar', test => {
      const server = setupPromises()

      const service = 'test'
      Setup.initialize({ service }).then(s => {
        test.ok(Db.connect.calledWith(databaseUri))
        test.ok(Sidecar.connect.calledWith(service))
        test.notOk(Eventric.getContext.called)
        test.notOk(Migrator.migrate.called)
        test.equal(s, server)
        test.end()
      })
    })

    initializeTest.test('connect to db and return hapi server', test => {
      const server = setupPromises()

      Setup.initialize({}).then(s => {
        test.ok(Db.connect.calledWith(databaseUri))
        test.notOk(Eventric.getContext.called)
        test.notOk(Migrator.migrate.called)
        test.equal(s, server)
        test.end()
      })
    })

    initializeTest.test('run migrations if runMigrations flag enabled', test => {
      setupPromises()

      Setup.initialize({ runMigrations: true }).then(() => {
        test.ok(Db.connect.called)
        test.ok(Migrator.migrate.called)
        test.notOk(Eventric.getContext.called)
        test.end()
      })
    })

    initializeTest.test('setup eventric context if loadEventric flag enabled', test => {
      setupPromises()

      Setup.initialize({ loadEventric: true }).then(() => {
        test.ok(Db.connect.called)
        test.notOk(Migrator.migrate.called)
        test.ok(Eventric.getContext.called)
        test.end()
      })
    })

    initializeTest.test('cleanup on error and rethrow', test => {
      setupPromises()

      let err = new Error('bad stuff')
      Sidecar.connect.returns(P.reject(err))

      const service = 'test'
      Setup.initialize({ service }).then(s => {
        test.fail('Should have thrown error')
        test.end()
      })
      .catch(e => {
        test.ok(Db.disconnect.calledOnce)
        test.equal(e, err)
        test.end()
      })
    })

    initializeTest.end()
  })

  setupTest.end()
})
