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

 * Vijaya Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const { Enum } = require('@mojaloop/central-services-shared')
const Sinon = require('sinon')
const { processPositionFxFulfilBin } = require('../../../../src/domain/position/fx-fulfil')
const { randomUUID } = require('crypto')

const constructFxTransferCallbackTestData = (initiatingFsp, counterPartyFsp) => {
  const commitRequestId = randomUUID()
  const payload = {
    fulfilment: 'WLctttbu2HvTsa1XWvUoGRcQozHsqeu9Ahl2JW9Bsu8',
    completedTimestamp: '2024-04-19T14:06:08.936Z',
    conversionState: 'RESERVED'
  }
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64')
  return {
    decodedPayload: payload,
    message: {
      value: {
        from: counterPartyFsp,
        to: initiatingFsp,
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
            'fspiop-destination': initiatingFsp,
            'fspiop-source': counterPartyFsp,
            traceparent: '00-e11ece8cc6ca3dc170a8ab693910d934-25d85755f1bc6898-01',
            tracestate: 'tx_end2end_start_ts=1692285908510'
          },
          payload: 'data:application/vnd.interoperability.fxTransfers+json;version=2.0;base64,' + base64Payload,
          context: {
            cyrilResult: {}
          }
        },
        type: 'application/json',
        metadata: {
          correlationId: '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf',
          event: {
            type: 'position',
            action: 'fx-reserve',
            createdAt: '2023-08-17T15:25:08.511Z',
            state: {
              status: 'success',
              code: 0,
              description: 'action successful'
            },
            id: commitRequestId
          },
          trace: {
            service: 'cl_fx_transfer_fulfil',
            traceId: 'e11ece8cc6ca3dc170a8ab693910d934',
            spanId: '1a2c4baf99bdb2c6',
            sampled: 1,
            flags: '01',
            parentSpanId: '3c5863bb3c2b4ecc',
            startTimestamp: '2023-08-17T15:25:08.860Z',
            tags: {
              tracestate: 'acmevendor=eyJzcGFuSWQiOiIxYTJjNGJhZjk5YmRiMmM2IiwidGltZUFwaVByZXBhcmUiOiIxNjkyMjg1OTA4NTEwIn0=,tx_end2end_start_ts=1692285908510',
              transactionType: 'transfer',
              transactionAction: 'fx-reserve',
              transactionId: '1cf6981b-25d8-4bd7-b9d9-b1c0fc8cdeaf',
              source: counterPartyFsp,
              destination: initiatingFsp,
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

const fxTransferCallbackTestData1 = constructFxTransferCallbackTestData('perffsp1', 'perffsp2')
const fxTransferCallbackTestData2 = constructFxTransferCallbackTestData('perffsp2', 'perffsp1')
const fxTransferCallbackTestData3 = constructFxTransferCallbackTestData('perffsp1', 'perffsp2')

const span = {}
const reserveBinItems = [{
  message: fxTransferCallbackTestData1.message,
  span,
  decodedPayload: fxTransferCallbackTestData1.decodedPayload
},
{
  message: fxTransferCallbackTestData2.message,
  span,
  decodedPayload: fxTransferCallbackTestData2.decodedPayload
},
{
  message: fxTransferCallbackTestData3.message,
  span,
  decodedPayload: fxTransferCallbackTestData3.decodedPayload
}]
Test('Fx Fulfil domain', processPositionFxFulfilBinTest => {
  let sandbox

  processPositionFxFulfilBinTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    t.end()
  })

  processPositionFxFulfilBinTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  processPositionFxFulfilBinTest.test('should process a bin of position-commit messages', async (test) => {
    const accumulatedFxTransferStates = {
      [fxTransferCallbackTestData1.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_FULFIL_DEPENDENT,
      [fxTransferCallbackTestData2.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_FULFIL_DEPENDENT,
      [fxTransferCallbackTestData3.message.value.id]: 'INVALID_STATE'
    }
    // Call the function
    const processedMessages = await processPositionFxFulfilBin(
      reserveBinItems,
      accumulatedFxTransferStates
    )

    // Assert the expected results
    test.equal(processedMessages.notifyMessages.length, 3)
    test.equal(processedMessages.notifyMessages[0].message.content.headers.accept, fxTransferCallbackTestData1.message.value.content.headers.accept)
    test.equal(processedMessages.notifyMessages[0].message.content.headers['fspiop-destination'], fxTransferCallbackTestData1.message.value.content.headers['fspiop-destination'])
    test.equal(processedMessages.notifyMessages[0].message.content.headers['fspiop-source'], fxTransferCallbackTestData1.message.value.content.headers['fspiop-source'])
    test.equal(processedMessages.notifyMessages[0].message.content.headers['content-type'], fxTransferCallbackTestData1.message.value.content.headers['content-type'])
    test.equal(processedMessages.accumulatedFxTransferStates[fxTransferCallbackTestData1.message.value.id], Enum.Transfers.TransferInternalState.COMMITTED)

    test.equal(processedMessages.notifyMessages[1].message.content.headers.accept, fxTransferCallbackTestData2.message.value.content.headers.accept)
    test.equal(processedMessages.notifyMessages[1].message.content.headers['fspiop-destination'], fxTransferCallbackTestData2.message.value.content.headers['fspiop-destination'])
    test.equal(processedMessages.notifyMessages[1].message.content.headers['fspiop-source'], fxTransferCallbackTestData2.message.value.content.headers['fspiop-source'])
    test.equal(processedMessages.notifyMessages[1].message.content.headers['content-type'], fxTransferCallbackTestData2.message.value.content.headers['content-type'])
    test.equal(processedMessages.accumulatedFxTransferStates[fxTransferCallbackTestData2.message.value.id], Enum.Transfers.TransferInternalState.COMMITTED)

    test.equal(processedMessages.notifyMessages[2].message.content.uriParams.id, fxTransferCallbackTestData3.message.value.id)
    test.equal(processedMessages.notifyMessages[2].message.content.headers.accept, fxTransferCallbackTestData3.message.value.content.headers.accept)
    test.equal(processedMessages.notifyMessages[2].message.content.headers['fspiop-destination'], fxTransferCallbackTestData3.message.value.content.headers['fspiop-source'])
    test.equal(processedMessages.notifyMessages[2].message.content.headers['fspiop-source'], Enum.Http.Headers.FSPIOP.SWITCH.value)
    test.equal(processedMessages.notifyMessages[2].message.content.headers['content-type'], fxTransferCallbackTestData3.message.value.content.headers['content-type'])
    test.equal(processedMessages.notifyMessages[2].message.content.payload.errorInformation.errorCode, '2001')
    test.equal(processedMessages.accumulatedFxTransferStates[fxTransferCallbackTestData3.message.value.id], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

    test.equal(processedMessages.accumulatedFxTransferStateChanges.length, 3)
    test.equal(processedMessages.accumulatedFxTransferStateChanges[0].commitRequestId, fxTransferCallbackTestData1.message.value.id)
    test.equal(processedMessages.accumulatedFxTransferStateChanges[1].commitRequestId, fxTransferCallbackTestData2.message.value.id)
    test.equal(processedMessages.accumulatedFxTransferStateChanges[0].transferStateId, Enum.Transfers.TransferInternalState.COMMITTED)
    test.equal(processedMessages.accumulatedFxTransferStateChanges[1].transferStateId, Enum.Transfers.TransferInternalState.COMMITTED)
    test.equal(processedMessages.accumulatedFxTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

    test.end()
  })

  processPositionFxFulfilBinTest.end()
})
