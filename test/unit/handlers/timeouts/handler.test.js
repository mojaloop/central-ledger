/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>

 --------------
 ******/
'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const TimeoutHandler = require('../../../../src/handlers/timeouts/handler')
const CronJob = require('cron').CronJob
const TimeoutService = require('../../../../src/domain/timeout')
const Config = require('../../../../src/lib/config')
const Uuid = require('uuid4')
const Enum = require('@mojaloop/central-services-shared').Enum
const Utility = require('@mojaloop/central-services-shared').Util.Kafka

Test('Timeout handler', TimeoutHandlerTest => {
  let sandbox

  TimeoutHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(TimeoutService)
    sandbox.stub(Utility)
    sandbox.stub(CronJob.prototype, 'constructor').returns(Promise.resolve())
    sandbox.stub(CronJob.prototype, 'start').returns(Promise.resolve(true))
    sandbox.stub(CronJob.prototype, 'stop').returns(Promise.resolve(true))
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
    const resultMock = [
      {
        transferId: Uuid(),
        bulkTransferId: null,
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2',
        transferStateId: Enum.Transfers.TransferInternalState.EXPIRED_PREPARED
      },
      {
        transferId: Uuid(),
        bulkTransferId: null,
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2',
        transferStateId: Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT
      },
      {
        transferId: Uuid(),
        bulkTransferId: null,
        payerFsp: 'dfsp2',
        payeeFsp: 'dfsp1',
        transferStateId: Enum.Transfers.TransferState.COMMITTED
      },
      {
        transferId: Uuid(),
        bulkTransferId: Uuid(),
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2',
        transferStateId: Enum.Transfers.TransferInternalState.EXPIRED_PREPARED
      },
      {
        transferId: Uuid(),
        bulkTransferId: Uuid(),
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2',
        transferStateId: Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT
      },
      {
        transferId: Uuid(),
        bulkTransferId: Uuid(),
        payerFsp: 'dfsp2',
        payeeFsp: 'dfsp1',
        transferStateId: Enum.Transfers.TransferState.COMMITTED
      }
    ]
    let expected = {
      cleanup: 1,
      intervalMin: 10,
      intervalMax: 20,
      result: resultMock
    }

    timeoutTest.test('perform timeout', async (test) => {
      TimeoutService.getTimeoutSegment = sandbox.stub().returns(timeoutSegmentMock)
      TimeoutService.cleanupTransferTimeout = sandbox.stub().returns(1)
      TimeoutService.getLatestTransferStateChange = sandbox.stub().returns(latestTransferStateChangeMock)
      TimeoutService.timeoutExpireReserved = sandbox.stub().returns(resultMock)
      Utility.produceGeneralMessage = sandbox.stub()

      const result = await TimeoutHandler.timeout()
      test.deepEqual(result, expected, 'Expected result is returned')
      test.equal(Utility.produceGeneralMessage.callCount, 4, 'Four different messages were produced')
      test.end()
    })

    timeoutTest.test('perform timeout when no data is present in segment table', async (test) => {
      TimeoutService.getTimeoutSegment = sandbox.stub().returns(null)
      TimeoutService.cleanupTransferTimeout = sandbox.stub().returns(1)
      TimeoutService.getLatestTransferStateChange = sandbox.stub().returns(null)
      TimeoutService.timeoutExpireReserved = sandbox.stub().returns(resultMock[0])
      Utility.produceGeneralMessage = sandbox.stub()
      expected = {
        cleanup: 1,
        intervalMin: 0,
        intervalMax: 0,
        result: resultMock[0]
      }

      const result = await TimeoutHandler.timeout()
      test.deepEqual(result, expected, 'Expected result is returned')
      test.ok(Utility.produceGeneralMessage.notCalled, 'No messages have been produced produced')
      test.end()
    })

    timeoutTest.test('throw error', async (test) => {
      TimeoutService.getTimeoutSegment = sandbox.stub().throws(new Error('Database unavailable'))
      try {
        await TimeoutHandler.timeout()
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

      try {
        await TimeoutHandler.timeout()
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
      const result = await TimeoutHandler.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.test('do not start the handler when its disabled in config', async (test) => {
      Config.HANDLERS_TIMEOUT_DISABLED = true
      const result = await TimeoutHandler.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.end()
  })

  TimeoutHandlerTest.test('registerTimeoutHandler should', registerTimeoutHandlerTest => {
    registerTimeoutHandlerTest.test('register timeout handler', async (test) => {
      const result = await TimeoutHandler.registerAllHandlers()
      test.equal(result, true)
      await TimeoutHandler.stop()
      test.end()
    })

    registerTimeoutHandlerTest.test('tear down the handler', async (test) => {
      await TimeoutHandler.stop()
      test.pass('reached stop')
      test.end()
    })

    registerTimeoutHandlerTest.test('isRunning', async (test) => {
      await TimeoutHandler.registerAllHandlers()
      const result = await TimeoutHandler.isRunning()
      test.equal(result, true)
      test.end()
    })

    registerTimeoutHandlerTest.test('should throw error', async (test) => {
      CronJob.prototype.start.throws(new Error())
      try {
        await TimeoutHandler.registerAllHandlers()
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
      await TimeoutHandler.stop()
      test.pass('reached stop')
      test.end()
    })

    stopTest.end()
  })

  TimeoutHandlerTest.end()
})
