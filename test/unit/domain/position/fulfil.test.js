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

 * Kevin Leyow <kevin.leyow@infitx.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const { Enum } = require('@mojaloop/central-services-shared')
const Sinon = require('sinon')
const { processPositionFulfilBin } = require('../../../../src/domain/position/fulfil')
const { randomUUID } = require('crypto')

const constructTransferCallbackTestData = (payerFsp, payeeFsp, transferState, eventAction, amount, currency, context) => {
  const transferId = randomUUID()
  const payload = {
    transferState,
    fulfilment: 'lnYe4rYwLthWbzhVyX5cAuDfL1Ulw4WdaTgyGDREysw',
    completedTimestamp: '2023-08-21T10:22:11.481Z'
  }
  const transferInfo = {
    transferId,
    amount
  }
  const reservedActionTransferInfo = {
    transferId,
    amount,
    currencyId: currency,
    ilpCondition: 'lnYe4rYwLthWbzhVyX5cAuDfL1Ulw4WdaTgyGDREysw',
    expirationDate: '2023-08-21T10:22:11.481Z',
    createdDate: '2023-08-21T10:22:11.481Z',
    completedTimestamp: '2023-08-21T10:22:11.481Z',
    transferStateEnumeration: 'PREPARE',
    fulfilment: 'lnYe4rYwLthWbzhVyX5cAuDfL1Ulw4WdaTgyGDREysw',
    extensionList: []
  }
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64')
  return {
    transferInfo,
    reservedActionTransferInfo,
    decodedPayload: payload,
    message: {
      value: {
        from: payerFsp,
        to: payeeFsp,
        id: transferId,
        content: {
          uriParams: {
            id: transferId
          },
          headers: {
            accept: 'application/vnd.interoperability.transfers+json;version=1.1',
            'content-type': 'application/vnd.interoperability.transfers+json;version=1.1',
            date: '2023-08-21T10:22:11.000Z',
            'fspiop-source': payerFsp,
            'fspiop-destination': payeeFsp,
            traceparent: '00-278414be0ce56adab6c6461b1196f7ec-c2639bb302a327f2-01',
            tracestate: 'acmevendor=eyJzcGFuSWQiOiJjMjYzOWJiMzAyYTMyN2YyIiwidGltZUFwaVByZXBhcmUiOiIxNjkyMjg1OTA4MTc4In0=,tx_end2end_start_ts=1692285908177,tx_callback_start_ts=1692613331481',
            'user-agent': 'axios/1.4.0',
            'content-length': '136',
            'accept-encoding': 'gzip, compress, deflate, br',
            host: 'ml-api-adapter:3000',
            connection: 'keep-alive'
          },
          payload: 'data:application/vnd.interoperability.transfers+json;version=1.1;base64,' + base64Payload,
          context
        },
        type: 'application/json',
        metadata: {
          correlationId: transferId,
          event: {
            type: 'position',
            action: eventAction,
            createdAt: '2023-08-21T10:22:11.481Z',
            state: {
              status: 'success',
              code: 0,
              description: 'action successful'
            },
            id: 'ffa2969c-8b90-4fa7-97b3-6013b5937553'
          },
          trace: {
            service: 'cl_transfer_fulfil',
            traceId: '278414be0ce56adab6c6461b1196f7ec',
            spanId: '29dcf2b250cd22d1',
            sampled: 1,
            flags: '01',
            parentSpanId: 'e038bfd263a0b4c0',
            startTimestamp: '2023-08-21T10:23:31.357Z',
            tags: {
              tracestate: 'acmevendor=eyJzcGFuSWQiOiIyOWRjZjJiMjUwY2QyMmQxIiwidGltZUFwaVByZXBhcmUiOiIxNjkyMjg1OTA4MTc4IiwidGltZUFwaUZ1bGZpbCI6IjE2OTI2MTMzMzE0ODEifQ==,tx_end2end_start_ts=1692285908177,tx_callback_start_ts=1692613331481',
              transactionType: 'transfer',
              transactionAction: 'fulfil',
              transactionId: transferId,
              source: payerFsp,
              destination: payeeFsp
            },
            tracestates: {
              acmevendor: {
                spanId: '29dcf2b250cd22d1',
                timeApiPrepare: '1692285908178',
                timeApiFulfil: '1692613331481'
              },
              tx_end2end_start_ts: '1692285908177',
              tx_callback_start_ts: '1692613331481'
            }
          },
          'protocol.createdAt': 1692613411360
        }
      },
      size: 3489,
      key: 51,
      topic: 'topic-transfer-position',
      offset: 4070,
      partition: 0,
      timestamp: 1694175690401
    }
  }
}

const transferTestData1 = constructTransferCallbackTestData('perffsp1', 'perffsp2', 'COMMITTED', 'commit', 2.00, 'USD')
const transferTestData2 = constructTransferCallbackTestData('perffsp2', 'perffsp1', 'COMMITTED', 'commit', 2.00, 'USD')
const transferTestData3 = constructTransferCallbackTestData('perffsp1', 'perffsp2', 'RESERVED', 'reserve', 2.00, 'USD')
const transferTestData4 = constructTransferCallbackTestData('perffsp2', 'perffsp1', 'RESERVED', 'reserve', 2.00, 'USD')

const span = {}
const commitBinItems = [{
  message: transferTestData1.message,
  span,
  decodedPayload: transferTestData1.decodedPayload
},
{
  message: transferTestData2.message,
  span,
  decodedPayload: transferTestData2.decodedPayload
}]
const reserveBinItems = [{
  message: transferTestData3.message,
  span,
  decodedPayload: transferTestData3.decodedPayload
},
{
  message: transferTestData4.message,
  span,
  decodedPayload: transferTestData4.decodedPayload
}]
Test('Fulfil domain', processPositionFulfilBinTest => {
  let sandbox

  processPositionFulfilBinTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    t.end()
  })

  processPositionFulfilBinTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  processPositionFulfilBinTest.test('should process a bin of position-commit messages', async (test) => {
    const accumulatedTransferStates = {
      [transferTestData1.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_FULFIL,
      [transferTestData2.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_FULFIL
    }
    const accumulatedFxTransferStates = {}
    const transferInfoList = {
      [transferTestData1.message.value.id]: transferTestData1.transferInfo,
      [transferTestData2.message.value.id]: transferTestData2.transferInfo
    }
    // Call the function
    const result = await processPositionFulfilBin(
      [commitBinItems, []],
      0,
      0,
      accumulatedTransferStates,
      accumulatedFxTransferStates,
      transferInfoList,
      []
    )

    // Assert the expected results
    test.equal(result.notifyMessages.length, 2)
    test.equal(result.accumulatedPositionValue, 4)
    test.equal(result.accumulatedPositionReservedValue, 0)


    test.equal(result.accumulatedTransferStateChanges[0].transferId, transferTestData1.message.value.id)
    test.equal(result.accumulatedTransferStateChanges[1].transferId, transferTestData2.message.value.id)
    test.equal(result.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.COMMITTED)
    test.equal(result.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.COMMITTED)

    test.equal(result.notifyMessages[0].message.content.headers.accept, transferTestData1.message.value.content.headers.accept)
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-destination'], transferTestData1.message.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-source'], transferTestData1.message.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[0].message.content.headers['content-type'], transferTestData1.message.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[0].value, 2)
    test.equal(result.accumulatedTransferStates[transferTestData1.message.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.equal(result.notifyMessages[1].message.content.headers.accept, transferTestData2.message.value.content.headers.accept)
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-destination'], transferTestData2.message.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-source'], transferTestData2.message.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[1].message.content.headers['content-type'], transferTestData2.message.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[1].value, 4)
    test.equal(result.accumulatedTransferStates[transferTestData2.message.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.end()
  })

  processPositionFulfilBinTest.test('should process a bin of position-reserve messages', async (test) => {
    const accumulatedTransferStates = {
      [transferTestData3.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_FULFIL,
      [transferTestData4.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_FULFIL
    }
    const accumulatedFxTransferStates = {}
    const transferInfoList = {
      [transferTestData3.message.value.id]: transferTestData3.transferInfo,
      [transferTestData4.message.value.id]: transferTestData4.transferInfo
    }
    const reservedActionTransfers = {
      [transferTestData3.message.value.id]: transferTestData3.reservedActionTransferInfo,
      [transferTestData4.message.value.id]: transferTestData4.reservedActionTransferInfo
    }
    // Call the function
    const result = await processPositionFulfilBin(
      [[], reserveBinItems],
      0,
      0,
      accumulatedTransferStates,
      accumulatedFxTransferStates,
      transferInfoList,
      reservedActionTransfers
    )

    // Assert the expected results
    test.equal(result.notifyMessages.length, 2)
    test.equal(result.accumulatedPositionValue, 4)
    test.equal(result.accumulatedPositionReservedValue, 0)

    test.equal(result.accumulatedTransferStateChanges[0].transferId, transferTestData3.message.value.id)
    test.equal(result.accumulatedTransferStateChanges[1].transferId, transferTestData4.message.value.id)
    test.equal(result.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.COMMITTED)
    test.equal(result.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.COMMITTED)

    test.equal(result.notifyMessages[0].message.content.headers.accept, transferTestData3.message.value.content.headers.accept)
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-destination'], transferTestData3.message.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-source'], transferTestData3.message.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[0].message.content.headers['content-type'], transferTestData3.message.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[0].value, 2)
    test.equal(result.accumulatedTransferStates[transferTestData3.message.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.equal(result.notifyMessages[1].message.content.headers.accept, transferTestData4.message.value.content.headers.accept)
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-destination'], transferTestData4.message.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-source'], transferTestData4.message.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[1].message.content.headers['content-type'], transferTestData4.message.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[1].value, 4)
    test.equal(result.accumulatedTransferStates[transferTestData4.message.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.end()
  })

  processPositionFulfilBinTest.test('should process a bin of position-reserve and position-commit messages', async (test) => {
    const accumulatedTransferStates = {
      [transferTestData1.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_FULFIL,
      [transferTestData2.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_FULFIL,
      [transferTestData3.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_FULFIL,
      [transferTestData4.message.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_FULFIL
    }
    const accumulatedFxTransferStates = {}
    const transferInfoList = {
      [transferTestData1.message.value.id]: transferTestData1.transferInfo,
      [transferTestData2.message.value.id]: transferTestData2.transferInfo,
      [transferTestData3.message.value.id]: transferTestData3.transferInfo,
      [transferTestData4.message.value.id]: transferTestData4.transferInfo
    }
    const reservedActionTransfers = {
      [transferTestData3.message.value.id]: transferTestData3.reservedActionTransferInfo,
      [transferTestData4.message.value.id]: transferTestData4.reservedActionTransferInfo
    }
    // Call the function
    const result = await processPositionFulfilBin(
      [commitBinItems, reserveBinItems],
      0,
      0,
      accumulatedTransferStates,
      accumulatedFxTransferStates,
      transferInfoList,
      reservedActionTransfers
    )

    // Assert the expected results
    test.equal(result.notifyMessages.length, 4)
    test.equal(result.accumulatedPositionValue, 8)
    test.equal(result.accumulatedPositionReservedValue, 0)

    test.equal(result.accumulatedTransferStateChanges[0].transferId, transferTestData1.message.value.id)
    test.equal(result.accumulatedTransferStateChanges[1].transferId, transferTestData2.message.value.id)
    test.equal(result.accumulatedTransferStateChanges[2].transferId, transferTestData3.message.value.id)
    test.equal(result.accumulatedTransferStateChanges[3].transferId, transferTestData4.message.value.id)
    test.equal(result.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.COMMITTED)
    test.equal(result.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.COMMITTED)
    test.equal(result.accumulatedTransferStateChanges[2].transferStateId, Enum.Transfers.TransferState.COMMITTED)
    test.equal(result.accumulatedTransferStateChanges[3].transferStateId, Enum.Transfers.TransferState.COMMITTED)

    test.equal(result.notifyMessages[0].message.content.headers.accept, transferTestData1.message.value.content.headers.accept)
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-destination'], transferTestData1.message.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-source'], transferTestData1.message.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[0].message.content.headers['content-type'], transferTestData1.message.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[0].value, 2)
    test.equal(result.accumulatedTransferStates[transferTestData1.message.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.equal(result.notifyMessages[1].message.content.headers.accept, transferTestData2.message.value.content.headers.accept)
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-destination'], transferTestData2.message.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-source'], transferTestData2.message.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[1].message.content.headers['content-type'], transferTestData2.message.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[1].value, 4)
    test.equal(result.accumulatedTransferStates[transferTestData2.message.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.equal(result.notifyMessages[2].message.content.headers.accept, transferTestData3.message.value.content.headers.accept)
    test.equal(result.notifyMessages[2].message.content.headers['fspiop-destination'], transferTestData3.message.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[2].message.content.headers['fspiop-source'], transferTestData3.message.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[2].message.content.headers['content-type'], transferTestData3.message.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[2].value, 6)
    test.equal(result.accumulatedTransferStates[transferTestData3.message.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.equal(result.notifyMessages[3].message.content.headers.accept, transferTestData4.message.value.content.headers.accept)
    test.equal(result.notifyMessages[3].message.content.headers['fspiop-destination'], transferTestData4.message.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[3].message.content.headers['fspiop-source'], transferTestData4.message.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[3].message.content.headers['content-type'], transferTestData4.message.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[3].value, 8)
    test.equal(result.accumulatedTransferStates[transferTestData4.message.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.end()
  })

  processPositionFulfilBinTest.test('should abort if fulfil is incorrect state', async (test) => {
    const accumulatedTransferStates = {
      [transferTestData1.message.value.id]: Enum.Transfers.TransferInternalState.INVALID,
      [transferTestData2.message.value.id]: Enum.Transfers.TransferInternalState.INVALID
    }
    const accumulatedFxTransferStates = {}
    const transferInfoList = {
      [transferTestData1.message.value.id]: transferTestData1.transferInfo,
      [transferTestData2.message.value.id]: transferTestData2.transferInfo
    }
    // Call the function
    const result = await processPositionFulfilBin(
      [commitBinItems, []],
      0,
      0,
      accumulatedTransferStates,
      accumulatedFxTransferStates,
      transferInfoList
    )

    // Assert the expected results
    test.equal(result.notifyMessages.length, 2)
    test.equal(result.accumulatedPositionValue, 0)
    test.equal(result.accumulatedPositionReservedValue, 0)
    test.deepEqual(result.accumulatedTransferStateChanges, [])

    test.equal(result.notifyMessages[0].message.content.headers.accept, transferTestData1.message.value.content.headers.accept)
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-destination'], transferTestData1.message.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-source'], Enum.Http.Headers.FSPIOP.SWITCH.value)
    test.equal(result.notifyMessages[0].message.content.headers['content-type'], transferTestData1.message.value.content.headers['content-type'])
    test.equal(result.accumulatedTransferStates[transferTestData1.message.value.id], Enum.Transfers.TransferInternalState.INVALID)

    test.equal(result.notifyMessages[1].message.content.headers.accept, transferTestData2.message.value.content.headers.accept)
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-destination'], transferTestData2.message.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-source'], Enum.Http.Headers.FSPIOP.SWITCH.value)
    test.equal(result.notifyMessages[1].message.content.headers['content-type'], transferTestData2.message.value.content.headers['content-type'])
    test.equal(result.accumulatedTransferStates[transferTestData2.message.value.id], Enum.Transfers.TransferInternalState.INVALID)

    test.end()
  })

  processPositionFulfilBinTest.end()
})
