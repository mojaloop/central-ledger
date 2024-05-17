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

 * INFITX
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>

 --------------
 ******/
'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Enum = require('@mojaloop/central-services-shared').Enum
const BinProcessor = require('../../../../src/domain/position/binProcessor')
const BatchPositionModel = require('../../../../src/models/position/batch')
const BatchPositionModelCached = require('../../../../src/models/position/batchCached')
const SettlementModelCached = require('../../../../src/models/settlement/settlementModelCached')
const participantFacade = require('../../../../src/models/participant/facade')
const sampleBins = require('./sampleBins')
const erroneousBins = require('./erroneousBins')

const trx = {}

const prepareTransfersBin1 = [
  '6c2c09c3-19b6-48ba-becc-cbdffcaadd7e',
  '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf',
  '5dff336f-62c0-4619-92c6-9ccd7c8f0369',
  'ccf68c01-fe1e-494e-8736-42a9107d3ba0'
]

const prepareTransfersBin2 = [
  '605ce9e6-a320-4a25-a4c4-397ac6d2544b',
  '42da6ac4-6c42-469d-930a-1213149f41fe',
  '64b91a07-99a7-4c68-b7dd-d6b3211ad09c'
]

const prepareTransfers = [
  ...prepareTransfersBin1,
  ...prepareTransfersBin2
]

const fulfilTransfers = [
  '4830fa00-0c2a-4de1-9640-5ad4e68f5f62',
  '33d42717-1dc9-4224-8c9b-45aab4fe6457',
  'f33add51-38b1-4715-9876-83d8a08c485d',
  '0a4834e7-7e4c-47e8-8dcb-f3f68031d377',
  '35cb4a90-5f54-48fb-9778-202fdb51da94',
  'fe332218-07d6-4f00-8399-76671594697a'
]

const timeoutReservedTransfers = [
  '7e3fa3f7-9a1b-4a81-83c9-5b41112dd7f5'
]

Test('BinProcessor', async (binProcessorTest) => {
  let sandbox
  binProcessorTest.beforeEach(async test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(BatchPositionModel)
    sandbox.stub(BatchPositionModelCached)
    sandbox.stub(SettlementModelCached)
    sandbox.stub(participantFacade)

    const prepareTransfersStates = Object.fromEntries(prepareTransfers.map((transferId) => [transferId, { transferStateChangeId: 1, transferStateId: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE }]))
    const fulfilTransfersStates = Object.fromEntries(fulfilTransfers.map((transferId) => [transferId, { transferStateChangeId: 1, transferStateId: Enum.Transfers.TransferInternalState.RECEIVED_FULFIL }]))
    const timeoutReservedTransfersStates = Object.fromEntries(timeoutReservedTransfers.map((transferId) => [transferId, { transferStateChangeId: 1, transferStateId: Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT }]))

    BatchPositionModel.getLatestTransferStateChangesByTransferIdList.returns({
      ...prepareTransfersStates,
      ...fulfilTransfersStates,
      ...timeoutReservedTransfersStates
    })

    BatchPositionModelCached.getParticipantCurrencyByIds.returns([
      {
        participantCurrencyId: 7,
        participantId: 2,
        currencyId: 'USD',
        ledgerAccountTypeId: 1,
        isActive: 1,
        createdDate: '2023-08-17T09:36:27.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 15,
        participantId: 3,
        currencyId: 'USD',
        ledgerAccountTypeId: 1,
        isActive: 1,
        createdDate: '2023-08-17T09:36:37.000Z',
        createdBy: 'unknown'
      }
    ])

    SettlementModelCached.getAll.returns([
      {
        settlementModelId: 1,
        name: 'DEFERREDNETUSD',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2,
        currencyId: 'USD',
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 1,
        autoPositionReset: 1,
        adjustPosition: 0,
        settlementAccountTypeId: 2
      },
      {
        settlementModelId: 2,
        name: 'DEFAULTDEFERREDNET',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2,
        currencyId: null,
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 1,
        autoPositionReset: 1,
        adjustPosition: 0,
        settlementAccountTypeId: 2
      },
      {
        settlementModelId: 3,
        name: 'CGS',
        isActive: 1,
        settlementGranularityId: 1,
        settlementInterchangeId: 1,
        settlementDelayId: 1,
        currencyId: 'INR',
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 1,
        autoPositionReset: 0,
        adjustPosition: 0,
        settlementAccountTypeId: 2
      },
      {
        settlementModelId: 4,
        name: 'INTERCHANGEFEE',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2,
        currencyId: 'INR',
        requireLiquidityCheck: 0,
        ledgerAccountTypeId: 5,
        autoPositionReset: 1,
        adjustPosition: 0,
        settlementAccountTypeId: 6
      }
    ])

    BatchPositionModelCached.getParticipantCurrencyByParticipantIds.returns([
      {
        participantCurrencyId: 9,
        participantId: 2,
        currencyId: 'BGN',
        ledgerAccountTypeId: 1,
        isActive: 1,
        createdDate: '2023-08-17T09:36:31.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 10,
        participantId: 2,
        currencyId: 'BGN',
        ledgerAccountTypeId: 2,
        isActive: 1,
        createdDate: '2023-08-17T09:36:31.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 11,
        participantId: 2,
        currencyId: 'INR',
        ledgerAccountTypeId: 1,
        isActive: 1,
        createdDate: '2023-08-17T09:36:32.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 12,
        participantId: 2,
        currencyId: 'INR',
        ledgerAccountTypeId: 2,
        isActive: 1,
        createdDate: '2023-08-17T09:36:32.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 13,
        participantId: 2,
        currencyId: 'INR',
        ledgerAccountTypeId: 5,
        isActive: 1,
        createdDate: '2023-08-17T09:36:32.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 14,
        participantId: 2,
        currencyId: 'INR',
        ledgerAccountTypeId: 6,
        isActive: 1,
        createdDate: '2023-08-17T09:36:32.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 7,
        participantId: 2,
        currencyId: 'USD',
        ledgerAccountTypeId: 1,
        isActive: 1,
        createdDate: '2023-08-17T09:36:27.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 8,
        participantId: 2,
        currencyId: 'USD',
        ledgerAccountTypeId: 2,
        isActive: 1,
        createdDate: '2023-08-17T09:36:27.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 17,
        participantId: 3,
        currencyId: 'BGN',
        ledgerAccountTypeId: 1,
        isActive: 1,
        createdDate: '2023-08-17T09:36:41.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 18,
        participantId: 3,
        currencyId: 'BGN',
        ledgerAccountTypeId: 2,
        isActive: 1,
        createdDate: '2023-08-17T09:36:41.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 19,
        participantId: 3,
        currencyId: 'INR',
        ledgerAccountTypeId: 1,
        isActive: 1,
        createdDate: '2023-08-17T09:36:41.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 20,
        participantId: 3,
        currencyId: 'INR',
        ledgerAccountTypeId: 2,
        isActive: 1,
        createdDate: '2023-08-17T09:36:41.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 21,
        participantId: 3,
        currencyId: 'INR',
        ledgerAccountTypeId: 5,
        isActive: 1,
        createdDate: '2023-08-17T09:36:41.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 22,
        participantId: 3,
        currencyId: 'INR',
        ledgerAccountTypeId: 6,
        isActive: 1,
        createdDate: '2023-08-17T09:36:41.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 15,
        participantId: 3,
        currencyId: 'USD',
        ledgerAccountTypeId: 1,
        isActive: 1,
        createdDate: '2023-08-17T09:36:37.000Z',
        createdBy: 'unknown'
      },
      {
        participantCurrencyId: 16,
        participantId: 3,
        currencyId: 'USD',
        ledgerAccountTypeId: 2,
        isActive: 1,
        createdDate: '2023-08-17T09:36:37.000Z',
        createdBy: 'unknown'
      }
    ])

    BatchPositionModel.getPositionsByAccountIdsForUpdate.returns({
      7: {
        participantPositionId: 7,
        participantCurrencyId: 7,
        value: 0,
        reservedValue: 0,
        changedDate: '2023-08-17T09:36:27.000Z'
      },
      8: {
        participantPositionId: 8,
        participantCurrencyId: 8,
        value: -5000000,
        reservedValue: 0,
        changedDate: '2023-08-17T09:36:33.000Z'
      },
      15: {
        participantPositionId: 15,
        participantCurrencyId: 15,
        value: 0,
        reservedValue: 0,
        changedDate: '2023-08-17T09:36:37.000Z'
      },
      16: {
        participantPositionId: 16,
        participantCurrencyId: 16,
        value: -5000000,
        reservedValue: 0,
        changedDate: '2023-08-17T09:36:43.000Z'
      }
    })

    BatchPositionModel.updateParticipantPosition.returns(true)

    BatchPositionModel.getTransferInfoList.returns({
      '4830fa00-0c2a-4de1-9640-5ad4e68f5f62': {
        amount: -2
      },
      '33d42717-1dc9-4224-8c9b-45aab4fe6457': {
        amount: -2
      },
      'f33add51-38b1-4715-9876-83d8a08c485d': {
        amount: -2
      },
      '0a4834e7-7e4c-47e8-8dcb-f3f68031d377': {
        amount: -2
      },
      '35cb4a90-5f54-48fb-9778-202fdb51da94': {
        amount: -2
      },
      'fe332218-07d6-4f00-8399-76671594697a': {
        amount: -2
      },
      '7e3fa3f7-9a1b-4a81-83c9-5b41112dd7f5': {
        amount: -50
      }
    })

    BatchPositionModel.getTransferByIdsForReserve.returns({
      '0a4834e7-7e4c-47e8-8dcb-f3f68031d377': {
        transferId: '0a4834e7-7e4c-47e8-8dcb-f3f68031d377',
        amount: 2.00,
        currencyId: 'USD',
        ilpCondition: 'lnYe4rYwLthWbzhVyX5cAuDfL1Ulw4WdaTgyGDREysw',
        expirationDate: '2023-08-21T10:22:11.481Z',
        createdDate: '2023-08-21T10:22:11.481Z',
        completedTimestamp: '2023-08-21T10:22:11.481Z',
        transferStateEnumeration: 'COMMITED',
        fulfilment: 'lnYe4rYwLthWbzhVyX5cAuDfL1Ulw4WdaTgyGDREysw',
        extensionList: []
      },
      '35cb4a90-5f54-48fb-9778-202fdb51da94': {
        transferId: '35cb4a90-5f54-48fb-9778-202fdb51da94',
        amount: 2.00,
        currencyId: 'USD',
        ilpCondition: 'lnYe4rYwLthWbzhVyX5cAuDfL1Ulw4WdaTgyGDREysw',
        expirationDate: '2023-08-21T10:22:11.481Z',
        createdDate: '2023-08-21T10:22:11.481Z',
        completedTimestamp: '2023-08-21T10:22:11.481Z',
        transferStateEnumeration: 'COMMITED',
        fulfilment: 'lnYe4rYwLthWbzhVyX5cAuDfL1Ulw4WdaTgyGDREysw',
        extensionList: []
      },
      'fe332218-07d6-4f00-8399-76671594697a': {
        transferId: 'fe332218-07d6-4f00-8399-76671594697a',
        amount: 2.00,
        currencyId: 'USD',
        ilpCondition: 'lnYe4rYwLthWbzhVyX5cAuDfL1Ulw4WdaTgyGDREysw',
        expirationDate: '2023-08-21T10:22:11.481Z',
        createdDate: '2023-08-21T10:22:11.481Z',
        completedTimestamp: '2023-08-21T10:22:11.481Z',
        transferStateEnumeration: 'COMMITED',
        fulfilment: 'lnYe4rYwLthWbzhVyX5cAuDfL1Ulw4WdaTgyGDREysw',
        extensionList: []
      }
    })
    test.end()
  })

  binProcessorTest.afterEach(async test => {
    sandbox.restore()
    test.end()
  })

  binProcessorTest.test('binProcessor should', prepareActionTest => {
    prepareActionTest.test('processBins should process a bin of positions and return the expected results', async (test) => {
      const sampleParticipantLimitReturnValues = [
        {
          participantId: 2,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        },
        {
          participantId: 3,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        }
      ]

      participantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(sampleParticipantLimitReturnValues.shift())

      const result = await BinProcessor.processBins(sampleBins, trx)

      // Assert on result.notifyMessages
      test.equal(result.notifyMessages.length, 14, 'processBins should return the expected number of notify messages')

      // Assert on result.limitAlarms
      // test.equal(result.limitAlarms.length, 1, 'processBin should return the expected number of limit alarms')

      // Assert on number of function calls for DB update on position value
      test.ok(BatchPositionModel.updateParticipantPosition.calledTwice, 'updateParticipantPosition should be called twice')

      // TODO: Assert on number of function calls for DB bulk insert of transferStateChanges
      // TODO: Assert on number of function calls for DB bulk insert of positionChanges

      // Assert on DB update for position values of all accounts in each function call
      test.deepEqual(BatchPositionModel.updateParticipantPosition.getCalls().map(call => call.args), [
        [{}, 7, -50, 0],
        [{}, 15, 2, 0]
      ], 'updateParticipantPosition should be called with the expected arguments')

      // TODO: Assert on DB bulk insert of transferStateChanges in each function call
      // TODO: Assert on DB bulk insert of positionChanges in each function call

      test.end()
    })

    prepareActionTest.test('processBins should handle prepare messages', async (test) => {
      const sampleParticipantLimitReturnValues = [
        {
          participantId: 2,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        },
        {
          participantId: 3,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        }
      ]

      participantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(sampleParticipantLimitReturnValues.shift())
      const sampleBinsDeepCopy = JSON.parse(JSON.stringify(sampleBins))
      sampleBinsDeepCopy[7].commit = []
      sampleBinsDeepCopy[15].commit = []
      sampleBinsDeepCopy[7].reserve = []
      sampleBinsDeepCopy[15].reserve = []
      sampleBinsDeepCopy[7]['timeout-reserved'] = []
      sampleBinsDeepCopy[15]['timeout-reserved'] = []
      const result = await BinProcessor.processBins(sampleBinsDeepCopy, trx)

      // Assert on result.notifyMessages
      test.equal(result.notifyMessages.length, 7, 'processBins should return the expected number of notify messages')

      // Assert on result.limitAlarms
      // test.equal(result.limitAlarms.length, 1, 'processBin should return the expected number of limit alarms')

      // Assert on number of function calls for DB update on position value
      test.ok(BatchPositionModel.updateParticipantPosition.calledTwice, 'updateParticipantPosition should be called twice')

      // TODO: Assert on number of function calls for DB bulk insert of transferStateChanges
      // TODO: Assert on number of function calls for DB bulk insert of positionChanges

      // Assert on DB update for position values of all accounts in each function call
      test.deepEqual(BatchPositionModel.updateParticipantPosition.getCalls().map(call => call.args), [
        [{}, 7, 8, 0],
        [{}, 15, 6, 0]
      ], 'updateParticipantPosition should be called with the expected arguments')

      // TODO: Assert on DB bulk insert of transferStateChanges in each function call
      // TODO: Assert on DB bulk insert of positionChanges in each function call

      test.end()
    })

    prepareActionTest.test('processBins should handle commit messages', async (test) => {
      const sampleParticipantLimitReturnValues = [
        {
          participantId: 2,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        },
        {
          participantId: 3,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        }
      ]
      participantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(sampleParticipantLimitReturnValues.shift())
      const sampleBinsDeepCopy = JSON.parse(JSON.stringify(sampleBins))
      sampleBinsDeepCopy[7].prepare = []
      sampleBinsDeepCopy[15].prepare = []
      sampleBinsDeepCopy[7].reserve = []
      sampleBinsDeepCopy[15].reserve = []
      sampleBinsDeepCopy[7]['timeout-reserved'] = []
      sampleBinsDeepCopy[15]['timeout-reserved'] = []
      const result = await BinProcessor.processBins(sampleBinsDeepCopy, trx)

      // Assert on result.notifyMessages
      test.equal(result.notifyMessages.length, 3, 'processBins should return 3 messages')

      // TODO: What if there are no position changes in a batch?
      // Assert on number of function calls for DB update on position value
      // test.ok(BatchPositionModel.updateParticipantPosition.notCalled, 'updateParticipantPosition should not be called')

      // TODO: Assert on number of function calls for DB bulk insert of transferStateChanges
      // TODO: Assert on number of function calls for DB bulk insert of positionChanges

      // Assert on DB update for position values of all accounts in each function call
      test.deepEqual(BatchPositionModel.updateParticipantPosition.getCalls().map(call => call.args), [
        [{}, 7, -4, 0],
        [{}, 15, -2, 0]
      ], 'updateParticipantPosition should be called with the expected arguments')

      // TODO: Assert on DB bulk insert of transferStateChanges in each function call
      // TODO: Assert on DB bulk insert of positionChanges in each function call

      test.end()
    })

    prepareActionTest.test('processBins should handle reserve messages', async (test) => {
      const sampleParticipantLimitReturnValues = [
        {
          participantId: 2,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        },
        {
          participantId: 3,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        }
      ]
      participantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(sampleParticipantLimitReturnValues.shift())
      const sampleBinsDeepCopy = JSON.parse(JSON.stringify(sampleBins))
      sampleBinsDeepCopy[7].prepare = []
      sampleBinsDeepCopy[15].prepare = []
      sampleBinsDeepCopy[7].commit = []
      sampleBinsDeepCopy[15].commit = []
      sampleBinsDeepCopy[7]['timeout-reserved'] = []
      sampleBinsDeepCopy[15]['timeout-reserved'] = []
      const result = await BinProcessor.processBins(sampleBinsDeepCopy, trx)

      // Assert on result.notifyMessages
      test.equal(result.notifyMessages.length, 3, 'processBins should return 3 messages')

      // TODO: What if there are no position changes in a batch?
      // Assert on number of function calls for DB update on position value
      // test.ok(BatchPositionModel.updateParticipantPosition.notCalled, 'updateParticipantPosition should not be called')

      // TODO: Assert on number of function calls for DB bulk insert of transferStateChanges
      // TODO: Assert on number of function calls for DB bulk insert of positionChanges

      // Assert on DB update for position values of all accounts in each function call
      test.deepEqual(BatchPositionModel.updateParticipantPosition.getCalls().map(call => call.args), [
        [{}, 7, -4, 0],
        [{}, 15, -2, 0]
      ], 'updateParticipantPosition should be called with the expected arguments')

      // TODO: Assert on DB bulk insert of transferStateChanges in each function call
      // TODO: Assert on DB bulk insert of positionChanges in each function call

      test.end()
    })

    prepareActionTest.test('processBins should handle timeout-reserved messages', async (test) => {
      const sampleParticipantLimitReturnValues = [
        {
          participantId: 2,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        },
        {
          participantId: 3,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        }
      ]
      participantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(sampleParticipantLimitReturnValues.shift())
      const sampleBinsDeepCopy = JSON.parse(JSON.stringify(sampleBins))
      sampleBinsDeepCopy[7].prepare = []
      sampleBinsDeepCopy[15].prepare = []
      sampleBinsDeepCopy[7].commit = []
      sampleBinsDeepCopy[15].commit = []
      sampleBinsDeepCopy[7].reserve = []
      sampleBinsDeepCopy[15].reserve = []
      const result = await BinProcessor.processBins(sampleBinsDeepCopy, trx)

      // Assert on result.notifyMessages
      test.equal(result.notifyMessages.length, 1, 'processBins should return 3 messages')

      // TODO: What if there are no position changes in a batch?
      // Assert on number of function calls for DB update on position value
      // test.ok(BatchPositionModel.updateParticipantPosition.notCalled, 'updateParticipantPosition should not be called')

      // TODO: Assert on number of function calls for DB bulk insert of transferStateChanges
      // TODO: Assert on number of function calls for DB bulk insert of positionChanges

      // Assert on DB update for position values of all accounts in each function call
      test.deepEqual(BatchPositionModel.updateParticipantPosition.getCalls().map(call => call.args), [
        [{}, 7, -50, 0],
        [{}, 15, 0, 0]
      ], 'updateParticipantPosition should be called with the expected arguments')

      // TODO: Assert on DB bulk insert of transferStateChanges in each function call
      // TODO: Assert on DB bulk insert of positionChanges in each function call

      test.end()
    })

    prepareActionTest.test('processBins should throw error if any accountId cannot be matched to atleast one participantCurrencyId', async (test) => {
      const sampleParticipantLimitReturnValues = [
        {
          participantId: 2,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        },
        {
          participantId: 3,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        }
      ]
      participantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(sampleParticipantLimitReturnValues.shift())
      const sampleBinsDeepCopy = JSON.parse(JSON.stringify(sampleBins))
      sampleBinsDeepCopy[100] = sampleBinsDeepCopy[15]
      delete sampleBinsDeepCopy[15]

      try {
        await BinProcessor.processBins(sampleBinsDeepCopy, trx)
        test.fail('Error not thrown!')
      } catch (err) {
        test.pass('Error thrown')
      }
      test.end()
    })

    prepareActionTest.test('processBins should throw error if no settlement model is found', async (test) => {
      SettlementModelCached.getAll.returns([])
      const sampleParticipantLimitReturnValues = [
        {
          participantId: 2,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        },
        {
          participantId: 3,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        }
      ]
      participantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(sampleParticipantLimitReturnValues.shift())
      try {
        await BinProcessor.processBins(sampleBins, trx)
        test.fail('Error not thrown!')
      } catch (err) {
        test.pass('Error thrown')
      }
      test.end()
    })

    prepareActionTest.test('processBins should throw error if no default settlement model if currency model is missing', async (test) => {
      SettlementModelCached.getAll.returns([
        {
          settlementModelId: 3,
          name: 'CGS',
          isActive: 1,
          settlementGranularityId: 1,
          settlementInterchangeId: 1,
          settlementDelayId: 1,
          currencyId: 'INR',
          requireLiquidityCheck: 1,
          ledgerAccountTypeId: 1,
          autoPositionReset: 0,
          adjustPosition: 0,
          settlementAccountTypeId: 2
        }
      ])
      const sampleParticipantLimitReturnValues = [
        {
          participantId: 2,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        },
        {
          participantId: 3,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        }
      ]
      participantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(sampleParticipantLimitReturnValues.shift())
      try {
        await BinProcessor.processBins(sampleBins, trx)
        test.fail('Error not thrown!')
      } catch (err) {
        test.pass('Error thrown')
      }
      test.end()
    })

    prepareActionTest.test('processBins should use default settlement model if currency model is missing', async (test) => {
      SettlementModelCached.getAll.returns([
        {
          settlementModelId: 2,
          name: 'DEFAULTDEFERREDNET',
          isActive: 1,
          settlementGranularityId: 2,
          settlementInterchangeId: 2,
          settlementDelayId: 2,
          currencyId: null,
          requireLiquidityCheck: 1,
          ledgerAccountTypeId: 1,
          autoPositionReset: 1,
          adjustPosition: 0,
          settlementAccountTypeId: 2
        }
      ])
      const sampleParticipantLimitReturnValues = [
        {
          participantId: 2,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        },
        {
          participantId: 3,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        }
      ]
      participantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(sampleParticipantLimitReturnValues.shift())

      const result = await BinProcessor.processBins(sampleBins, trx)

      // Assert on result.notifyMessages
      test.equal(result.notifyMessages.length, 14, 'processBins should return 14 messages')

      // TODO: What if there are no position changes in a batch?
      // Assert on number of function calls for DB update on position value
      // test.ok(BatchPositionModel.updateParticipantPosition.notCalled, 'updateParticipantPosition should not be called')

      // TODO: Assert on number of function calls for DB bulk insert of transferStateChanges
      // TODO: Assert on number of function calls for DB bulk insert of positionChanges

      // Assert on DB update for position values of all accounts in each function call
      test.deepEqual(BatchPositionModel.updateParticipantPosition.getCalls().map(call => call.args), [
        [{}, 7, -50, 0],
        [{}, 15, 2, 0]
      ], 'updateParticipantPosition should be called with the expected arguments')

      // TODO: Assert on DB bulk insert of transferStateChanges in each function call
      // TODO: Assert on DB bulk insert of positionChanges in each function call

      test.end()
    })

    prepareActionTest.test('processBins should handle no binItems', async (test) => {
      const sampleParticipantLimitReturnValues = [
        {
          participantId: 2,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        },
        {
          participantId: 3,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        }
      ]
      participantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(sampleParticipantLimitReturnValues.shift())
      const sampleBinsDeepCopy = JSON.parse(JSON.stringify(sampleBins))
      delete sampleBinsDeepCopy[7].prepare
      delete sampleBinsDeepCopy[15].prepare
      delete sampleBinsDeepCopy[7].commit
      delete sampleBinsDeepCopy[15].commit
      delete sampleBinsDeepCopy[7].reserve
      delete sampleBinsDeepCopy[15].reserve
      delete sampleBinsDeepCopy[7]['timeout-reserved']
      delete sampleBinsDeepCopy[15]['timeout-reserved']
      const result = await BinProcessor.processBins(sampleBinsDeepCopy, trx)

      // Assert on result.notifyMessages
      test.equal(result.notifyMessages.length, 0, 'processBins should return no messages')

      // TODO: What if there are no position changes in a batch?
      // Assert on number of function calls for DB update on position value
      // test.ok(BatchPositionModel.updateParticipantPosition.notCalled, 'updateParticipantPosition should not be called')

      // TODO: Assert on number of function calls for DB bulk insert of transferStateChanges
      // TODO: Assert on number of function calls for DB bulk insert of positionChanges

      // Assert on DB update for position values of all accounts in each function call
      test.deepEqual(BatchPositionModel.updateParticipantPosition.getCalls().map(call => call.args), [
        [{}, 7, 0, 0],
        [{}, 15, 0, 0]
      ], 'updateParticipantPosition should be called with the expected arguments')

      // TODO: Assert on DB bulk insert of transferStateChanges in each function call
      // TODO: Assert on DB bulk insert of positionChanges in each function call

      test.end()
    })

    prepareActionTest.test('processBins should handle non supported bins', async (test) => {
      const sampleParticipantLimitReturnValues = [
        {
          participantId: 2,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        },
        {
          participantId: 3,
          currencyId: 'USD',
          participantLimitTypeId: 1,
          value: 1000000
        }
      ]
      participantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(sampleParticipantLimitReturnValues.shift())
      const sampleBinsDeepCopy = JSON.parse(JSON.stringify(erroneousBins))
      const result = await BinProcessor.processBins(sampleBinsDeepCopy, trx)

      // Assert on result.notifyMessages
      test.equal(result.notifyMessages.length, 4, 'processBins should return 4 messages')
      // Assert on DB update for position values of all accounts in each function call
      test.deepEqual(BatchPositionModel.updateParticipantPosition.getCalls().map(call => call.args), [
        [{}, 7, 8, 0]
      ], 'updateParticipantPosition should be called with the expected arguments')

      test.end()
    })
    prepareActionTest.end()
  })
  binProcessorTest.test('iterateThroughBins should', async (iterateThroughBinsTest) => {
    iterateThroughBinsTest.test('iterateThroughBins should call callback function for each message in bins', async (test) => {
      const spyCb = sandbox.spy()
      await BinProcessor.iterateThroughBins(sampleBins, spyCb)

      test.equal(spyCb.callCount, 14, 'callback should be called 14 times')
      test.end()
    })
    iterateThroughBinsTest.test('iterateThroughBins should call error callback function if callback function throws error', async (test) => {
      const spyCb = sandbox.stub()
      const errorCb = sandbox.spy()
      spyCb.onFirstCall().throws()
      spyCb.onThirdCall().throws()
      await BinProcessor.iterateThroughBins(sampleBins, spyCb, errorCb)

      test.equal(spyCb.callCount, 14, 'callback should be called 14 times')
      test.equal(errorCb.callCount, 2, 'error callback should be called 2 times')
      test.end()
    })
    iterateThroughBinsTest.test('iterateThroughBins should not affect if callback function throws error', async (test) => {
      const spyCb = sandbox.stub()
      spyCb.onFirstCall().throws()
      await BinProcessor.iterateThroughBins(sampleBins, spyCb)

      test.equal(spyCb.callCount, 14, 'callback should be called 14 times')
      test.end()
    })
    iterateThroughBinsTest.end()
  })
  binProcessorTest.end()
})
