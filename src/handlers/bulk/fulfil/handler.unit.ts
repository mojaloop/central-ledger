/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
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
 - Shashikant Hirugade <shirugade@mojaloop.io>

 --------------
 ******/

import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert'
import { randomUUID } from 'node:crypto'
import { Enum, Util } from '@mojaloop/central-services-shared'
import { Models } from '@mojaloop/object-store-lib'
import BulkTransferService from '../../../domain/bulkTransfer'
import BulkFulfilHandler from './handler'

const Kafka: any = Util.Kafka
const Comparators: any = (Util as any).Comparators
const BulkTransferModels: any = Models.BulkTransfer
const Service: any = BulkTransferService

const { Action, Type } = Enum.Events.Event
const PAYER = 'dfsp1'
const PAYEE = 'dfsp2'
const OTHER = 'dfsp3'
const FULFILMENT = 'adlcfFFpGkn3dDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI'

type MessageOptions = { source?: string, destination?: string, completedTimestamp?: string, action?: string }

const buildMessage = ({ source = PAYEE, destination = PAYER, completedTimestamp = new Date().toISOString(), action = Action.BULK_COMMIT }: MessageOptions = {}): any => ({
  topic: 'topic-bulk-fulfil',
  value: {
    id: randomUUID(),
    from: source,
    to: destination,
    content: {
      headers: {
        'content-type': 'application/vnd.interoperability.bulkTransfers+json;version=1.1',
        'fspiop-source': source,
        'fspiop-destination': destination,
        date: new Date().toISOString()
      },
      payload: {
        bulkTransferId: randomUUID(),
        bulkTransferState: 'COMPLETED',
        completedTimestamp,
        hash: 'fake-hash'
      }
    },
    metadata: {
      event: {
        id: randomUUID(),
        type: Type.BULK,
        action,
        createdAt: new Date().toISOString(),
        state: { status: 'success', code: 0 }
      }
    }
  }
})

describe('bulk fulfil handler', () => {
  let proceed: any
  let duplicateCheck: any
  let bulkFulfil: any
  let bulkFulfilError: any
  let transitionToAborting: any
  let associationUpdate: any
  // The bulk's own transfers, and the individual results the payee sent (as read from the object store).
  let bulkTransferIds: string[]
  let individualResults: any[]

  // The options (third argument) of each Kafka.proceed call.
  const proceedOptions = (): any[] => proceed.mock.calls.map((call: any) => call.arguments[2])
  const proceededActions = (): string[] => proceedOptions().map(options => options.eventDetail.action)

  beforeEach(() => {
    bulkTransferIds = [randomUUID(), randomUUID()]
    individualResults = [{ transferId: bulkTransferIds[0], fulfilment: FULFILMENT }]
    proceed = mock.method(Kafka, 'proceed', async () => true)
    duplicateCheck = mock.method(Comparators, 'duplicateCheckComparator', async () => ({ hasDuplicateId: false, hasDuplicateHash: false }))
    mock.method(Service, 'getParticipantsById', async () => ({ payerFsp: PAYER, payeeFsp: PAYEE }))
    bulkFulfil = mock.method(Service, 'bulkFulfil', async () => Enum.Transfers.BulkTransferState.PROCESSING)
    bulkFulfilError = mock.method(Service, 'bulkFulfilError', async () => Enum.Transfers.BulkTransferState.PROCESSING)
    transitionToAborting = mock.method(Service, 'bulkFulfilTransitionToAborting', async () => Enum.Transfers.BulkTransferState.ABORTING)
    mock.method(Service, 'getBulkTransferById', async () => ({
      payeeBulkTransfer: { individualTransferResults: [{ transferId: randomUUID() }, { transferId: randomUUID() }] }
    }))
    associationUpdate = mock.method(Service, 'bulkTransferAssociationUpdate', async () => {})
    mock.method(Service, 'getBulkTransferTransferIds', async () => bulkTransferIds)
    mock.method(BulkTransferModels, 'getIndividualTransferFulfilModel', () => ({
      find: () => ({
        cursor: async function * () {
          for (const payload of individualResults) yield { payload: { ...payload } }
        }
      })
    }))
  })

  afterEach(() => {
    mock.restoreAll()
  })

  // A DFSP may not change another DFSP's bulk transfer: a callback from the wrong party is rejected to its
  // sender only. Nothing is recorded, the bulk isn't changed, and no transfer is sent on.
  for (const { name, source, destination, errorMessage } of [
    { name: 'another DFSP as the source', source: OTHER, destination: PAYER, errorMessage: 'FSPIOP-Source header should match Payee FSP' },
    { name: 'the payer as the source', source: PAYER, destination: PAYER, errorMessage: 'FSPIOP-Source header should match Payee FSP' },
    { name: 'a wrong destination', source: PAYEE, destination: OTHER, errorMessage: 'FSPIOP-Destination header should match Payer FSP' }
  ]) {
    for (const action of [Action.BULK_COMMIT, Action.BULK_ABORT]) {
      it(`rejects a ${action} callback with ${name} to its sender only`, async () => {
        const message = buildMessage({ source, destination, action })

        await assert.rejects(BulkFulfilHandler.bulkFulfil(null, [message]), new RegExp(errorMessage))

        assert.equal(proceed.mock.callCount(), 1, 'one message: the error to the sender')
        const [, params, options] = proceed.mock.calls[0].arguments
        assert.equal(options.fspiopError.errorInformation.errorDescription, `Generic validation error - ${errorMessage}`)
        assert.deepEqual(options.eventDetail, { functionality: Type.NOTIFICATION, action })
        assert.equal(options.fromSwitch, true, 'sent back to the sender')
        assert.deepEqual(params.message.value.content.uriParams, { id: message.value.content.payload.bulkTransferId })
        assert.equal(duplicateCheck.mock.callCount(), 0, 'nothing recorded, so the payee can still fulfil')
        assert.equal(transitionToAborting.mock.callCount(), 0, 'the bulk is not aborted')
        assert.equal(bulkFulfil.mock.callCount() + bulkFulfilError.mock.callCount(), 0, 'the bulk is not changed')
        assert.equal(associationUpdate.mock.callCount(), 0, 'no transfer is changed')
        assert.ok(!proceedOptions().some(o => o.eventDetail.functionality === Type.FULFIL), 'no transfer is sent to the fulfil handler')
      })
    }
  }

  // A bulk callback may only change transfers of this bulk: a result naming another transfer rejects the
  // whole callback to its sender, before anything is recorded or sent.
  for (const { name, foreignResult } of [
    { name: 'an error', foreignResult: { errorInformation: { errorCode: '5000', errorDescription: 'rejected' } } },
    { name: 'no fulfilment', foreignResult: {} },
    { name: 'a fulfilment', foreignResult: { fulfilment: FULFILMENT } }
  ]) {
    it(`rejects a callback whose results include a transfer outside the bulk, with ${name}, to its sender only`, async () => {
      individualResults.push({ transferId: randomUUID(), ...foreignResult })
      const message = buildMessage()

      await assert.rejects(BulkFulfilHandler.bulkFulfil(null, [message]), /individualTransferResults must only include transfers of this bulk/)

      assert.equal(proceed.mock.callCount(), 1, 'one message: the error to the sender')
      const [, params, options] = proceed.mock.calls[0].arguments
      assert.deepEqual(options.eventDetail, { functionality: Type.NOTIFICATION, action: Action.BULK_COMMIT })
      assert.equal(options.fromSwitch, true, 'sent back to the sender')
      assert.deepEqual(params.message.value.content.uriParams, { id: message.value.content.payload.bulkTransferId })
      assert.equal(duplicateCheck.mock.callCount(), 0, 'nothing recorded, so the payee can resend')
      assert.equal(bulkFulfil.mock.callCount() + transitionToAborting.mock.callCount(), 0, 'the bulk is not changed')
      assert.equal(associationUpdate.mock.callCount(), 0, 'no transfer is changed')
      assert.ok(!proceedOptions().some(o => o.eventDetail.functionality === Type.FULFIL), 'no transfer is sent to the fulfil handler')
    })
  }

  it('aborts the whole bulk when the payee\'s own fulfilment fails validation, as before', async () => {
    const message = buildMessage({ completedTimestamp: new Date(Date.now() + 10 * 86400000).toISOString() })

    await assert.rejects(BulkFulfilHandler.bulkFulfil(null, [message]), /completedTimestamp fails because future timestamp was provided/)

    assert.equal(duplicateCheck.mock.callCount(), 1)
    assert.equal(transitionToAborting.mock.callCount(), 1, 'the bulk is aborted')
    assert.deepEqual(proceededActions(), [Action.BULK_ABORT, Action.BULK_ABORT, Action.BULK_COMMIT], 'each transfer aborted, then the error to the payee')
  })

  it('commits each transfer for a valid fulfil from the payee, as before', async () => {
    const message = buildMessage()

    await BulkFulfilHandler.bulkFulfil(null, [message])

    assert.equal(duplicateCheck.mock.callCount(), 1)
    assert.equal(bulkFulfil.mock.callCount(), 1)
    assert.equal(transitionToAborting.mock.callCount(), 0)
    assert.deepEqual(proceededActions(), [Action.BULK_COMMIT])
  })
})
