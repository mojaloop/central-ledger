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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>

 --------------
 ******/
'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const TimeoutHandler = require('../../../../src/handlers/timeouts/handler')
const CronJob = require('cron').CronJob
const Proxyquire = require('proxyquire')
const TimeoutService = require('../../../../src/domain/timeout')
const Config = require('../../../../src/lib/config')
const { randomUUID } = require('crypto')
const ProxyCache = require('#src/lib/proxyCache')
const DistLock = require('../../../../src/lib/distLock')
const Enum = require('@mojaloop/central-services-shared').Enum
const Utility = require('@mojaloop/central-services-shared').Util.Kafka

Test('Timeout handler', TimeoutHandlerTest => {
  let sandbox
  let DistLockStub
  let createDistLockStub

  TimeoutHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(TimeoutService)
    sandbox.stub(Utility)
    sandbox.stub(CronJob.prototype, 'constructor').returns(Promise.resolve())
    sandbox.stub(CronJob.prototype, 'start').returns(Promise.resolve(true))
    sandbox.stub(CronJob.prototype, 'stop').returns(Promise.resolve(true))
    sandbox.stub(ProxyCache, 'getCache').returns({
      connect: sandbox.stub(),
      disconnect: sandbox.stub()
    })
    DistLockStub = {
      acquire: sandbox.stub().resolves(true),
      release: sandbox.stub().resolves(),
      extend: sandbox.stub().resolves()
    }
    createDistLockStub = sandbox.stub(DistLock, 'createLock').returns(DistLockStub)
    Config.HANDLERS_TIMEOUT_DISABLED = false
    test.end()
  })

  TimeoutHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  TimeoutHandlerTest.test('timeout should', timeoutTest => {
    const timeoutSegmentMock = {
      segmentId: 1,
      value: 10
    }
    const latestTransferStateChangeMock = {
      transferStateChangeId: 20
    }
    const latestFxTransferStateChangeMock = {
      fxTransferStateChangeId: 20
    }
    const transferTimeoutListMock = [
      {
        transferId: randomUUID(),
        bulkTransferId: null,
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2',
        transferStateId: Enum.Transfers.TransferInternalState.EXPIRED_PREPARED,
        payerParticipantCurrencyId: 0,
        effectedParticipantCurrencyId: 0
      },
      {
        transferId: randomUUID(),
        bulkTransferId: null,
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2',
        transferStateId: Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT,
        payerParticipantCurrencyId: 0,
        effectedParticipantCurrencyId: 0
      },
      {
        transferId: randomUUID(),
        bulkTransferId: null,
        payerFsp: 'dfsp2',
        payeeFsp: 'dfsp1',
        transferStateId: Enum.Transfers.TransferState.COMMITTED,
        payerParticipantCurrencyId: 0,
        effectedParticipantCurrencyId: 0
      },
      {
        transferId: randomUUID(),
        bulkTransferId: randomUUID(),
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2',
        transferStateId: Enum.Transfers.TransferInternalState.EXPIRED_PREPARED,
        payerParticipantCurrencyId: 0,
        effectedParticipantCurrencyId: 0
      },
      {
        transferId: randomUUID(),
        bulkTransferId: randomUUID(),
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2',
        transferStateId: Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT,
        payerParticipantCurrencyId: 0,
        effectedParticipantCurrencyId: 0
      },
      {
        transferId: randomUUID(),
        bulkTransferId: randomUUID(),
        payerFsp: 'dfsp2',
        payeeFsp: 'dfsp1',
        transferStateId: Enum.Transfers.TransferState.COMMITTED,
        payerParticipantCurrencyId: 0,
        effectedParticipantCurrencyId: 0
      }
    ]
    const fxTransferTimeoutListMock = [
      {
        commitRequestId: randomUUID(),
        initiatingFsp: 'dfsp1',
        counterPartyFsp: 'dfsp2',
        transferStateId: Enum.Transfers.TransferInternalState.EXPIRED_PREPARED,
        payerParticipantCurrencyId: 0,
        effectedParticipantCurrencyId: 0
      },
      {
        commitRequestId: randomUUID(),
        initiatingFsp: 'dfsp1',
        counterPartyFsp: 'dfsp2',
        transferStateId: Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT,
        payerParticipantCurrencyId: 0,
        effectedParticipantCurrencyId: 0
      }
    ]
    const resultMock = {
      transferTimeoutList: transferTimeoutListMock,
      fxTransferTimeoutList: fxTransferTimeoutListMock
    }
    let expected = {
      cleanup: 1,
      fxCleanup: 1,
      intervalMin: 10,
      intervalMax: 20,
      fxIntervalMin: 10,
      fxIntervalMax: 20,
      ...resultMock
    }

    timeoutTest.test('perform timeout', async (test) => {
      TimeoutService.getTimeoutSegment = sandbox.stub().returns(timeoutSegmentMock)
      TimeoutService.getFxTimeoutSegment = sandbox.stub().returns(timeoutSegmentMock)
      TimeoutService.cleanupTransferTimeout = sandbox.stub().returns(1)
      TimeoutService.cleanupFxTransferTimeout = sandbox.stub().returns(1)
      TimeoutService.getLatestTransferStateChange = sandbox.stub().returns(latestTransferStateChangeMock)
      TimeoutService.getLatestFxTransferStateChange = sandbox.stub().returns(latestFxTransferStateChangeMock)
      TimeoutService.timeoutExpireReserved = sandbox.stub().returns(resultMock)
      Utility.produceGeneralMessage = sandbox.stub()

      const TimeoutHandlerProxy = Proxyquire('../../../../src/handlers/timeouts/handler', {
        '../../lib/distLock': {
          createLock: createDistLockStub
        }
      })

      await TimeoutHandlerProxy.registerTimeoutHandler()
      const result = await TimeoutHandlerProxy.timeout()
      const produceGeneralMessageCalls = Utility.produceGeneralMessage.getCalls()

      for (const message of produceGeneralMessageCalls) {
        if (message.args[2] === 'position') {
          // Check message key matches payer account id
          test.equal(message.args[6], '0')
        }
      }
      test.deepEqual(result, expected, 'Expected result is returned')
      test.equal(Utility.produceGeneralMessage.callCount, 6, '6 messages were produced')
      test.end()
    })

    timeoutTest.test('perform timeout with single messages', async (test) => {
      const resultMock1 = {
        transferTimeoutList: transferTimeoutListMock[0],
        fxTransferTimeoutList: fxTransferTimeoutListMock[0]
      }

      TimeoutService.getTimeoutSegment = sandbox.stub().returns(timeoutSegmentMock)
      TimeoutService.getFxTimeoutSegment = sandbox.stub().returns(timeoutSegmentMock)
      TimeoutService.cleanupTransferTimeout = sandbox.stub().returns(1)
      TimeoutService.cleanupFxTransferTimeout = sandbox.stub().returns(1)
      TimeoutService.getLatestTransferStateChange = sandbox.stub().returns(latestTransferStateChangeMock)
      TimeoutService.getLatestFxTransferStateChange = sandbox.stub().returns(latestFxTransferStateChangeMock)
      TimeoutService.timeoutExpireReserved = sandbox.stub().returns(resultMock1)
      Utility.produceGeneralMessage = sandbox.stub()

      const TimeoutHandlerProxy = Proxyquire('../../../../src/handlers/timeouts/handler', {
        '../../lib/distLock': {
          createLock: createDistLockStub
        }
      })

      await TimeoutHandlerProxy.registerTimeoutHandler()
      const result = await TimeoutHandlerProxy.timeout()
      const produceGeneralMessageCalls = Utility.produceGeneralMessage.getCalls()

      for (const message of produceGeneralMessageCalls) {
        if (message.args[2] === 'position') {
          // Check message key matches payer account id
          test.equal(message.args[6], '0')
        }
      }

      const expected1 = {
        ...expected,
        ...resultMock1
      }
      test.deepEqual(result, expected1, 'Expected result is returned')
      test.equal(Utility.produceGeneralMessage.callCount, 2, '2 messages were produced')
      test.end()
    })

    timeoutTest.test('perform timeout when no data is present in segment table', async (test) => {
      TimeoutService.getTimeoutSegment = sandbox.stub().returns(null)
      TimeoutService.getFxTimeoutSegment = sandbox.stub().returns(null)
      TimeoutService.cleanupTransferTimeout = sandbox.stub().returns(1)
      TimeoutService.cleanupFxTransferTimeout = sandbox.stub().returns(1)
      TimeoutService.getLatestTransferStateChange = sandbox.stub().returns(null)
      TimeoutService.getLatestFxTransferStateChange = sandbox.stub().returns(null)
      const resultMock1 = {
        transferTimeoutList: null,
        fxTransferTimeoutList: null
      }
      TimeoutService.timeoutExpireReserved = sandbox.stub().returns(resultMock1)
      Utility.produceGeneralMessage = sandbox.stub()
      expected = {
        cleanup: 1,
        fxCleanup: 1,
        intervalMin: 0,
        intervalMax: 0,
        fxIntervalMin: 0,
        fxIntervalMax: 0,
        ...resultMock1
      }

      const TimeoutHandlerProxy = Proxyquire('../../../../src/handlers/timeouts/handler', {
        '../../lib/distLock': {
          createLock: createDistLockStub
        }
      })

      await TimeoutHandlerProxy.registerTimeoutHandler()
      const result = await TimeoutHandlerProxy.timeout()
      test.deepEqual(result, expected, 'Expected result is returned')
      test.ok(Utility.produceGeneralMessage.notCalled, 'No messages have been produced produced')
      test.end()
    })

    timeoutTest.test('throw error', async (test) => {
      TimeoutService.getTimeoutSegment = sandbox.stub().throws(new Error('Database unavailable'))
      const TimeoutHandlerProxy = Proxyquire('../../../../src/handlers/timeouts/handler', {
        '../../lib/distLock': {
          createLock: createDistLockStub
        }
      })

      try {
        await TimeoutHandlerProxy.registerTimeoutHandler()
        await TimeoutHandlerProxy.timeout()
        test.fail('Error not thrown')
      } catch (err) {
        test.ok(err instanceof Error)
      }
      test.end()
    })

    timeoutTest.test('handle message errors', async (test) => {
      TimeoutService.getTimeoutSegment = sandbox.stub().returns(timeoutSegmentMock)
      TimeoutService.cleanupTransferTimeout = sandbox.stub().returns(1)
      TimeoutService.getLatestTransferStateChange = sandbox.stub().returns(latestTransferStateChangeMock)
      TimeoutService.timeoutExpireReserved = sandbox.stub().returns(resultMock)
      Utility.produceGeneralMessage = sandbox.stub().throws()

      const TimeoutHandlerProxy = Proxyquire('../../../../src/handlers/timeouts/handler', {
        '../../lib/distLock': {
          createLock: createDistLockStub
        }
      })

      try {
        await TimeoutHandlerProxy.registerTimeoutHandler()
        await TimeoutHandlerProxy.timeout()
        test.error('Exception expected')
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    timeoutTest.test('handle fx message errors', async (test) => {
      const resultMock1 = {
        transferTimeoutList: [],
        fxTransferTimeoutList: fxTransferTimeoutListMock[0]
      }
      TimeoutService.timeoutExpireReserved = sandbox.stub().returns(resultMock1)

      TimeoutService.getTimeoutSegment = sandbox.stub().returns(null)
      TimeoutService.getFxTimeoutSegment = sandbox.stub().returns(timeoutSegmentMock)
      TimeoutService.cleanupTransferTimeout = sandbox.stub().returns(1)
      TimeoutService.cleanupFxTransferTimeout = sandbox.stub().returns(1)
      TimeoutService.getLatestTransferStateChange = sandbox.stub().returns(null)
      TimeoutService.getLatestFxTransferStateChange = sandbox.stub().returns(latestFxTransferStateChangeMock)
      Utility.produceGeneralMessage = sandbox.stub().throws()

      const TimeoutHandlerProxy = Proxyquire('../../../../src/handlers/timeouts/handler', {
        '../../lib/distLock': {
          createLock: createDistLockStub
        }
      })

      try {
        await TimeoutHandlerProxy.registerTimeoutHandler()
        await TimeoutHandlerProxy.timeout()
        test.error('Exception expected')
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    timeoutTest.end()
  })

  TimeoutHandlerTest.test('registerAllHandlers should', registerHandlersTest => {
    registerHandlersTest.test('register timeout handler', async (test) => {
      const TimeoutHandlerProxy = Proxyquire('../../../../src/handlers/timeouts/handler', {
        '../../lib/distLock': {
          createLock: createDistLockStub
        }
      })
      const result = await TimeoutHandlerProxy.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.test('do not start the handler when its disabled in config', async (test) => {
      Config.HANDLERS_TIMEOUT_DISABLED = true
      const TimeoutHandlerProxy = Proxyquire('../../../../src/handlers/timeouts/handler', {
        '../../lib/distLock': {
          createLock: createDistLockStub
        }
      })
      const result = await TimeoutHandlerProxy.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.end()
  })

  TimeoutHandlerTest.test('registerTimeoutHandler should', registerTimeoutHandlerTest => {
    registerTimeoutHandlerTest.test('register timeout handler', async (test) => {
      const TimeoutHandlerProxy = Proxyquire('../../../../src/handlers/timeouts/handler', {
        '../../lib/distLock': {
          createLock: createDistLockStub
        }
      })
      const result = await TimeoutHandlerProxy.registerAllHandlers()
      test.equal(result, true)
      await TimeoutHandlerProxy.stop()
      test.end()
    })

    registerTimeoutHandlerTest.test('tear down the handler', async (test) => {
      await TimeoutHandler.stop()
      test.pass('reached stop')
      test.end()
    })

    registerTimeoutHandlerTest.test('isRunning', async (test) => {
      const TimeoutHandlerProxy = Proxyquire('../../../../src/handlers/timeouts/handler', {
        '../../lib/distLock': {
          createLock: createDistLockStub
        }
      })
      await TimeoutHandlerProxy.registerAllHandlers()
      const result = await TimeoutHandlerProxy.isRunning()
      test.equal(result, true)
      test.end()
    })

    registerTimeoutHandlerTest.test('should throw error', async (test) => {
      CronJob.prototype.start.throws(new Error())
      try {
        const TimeoutHandlerProxy = Proxyquire('../../../../src/handlers/timeouts/handler', {
          '../../lib/distLock': {
            createLock: createDistLockStub
          }
        })
        await TimeoutHandlerProxy.registerAllHandlers()
        test.fail('should throw')
        test.end()
      } catch (e) {
        test.ok(e instanceof Error)
        test.end()
      }
    })

    registerTimeoutHandlerTest.end()
  })

  TimeoutHandlerTest.test('stop should', stopTest => {
    stopTest.test('to reach else branch', async (test) => {
      const TimeoutHandlerProxy = Proxyquire('../../../../src/handlers/timeouts/handler', {
        '../../lib/distLock': {
          createLock: createDistLockStub
        }
      })
      await TimeoutHandlerProxy.stop()
      test.pass('reached stop')
      test.end()
    })

    stopTest.end()
  })

  TimeoutHandlerTest.end()
})
