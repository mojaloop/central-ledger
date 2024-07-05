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
const { processPositionTimeoutReservedBin } = require('../../../../src/domain/position/timeout-reserved')

const timeoutMessage1 = {
  value: {
    from: 'perffsp1',
    to: 'perffsp2',
    id: 'd6a036a5-65a3-48af-a0c7-ee089c412ada',
    content: {
      uriParams: {
        id: 'd6a036a5-65a3-48af-a0c7-ee089c412ada'
      },
      headers: {
        accept: 'application/vnd.interoperability.transfers+json;version=1.0',
        'fspiop-destination': 'perffsp2',
        'Content-Type': 'application/vnd.interoperability.transfers+json;version=1.0',
        date: 'Tue, 14 May 2024 00:13:15 GMT',
        'fspiop-source': 'perffsp1'
      },
      payload: {
        errorInformation: {
          errorCode: '3303',
          errorDescription: 'Transfer expired',
          extensionList: {
            extension: [
              {
                key: 'cause',
                value: 'FSPIOPError at Object.createFSPIOPError...'
              }
            ]
          }
        }
      }
    },
    type: 'application/vnd.interoperability.transfers+json;version=1.0',
    metadata: {
      correlationId: 'd6a036a5-65a3-48af-a0c7-ee089c412ada',
      event: {
        type: 'position',
        action: 'timeout-reserved',
        createdAt: '2024-05-14T00:13:15.092Z',
        state: {
          status: 'error',
          code: '3303',
          description: 'Transfer expired'
        },
        id: '1ef2f45c-f7a4-4b67-a0fc-7164ed43f0f1'
      },
      trace: {
        service: 'cl_transfer_timeout',
        traceId: 'de8e410463b73e45203fc916d68cf98c',
        spanId: 'bb0abd2ea5fdfbbd',
        startTimestamp: '2024-05-14T00:13:15.092Z',
        tags: {
          tracestate: 'acmevendor=eyJzcGFuSWQiOiJiYjBhYmQyZWE1ZmRmYmJkIn0=',
          transactionType: 'transfer',
          transactionAction: 'timeout-received',
          source: 'switch',
          destination: 'perffsp1'
        },
        tracestates: {
          acmevendor: {
            spanId: 'bb0abd2ea5fdfbbd'
          }
        }
      },
      'protocol.createdAt': 1715645595093
    }
  },
  size: 3489,
  key: 51,
  topic: 'topic-transfer-position',
  offset: 4073,
  partition: 0,
  timestamp: 1694175690401
}
const timeoutMessage2 = {
  value: {
    from: 'perffsp1',
    to: 'perffsp2',
    id: '7e3fa3f7-9a1b-4a81-83c9-5b41112dd7f5',
    content: {
      uriParams: {
        id: '7e3fa3f7-9a1b-4a81-83c9-5b41112dd7f5'
      },
      headers: {
        accept: 'application/vnd.interoperability.transfers+json;version=1.0',
        'fspiop-destination': 'perffsp2',
        'Content-Type': 'application/vnd.interoperability.transfers+json;version=1.0',
        date: 'Tue, 14 May 2024 00:13:15 GMT',
        'fspiop-source': 'perffsp1'
      },
      payload: {
        errorInformation: {
          errorCode: '3303',
          errorDescription: 'Transfer expired',
          extensionList: {
            extension: [
              {
                key: 'cause',
                value: 'FSPIOPError at Object.createFSPIOPError...'
              }
            ]
          }
        }
      }
    },
    type: 'application/vnd.interoperability.transfers+json;version=1.0',
    metadata: {
      correlationId: '7e3fa3f7-9a1b-4a81-83c9-5b41112dd7f5',
      event: {
        type: 'position',
        action: 'timeout-reserved',
        createdAt: '2024-05-14T00:13:15.092Z',
        state: {
          status: 'error',
          code: '3303',
          description: 'Transfer expired'
        },
        id: '1ef2f45c-f7a4-4b67-a0fc-7164ed43f0f1'
      },
      trace: {
        service: 'cl_transfer_timeout',
        traceId: 'de8e410463b73e45203fc916d68cf98c',
        spanId: 'bb0abd2ea5fdfbbd',
        startTimestamp: '2024-05-14T00:13:15.092Z',
        tags: {
          tracestate: 'acmevendor=eyJzcGFuSWQiOiJiYjBhYmQyZWE1ZmRmYmJkIn0=',
          transactionType: 'transfer',
          transactionAction: 'timeout-received',
          source: 'switch',
          destination: 'perffsp1'
        },
        tracestates: {
          acmevendor: {
            spanId: 'bb0abd2ea5fdfbbd'
          }
        }
      },
      'protocol.createdAt': 1715645595093
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
const binItems = [{
  message: timeoutMessage1,
  span,
  decodedPayload: {}
},
{
  message: timeoutMessage2,
  span,
  decodedPayload: {}
}]

Test('timeout reserved domain', positionIndexTest => {
  let sandbox

  positionIndexTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    t.end()
  })

  positionIndexTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  positionIndexTest.test('processPositionTimeoutReservedBin should', changeParticipantPositionTest => {
    changeParticipantPositionTest.test('produce abort message for transfers not in the right transfer state', async (test) => {
      try {
        await processPositionTimeoutReservedBin(
          binItems,
          0, // Accumulated position value
          0,
          {
            'd6a036a5-65a3-48af-a0c7-ee089c412ada': 'INVALID_STATE',
            '7e3fa3f7-9a1b-4a81-83c9-5b41112dd7f5': 'INVALID_STATE'
          },
          {}
        )
        test.fail('Error not thrown')
      } catch (e) {
        test.pass('Error thrown')
      }
      test.end()
    })

    changeParticipantPositionTest.test('produce reserved messages/position changes for valid timeout messages', async (test) => {
      const processedMessages = await processPositionTimeoutReservedBin(
        binItems,
        0, // Accumulated position value
        0,
        {
          'd6a036a5-65a3-48af-a0c7-ee089c412ada': Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT,
          '7e3fa3f7-9a1b-4a81-83c9-5b41112dd7f5': Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT
        },
        {
          'd6a036a5-65a3-48af-a0c7-ee089c412ada': {
            amount: -10
          },
          '7e3fa3f7-9a1b-4a81-83c9-5b41112dd7f5': {
            amount: -5
          }
        }
      )
      test.equal(processedMessages.notifyMessages.length, 2)

      test.equal(processedMessages.accumulatedPositionChanges.length, 2)

      test.equal(processedMessages.notifyMessages[0].message.content.headers['fspiop-destination'], timeoutMessage1.value.to)
      test.equal(processedMessages.notifyMessages[0].message.content.headers['fspiop-source'], timeoutMessage1.value.from)
      test.equal(processedMessages.notifyMessages[0].message.content.headers['content-type'], timeoutMessage1.value.content.headers['content-type'])
      test.equal(processedMessages.accumulatedPositionChanges[0].value, -10)
      test.equal(processedMessages.accumulatedTransferStates[timeoutMessage1.value.id], Enum.Transfers.TransferInternalState.EXPIRED_RESERVED)

      test.equal(processedMessages.notifyMessages[1].message.content.headers['fspiop-destination'], timeoutMessage2.value.to)
      test.equal(processedMessages.notifyMessages[1].message.content.headers['fspiop-source'], timeoutMessage1.value.from)
      test.equal(processedMessages.notifyMessages[1].message.content.headers['content-type'], timeoutMessage2.value.content.headers['content-type'])
      test.equal(processedMessages.accumulatedPositionChanges[1].value, -15)
      test.equal(processedMessages.accumulatedTransferStates[timeoutMessage2.value.id], Enum.Transfers.TransferInternalState.EXPIRED_RESERVED)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferId, timeoutMessage1.value.id)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferId, timeoutMessage2.value.id)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferInternalState.EXPIRED_RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferInternalState.EXPIRED_RESERVED)

      test.equal(processedMessages.accumulatedPositionValue, -15)
      test.end()
    })

    changeParticipantPositionTest.end()
  })

  positionIndexTest.end()
})
