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
const PositionPrepareDomain = require('../../../../src/domain/position/prepare')
const BatchPositionModel = require('../../../../src/models/position/batch')
const sampleBins = require('./sampleBins')

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

const fulfillTransfers = [
  '4830fa00-0c2a-4de1-9640-5ad4e68f5f62',
  '33d42717-1dc9-4224-8c9b-45aab4fe6457',
  'f33add51-38b1-4715-9876-83d8a08c485d'
]

Test('BinProcessor', async (binProcessorTest) => {
  let sandbox
  binProcessorTest.beforeEach(async test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(BatchPositionModel)

    const prepareTransfersStates = Object.fromEntries(prepareTransfers.map((transferId) => [transferId, Enum.Transfers.TransferInternalState.RECEIVED_PREPARE]))
    const fulfillTransfersStates = Object.fromEntries(fulfillTransfers.map((transferId) => [transferId, Enum.Transfers.TransferInternalState.RECEIVED_FULFIL]))
    BatchPositionModel.getLatestTransferStatesByTransferIdList.returns({
      ...prepareTransfersStates,
      ...fulfillTransfersStates
    })

    BatchPositionModel.getPositionsByAccountIdsForUpdate.returns({
      7: {
        participantPositionId: 7,
        participantCurrencyId: 7,
        value: 10,
        reservedValue: 0,
        changedDate: '2023-08-17T09:37:22.000Z'
      },
      15: {
        participantPositionId: 15,
        participantCurrencyId: 15,
        value: 20,
        reservedValue: 0,
        changedDate: '2023-08-17T09:37:22.000Z'
      }
    })

    BatchPositionModel.updateParticipantPosition.returns(true)

    test.end()
  })

  binProcessorTest.afterEach(async test => {
    sandbox.restore()
    test.end()
  })

  binProcessorTest.test('binProcessor should', prepareActionTest => {
    prepareActionTest.test('processBins should process a bin of positions and return the expected results', async (test) => {
      const expectedPrepareBinResults = [
        {
          accumulatedPositionValue: 18,
          accumulatedPositionReservedValue: 0,
          accumulatedTransferStateChanges: prepareTransfersBin1.map((transferId) => ({
            transferId,
            transferStateId: Enum.Transfers.TransferState.RESERVED
          })),
          accumulatedPositionChanges: [
            {
              value: 12,
              reservedValue: 0
            },
            {
              value: 14,
              reservedValue: 0
            },
            {
              value: 16,
              reservedValue: 0
            },
            {
              value: 18,
              reservedValue: 0
            }
          ],
          notifyMessages: [
            { message: 'notify1' },
            { message: 'notify2' },
            { message: 'notify3' },
            { message: 'notify4' }
          ],
          limitAlarms: [{
            participantId: 1,
            currencyId: 1,
            participantLimitTypeId: 1,
            value: 1
          }]
        },
        {
          accumulatedPositionValue: 26,
          accumulatedPositionReservedValue: 0,
          accumulatedTransferStateChanges: prepareTransfersBin2.map((transferId) => ({
            transferId,
            transferStateId: Enum.Transfers.TransferInternalState.RESERVED
          })),
          accumulatedPositionChanges: [
            {
              value: 22,
              reservedValue: 0
            },
            {
              value: 24,
              reservedValue: 0
            },
            {
              value: 26,
              reservedValue: 0
            }
          ],
          notifyMessages: [
            { message: 'notify1' },
            { message: 'notify2' },
            { message: 'notify3' }
          ],
          limitAlarms: []
        }
      ]

      const positionPrepareBinStub = sandbox.stub(PositionPrepareDomain, 'processPositionPrepareBin').callsFake(
        (accountBin,
          accumulatedPositionValue,
          accumulatedPositionReservedValue,
          accumulatedTransferStates) => { return expectedPrepareBinResults.shift() })

      const result = await BinProcessor.processBins(sampleBins, trx)

      test.ok(positionPrepareBinStub.calledTwice, 'processPositionPrepareBin should be called twice')

      // Assert on result.notifyMessages
      test.equal(result.notifyMessages.length, 7, 'processBins should return the expected number of notify messages')

      // Assert on result.limitAlarms
      test.equal(result.limitAlarms.length, 1, 'processBin should return the expected number of limit alarms')

      // Assert on number of function calls for DB update on position value
      test.ok(BatchPositionModel.updateParticipantPosition.calledTwice, 'updateParticipantPosition should be called twice')

      // TODO: Assert on number of function calls for DB bulk insert of transferStateChanges
      // TODO: Assert on number of function calls for DB bulk insert of positionChanges

      // Assert on DB update for position values of all accounts in each function call
      test.deepEqual(BatchPositionModel.updateParticipantPosition.getCalls().map(call => call.args), [
        [{}, 7, 18, 0],
        [{}, 15, 26, 0]
      ], 'updateParticipantPosition should be called with the expected arguments')

      // TODO: Assert on DB bulk insert of transferStateChanges in each function call
      // TODO: Assert on DB bulk insert of positionChanges in each function call

      test.end()
    })
    prepareActionTest.end()
  })
  binProcessorTest.end()
})
