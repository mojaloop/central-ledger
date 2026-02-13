/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
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

 * Infitx
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>

 --------------

 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const { Enum } = require('@mojaloop/central-services-shared')
const Sinon = require('sinon')
const { processPositionAbortBin } = require('../../../../src/domain/position/abort')
const Config = require('../../../../src/lib/config')

const span = {}

/**
* Helpers
*/
const deepClone = (obj) => JSON.parse(JSON.stringify(obj))

const makeBinItems = (messages) =>
  messages.map((msg) => ({
    message: deepClone(msg),
    span,
    decodedPayload: deepClone(msg.value.content.payload)
  }))

const expectThrows = async (t, fn) => {
  try {
    await fn()
    t.fail('Error not thrown')
  } catch (e) {
    t.pass('Error thrown')
  }
}

const baseMetadata = (correlationId, action, from) => ({
  correlationId,
  event: {
    type: 'position',
    action,
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
      transactionAction: action,
      source: from,
      destination: 'payerfsp1'
    },
    tracestates: {
      acmevendor: {
        spanId: 'bb0abd2ea5fdfbbd'
      }
    }
  },
  'protocol.createdAt': 1715645595093
})

const buildPositionMessage = ({
  id,
  from,
  to = 'payerfsp1',
  action, // 'abort' | 'fx-abort'
  errorDescription,
  cyrilResult
}) => ({
  value: {
    from,
    to,
    id,
    content: {
      uriParams: { id },
      headers: {
        accept: 'application/vnd.interoperability.transfers+json;version=1.0',
        'fspiop-destination': to,
        'Content-Type': 'application/vnd.interoperability.transfers+json;version=1.0',
        date: 'Tue, 14 May 2024 00:13:15 GMT',
        'fspiop-source': from
      },
      payload: {
        errorInformation: {
          errorCode: '5104',
          errorDescription
        }
      },
      context: { cyrilResult }
    },
    type: 'application/vnd.interoperability.transfers+json;version=1.0',
    metadata: baseMetadata(id, action, from)
  },
  size: 3489,
  key: 51,
  topic: 'topic-transfer-position',
  offset: 4073,
  partition: 0,
  timestamp: 1694175690401
})

const makeAbortMessages = () => {
  const abort1 = buildPositionMessage({
    id: 'a0000001-0000-0000-0000-000000000000',
    from: 'payeefsp1',
    action: 'abort',
    errorDescription: 'Payee Rejected',
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
      ],
      transferStateChanges: []
    }
  })

  const abort2 = buildPositionMessage({
    id: 'a0000002-0000-0000-0000-000000000000',
    from: 'payeefsp1',
    action: 'abort',
    errorDescription: 'Payee Rejected',
    cyrilResult: {
      positionChanges: [
        {
          isFxTransferStateChange: false,
          transferId: 'a0000002-0000-0000-0000-000000000000',
          notifyTo: 'payerfsp1',
          participantCurrencyId: 1,
          amount: -10
        }
      ],
      transferStateChanges: []
    }
  })

  return { abort1, abort2 }
}

const makeFxAbortMessages = () => {
  const fx1 = buildPositionMessage({
    id: 'c0000001-0000-0000-0000-000000000000',
    from: 'fxp1',
    action: 'fx-abort',
    errorDescription: 'FXP Rejected',
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
  })

  const fx2 = buildPositionMessage({
    id: 'c0000002-0000-0000-0000-000000000000',
    from: 'fxp1',
    action: 'fx-abort',
    errorDescription: 'FXP Rejected',
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
  })

  return { fx1, fx2 }
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
      const { abort1, abort2 } = makeAbortMessages()
      const binItems = makeBinItems([abort1, abort2])

      await expectThrows(test, async () => {
        await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              [abort1.value.id]: 'INVALID_STATE',
              [abort2.value.id]: 'INVALID_STATE'
            },
            accumulatedFxTransferStates: {
              'b0000001-0000-0000-0000-000000000000': 'INVALID_STATE'
            },
            isFx: false
          }
        )
      })

      test.end()
    })

    processPositionAbortBinTest.test('produce abort messages with correct states but invalid cyrilResult', async (test) => {
      const { abort1, abort2 } = makeAbortMessages()
      const binItems = makeBinItems([abort1, abort2])

      binItems[0].message.value.content.context = {
        cyrilResult: 'INVALID'
      }

      await expectThrows(test, async () => {
        await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              [abort1.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR,
              [abort2.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            accumulatedFxTransferStates: {
              'b0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: false
          }
        )
      })

      test.end()
    })

    processPositionAbortBinTest.test('produce abort messages with correct states and proper cyrilResult.', async (test) => {
      const { abort1, abort2 } = makeAbortMessages()
      const binItems = makeBinItems([abort1, abort2])

      try {
        const processedResult = await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              [abort1.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR,
              [abort2.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR
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
        test.equal(processedResult.accumulatedTransferStates[abort1.value.id], Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedTransferStates[abort2.value.id], Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedTransferStateChanges[0].transferId, abort1.value.id)
        test.equal(processedResult.accumulatedTransferStateChanges[1].transferId, abort2.value.id)
        test.equal(processedResult.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedPositionValue, -20)
      } catch (e) {
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('produce abort messages with correct states and proper cyrilResult with a single message. expecting one position to be adjusted and one followup message', async (test) => {
      const { abort1, abort2 } = makeAbortMessages()
      const binItems = makeBinItems([abort1, abort2])
      binItems.splice(1, 1)
      try {
        const processedResult = await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              [abort1.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR,
              [abort2.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR
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
        test.equal(processedResult.accumulatedTransferStates[abort1.value.id], Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedTransferStateChanges[0].transferId, abort1.value.id)
        test.equal(processedResult.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedPositionValue, -10)
      } catch (e) {
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('skip position changes if changePositions is false', async (test) => {
      const { abort1, abort2 } = makeAbortMessages()
      const binItems = makeBinItems([abort1, abort2])

      try {
        const processedResult = await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              [abort1.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR,
              [abort2.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: false,
            changePositions: false
          }
        )
        test.equal(processedResult.accumulatedPositionChanges.length, 0)
        test.equal(processedResult.accumulatedPositionValue, 0)
        test.equal(processedResult.accumulatedTransferStateChanges.length, 2)
        processedResult.accumulatedTransferStateChanges.forEach(transferStateChange =>
          test.equal(transferStateChange.transferStateId, Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        )
        processedResult.accumulatedTransferStates[abort1.value.id] = Enum.Transfers.TransferInternalState.ABORTED_ERROR
        processedResult.accumulatedTransferStates[abort2.value.id] = Enum.Transfers.TransferInternalState.ABORTED_ERROR
      } catch (e) {
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('produce abort messages for ABORT_VALIDATION action', async (test) => {
      const { abort1 } = makeAbortMessages()
      const binItems = makeBinItems([abort1])

      binItems[0].message.value.metadata.event.action = Enum.Events.Event.Action.ABORT_VALIDATION
      // Set context to null to test line where context is created
      binItems[0].message.value.content.context = null
      binItems[0].message.value.content.context = {
        cyrilResult: {
          positionChanges: [
            {
              isFxTransferStateChange: false,
              transferId: 'a0000001-0000-0000-0000-000000000000',
              notifyTo: 'payerfsp1',
              participantCurrencyId: 1,
              amount: -10,
              isOriginalId: false
            }
          ],
          transferStateChanges: [
            {
              transferId: 'a0000003-0000-0000-0000-000000000000',
              transferStateId: Enum.Transfers.TransferInternalState.ABORTED_ERROR,
              notifyTo: 'payerfsp2',
              isOriginalId: true
            }
          ]
        }
      }
      try {
        const processedResult = await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'a0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            accumulatedFxTransferStates: {},
            isFx: false
          }
        )
        test.pass('Error not thrown')
        test.equal(processedResult.notifyMessages.length, 2)
        test.ok(processedResult.notifyMessages[0].message.content.context)
        test.ok(processedResult.notifyMessages[0].message.content.context.isOriginalId === false)
        test.equal(processedResult.accumulatedTransferStateChanges.length, 2)
      } catch (e) {
        console.error(e)
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('produce abort messages when context is undefined to test context initialization', async (test) => {
      const { abort1 } = makeAbortMessages()
      const binItems = makeBinItems([abort1])

      // Set content.context to undefined to ensure context initialization is hit
      binItems[0].message.value.content.context = undefined
      // Now set it back with just cyrilResult
      binItems[0].message.value.content.context = {
        cyrilResult: {
          positionChanges: [
            {
              isFxTransferStateChange: false,
              transferId: 'a0000001-0000-0000-0000-000000000000',
              notifyTo: 'payerfsp1',
              participantCurrencyId: 1,
              amount: -10,
              isOriginalId: false
            }
          ],
          transferStateChanges: []
        }
      }
      try {
        const processedResult = await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'a0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            accumulatedFxTransferStates: {},
            isFx: false
          }
        )
        test.pass('Error not thrown')
        test.ok(processedResult.notifyMessages[0].message.content.context)
        test.ok(typeof processedResult.notifyMessages[0].message.content.context.isOriginalId !== 'undefined')
      } catch (e) {
        console.error(e)
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('produce abort messages with patchNotifications in cyrilResult for FX transfers', async (test) => {
      const { abort1 } = makeAbortMessages()
      const binItems = makeBinItems([abort1])

      // Make the first position change an FX transfer state change so we hit the patchNotifications path
      // Set only one position change to ensure all are done and notifications are sent
      binItems[0].message.value.content.context.cyrilResult.positionChanges = [
        {
          isFxTransferStateChange: true,
          commitRequestId: 'b0000001-0000-0000-0000-000000000000',
          notifyTo: 'fxp1',
          participantCurrencyId: 1,
          amount: -10
        }
      ]
      binItems[0].message.value.content.context.cyrilResult.patchNotifications = [
        {
          commitRequestId: 'b0000001-0000-0000-0000-000000000000',
          fxpName: 'fxp1'
        }
      ]
      try {
        const processedResult = await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'a0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            accumulatedFxTransferStates: {
              'b0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: false
          }
        )
        test.pass('Error not thrown')
        // Should have at least one patch notification and one fx-transfer notification
        test.ok(processedResult.notifyMessages.length >= 2, `Expected at least 2 notifications, got ${processedResult.notifyMessages.length}`)
        test.ok(processedResult.followupMessages.length === 0, 'Should not have followup messages when all position changes are done')
        // Find the patch notification message
        const patchMessage = processedResult.notifyMessages.find(
          msg => msg.message.id === 'b0000001-0000-0000-0000-000000000000'
        )
        test.ok(patchMessage, 'Patch notification message should exist')
        test.equal(patchMessage.message.content.payload.conversionState, Enum.Transfers.TransferState.ABORTED)
        test.equal(patchMessage.message.metadata.event.action, Enum.Events.Event.Action.FX_NOTIFY)
      } catch (e) {
        console.error(e)
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.end()
  })

  positionIndexTest.test('processPositionAbortBin with FX should', processPositionAbortBinTest => {
    processPositionAbortBinTest.test('produce fx-abort message for fxTransfers not in the right transfer state', async (test) => {
      const { fx1, fx2 } = makeFxAbortMessages()
      const binItems = makeBinItems([fx1, fx2])

      await expectThrows(test, async () => {
        await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'd0000001-0000-0000-0000-000000000000': 'INVALID_STATE'
            },
            accumulatedFxTransferStates: {
              [fx1.value.id]: 'INVALID_STATE',
              [fx2.value.id]: 'INVALID_STATE'
            },
            isFx: true
          }
        )
      })

      test.end()
    })

    processPositionAbortBinTest.test('produce fx-abort messages with correct states but invalid cyrilResult', async (test) => {
      const { fx1, fx2 } = makeFxAbortMessages()
      const binItems = makeBinItems([fx1, fx2])

      binItems[0].message.value.content.context = {
        cyrilResult: 'INVALID'
      }

      await expectThrows(test, async () => {
        await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'd0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            accumulatedFxTransferStates: {
              [fx1.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR,
              [fx2.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: true
          }
        )
      })

      test.end()
    })

    processPositionAbortBinTest.test('produce abort messages with correct states and proper cyrilResult.', async (test) => {
      const { fx1, fx2 } = makeFxAbortMessages()
      const binItems = makeBinItems([fx1, fx2])

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
              [fx1.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR,
              [fx2.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: true
          }
        )
        test.pass('Error not thrown')
        test.equal(processedResult.notifyMessages.length, 1)
        test.equal(processedResult.followupMessages.length, 1)
        test.equal(processedResult.accumulatedPositionChanges.length, 2)
        test.equal(processedResult.accumulatedPositionChanges[0].value, -10)
        test.equal(processedResult.accumulatedFxTransferStates[fx1.value.id], Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedFxTransferStates[fx2.value.id], Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedPositionValue, -20)
      } catch (e) {
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('produce abort messages with correct states and proper cyrilResult with a single message. expecting one position to be adjusted and one followup message', async (test) => {
      const { fx1, fx2 } = makeFxAbortMessages()
      const binItems = makeBinItems([fx1, fx2])
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
              [fx1.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR,
              [fx2.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: true
          }
        )
        test.pass('Error not thrown')
        test.equal(processedResult.notifyMessages.length, 0)
        test.equal(processedResult.followupMessages.length, 1)
        test.equal(processedResult.accumulatedPositionChanges.length, 1)
        test.equal(processedResult.accumulatedPositionChanges[0].value, -10)
        test.equal(processedResult.accumulatedFxTransferStates[fx1.value.id], Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(processedResult.accumulatedPositionValue, -10)
      } catch (e) {
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('FX mode: should process a NON-FX positionChange when the FX one is already done', async (test) => {
      const { fx1 } = makeFxAbortMessages()
      const binItems = makeBinItems([fx1])

      // Make the FX positionChange already done, so the "to be processed" becomes the NON-FX entry
      const cyrilResult = binItems[0].message.value.content.context.cyrilResult
      cyrilResult.positionChanges[0].isDone = true // FX entry done
      cyrilResult.positionChanges[1].isDone = false // NON-FX entry not done

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
              [fx1.value.id]: Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: true
          }
        )

        test.pass('No error thrown')
        test.equal(processedResult.accumulatedTransferStateChanges.length, 1)
        test.equal(processedResult.accumulatedFxTransferStateChanges.length, 0)
        test.equal(
          processedResult.accumulatedTransferStates['d0000001-0000-0000-0000-000000000000'],
          Enum.Transfers.TransferInternalState.ABORTED_ERROR
        )
        test.equal(processedResult.accumulatedPositionChanges.length, 1)
        test.equal(processedResult.accumulatedPositionValue, -10)
        test.equal(processedResult.followupMessages.length, 0)
      } catch (e) {
        console.error(e)
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('Forwarding: FX forwarded message uses FX_ABORT action when isOriginalId=false', async (test) => {
      const { abort1 } = makeAbortMessages()
      const binItems = makeBinItems([abort1])

      // Force "all done" forwarding path:
      // - Make one FX positionChange already done, and one NON-FX not done
      binItems[0].message.value.content.context.cyrilResult.positionChanges = [
        {
          isFxTransferStateChange: false,
          transferId: 'a0000001-0000-0000-0000-000000000000',
          notifyTo: 'payerfsp1',
          participantCurrencyId: 1,
          amount: -10,
          isOriginalId: true,
          isDone: false
        },
        {
          isFxTransferStateChange: true,
          commitRequestId: 'b0000001-0000-0000-0000-000000000000',
          notifyTo: 'fxp1',
          participantCurrencyId: 2,
          amount: -10,
          isOriginalId: false,
          isDone: true
        }
      ]

      try {
        const processedResult = await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'a0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            accumulatedFxTransferStates: {
              'b0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: false
          }
        )

        test.pass('No error thrown')
        test.ok(processedResult.notifyMessages.length >= 2, `Expected >=2 notify messages, got ${processedResult.notifyMessages.length}`)

        const fxForward = processedResult.notifyMessages.find(
          m => m.message.id === 'b0000001-0000-0000-0000-000000000000'
        )
        test.ok(fxForward, 'Expected FX forward message to exist')
        test.equal(fxForward.message.metadata.event.action, Enum.Events.Event.Action.FX_ABORT)
        test.equal(fxForward.message.from, Config.HUB_NAME)
      } catch (e) {
        console.error(e)
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('Forwarding: FX positionChange without notifyTo should be skipped (branch coverage)', async (test) => {
      const { abort1 } = makeAbortMessages()
      const binItems = makeBinItems([abort1])

      binItems[0].message.value.content.context.cyrilResult.positionChanges = [
        {
          isFxTransferStateChange: false,
          transferId: 'a0000001-0000-0000-0000-000000000000',
          notifyTo: 'payerfsp1',
          participantCurrencyId: 1,
          amount: -10,
          isOriginalId: true,
          isDone: false
        },
        {
          isFxTransferStateChange: true,
          commitRequestId: 'b0000001-0000-0000-0000-000000000000',
          participantCurrencyId: 2,
          amount: -10,
          isOriginalId: false,
          isDone: true
        }
      ]

      try {
        const processedResult = await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'a0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            accumulatedFxTransferStates: {
              'b0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            isFx: false
          }
        )

        test.pass('No error thrown')
        const fxForward = processedResult.notifyMessages.find(
          m => m.message.id === 'b0000001-0000-0000-0000-000000000000'
        )
        test.notOk(fxForward, 'FX forward message should be skipped when notifyTo is missing')
      } catch (e) {
        console.error(e)
        test.fail('Error thrown')
      }
      test.end()
    })

    processPositionAbortBinTest.test('produce abort messages for FX_ABORT_VALIDATION action (validation branch)', async (test) => {
      const { abort1 } = makeAbortMessages()
      const binItems = makeBinItems([abort1])

      binItems[0].message.value.metadata.event.action = Enum.Events.Event.Action.FX_ABORT_VALIDATION

      binItems[0].message.value.content.context = {
        cyrilResult: {
          positionChanges: [
            {
              isFxTransferStateChange: false,
              transferId: 'a0000001-0000-0000-0000-000000000000',
              notifyTo: 'payerfsp1',
              participantCurrencyId: 1,
              amount: -10,
              isOriginalId: false,
              isDone: false
            }
          ],
          transferStateChanges: [
            {
              transferId: 'a0000009-0000-0000-0000-000000000000',
              transferStateId: Enum.Transfers.TransferInternalState.ABORTED_ERROR,
              notifyTo: 'payerfsp9',
              isOriginalId: true
            }
          ]
        }
      }

      try {
        const processedResult = await processPositionAbortBin(
          binItems,
          {
            accumulatedPositionValue: 0,
            accumulatedPositionReservedValue: 0,
            accumulatedTransferStates: {
              'a0000001-0000-0000-0000-000000000000': Enum.Transfers.TransferInternalState.RECEIVED_ERROR
            },
            accumulatedFxTransferStates: {},
            isFx: false
          }
        )

        test.pass('No error thrown')
        test.equal(processedResult.notifyMessages.length, 2)
        processedResult.notifyMessages.forEach(nm => {
          test.equal(nm.message.from, Config.HUB_NAME)
        })

        test.equal(processedResult.accumulatedTransferStateChanges.length, 2)
        const extra = processedResult.accumulatedTransferStateChanges.find(t => t.transferId === 'a0000009-0000-0000-0000-000000000000')
        test.ok(extra, 'Expected extra transferStateChange to be persisted')
        test.equal(extra.transferStateId, Enum.Transfers.TransferInternalState.ABORTED_ERROR)
        test.equal(typeof extra.notifyTo, 'undefined')
        test.equal(typeof extra.isOriginalId, 'undefined')
      } catch (e) {
        console.error(e)
        test.fail('Error thrown')
      }
      test.end()
    })
    processPositionAbortBinTest.end()
  })

  positionIndexTest.end()
})
