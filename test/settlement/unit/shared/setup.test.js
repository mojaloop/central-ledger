/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 --------------
 ******/

'use strict'

const Config = require('../../../../src/settlement/lib/config')
const { logger } = require('../../../../src/settlement/shared/logger')
const Path = require('path')
const Proxyquire = require('proxyquire')
const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const getPort = async () => (await import('get-port')).default()

Test('Server Setup', async setupTest => {
  let sandbox
  let serverStub
  let HapiStub
  let HapiOpenAPIStub
  let PathStub
  let DbStub
  let EnumsStub
  let ConfigStub
  let EngineStub
  let SetupProxy
  let RegisterHandlersStub

  setupTest.beforeEach(test => {
    try {
      sandbox = Sinon.createSandbox()
      sandbox.stub(logger, 'isDebugEnabled').value(true)
      sandbox.stub(logger, 'debug')
      sandbox.stub(logger, 'isErrorEnabled').value(true)
      sandbox.stub(logger, 'error')
      sandbox.stub(logger, 'isInfoEnabled').value(true)
      sandbox.stub(logger, 'info')

      RegisterHandlersStub = {
        registerAllHandlers: sandbox.stub().returns(Promise.resolve()),
        deferredSettlement: {
          registerSettlementWindowHandler: sandbox.stub().returns(Promise.resolve())
        },
        grossSettlement: {
          registerTransferSettlementHandler: sandbox.stub().returns(Promise.resolve())
        },
        rules: {
          registerRulesHandler: sandbox.stub().returns(Promise.resolve())
        }
      }

      serverStub = {
        register: sandbox.stub(),
        method: sandbox.stub(),
        start: sandbox.stub(),
        log: sandbox.stub(),
        plugins: {
          openapi: {
            setHost: sandbox.stub()
          }
        },
        info: {
          host: Config.HOSTNAME,
          port: Config.PORT
        },
        ext: sandbox.stub()
      }
      HapiStub = {
        Server: sandbox.stub().returns(serverStub)
      }
      DbStub = {
        connect: sandbox.stub().returns(Promise.resolve())
      }
      HapiOpenAPIStub = sandbox.stub()
      PathStub = Path
      EnumsStub = [sandbox.stub()]
      ConfigStub = Config
      EngineStub = sandbox.stub()

      SetupProxy = Proxyquire('../../../../src/settlement/shared/setup', {
        '@hapi/catbox-memory': EngineStub,
        '@hapi/hapi': HapiStub,
        'hapi-openapi': HapiOpenAPIStub,
        path: PathStub,
        '../lib/db': DbStub,
        '../models/lib/enums': EnumsStub,
        '../lib/config': ConfigStub
      })
    } catch (err) {
      logger.error(`setupTest failed with error - ${err}`)
      console.error(err.message)
    }
    test.end()
  })

  setupTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await setupTest.test('init should', async initTest => {
    try {
      await initTest.test('test 1 - API', async test => {
        try {
          const errorToThrow = new Error('Throw Boom error')

          const HapiStubThrowError = {
            Server: sandbox.stub().callsFake((opt) => {
              opt.routes.validate.failAction(sandbox.stub(), sandbox.stub(), errorToThrow)
              return serverStub
            })
          }

          const SetupProxy1 = Proxyquire('../../../../src/settlement/shared/setup', {
            '@hapi/catbox-memory': EngineStub,
            '@hapi/hapi': HapiStubThrowError,
            'hapi-openapi': HapiOpenAPIStub,
            path: PathStub,
            '../lib/db': DbStub,
            '../models/lib/enums': EnumsStub,
            '../lib/config': ConfigStub
          })

          const port = await getPort()
          const server = await SetupProxy1.initialize({ service: 'api', port })
          test.ok(server, 'return server object')
          test.ok(HapiStubThrowError.Server.calledOnce, 'Hapi.Server called once')
          test.ok(DbStub.connect.calledOnce, 'Db.connect called once')
          test.equal(serverStub.register.callCount, 7, 'server.register called 7 times')
          test.ok(serverStub.method.calledOnce, 'server.method called once')
          test.ok(serverStub.start.calledOnce, 'server.start called once')
          test.ok(serverStub.plugins.openapi.setHost.calledOnce, 'server.plugins.openapi.setHost called once')
          test.ok(serverStub.ext.calledOnce, 'server.ext called once')
          test.end()
        } catch (err) {
          logger.error(`init failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await initTest.test('test 1 - handler', async test => {
        try {
          const errorToThrow = new Error('Throw Boom error')

          const HapiStubThrowError = {
            Server: sandbox.stub().callsFake((opt) => {
              opt.routes.validate.failAction(sandbox.stub(), sandbox.stub(), errorToThrow)
              return serverStub
            })
          }

          const SetupProxy1 = Proxyquire('../../../../src/settlement/shared/setup', {
            '@hapi/catbox-memory': EngineStub,
            '@hapi/hapi': HapiStubThrowError,
            'hapi-openapi': HapiOpenAPIStub,
            path: PathStub,
            '../lib/db': DbStub,
            '../models/lib/enums': EnumsStub,
            '../lib/config': ConfigStub
          })

          const port = await getPort()
          const server = await SetupProxy1.initialize({ service: 'handler', port })
          test.ok(server, 'return server object')
          test.ok(HapiStubThrowError.Server.calledOnce, 'Hapi.Server called once')
          test.ok(DbStub.connect.calledOnce, 'Db.connect called once')
          test.equal(serverStub.register.callCount, 7, 'server.register called 7 times')
          test.ok(serverStub.method.calledOnce, 'server.method called once')
          test.ok(serverStub.start.calledOnce, 'server.start called once')
          test.ok(serverStub.plugins.openapi.setHost.calledOnce, 'server.plugins.openapi.setHost called once')
          test.end()
        } catch (err) {
          logger.error(`init failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await initTest.test('test 2 - handler', async test => {
        try {
          const errorToThrow = new Error('Throw Boom error')

          const HapiStubThrowError = {
            Server: sandbox.stub().callsFake((opt) => {
              opt.routes.validate.failAction(sandbox.stub(), sandbox.stub(), errorToThrow)
              return serverStub
            })
          }

          const Config2Stub = Object.assign({}, ConfigStub)
          Config2Stub.HANDLERS_API_DISABLED = true
          const SetupProxy1 = Proxyquire('../../../../src/settlement/shared/setup', {
            '@hapi/catbox-memory': EngineStub,
            '@hapi/hapi': HapiStubThrowError,
            'hapi-openapi': HapiOpenAPIStub,
            path: PathStub,
            '../lib/db': DbStub,
            '../models/lib/enums': EnumsStub,
            '../lib/config': Config2Stub
          })

          const port = await getPort()
          const server = await SetupProxy1.initialize({ service: 'handler', port })
          test.notok(server, 'not create server object')
          test.end()
        } catch (err) {
          logger.error(`init failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await initTest.test('test - handler service type, run handlers true and a handler list', async test => {
        try {
          const errorToThrow = new Error('Throw Boom error')

          const HapiStubThrowError = {
            Server: sandbox.stub().callsFake((opt) => {
              opt.routes.validate.failAction(sandbox.stub(), sandbox.stub(), errorToThrow)
              return serverStub
            })
          }

          const SetupProxy1 = Proxyquire('../../../../src/settlement/shared/setup', {
            '../handlers/register': RegisterHandlersStub,
            '@hapi/catbox-memory': EngineStub,
            'hapi-openapi': HapiOpenAPIStub,
            path: PathStub,
            '../lib/db': DbStub,
            '../models/lib/enums': EnumsStub,
            '../lib/config': ConfigStub,
            '@hapi/hapi': HapiStubThrowError
          })

          const settlementwindowHandler = {
            type: 'deferredSettlement',
            enabled: true
          }
          const fakeHandler = {
            type: 'fake',
            enabled: false
          }

          const modulesList = [
            settlementwindowHandler,
            fakeHandler
          ]

          const port = await getPort()
          const server = await SetupProxy1.initialize({ service: 'handler', port, modules: [], runHandlers: true, handlers: modulesList })
          test.ok(server, 'return server object')
          test.ok(RegisterHandlersStub.deferredSettlement.registerSettlementWindowHandler.called)
          test.end()
        } catch (err) {
          logger.error(`init failed with error - ${err}`)
          test.fail(`Should have not received an error: ${err}`)
          test.end()
        }
      })

      await initTest.test('test - handler transferSettlement handler', async test => {
        try {
          const errorToThrow = new Error('Throw Boom error')

          const HapiStubThrowError = {
            Server: sandbox.stub().callsFake((opt) => {
              opt.routes.validate.failAction(sandbox.stub(), sandbox.stub(), errorToThrow)
              return serverStub
            })
          }

          const SetupProxy1 = Proxyquire('../../../../src/settlement/shared/setup', {
            '../handlers/register': RegisterHandlersStub,
            '@hapi/catbox-memory': EngineStub,
            '@hapi/hapi': HapiStubThrowError,
            'hapi-openapi': HapiOpenAPIStub,
            path: PathStub,
            '../lib/db': DbStub,
            '../models/lib/enums': EnumsStub,
            '../lib/config': ConfigStub
          })

          const transferSettlementHandler = {
            type: 'grossSettlement',
            enabled: true
          }

          const modulesList = [
            transferSettlementHandler
          ]

          const port = await getPort()
          const server = await SetupProxy1.initialize({ service: 'handler', port, modules: [], runHandlers: true, handlers: modulesList })
          test.ok(server, 'return server object')
          test.ok(RegisterHandlersStub.grossSettlement.registerTransferSettlementHandler.called)
          test.end()
        } catch (err) {
          logger.error(`init failed with error - ${err}`)
          test.fail(`Should have not received an error: ${err}`)
          test.end()
        }
      })

      await initTest.test('test - handler rules handler', async test => {
        try {
          const errorToThrow = new Error('Throw Boom error')

          const HapiStubThrowError = {
            Server: sandbox.stub().callsFake((opt) => {
              opt.routes.validate.failAction(sandbox.stub(), sandbox.stub(), errorToThrow)
              return serverStub
            })
          }

          const SetupProxy1 = Proxyquire('../../../../src/settlement/shared/setup', {
            '../handlers/register': RegisterHandlersStub,
            '@hapi/catbox-memory': EngineStub,
            '@hapi/hapi': HapiStubThrowError,
            'hapi-openapi': HapiOpenAPIStub,
            path: PathStub,
            '../lib/db': DbStub,
            '../models/lib/enums': EnumsStub,
            '../lib/config': ConfigStub
          })

          const rulesHandler = {
            type: 'rules',
            enabled: true
          }

          const modulesList = [
            rulesHandler
          ]

          const port = await getPort()
          const server = await SetupProxy1.initialize({ service: 'handler', port, modules: [], runHandlers: true, handlers: modulesList })
          test.ok(server, 'return server object')
          test.ok(RegisterHandlersStub.rules.registerRulesHandler.called)
          test.end()
        } catch (err) {
          logger.error(`init failed with error - ${err}`)
          test.fail(`Should have not received an error: ${err}`)
          test.end()
        }
      })

      await initTest.test('test - handler service type, run handlers true a handler list and incorrect handler type', async test => {
        try {
          const errorToThrow = new Error('Throw Boom error')

          const HapiStubThrowError = {
            Server: sandbox.stub().callsFake((opt) => {
              opt.routes.validate.failAction(sandbox.stub(), sandbox.stub(), errorToThrow)
              return serverStub
            })
          }

          const SetupProxy1 = Proxyquire('../../../../src/settlement/shared/setup', {
            '../handlers/register': RegisterHandlersStub,
            '@hapi/catbox-memory': EngineStub,
            '@hapi/hapi': HapiStubThrowError,
            'hapi-openapi': HapiOpenAPIStub,
            path: PathStub,
            '../lib/db': DbStub,
            '../models/lib/enums': EnumsStub,
            '../lib/config': ConfigStub
          })

          const settlementwindowHandler = {
            type: 'invalidWindow',
            enabled: true
          }

          const modulesList = [
            settlementwindowHandler
          ]

          const port = await getPort()
          const server = await SetupProxy1.initialize({ service: 'handler', port, modules: [], runHandlers: true, handlers: modulesList })
          test.ok(server, 'return server object')
          test.ok(RegisterHandlersStub.settlementWindow.registerSettlementWindowHandler.called)
          test.end()
        } catch (err) {
          logger.error(`init failed with error - ${err}`)
          test.pass(`Should have failed with an error: ${err}`)
          test.end()
        }
      })

      await initTest.test('test - handler service type and run handlers true', async test => {
        try {
          const errorToThrow = new Error('Throw Boom error')

          const HapiStubThrowError = {
            Server: sandbox.stub().callsFake((opt) => {
              opt.routes.validate.failAction(sandbox.stub(), sandbox.stub(), errorToThrow)
              return serverStub
            })
          }

          const SetupProxy1 = Proxyquire('../../../../src/settlement/shared/setup', {
            '../handlers/register': RegisterHandlersStub,
            '@hapi/catbox-memory': EngineStub,
            '@hapi/hapi': HapiStubThrowError,
            'hapi-openapi': HapiOpenAPIStub,
            path: PathStub,
            '../lib/db': DbStub,
            '../models/lib/enums': EnumsStub,
            '../lib/config': ConfigStub
          })

          const port = await getPort()
          const server = await SetupProxy1.initialize({ service: 'handler', port, modules: [], runHandlers: true })
          test.ok(server, 'return server object')
          test.ok(RegisterHandlersStub.registerAllHandlers.called)
          test.end()
        } catch (err) {
          logger.error(`init failed with error - ${err}`)
          test.fail(`Should have not received an error: ${err}`)
          test.end()
        }
      })

      await initTest.test('test 1 - invalid service type', async test => {
        try {
          const errorToThrow = new Error('No valid service type')

          const HapiStubThrowError = {
            Server: sandbox.stub().callsFake((opt) => {
              opt.routes.validate.failAction(sandbox.stub(), sandbox.stub(), errorToThrow)
              return serverStub
            })
          }

          const SetupProxy1 = Proxyquire('../../../../src/settlement/shared/setup', {
            '@hapi/catbox-memory': EngineStub,
            '@hapi/hapi': HapiStubThrowError,
            'hapi-openapi': HapiOpenAPIStub,
            path: PathStub,
            '../lib/db': DbStub,
            '../models/lib/enums': EnumsStub,
            '../lib/config': ConfigStub
          })

          const port = await getPort()
          const server = await SetupProxy1.initialize({ service: 'invalid', port })
          test.fail(server, 'Invalid service type')
          test.end()
        } catch (err) {
          logger.error(`init failed with error - ${err}`)
          test.pass()
          test.end()
        }
      })

      await initTest.test('should catch errors and console.error output', async test => {
        try {
          const e = new Error('Database unavailable')
          DbStub.connect = sandbox.stub().throws(e)
          const consoleErrorStub = sandbox.stub(console, 'error')
          const port = await getPort()
          await SetupProxy.initialize({ service: 'api', port })
          test.ok(consoleErrorStub.withArgs(e).calledOnce)
          consoleErrorStub.restore()
          test.end()
        } catch (err) {
          logger.error(`init failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await initTest.test('should catch errors after server.start and use server.log', async test => {
        try {
          const e = new Error('setHost error')
          serverStub.plugins.openapi.setHost = sandbox.stub().throws(e)
          const port = await getPort()
          await SetupProxy.initialize({ service: 'api', port })
          test.ok(serverStub.log.withArgs('error', e.message).calledOnce)
          test.end()
        } catch (err) {
          logger.error(`init failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await initTest.test('invoke server method enums', async test => {
        try {
          await SetupProxy.__testonly__.getEnums(0)
          test.ok(EnumsStub[0].withArgs().calledOnce)
          test.end()
        } catch (err) {
          logger.error(`init failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await initTest.test('should log correct dbLoadedTables when Db._tables is undefined', async test => {
        try {
          // Arrange
          delete DbStub._tables
          DbStub.connect = sandbox.stub().callsFake(async () => {
            delete DbStub._tables
          })
          const port = await getPort()
          await SetupProxy.initialize({ service: 'api', port })
          test.end()
        } catch (err) {
          logger.error(`init failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })
      await initTest.end()
    } catch (err) {
      logger.error(`setupTest failed with error - ${err}`)
      initTest.fail()
      initTest.end()
    }
  })

  await setupTest.end()
})
