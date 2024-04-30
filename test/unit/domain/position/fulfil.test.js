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

const transferMessage1 = {
  value: {
    from: 'perffsp1',
    to: 'perffsp2',
    id: '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f',
    content: {
      uriParams: {
        id: '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f'
      },
      headers: {
        accept: 'application/vnd.interoperability.transfers+json;version=1.1',
        'content-type': 'application/vnd.interoperability.transfers+json;version=1.1',
        date: '2023-08-21T10:22:11.000Z',
        'fspiop-source': 'perffsp1',
        'fspiop-destination': 'perffsp2',
        traceparent: '00-278414be0ce56adab6c6461b1196f7ec-c2639bb302a327f2-01',
        tracestate: 'acmevendor=eyJzcGFuSWQiOiJjMjYzOWJiMzAyYTMyN2YyIiwidGltZUFwaVByZXBhcmUiOiIxNjkyMjg1OTA4MTc4In0=,tx_end2end_start_ts=1692285908177,tx_callback_start_ts=1692613331481',
        'user-agent': 'axios/1.4.0',
        'content-length': '136',
        'accept-encoding': 'gzip, compress, deflate, br',
        host: 'ml-api-adapter:3000',
        connection: 'keep-alive'
      },
      payload: 'data:application/vnd.interoperability.transfers+json;version=1.1;base64,eyJ0cmFuc2ZlclN0YXRlIjoiQ09NTUlUVEVEIiwiZnVsZmlsbWVudCI6ImxuWWU0cll3THRoV2J6aFZ5WDVjQXVEZkwxVWx3NFdkYVRneUdEUkV5c3ciLCJjb21wbGV0ZWRUaW1lc3RhbXAiOiIyMDIzLTA4LTIxVDEwOjIyOjExLjQ4MVoifQ=='
    },
    type: 'application/json',
    metadata: {
      correlationId: '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f',
      event: {
        type: 'position',
        action: 'commit',
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
          transactionId: '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f',
          source: 'perffsp1',
          destination: 'perffsp2'
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
const transferMessage2 = {
  value: {
    from: 'perffsp2',
    to: 'perffsp1',
    id: '4830fa00-0c2a-4de1-9640-5ad4e68f5f62',
    content: {
      uriParams: {
        id: '4830fa00-0c2a-4de1-9640-5ad4e68f5f62'
      },
      headers: {
        accept: 'application/vnd.interoperability.transfers+json;version=1.1',
        'content-type': 'application/vnd.interoperability.transfers+json;version=1.1',
        date: '2023-08-21T10:22:27.000Z',
        'fspiop-source': 'perffsp2',
        'fspiop-destination': 'perffsp1',
        traceparent: '00-1fcd3843697316bd4dea096eb8b0f20d-242262bdec0c9c76-01',
        tracestate: 'acmevendor=eyJzcGFuSWQiOiIyNDIyNjJiZGVjMGM5Yzc2IiwidGltZUFwaVByZXBhcmUiOiIxNjkyMjg1OTEyMDI3In0=,tx_end2end_start_ts=1692285912027,tx_callback_start_ts=1692613347073',
        'user-agent': 'axios/1.4.0',
        'content-length': '136',
        'accept-encoding': 'gzip, compress, deflate, br',
        host: 'ml-api-adapter:3000',
        connection: 'keep-alive'
      },
      payload: 'data:application/vnd.interoperability.transfers+json;version=1.1;base64,eyJ0cmFuc2ZlclN0YXRlIjoiQ09NTUlUVEVEIiwiZnVsZmlsbWVudCI6ImxuWWU0cll3THRoV2J6aFZ5WDVjQXVEZkwxVWx3NFdkYVRneUdEUkV5c3ciLCJjb21wbGV0ZWRUaW1lc3RhbXAiOiIyMDIzLTA4LTIxVDEwOjIyOjI3LjA3M1oifQ=='
    },
    type: 'application/json',
    metadata: {
      correlationId: '4830fa00-0c2a-4de1-9640-5ad4e68f5f62',
      event: {
        type: 'position',
        action: 'commit',
        createdAt: '2023-08-21T10:22:27.074Z',
        state: {
          status: 'success',
          code: 0,
          description: 'action successful'
        },
        id: 'c16155a3-1807-470d-9386-ce46603ed875'
      },
      trace: {
        service: 'cl_transfer_fulfil',
        traceId: '1fcd3843697316bd4dea096eb8b0f20d',
        spanId: '5690c3dbd5bb1ee5',
        sampled: 1,
        flags: '01',
        parentSpanId: '66055f3f76497fc9',
        startTimestamp: '2023-08-21T10:23:45.332Z',
        tags: {
          tracestate: 'acmevendor=eyJzcGFuSWQiOiI1NjkwYzNkYmQ1YmIxZWU1IiwidGltZUFwaVByZXBhcmUiOiIxNjkyMjg1OTEyMDI3IiwidGltZUFwaUZ1bGZpbCI6IjE2OTI2MTMzNDcwNzQifQ==,tx_end2end_start_ts=1692285912027,tx_callback_start_ts=1692613347073',
          transactionType: 'transfer',
          transactionAction: 'fulfil',
          transactionId: '4830fa00-0c2a-4de1-9640-5ad4e68f5f62',
          source: 'perffsp2',
          destination: 'perffsp1'
        },
        tracestates: {
          acmevendor: {
            spanId: '5690c3dbd5bb1ee5',
            timeApiPrepare: '1692285912027',
            timeApiFulfil: '1692613347074'
          },
          tx_end2end_start_ts: '1692285912027',
          tx_callback_start_ts: '1692613347073'
        }
      },
      'protocol.createdAt': 1692613425335
    }
  },
  size: 3489,
  key: 51,
  topic: 'topic-transfer-position',
  offset: 4073,
  partition: 0,
  timestamp: 1694175690401
}
const transferMessage3 = {
  value: {
    from: 'perffsp1',
    to: 'perffsp2',
    id: '780a1e7c-f01e-47a4-8538-1a27fb690627',
    content: {
      uriParams: {
        id: '780a1e7c-f01e-47a4-8538-1a27fb690627'
      },
      headers: {
        accept: 'application/vnd.interoperability.transfers+json;version=1.1',
        'content-type': 'application/vnd.interoperability.transfers+json;version=1.1',
        date: '2023-08-21T10:22:11.000Z',
        'fspiop-source': 'perffsp1',
        'fspiop-destination': 'perffsp2',
        traceparent: '00-278414be0ce56adab6c6461b1196f7ec-c2639bb302a327f2-01',
        tracestate: 'acmevendor=eyJzcGFuSWQiOiJjMjYzOWJiMzAyYTMyN2YyIiwidGltZUFwaVByZXBhcmUiOiIxNjkyMjg1OTA4MTc4In0=,tx_end2end_start_ts=1692285908177,tx_callback_start_ts=1692613331481',
        'user-agent': 'axios/1.4.0',
        'content-length': '136',
        'accept-encoding': 'gzip, compress, deflate, br',
        host: 'ml-api-adapter:3000',
        connection: 'keep-alive'
      },
      payload: 'data:application/vnd.interoperability.transfers+json;version=1.1;base64,eyJ0cmFuc2ZlclN0YXRlIjoiQ09NTUlUVEVEIiwiZnVsZmlsbWVudCI6ImxuWWU0cll3THRoV2J6aFZ5WDVjQXVEZkwxVWx3NFdkYVRneUdEUkV5c3ciLCJjb21wbGV0ZWRUaW1lc3RhbXAiOiIyMDIzLTA4LTIxVDEwOjIyOjExLjQ4MVoifQ=='
    },
    type: 'application/json',
    metadata: {
      correlationId: '780a1e7c-f01e-47a4-8538-1a27fb690627',
      event: {
        type: 'position',
        action: 'reserve',
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
          transactionId: '780a1e7c-f01e-47a4-8538-1a27fb690627',
          source: 'perffsp1',
          destination: 'perffsp2'
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
const transferMessage4 = {
  value: {
    from: 'perffsp2',
    to: 'perffsp1',
    id: '0a4834e7-7e4c-47e8-8dcb-f3f68031d377',
    content: {
      uriParams: {
        id: '0a4834e7-7e4c-47e8-8dcb-f3f68031d377'
      },
      headers: {
        accept: 'application/vnd.interoperability.transfers+json;version=1.1',
        'content-type': 'application/vnd.interoperability.transfers+json;version=1.1',
        date: '2023-08-21T10:22:27.000Z',
        'fspiop-source': 'perffsp2',
        'fspiop-destination': 'perffsp1',
        traceparent: '00-1fcd3843697316bd4dea096eb8b0f20d-242262bdec0c9c76-01',
        tracestate: 'acmevendor=eyJzcGFuSWQiOiIyNDIyNjJiZGVjMGM5Yzc2IiwidGltZUFwaVByZXBhcmUiOiIxNjkyMjg1OTEyMDI3In0=,tx_end2end_start_ts=1692285912027,tx_callback_start_ts=1692613347073',
        'user-agent': 'axios/1.4.0',
        'content-length': '136',
        'accept-encoding': 'gzip, compress, deflate, br',
        host: 'ml-api-adapter:3000',
        connection: 'keep-alive'
      },
      payload: 'data:application/vnd.interoperability.transfers+json;version=1.1;base64,eyJ0cmFuc2ZlclN0YXRlIjoiQ09NTUlUVEVEIiwiZnVsZmlsbWVudCI6ImxuWWU0cll3THRoV2J6aFZ5WDVjQXVEZkwxVWx3NFdkYVRneUdEUkV5c3ciLCJjb21wbGV0ZWRUaW1lc3RhbXAiOiIyMDIzLTA4LTIxVDEwOjIyOjI3LjA3M1oifQ=='
    },
    type: 'application/json',
    metadata: {
      correlationId: '0a4834e7-7e4c-47e8-8dcb-f3f68031d377',
      event: {
        type: 'position',
        action: 'reserve',
        createdAt: '2023-08-21T10:22:27.074Z',
        state: {
          status: 'success',
          code: 0,
          description: 'action successful'
        },
        id: 'c16155a3-1807-470d-9386-ce46603ed875'
      },
      trace: {
        service: 'cl_transfer_fulfil',
        traceId: '1fcd3843697316bd4dea096eb8b0f20d',
        spanId: '5690c3dbd5bb1ee5',
        sampled: 1,
        flags: '01',
        parentSpanId: '66055f3f76497fc9',
        startTimestamp: '2023-08-21T10:23:45.332Z',
        tags: {
          tracestate: 'acmevendor=eyJzcGFuSWQiOiI1NjkwYzNkYmQ1YmIxZWU1IiwidGltZUFwaVByZXBhcmUiOiIxNjkyMjg1OTEyMDI3IiwidGltZUFwaUZ1bGZpbCI6IjE2OTI2MTMzNDcwNzQifQ==,tx_end2end_start_ts=1692285912027,tx_callback_start_ts=1692613347073',
          transactionType: 'transfer',
          transactionAction: 'fulfil',
          transactionId: '0a4834e7-7e4c-47e8-8dcb-f3f68031d377',
          source: 'perffsp2',
          destination: 'perffsp1'
        },
        tracestates: {
          acmevendor: {
            spanId: '5690c3dbd5bb1ee5',
            timeApiPrepare: '1692285912027',
            timeApiFulfil: '1692613347074'
          },
          tx_end2end_start_ts: '1692285912027',
          tx_callback_start_ts: '1692613347073'
        }
      },
      'protocol.createdAt': 1692613425335
    }
  },
  size: 3489,
  key: 51,
  topic: 'topic-transfer-position',
  offset: 4073,
  partition: 0,
  timestamp: 1694175690401
}
const span = {}
const commitBinItems = [{
  message: transferMessage1,
  span,
  decodedPayload: {
    transferState: 'COMMITTED',
    fulfilment: 'lnYe4rYwLthWbzhVyX5cAuDfL1Ulw4WdaTgyGDREysw',
    completedTimestamp: '2023-08-21T10:22:11.481Z'
  }
},
{
  message: transferMessage2,
  span,
  decodedPayload: {
    transferState: 'COMMITTED',
    fulfilment: 'lnYe4rYwLthWbzhVyX5cAuDfL1Ulw4WdaTgyGDREysw',
    completedTimestamp: '2023-08-21T10:22:27.073Z'
  }
}]
const reserveBinItems = [{
  message: transferMessage3,
  span,
  decodedPayload: {
    transferState: 'RESERVED',
    fulfilment: 'lnYe4rYwLthWbzhVyX5cAuDfL1Ulw4WdaTgyGDREysw',
    completedTimestamp: '2023-08-21T10:22:11.481Z'
  }
},
{
  message: transferMessage4,
  span,
  decodedPayload: {
    transferState: 'RESERVED',
    fulfilment: 'lnYe4rYwLthWbzhVyX5cAuDfL1Ulw4WdaTgyGDREysw',
    completedTimestamp: '2023-08-21T10:22:27.073Z'
  }
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
    // Call the function
    const result = await processPositionFulfilBin(
      [commitBinItems, []],
      0,
      0,
      // Transfer States
      {
        '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f': Enum.Transfers.TransferInternalState.RECEIVED_FULFIL,
        '4830fa00-0c2a-4de1-9640-5ad4e68f5f62': Enum.Transfers.TransferInternalState.RECEIVED_FULFIL
      },
      // FX Transfer States
      {},
      {
        '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f': {
          amount: 2.00
        },
        '4830fa00-0c2a-4de1-9640-5ad4e68f5f62': {
          amount: 2.00
        }
      }
    )

    // Assert the expected results
    test.equal(result.notifyMessages.length, 2)
    test.equal(result.accumulatedPositionValue, 4)
    test.equal(result.accumulatedPositionReservedValue, 0)
    test.deepEqual(result.accumulatedTransferStateChanges, [
      {
        transferId: '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f',
        transferStateId: 'COMMITTED',
        reason: undefined
      },
      {
        transferId: '4830fa00-0c2a-4de1-9640-5ad4e68f5f62',
        transferStateId: 'COMMITTED',
        reason: undefined
      }
    ])
    test.deepEqual(result.accumulatedTransferStates, {
      '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f': 'COMMITTED',
      '4830fa00-0c2a-4de1-9640-5ad4e68f5f62': 'COMMITTED'
    })

    test.equal(result.notifyMessages[0].message.content.headers.accept, transferMessage1.value.content.headers.accept)
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-destination'], transferMessage1.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-source'], transferMessage1.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[0].message.content.headers['content-type'], transferMessage1.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[0].value, 2)
    test.equal(result.accumulatedTransferStates[transferMessage1.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.equal(result.notifyMessages[1].message.content.headers.accept, transferMessage2.value.content.headers.accept)
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-destination'], transferMessage2.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-source'], transferMessage2.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[1].message.content.headers['content-type'], transferMessage2.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[1].value, 4)
    test.equal(result.accumulatedTransferStates[transferMessage2.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.end()
  })

  processPositionFulfilBinTest.test('should process a bin of position-reserve messages', async (test) => {
    // Call the function
    const result = await processPositionFulfilBin(
      [[], reserveBinItems],
      0,
      0,
      // Transfer States
      {
        '780a1e7c-f01e-47a4-8538-1a27fb690627': Enum.Transfers.TransferInternalState.RECEIVED_FULFIL,
        '0a4834e7-7e4c-47e8-8dcb-f3f68031d377': Enum.Transfers.TransferInternalState.RECEIVED_FULFIL
      },
      // FX Transfer States
      {},
      {
        '780a1e7c-f01e-47a4-8538-1a27fb690627': {
          amount: 2.00
        },
        '0a4834e7-7e4c-47e8-8dcb-f3f68031d377': {
          amount: 2.00
        }
      },
      {
        '780a1e7c-f01e-47a4-8538-1a27fb690627': {
          transferId: '780a1e7c-f01e-47a4-8538-1a27fb690627',
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
        }
      }
    )

    // Assert the expected results
    test.equal(result.notifyMessages.length, 2)
    test.equal(result.accumulatedPositionValue, 4)
    test.equal(result.accumulatedPositionReservedValue, 0)
    test.deepEqual(result.accumulatedTransferStateChanges, [
      {
        transferId: '780a1e7c-f01e-47a4-8538-1a27fb690627',
        transferStateId: 'COMMITTED',
        reason: undefined
      },
      {
        transferId: '0a4834e7-7e4c-47e8-8dcb-f3f68031d377',
        transferStateId: 'COMMITTED',
        reason: undefined
      }
    ])
    test.deepEqual(result.accumulatedTransferStates, {
      '780a1e7c-f01e-47a4-8538-1a27fb690627': 'COMMITTED',
      '0a4834e7-7e4c-47e8-8dcb-f3f68031d377': 'COMMITTED'
    })
    console.log(result.accumulatedTransferStates)
    test.equal(result.notifyMessages[0].message.content.headers.accept, transferMessage1.value.content.headers.accept)
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-destination'], transferMessage1.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-source'], transferMessage1.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[0].message.content.headers['content-type'], transferMessage1.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[0].value, 2)
    test.equal(result.accumulatedTransferStates[transferMessage3.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.equal(result.notifyMessages[1].message.content.headers.accept, transferMessage2.value.content.headers.accept)
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-destination'], transferMessage2.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-source'], transferMessage2.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[1].message.content.headers['content-type'], transferMessage2.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[1].value, 4)
    test.equal(result.accumulatedTransferStates[transferMessage4.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.end()
  })

  processPositionFulfilBinTest.test('should process a bin of position-reserve and position-commit messages', async (test) => {
    // Call the function
    const result = await processPositionFulfilBin(
      [commitBinItems, reserveBinItems],
      0,
      0,
      // Transfer States
      {
        '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f': Enum.Transfers.TransferInternalState.RECEIVED_FULFIL,
        '4830fa00-0c2a-4de1-9640-5ad4e68f5f62': Enum.Transfers.TransferInternalState.RECEIVED_FULFIL,
        '780a1e7c-f01e-47a4-8538-1a27fb690627': Enum.Transfers.TransferInternalState.RECEIVED_FULFIL,
        '0a4834e7-7e4c-47e8-8dcb-f3f68031d377': Enum.Transfers.TransferInternalState.RECEIVED_FULFIL
      },
      // FX Transfer States
      {},
      {
        '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f': {
          amount: 2.00
        },
        '4830fa00-0c2a-4de1-9640-5ad4e68f5f62': {
          amount: 2.00
        },
        '780a1e7c-f01e-47a4-8538-1a27fb690627': {
          amount: 2.00
        },
        '0a4834e7-7e4c-47e8-8dcb-f3f68031d377': {
          amount: 2.00
        }
      },
      {
        '780a1e7c-f01e-47a4-8538-1a27fb690627': {
          transferId: '780a1e7c-f01e-47a4-8538-1a27fb690627',
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
        }
      }
    )

    // Assert the expected results
    test.equal(result.notifyMessages.length, 4)
    test.equal(result.accumulatedPositionValue, 8)
    test.equal(result.accumulatedPositionReservedValue, 0)
    test.deepEqual(result.accumulatedTransferStateChanges, [
      {
        transferId: '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f',
        transferStateId: 'COMMITTED',
        reason: undefined
      },
      {
        transferId: '4830fa00-0c2a-4de1-9640-5ad4e68f5f62',
        transferStateId: 'COMMITTED',
        reason: undefined
      },
      {
        transferId: '780a1e7c-f01e-47a4-8538-1a27fb690627',
        transferStateId: 'COMMITTED',
        reason: undefined
      },
      {
        transferId: '0a4834e7-7e4c-47e8-8dcb-f3f68031d377',
        transferStateId: 'COMMITTED',
        reason: undefined
      }
    ])
    test.deepEqual(result.accumulatedTransferStates, {
      '780a1e7c-f01e-47a4-8538-1a27fb690627': 'COMMITTED',
      '0a4834e7-7e4c-47e8-8dcb-f3f68031d377': 'COMMITTED',
      '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f': 'COMMITTED',
      '4830fa00-0c2a-4de1-9640-5ad4e68f5f62': 'COMMITTED'
    })
    console.log(result.accumulatedPositionChanges)
    test.equal(result.notifyMessages[0].message.content.headers.accept, transferMessage1.value.content.headers.accept)
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-destination'], transferMessage1.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-source'], transferMessage1.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[0].message.content.headers['content-type'], transferMessage1.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[0].value, 2)
    test.equal(result.accumulatedTransferStates[transferMessage1.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.equal(result.notifyMessages[1].message.content.headers.accept, transferMessage2.value.content.headers.accept)
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-destination'], transferMessage2.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-source'], transferMessage2.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[1].message.content.headers['content-type'], transferMessage2.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[1].value, 4)
    test.equal(result.accumulatedTransferStates[transferMessage2.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.equal(result.notifyMessages[2].message.content.headers.accept, transferMessage1.value.content.headers.accept)
    test.equal(result.notifyMessages[2].message.content.headers['fspiop-destination'], transferMessage1.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[2].message.content.headers['fspiop-source'], transferMessage1.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[2].message.content.headers['content-type'], transferMessage1.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[2].value, 6)
    test.equal(result.accumulatedTransferStates[transferMessage3.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.equal(result.notifyMessages[3].message.content.headers.accept, transferMessage2.value.content.headers.accept)
    test.equal(result.notifyMessages[3].message.content.headers['fspiop-destination'], transferMessage2.value.content.headers['fspiop-destination'])
    test.equal(result.notifyMessages[3].message.content.headers['fspiop-source'], transferMessage2.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[3].message.content.headers['content-type'], transferMessage2.value.content.headers['content-type'])
    test.equal(result.accumulatedPositionChanges[3].value, 8)
    test.equal(result.accumulatedTransferStates[transferMessage4.value.id], Enum.Transfers.TransferState.COMMITTED)

    test.end()
  })

  processPositionFulfilBinTest.test('should abort if fulfil is incorrect state', async (test) => {
    // Call the function
    const result = await processPositionFulfilBin(
      [commitBinItems, []],
      0,
      0,
      // Transfer States
      {
        '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f': Enum.Transfers.TransferInternalState.INVALID,
        '4830fa00-0c2a-4de1-9640-5ad4e68f5f62': Enum.Transfers.TransferInternalState.INVALID
      },
      // FX Transfer States
      {},
      {
        '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f': {
          amount: 2.00
        },
        '4830fa00-0c2a-4de1-9640-5ad4e68f5f62': {
          amount: 2.00
        }
      }
    )

    // Assert the expected results
    test.equal(result.notifyMessages.length, 2)
    test.equal(result.accumulatedPositionValue, 0)
    test.equal(result.accumulatedPositionReservedValue, 0)
    test.deepEqual(result.accumulatedTransferStateChanges, [])
    test.deepEqual(result.accumulatedTransferStates,
      {
        '68c8aa25-fe5b-4b1f-a0ab-ab890fe3ae7f': Enum.Transfers.TransferInternalState.INVALID,
        '4830fa00-0c2a-4de1-9640-5ad4e68f5f62': Enum.Transfers.TransferInternalState.INVALID
      }
    )

    test.equal(result.notifyMessages[0].message.content.headers.accept, transferMessage1.value.content.headers.accept)
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-destination'], transferMessage1.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[0].message.content.headers['fspiop-source'], Enum.Http.Headers.FSPIOP.SWITCH.value)
    test.equal(result.notifyMessages[0].message.content.headers['content-type'], transferMessage1.value.content.headers['content-type'])
    test.equal(result.accumulatedTransferStates[transferMessage1.value.id], Enum.Transfers.TransferInternalState.INVALID)

    console.log(transferMessage2.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[1].message.content.headers.accept, transferMessage2.value.content.headers.accept)
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-destination'], transferMessage2.value.content.headers['fspiop-source'])
    test.equal(result.notifyMessages[1].message.content.headers['fspiop-source'], Enum.Http.Headers.FSPIOP.SWITCH.value)
    test.equal(result.notifyMessages[1].message.content.headers['content-type'], transferMessage2.value.content.headers['content-type'])
    test.equal(result.accumulatedTransferStates[transferMessage2.value.id], Enum.Transfers.TransferInternalState.INVALID)

    test.end()
  })

  processPositionFulfilBinTest.end()
})
