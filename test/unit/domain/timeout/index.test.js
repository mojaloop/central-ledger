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

 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const TimeoutService = require('../../../../src/domain/timeout')
const TransferTimeoutModel = require('../../../../src/models/transfer/transferTimeout')
const FxTransferTimeoutModel = require('../../../../src/models/fxTransfer/fxTransferTimeout')
const TransferFacade = require('../../../../src/models/transfer/facade')
const SegmentModel = require('../../../../src/models/misc/segment')
const TransferStateChangeModel = require('../../../../src/models/transfer/transferStateChange')
const FxTransferStateChangeModel = require('../../../../src/models/fxTransfer/stateChange')
const Logger = require('../../../../src/shared/logger').logger

Test('Timeout Service', timeoutTest => {
  let sandbox

  timeoutTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(TransferTimeoutModel)
    sandbox.stub(FxTransferTimeoutModel)
    sandbox.stub(TransferFacade)
    sandbox.stub(TransferStateChangeModel)
    sandbox.stub(FxTransferStateChangeModel)
    sandbox.stub(SegmentModel)
    t.end()
  })

  timeoutTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  timeoutTest.test('getTimeoutSegment should', getTimeoutSegmentTest => {
    getTimeoutSegmentTest.test('return the segment', async (test) => {
      try {
        const params = {
          segmentType: 'timeout',
          enumeration: 0,
          tableName: 'transferStateChange'
        }

        const segment = {
          segmentId: 1,
          segmentType: 'timeout',
          enumeration: 0,
          tableName: 'transferStateChange',
          value: 4,
          changedDate: '2018-10-10 21:57:00'
        }

        SegmentModel.getByParams.withArgs(params).returns(Promise.resolve(segment))
        const result = await TimeoutService.getTimeoutSegment()
        test.deepEqual(result, segment, 'Results Match')
        test.end()
      } catch (e) {
        Logger.error(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    getTimeoutSegmentTest.end()
  })

  timeoutTest.test('getFxTimeoutSegment should', getFxTimeoutSegmentTest => {
    getFxTimeoutSegmentTest.test('return the segment', async (test) => {
      try {
        const params = {
          segmentType: 'timeout',
          enumeration: 0,
          tableName: 'fxTransferStateChange'
        }

        const segment = {
          segmentId: 1,
          segmentType: 'timeout',
          enumeration: 0,
          tableName: 'fxTransferStateChange',
          value: 4,
          changedDate: '2018-10-10 21:57:00'
        }

        SegmentModel.getByParams.withArgs(params).returns(Promise.resolve(segment))
        const result = await TimeoutService.getFxTimeoutSegment()
        test.deepEqual(result, segment, 'Results Match')
        test.end()
      } catch (e) {
        Logger.error(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    getFxTimeoutSegmentTest.end()
  })

  timeoutTest.test('cleanupTransferTimeout should', cleanupTransferTimeoutTest => {
    cleanupTransferTimeoutTest.test('cleanup the timed out transfers and return the id', async (test) => {
      try {
        TransferTimeoutModel.cleanup.returns(Promise.resolve(1))
        const result = await TimeoutService.cleanupTransferTimeout()
        test.equal(result, 1, 'Results Match')
        test.end()
      } catch (e) {
        Logger.error(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    cleanupTransferTimeoutTest.end()
  })

  timeoutTest.test('cleanupFxTransferTimeout should', cleanupFxTransferTimeoutTest => {
    cleanupFxTransferTimeoutTest.test('cleanup the timed out fx-transfers and return the id', async (test) => {
      try {
        FxTransferTimeoutModel.cleanup.returns(Promise.resolve(1))
        const result = await TimeoutService.cleanupFxTransferTimeout()
        test.equal(result, 1, 'Results Match')
        test.end()
      } catch (e) {
        Logger.error(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    cleanupFxTransferTimeoutTest.end()
  })

  timeoutTest.test('getLatestTransferStateChange should', getLatestTransferStateChangeTest => {
    getLatestTransferStateChangeTest.test('get the latest transfer state change id', async (test) => {
      try {
        const record = { transferStateChangeId: 1 }
        TransferStateChangeModel.getLatest.returns(Promise.resolve(record))
        const result = await TimeoutService.getLatestTransferStateChange()
        test.equal(result, record, 'Results Match')
        test.end()
      } catch (e) {
        Logger.error(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    getLatestTransferStateChangeTest.end()
  })

  timeoutTest.test('getLatestFxTransferStateChange should', getLatestFxTransferStateChangeTest => {
    getLatestFxTransferStateChangeTest.test('get the latest fx-transfer state change id', async (test) => {
      try {
        const record = { fxTransferStateChangeId: 1 }
        FxTransferStateChangeModel.getLatest.returns(Promise.resolve(record))
        const result = await TimeoutService.getLatestFxTransferStateChange()
        test.equal(result, record, 'Results Match')
        test.end()
      } catch (e) {
        Logger.error(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    getLatestFxTransferStateChangeTest.end()
  })

  timeoutTest.test('timeoutExpireReserved should', timeoutExpireReservedTest => {
    timeoutExpireReservedTest.test('timeout the reserved transactions which are expired', async (test) => {
      try {
        const params = { segmentId: 1, intervalMin: 1, intervalMax: 2 }
        TransferFacade.timeoutExpireReserved.withArgs(params).returns(Promise.resolve(true))
        const result = await TimeoutService.timeoutExpireReserved(params)
        test.equal(result, true, 'Results Match')
        test.end()
      } catch (e) {
        Logger.error(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    timeoutExpireReservedTest.end()
  })

  timeoutTest.end()
})
