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
const { processPositionAbortBin } = require('../../../../src/domain/position/abort')

const abortMessage1 = {
  value: {
    from: 'payeefsp1',
    to: 'payerfsp1',
    id: 'a0000001-0000-0000-0000-000000000000',
    content: {
      uriParams: {
        id: 'a0000001-0000-0000-0000-000000000000'
      },
      headers: {
        accept: 'application/vnd.interoperability.transfers+json;version=1.0',
        'fspiop-destination': 'payerfsp1',
        'Content-Type': 'application/vnd.interoperability.transfers+json;version=1.0',
        date: 'Tue, 14 May 2024 00:13:15 GMT',
        'fspiop-source': 'payeefsp1'
      },
      payload: {
        errorInformation: {
          errorCode: '5104',
          errorDescription: 'Payee Rejected'
        }
      },
      context: {
        cyrilResult: {
          positionChanges: [
            {
              isFxTransferStateChange: false,
              transferId: 'a0000001-0000-0000-0000-000000000000',
              notifyTo: 'payerfsp1',
              participantCurrencyId: 1,
              amount: -10
            },
            {
              isFxTransferStateChange: true,
              commitRequestId: 'b0000001-0000-0000-0000-000000000000',
              notifyTo: 'fxp1',
              participantCurrencyId: 2,
              amount: -10
            }
          ]
        }
      }
    },
    type: 'application/vnd.interoperability.transfers+json;version=1.0',
    metadata: {
      correlationId: 'a0000001-0000-0000-0000-000000000000',
      event: {
        type: 'position',
        action: 'abort',
        createdAt: '2024-05-14T00:13:15.092Z',
        state: {
          status: 'error',
          code: '5104',
          description: 'Payee Rejected'
        },
        id: '1ef2f45c-f7a4-4b67-a0fc-7164ed43f0f1'
      },
      trace: {
        service: 'cl_transfer',
        traceId: 'de8e410463b73e45203fc916d68cf98c',
        spanId: 'bb0abd2ea5fdfbbd',
        startTimestamp: '2024-05-14T00:13:15.092Z',
        tags: {
          tracestate: 'acmevendor=eyJzcGFuSWQiOiJiYjBhYmQyZWE1ZmRmYmJkIn0=',
          transactionType: 'transfer',
          transactionAction: 'abort',
          source: 'payeefsp1',
          destination: 'payerfsp1'
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

const abortMessage2 = {
  value: {
    from: 'payeefsp1',
    to: 'payerfsp1',
    id: 'a0000002-0000-0000-0000-000000000000',
    content: {
      uriParams: {
        id: 'a0000002-0000-0000-0000-000000000000'
      },
      headers: {
        accept: 'application/vnd.interoperability.transfers+json;version=1.0',
        'fspiop-destination': 'payerfsp1',
        'Content-Type': 'application/vnd.interoperability.transfers+json;version=1.0',
        date: 'Tue, 14 May 2024 00:13:15 GMT',
        'fspiop-source': 'payeefsp1'
      },
      payload: {
        errorInformation: {
          errorCode: '5104',
          errorDescription: 'Payee Rejected'
        }
      },
      context: {
        cyrilResult: {
          positionChanges: [
            {
              isFxTransferStateChange: false,
              transferId: 'a0000002-0000-0000-0000-000000000000',
              notifyTo: 'payerfsp1',
              participantCurrencyId: 1,
              amount: -10
            }
          ]
        }
      }
    },
    type: 'application/vnd.interoperability.transfers+json;version=1.0',
    metadata: {
      correlationId: 'a0000002-0000-0000-0000-000000000000',
      event: {
        type: 'position',
        action: 'abort',
        createdAt: '2024-05-14T00:13:15.092Z',
        state: {
          status: 'error',
          code: '5104',
          description: 'Payee Rejected'
        },
        id: '1ef2f45c-f7a4-4b67-a0fc-7164ed43f0f1'
      },
      trace: {
        service: 'cl_transfer',
        traceId: 'de8e410463b73e45203fc916d68cf98c',
        spanId: 'bb0abd2ea5fdfbbd',
        startTimestamp: '2024-05-14T00:13:15.092Z',
        tags: {
          tracestate: 'acmevendor=eyJzcGFuSWQiOiJiYjBhYmQyZWE1ZmRmYmJkIn0=',
          transactionType: 'transfer',
          transactionAction: 'abort',
          source: 'payeefsp1',
          destination: 'payerfsp1'
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

const fxAbortMessage1 = {
  value: {
    from: 'fxp1',
    to: 'payerfsp1',
    id: 'c0000001-0000-0000-0000-000000000000',
    content: {
      uriParams: {
        id: 'c0000001-0000-0000-0000-000000000000'
      },
      headers: {
        accept: 'application/vnd.interoperability.transfers+json;version=1.0',
        'fspiop-destination': 'payerfsp1',
        'Content-Type': 'application/vnd.interoperability.transfers+json;version=1.0',
        date: 'Tue, 14 May 2024 00:13:15 GMT',
        'fspiop-source': 'fxp1'
      },
      payload: {
        errorInformation: {
          errorCode: '5104',
          errorDescription: 'FXP Rejected'
        }
      },
      context: {
        cyrilResult: {
          positionChanges: [
            {
              isFxTransferStateChange: true,
              commitRequestId: 'c0000001-0000-0000-0000-000000000000',
              notifyTo: 'fxp1',
              participantCurrencyId: 1,
              amount: -10
            },
            {
              isFxTransferStateChange: false,
              transferId: 'd0000001-0000-0000-0000-000000000000',
              notifyTo: 'payerfsp1',
              participantCurrencyId: 1,
              amount: -10
            }
          ]
        }
      }
    },
    type: 'application/vnd.interoperability.transfers+json;version=1.0',
    metadata: {
      correlationId: 'c0000001-0000-0000-0000-000000000000',
      event: {
        type: 'position',
        action: 'fx-abort',
        createdAt: '2024-05-14T00:13:15.092Z',
        state: {
          status: 'error',
          code: '5104',
          description: 'Payee Rejected'
        },
        id: '1ef2f45c-f7a4-4b67-a0fc-7164ed43f0f1'
      },
      trace: {
        service: 'cl_transfer',
        traceId: 'de8e410463b73e45203fc916d68cf98c',
        spanId: 'bb0abd2ea5fdfbbd',
        startTimestamp: '2024-05-14T00:13:15.092Z',
        tags: {
          tracestate: 'acmevendor=eyJzcGFuSWQiOiJiYjBhYmQyZWE1ZmRmYmJkIn0=',
          transactionType: 'transfer',
          transactionAction: 'fx-abort',
          source: 'fxp1',
          destination: 'payerfsp1'
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

const fxAbortMessage2 = {
  value: {
    from: 'fxp1',
    to: 'payerfsp1',
    id: 'c0000002-0000-0000-0000-000000000000',
    content: {
      uriParams: {
        id: 'c0000002-0000-0000-0000-000000000000'
      },
      headers: {
        accept: 'application/vnd.interoperability.transfers+json;version=1.0',
        'fspiop-destination': 'payerfsp1',
        'Content-Type': 'application/vnd.interoperability.transfers+json;version=1.0',
        date: 'Tue, 14 May 2024 00:13:15 GMT',
        'fspiop-source': 'fxp1'
      },
      payload: {
        errorInformation: {
          errorCode: '5104',
          errorDescription: 'FXP Rejected'
        }
      },
      context: {
        cyrilResult: {
          positionChanges: [
            {
              isFxTransferStateChange: true,
              commitRequestId: 'c0000002-0000-0000-0000-000000000000',
              notifyTo: 'fxp1',
              participantCurrencyId: 1,
              amount: -10
            }
          ]
        }
      }
    },
    type: 'application/vnd.interoperability.transfers+json;version=1.0',
    metadata: {
      correlationId: 'c0000002-0000-0000-0000-000000000000',
      event: {
        type: 'position',
        action: 'fx-abort',
        createdAt: '2024-05-14T00:13:15.092Z',
        state: {
          status: 'error',
          code: '5104',
          description: 'Payee Rejected'
        },
        id: '1ef2f45c-f7a4-4b67-a0fc-7164ed43f0f1'
      },
      trace: {
        service: 'cl_transfer',
        traceId: 'de8e410463b73e45203fc916d68cf98c',
        spanId: 'bb0abd2ea5fdfbbd',
        startTimestamp: '2024-05-14T00:13:15.092Z',
        tags: {
          tracestate: 'acmevendor=eyJzcGFuSWQiOiJiYjBhYmQyZWE1ZmRmYmJkIn0=',
          transactionType: 'transfer',
          transactionAction: 'fx-abort',
          source: 'fxp1',
          destination: 'payerfsp1'
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

const getAbortBinItems = () => {
  const binItems = [
    {
      message: JSON.parse(JSON.stringify(abortMessage1)),
      span,
      decodedPayload: {}
    },
    {
      message: JSON.parse(JSON.stringify(abortMessage2)),
      span,
      decodedPayload: {}
    }
  ]
  return binItems
}

const getFxAbortBinItems = () => {
  const binItems = [
    {
      message: JSON.parse(JSON.stringify(fxAbortMessage1)),
      span,
      decodedPayload: {}
    },
    {
      message: JSON.parse(JSON.stringify(fxAbortMessage2)),
      span,
      decodedPayload: {}
    }
  ]
  return binItems
}

Test('abort domain', positionIndexTest => {
  let sandbox

  positionIndexTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    t.end()
  })

  positionIndexTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  positionIndexTest.test('processPositionAbortBin should', processPositionAbortBinTest => {
    processPositionAbortBinTest.test('produce abort message for transfers not in the right transfer state', async (test) => {
      const binItems = getAbortBinItems()
      try {
        await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'a0000001-0000-0000-0000-000000000000': 'INVALID_STATE',
              'a0000002-0000-0000-0000-000000000000': 'INVALID_STATE'
            },
            accumulatedFxTransferStates: {
              'b0000001-0000-0000-0000-000000000000': 'INVALID_STATE'
            },
            isFx: false
          }
        )
        test.fail('Error not thrown')
      } catch (e) {
        test.pass('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('produce abort messages with correct states but invalid cyrilResult', async (test) => {
      const binItems = getAbortBinItems()
      binItems[0].message.value.content.context = {
        cyrilResult: 'INVALID'
      }
      try {
        await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'a0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR,
              'a0000002-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            accumulatedFxTransferStates: {
              'b0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: false
          }
        )
        test.fail('Error not thrown')
      } catch (e) {
        test.pass('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('produce abort messages with correct states and proper cyrilResult.', async (test) => {
      const binItems = getAbortBinItems()
      try {
        const processedResult = await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'a0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR,
              'a0000002-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            accumulatedFxTransferStates: {
              'b0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: false
          }
        )
        test.pass('Error not thrown')
        test.equal(processedResult.notifyMessages.length, 1)
        test.equal(processedResult.followupMessages.length, 1)
        test.equal(processedResult.accumulatedPositionChanges.length, 2)
        test.equal(processedResult.accumulatedPositionChanges[0].value, -10)
        test.equal(processedResult.accumulatedTransferStates[abortMessage1.value.id], Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedTransferStates[abortMessage2.value.id], Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedTransferStateChanges[0].transferId, abortMessage1.value.id)
        test.equal(processedResult.accumulatedTransferStateChanges[1].transferId, abortMessage2.value.id)
        test.equal(processedResult.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedPositionValue, -20)
      } catch (e) {
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('produce abort messages with correct states and proper cyrilResult with a single message. expecting one position to be adjusted and one followup message', async (test) => {
      const binItems = getAbortBinItems()
      binItems.splice(1, 1)
      try {
        const processedResult = await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'a0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR,
              'a0000002-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            accumulatedFxTransferStates: {
              'b0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: false
          }
        )
        test.pass('Error not thrown')
        test.equal(processedResult.notifyMessages.length, 0)
        test.equal(processedResult.followupMessages.length, 1)
        test.equal(processedResult.accumulatedPositionChanges.length, 1)
        test.equal(processedResult.accumulatedPositionChanges[0].value, -10)
        test.equal(processedResult.accumulatedTransferStates[abortMessage1.value.id], Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedTransferStateChanges[0].transferId, abortMessage1.value.id)
        test.equal(processedResult.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedPositionValue, -10)
      } catch (e) {
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('skip position changes if changePositions is false', async (test) => {
      const binItems = getAbortBinItems()
      try {
        const processedResult = await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'a0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR,
              'a0000002-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: false,
            changePositions: false
          }
        )
        test.equal(processedResult.accumulatedPositionChanges.length, 0)
        test.equal(processedResult.accumulatedPositionValue, 0)
        test.equal(processedResult.accumulatedTransferStateChanges.length, 2)
        processedResult.accumulatedTransferStateChanges.forEach(transferStateChange => test.equal(transferStateChange.transferStateId, Enum.Transfers.TransferInternalState.ABORTED_ERROR))
        processedResult.accumulatedTransferStates[abortMessage1.value.id] = Enum.Transfers.TransferInternalState.ABORTED_ERROR
        processedResult.accumulatedTransferStates[abortMessage2.value.id] = Enum.Transfers.TransferInternalState.ABORTED_ERROR
      } catch (e) {
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.end()
  })

  positionIndexTest.test('processPositionAbortBin with FX should', processPositionAbortBinTest => {
    processPositionAbortBinTest.test('produce fx-abort message for fxTransfers not in the right transfer state', async (test) => {
      const binItems = getFxAbortBinItems()
      try {
        await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'd0000001-0000-0000-0000-000000000000': 'INVALID_STATE'
            },
            accumulatedFxTransferStates: {
              'c0000001-0000-0000-0000-000000000000': 'INVALID_STATE',
              'c0000002-0000-0000-0000-000000000000': 'INVALID_STATE'
            },
            isFx: true
          }
        )
        test.fail('Error not thrown')
      } catch (e) {
        test.pass('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('produce fx-abort messages with correct states but invalid cyrilResult', async (test) => {
      const binItems = getFxAbortBinItems()
      binItems[0].message.value.content.context = {
        cyrilResult: 'INVALID'
      }
      try {
        await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'd0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            accumulatedFxTransferStates: {
              'c0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR,
              'c0000002-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: true
          }
        )
        test.fail('Error not thrown')
      } catch (e) {
        test.pass('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('produce abort messages with correct states and proper cyrilResult.', async (test) => {
      const binItems = getFxAbortBinItems()
      try {
        const processedResult = await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'd0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            accumulatedFxTransferStates: {
              'c0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR,
              'c0000002-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: true
          }
        )
        test.pass('Error not thrown')
        test.equal(processedResult.notifyMessages.length, 1)
        test.equal(processedResult.followupMessages.length, 1)
        test.equal(processedResult.accumulatedPositionChanges.length, 2)
        test.equal(processedResult.accumulatedPositionChanges[0].value, -10)
        test.equal(processedResult.accumulatedFxTransferStates[fxAbortMessage1.value.id], Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedFxTransferStates[fxAbortMessage2.value.id], Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedPositionValue, -20)
      } catch (e) {
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('produce abort messages with correct states and proper cyrilResult with a single message. expecting one position to be adjusted and one followup message', async (test) => {
      const binItems = getFxAbortBinItems()
      binItems.splice(1, 1)
      try {
        const processedResult = await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'd0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            accumulatedFxTransferStates: {
              'c0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR,
              'c0000002-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: true
          }
        )
        test.pass('Error not thrown')
        test.equal(processedResult.notifyMessages.length, 0)
        test.equal(processedResult.followupMessages.length, 1)
        test.equal(processedResult.accumulatedPositionChanges.length, 1)
        test.equal(processedResult.accumulatedPositionChanges[0].value, -10)
        test.equal(processedResult.accumulatedFxTransferStates[fxAbortMessage1.value.id], Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedPositionValue, -10)
      } catch (e) {
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.end()
  })

  positionIndexTest.end()
})
