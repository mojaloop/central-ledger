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

 * Vijaya Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const { Enum } = require('@mojaloop/central-services-shared')
const Sinon = require('sinon')
const { processFxPositionPrepareBin } = require('../../../../src/domain/position/fx-prepare')
const Logger = require('../../../../src/shared/logger').logger
const { randomUUID } = require('crypto')
const Config = require('../../../../src/lib/config')

const constructFxTransferTestData = (initiatingFsp, counterPartyFsp, sourceAmount, sourceCurrency, targetAmount, targetCurrency) => {
  const commitRequestId = randomUUID()
  const determiningTransferId = randomUUID()
  const payload = {
    commitRequestId,
    determiningTransferId,
    initiatingFsp,
    counterPartyFsp,
    sourceAmount: {
      currency: sourceCurrency,
      amount: sourceAmount
    },
    targetAmount: {
      currency: targetCurrency,
      amount: targetAmount
    },
    condition: 'GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf00-Tn6kESAfM',
    expiration: '2024-04-19T14:06:08.936Z'
  }
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64')
  return {
    decodedPayload: payload,
    message: {
      value: {
        from: initiatingFsp,
        to: counterPartyFsp,
        id: commitRequestId,
        content: {
          uriParams: {
            id: commitRequestId
          },
          headers: {
            host: 'ml-api-adapter:3000',
            'content-length': 1314,
            accept: 'application/vnd.interoperability.fxTransfers+json;version=2.0',
            'content-type': 'application/vnd.interoperability.fxTransfers+json;version=2.0',
            date: '2023-08-17T15:25:08.000Z',
            'fspiop-destination': counterPartyFsp,
            'fspiop-source': initiatingFsp,
            traceparent: '00-e11ece8cc6ca3dc170a8ab693910d934-25d85755f1bc6898-01',
            tracestate: 'tx_end2end_start_ts=1692285908510'
          },
          payload: 'data:application/vnd.interoperability.fxTransfers+json;version=2.0;base64,' + base64Payload,
          context: {
            cyrilResult: {
              participantName: initiatingFsp,
              currencyId: sourceCurrency,
              amount: sourceAmount
            }
          }
        },
        type: 'application/json',
        metadata: {
          correlationId: '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf',
          event: {
            type: 'position',
            action: 'fx-prepare',
            createdAt: '2023-08-17T15:25:08.511Z',
            state: {
              status: 'success',
              code: 0,
              description: 'action successful'
            },
            id: commitRequestId
          },
          trace: {
            service: 'cl_fx_transfer_prepare',
            traceId: 'e11ece8cc6ca3dc170a8ab693910d934',
            spanId: '1a2c4baf99bdb2c6',
            sampled: 1,
            flags: '01',
            parentSpanId: '3c5863bb3c2b4ecc',
            startTimestamp: '2023-08-17T15:25:08.860Z',
            tags: {
              tracestate: 'acmevendor=eyJzcGFuSWQiOiIxYTJjNGJhZjk5YmRiMmM2IiwidGltZUFwaVByZXBhcmUiOiIxNjkyMjg1OTA4NTEwIn0=,tx_end2end_start_ts=1692285908510',
              transactionType: 'transfer',
              transactionAction: 'fx-prepare',
              transactionId: '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf',
              source: initiatingFsp,
              destination: counterPartyFsp,
              initiatingFsp,
              counterPartyFsp
            },
            tracestates: {
              acmevendor: {
                spanId: '1a2c4baf99bdb2c6',
                timeApiPrepare: '1692285908510'
              },
              tx_end2end_start_ts: '1692285908510'
            }
          },
          'protocol.createdAt': 1692285908866
        }
      },
      size: 3489,
      key: 51,
      topic: 'topic-transfer-position-batch',
      offset: 4070,
      partition: 0,
      timestamp: 1694175690401
    }
  }
}

const sourceAmount = 5
const fxTransferTestData1 = constructFxTransferTestData('perffsp1', 'perffsp2', sourceAmount.toString(), 'USD', '50', 'XXX')
const fxTransferTestData2 = constructFxTransferTestData('perffsp1', 'perffsp2', sourceAmount.toString(), 'USD', '50', 'XXX')
const fxTransferTestData3 = constructFxTransferTestData('perffsp1', 'perffsp2', sourceAmount.toString(), 'USD', '50', 'XXX')

const span = {}
const binItems = [{
  message: fxTransferTestData1.message,
  span,
  decodedPayload: fxTransferTestData1.decodedPayload
},
{
  message: fxTransferTestData2.message,
  span,
  decodedPayload: fxTransferTestData2.decodedPayload
},
{
  message: fxTransferTestData3.message,
  span,
  decodedPayload: fxTransferTestData3.decodedPayload
}]

Test('FX Prepare domain', positionIndexTest => {
  let sandbox

  positionIndexTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    t.end()
  })

  positionIndexTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  positionIndexTest.test('processFxPositionPrepareBin should', changeParticipantPositionTest => {
    changeParticipantPositionTest.test('produce abort message for transfers not in the right transfer state', async (test) => {
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 900, // Participant limit value
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      const accumulatedFxTransferStates = {
        [fxTransferTestData1.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        [fxTransferTestData2.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        [fxTransferTestData3.message.value.id]: 'INVALID_STATE'
      }
      const processedMessages = await processFxPositionPrepareBin(
        binItems,
        {
          accumulatedPositionValue: 0, // Accumulated position value
          accumulatedPositionReservedValue: 0,
          accumulatedFxTransferStates,
          settlementParticipantPosition: -1000, // Settlement participant position value
          participantLimit
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.notifyMessages.length, 3)
      test.equal(processedMessages.notifyMessages[0].message.content.headers.accept, fxTransferTestData1.message.value.content.headers.accept)
      test.equal(processedMessages.notifyMessages[0].message.content.headers['fspiop-destination'], fxTransferTestData1.message.value.content.headers['fspiop-destination'])
      test.equal(processedMessages.notifyMessages[0].message.content.headers['fspiop-source'], fxTransferTestData1.message.value.content.headers['fspiop-source'])
      test.equal(processedMessages.notifyMessages[0].message.content.headers['content-type'], fxTransferTestData1.message.value.content.headers['content-type'])
      test.equal(processedMessages.accumulatedFxTransferStates[fxTransferTestData1.message.value.id], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.notifyMessages[1].message.content.headers.accept, fxTransferTestData2.message.value.content.headers.accept)
      test.equal(processedMessages.notifyMessages[1].message.content.headers['fspiop-destination'], fxTransferTestData2.message.value.content.headers['fspiop-destination'])
      test.equal(processedMessages.notifyMessages[1].message.content.headers['fspiop-source'], fxTransferTestData2.message.value.content.headers['fspiop-source'])
      test.equal(processedMessages.notifyMessages[1].message.content.headers['content-type'], fxTransferTestData2.message.value.content.headers['content-type'])
      test.equal(processedMessages.accumulatedFxTransferStates[fxTransferTestData2.message.value.id], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.notifyMessages[2].message.content.uriParams.id, fxTransferTestData3.message.value.id)
      test.equal(processedMessages.notifyMessages[2].message.content.headers.accept, fxTransferTestData3.message.value.content.headers.accept)
      test.equal(processedMessages.notifyMessages[2].message.content.headers['fspiop-destination'], fxTransferTestData3.message.value.content.headers['fspiop-source'])
      test.equal(processedMessages.notifyMessages[2].message.content.headers['fspiop-source'], Config.HUB_NAME)
      test.equal(processedMessages.notifyMessages[2].message.content.headers['content-type'], fxTransferTestData3.message.value.content.headers['content-type'])
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.equal(processedMessages.accumulatedFxTransferStates[fxTransferTestData3.message.value.id], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedFxTransferStateChanges[0].commitRequestId, fxTransferTestData1.message.value.id)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[1].commitRequestId, fxTransferTestData2.message.value.id)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[2].commitRequestId, fxTransferTestData3.message.value.id)

      test.equal(processedMessages.accumulatedFxTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedPositionValue, sourceAmount * 2)
      test.end()
    })

    changeParticipantPositionTest.test('produce abort message for when payer does not have enough liquidity', async (test) => {
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 0, // Set low
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      const accumulatedFxTransferStates = {
        [fxTransferTestData1.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        [fxTransferTestData2.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        [fxTransferTestData3.message.value.id]: 'INVALID_STATE'
      }
      const processedMessages = await processFxPositionPrepareBin(
        binItems,
        {
          accumulatedPositionValue: 0, // No accumulated position value
          accumulatedPositionReservedValue: 0,
          accumulatedFxTransferStates,
          settlementParticipantPosition: 0, // Settlement participant position value
          participantLimit
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.notifyMessages.length, 3)
      test.equal(processedMessages.accumulatedPositionChanges.length, 0)

      test.equal(processedMessages.notifyMessages[0].message.content.uriParams.id, fxTransferTestData1.message.value.id)
      test.equal(processedMessages.notifyMessages[0].message.content.headers.accept, fxTransferTestData1.message.value.content.headers.accept)
      test.equal(processedMessages.notifyMessages[0].message.content.headers['fspiop-destination'], fxTransferTestData1.message.value.content.headers['fspiop-source'])
      test.equal(processedMessages.notifyMessages[0].message.content.headers['fspiop-source'], Config.HUB_NAME)
      test.equal(processedMessages.notifyMessages[0].message.content.headers['content-type'], fxTransferTestData1.message.value.content.headers['content-type'])

      test.equal(processedMessages.notifyMessages[0].message.content.payload.errorInformation.errorCode, '4001')
      test.equal(processedMessages.notifyMessages[0].message.content.payload.errorInformation.errorDescription, 'Payer FSP insufficient liquidity')
      test.equal(processedMessages.accumulatedFxTransferStates[fxTransferTestData1.message.value.id], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.notifyMessages[1].message.content.uriParams.id, fxTransferTestData2.message.value.id)
      test.equal(processedMessages.notifyMessages[1].message.content.headers.accept, fxTransferTestData2.message.value.content.headers.accept)
      test.equal(processedMessages.notifyMessages[1].message.content.headers['fspiop-destination'], fxTransferTestData2.message.value.content.headers['fspiop-source'])
      test.equal(processedMessages.notifyMessages[1].message.content.headers['fspiop-source'], Config.HUB_NAME)
      test.equal(processedMessages.notifyMessages[1].message.content.headers['content-type'], fxTransferTestData2.message.value.content.headers['content-type'])
      test.equal(processedMessages.notifyMessages[1].message.content.payload.errorInformation.errorCode, '4001')
      test.equal(processedMessages.notifyMessages[1].message.content.payload.errorInformation.errorDescription, 'Payer FSP insufficient liquidity')
      test.equal(processedMessages.accumulatedFxTransferStates[fxTransferTestData2.message.value.id], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.notifyMessages[2].message.content.uriParams.id, fxTransferTestData3.message.value.id)
      test.equal(processedMessages.notifyMessages[2].message.content.headers.accept, fxTransferTestData3.message.value.content.headers.accept)
      test.equal(processedMessages.notifyMessages[2].message.content.headers['fspiop-destination'], fxTransferTestData3.message.value.content.headers['fspiop-source'])
      test.equal(processedMessages.notifyMessages[2].message.content.headers['fspiop-source'], Config.HUB_NAME)
      test.equal(processedMessages.notifyMessages[2].message.content.headers['content-type'], fxTransferTestData3.message.value.content.headers['content-type'])
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.equal(processedMessages.accumulatedFxTransferStates[fxTransferTestData3.message.value.id], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedFxTransferStateChanges[0].commitRequestId, fxTransferTestData1.message.value.id)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[1].commitRequestId, fxTransferTestData2.message.value.id)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[2].commitRequestId, fxTransferTestData3.message.value.id)

      test.equal(processedMessages.accumulatedFxTransferStateChanges[0].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[1].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedPositionValue, 0)
      test.end()
    })

    changeParticipantPositionTest.test('produce abort message for when payer has reached their set payer limit', async (test) => {
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 1000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      const accumulatedFxTransferStates = {
        [fxTransferTestData1.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        [fxTransferTestData2.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        [fxTransferTestData3.message.value.id]: 'INVALID_STATE'
      }
      const processedMessages = await processFxPositionPrepareBin(
        binItems,
        {
          accumulatedPositionValue: 1000, // Position value has reached limit of 1000
          accumulatedPositionReservedValue: 0,
          accumulatedFxTransferStates,
          settlementParticipantPosition: -2000, // Payer has liquidity
          participantLimit
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.notifyMessages.length, 3)
      test.equal(processedMessages.accumulatedPositionChanges.length, 0)

      test.equal(processedMessages.notifyMessages[0].message.content.uriParams.id, fxTransferTestData1.message.value.id)
      test.equal(processedMessages.notifyMessages[0].message.content.headers.accept, fxTransferTestData1.message.value.content.headers.accept)
      test.equal(processedMessages.notifyMessages[0].message.content.headers['fspiop-destination'], fxTransferTestData1.message.value.content.headers['fspiop-source'])
      test.equal(processedMessages.notifyMessages[0].message.content.headers['fspiop-source'], Config.HUB_NAME)
      test.equal(processedMessages.notifyMessages[0].message.content.headers['content-type'], fxTransferTestData1.message.value.content.headers['content-type'])
      test.equal(processedMessages.notifyMessages[0].message.content.payload.errorInformation.errorCode, '4200')
      test.equal(processedMessages.notifyMessages[0].message.content.payload.errorInformation.errorDescription, 'Payer limit error')
      test.equal(processedMessages.accumulatedFxTransferStates[fxTransferTestData1.message.value.id], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.notifyMessages[1].message.content.uriParams.id, fxTransferTestData2.message.value.id)
      test.equal(processedMessages.notifyMessages[1].message.content.headers.accept, fxTransferTestData2.message.value.content.headers.accept)
      test.equal(processedMessages.notifyMessages[1].message.content.headers['fspiop-destination'], fxTransferTestData2.message.value.content.headers['fspiop-source'])
      test.equal(processedMessages.notifyMessages[1].message.content.headers['fspiop-source'], Config.HUB_NAME)
      test.equal(processedMessages.notifyMessages[1].message.content.headers['content-type'], fxTransferTestData2.message.value.content.headers['content-type'])
      test.equal(processedMessages.notifyMessages[1].message.content.payload.errorInformation.errorCode, '4200')
      test.equal(processedMessages.notifyMessages[1].message.content.payload.errorInformation.errorDescription, 'Payer limit error')
      test.equal(processedMessages.accumulatedFxTransferStates[fxTransferTestData2.message.value.id], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.notifyMessages[2].message.content.uriParams.id, fxTransferTestData3.message.value.id)
      test.equal(processedMessages.notifyMessages[2].message.content.headers.accept, fxTransferTestData3.message.value.content.headers.accept)
      test.equal(processedMessages.notifyMessages[2].message.content.headers['fspiop-destination'], fxTransferTestData3.message.value.content.headers['fspiop-source'])
      test.equal(processedMessages.notifyMessages[2].message.content.headers['fspiop-source'], Config.HUB_NAME)
      test.equal(processedMessages.notifyMessages[2].message.content.headers['content-type'], fxTransferTestData3.message.value.content.headers['content-type'])
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.equal(processedMessages.accumulatedFxTransferStates[fxTransferTestData3.message.value.id], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedFxTransferStateChanges[0].commitRequestId, fxTransferTestData1.message.value.id)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[1].commitRequestId, fxTransferTestData2.message.value.id)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[2].commitRequestId, fxTransferTestData3.message.value.id)

      test.equal(processedMessages.accumulatedFxTransferStateChanges[0].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[1].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      // Accumulated position value should not change from the input
      test.equal(processedMessages.accumulatedPositionValue, 1000)
      test.end()
    })

    changeParticipantPositionTest.test('produce reserved messages for valid transfer messages', async (test) => {
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 10000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      const accumulatedFxTransferStates = {
        [fxTransferTestData1.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        [fxTransferTestData2.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        [fxTransferTestData3.message.value.id]: 'INVALID_STATE'
      }
      const processedMessages = await processFxPositionPrepareBin(
        binItems,
        {
          accumulatedPositionValue: 0, // Accumulated position value
          accumulatedPositionReservedValue: 0,
          accumulatedFxTransferStates,
          settlementParticipantPosition: -2000, // Payer has liquidity
          participantLimit
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.notifyMessages.length, 3)

      test.equal(processedMessages.accumulatedPositionChanges.length, 2)

      test.equal(processedMessages.notifyMessages[0].message.content.headers.accept, fxTransferTestData1.message.value.content.headers.accept)
      test.equal(processedMessages.notifyMessages[0].message.content.headers['fspiop-destination'], fxTransferTestData1.message.value.content.headers['fspiop-destination'])
      test.equal(processedMessages.notifyMessages[0].message.content.headers['fspiop-source'], fxTransferTestData1.message.value.content.headers['fspiop-source'])
      test.equal(processedMessages.notifyMessages[0].message.content.headers['content-type'], fxTransferTestData1.message.value.content.headers['content-type'])
      test.equal(processedMessages.accumulatedPositionChanges[0].value, sourceAmount)
      test.equal(processedMessages.accumulatedFxTransferStates[fxTransferTestData1.message.value.id], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.notifyMessages[1].message.content.headers.accept, fxTransferTestData2.message.value.content.headers.accept)
      test.equal(processedMessages.notifyMessages[1].message.content.headers['fspiop-destination'], fxTransferTestData2.message.value.content.headers['fspiop-destination'])
      test.equal(processedMessages.notifyMessages[1].message.content.headers['fspiop-source'], fxTransferTestData2.message.value.content.headers['fspiop-source'])
      test.equal(processedMessages.notifyMessages[1].message.content.headers['content-type'], fxTransferTestData2.message.value.content.headers['content-type'])
      test.equal(processedMessages.accumulatedPositionChanges[1].value, sourceAmount * 2)
      test.equal(processedMessages.accumulatedFxTransferStates[fxTransferTestData2.message.value.id], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.notifyMessages[2].message.content.uriParams.id, fxTransferTestData3.message.value.id)
      test.equal(processedMessages.notifyMessages[2].message.content.headers.accept, fxTransferTestData3.message.value.content.headers.accept)
      test.equal(processedMessages.notifyMessages[2].message.content.headers['fspiop-destination'], fxTransferTestData3.message.value.content.headers['fspiop-source'])
      test.equal(processedMessages.notifyMessages[2].message.content.headers['fspiop-source'], Config.HUB_NAME)
      test.equal(processedMessages.notifyMessages[2].message.content.headers['content-type'], fxTransferTestData3.message.value.content.headers['content-type'])
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.equal(processedMessages.accumulatedFxTransferStates[fxTransferTestData3.message.value.id], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedFxTransferStateChanges[0].commitRequestId, fxTransferTestData1.message.value.id)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[1].commitRequestId, fxTransferTestData2.message.value.id)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[2].commitRequestId, fxTransferTestData3.message.value.id)

      test.equal(processedMessages.accumulatedFxTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedFxTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedPositionValue, sourceAmount * 2)
      test.end()
    })

    changeParticipantPositionTest.test('produce proper limit alarms', async (test) => {
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: sourceAmount * 2,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      const accumulatedFxTransferStates = {
        [fxTransferTestData1.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        [fxTransferTestData2.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        [fxTransferTestData3.message.value.id]: 'INVALID_STATE'
      }
      const processedMessages = await processFxPositionPrepareBin(
        binItems,
        {
          accumulatedPositionValue: 0,
          accumulatedPositionReservedValue: 0,
          accumulatedFxTransferStates,
          settlementParticipantPosition: -sourceAmount * 2,
          participantLimit
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.notifyMessages.length, 3)
      test.equal(processedMessages.limitAlarms.length, 2)
      test.equal(processedMessages.accumulatedPositionValue, sourceAmount * 2)
      test.end()
    })

    changeParticipantPositionTest.test('skip position changes if changePositions is false', async (test) => {
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 10000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      const accumulatedFxTransferStates = {
        [fxTransferTestData1.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        [fxTransferTestData2.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        [fxTransferTestData3.message.value.id]: 'INVALID_STATE'
      }
      const processedMessages = await processFxPositionPrepareBin(
        binItems,
        {
          accumulatedPositionValue: -4,
          accumulatedPositionReservedValue: 0,
          accumulatedFxTransferStates,
          settlementParticipantPosition: -2000,
          participantLimit,
          changePositions: false
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.notifyMessages.length, 3)
      test.equal(processedMessages.accumulatedPositionChanges.length, 0)
      test.equal(processedMessages.accumulatedPositionValue, -4)
      test.end()
    })

    changeParticipantPositionTest.test('use targetAmount as transferAmount if cyrilResult currency equals targetAmount currency', async (test) => {
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 10000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      const accumulatedFxTransferStates = {
        [fxTransferTestData1.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        [fxTransferTestData2.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        [fxTransferTestData3.message.value.id]: 'INVALID_STATE'
      }
      const cyrilResult = {
        participantName: 'perffsp1',
        currencyId: 'XXX',
        amount: 50
      }
      const binItemsWithModifiedCyrilResult = binItems.map(item => {
        item.message.value.content.context.cyrilResult = cyrilResult
        return item
      })
      const processedMessages = await processFxPositionPrepareBin(
        binItemsWithModifiedCyrilResult,
        {
          accumulatedPositionValue: 0,
          accumulatedPositionReservedValue: 0,
          accumulatedFxTransferStates,
          settlementParticipantPosition: -2000,
          participantLimit
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.notifyMessages.length, 3)
      test.equal(processedMessages.accumulatedPositionChanges.length, 2)
      test.equal(processedMessages.accumulatedPositionChanges[0].value, 50)
      test.equal(processedMessages.accumulatedPositionChanges[1].value, 100)
      test.end()
    })

    changeParticipantPositionTest.end()
  })

  positionIndexTest.end()
})
