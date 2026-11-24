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
 --------------
 ******/
'use strict'

const { randomUUID } = require('crypto')
const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators
const Enum = require('@mojaloop/central-services-shared').Enum
const BulkTransferModels = require('@mojaloop/object-store-lib').Models.BulkTransfer
const BulkTransferService = require('#src/domain/bulkTransfer/index')
const BulkFulfilHandler = require('#src/handlers/bulk/fulfil/handler')

const { Action, Type } = Enum.Events.Event
const PAYER = 'dfsp1'
const PAYEE = 'dfsp2'
const OTHER = 'dfsp3'

const buildMessage = ({ source = PAYEE, destination = PAYER, completedTimestamp = new Date().toISOString(), action = Action.BULK_COMMIT } = {}) => ({
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

// The handler rethrows the error it sent; check that it did.
const assertRejects = async (test, promise, pattern) => {
  try {
    await promise
    test.fail('expected the handler to throw')
  } catch (err) {
    test.ok(pattern.test(err.message), `throws: ${err.message}`)
  }
}

const proceededActions = () => Kafka.proceed.getCalls().map(call => call.args[2].eventDetail.action)

Test('Bulk fulfil handler', bulkFulfilTest => {
  let sandbox

  bulkFulfilTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Kafka, 'proceed').resolves(true)
    sandbox.stub(Comparators, 'duplicateCheckComparator').resolves({ hasDuplicateId: false, hasDuplicateHash: false })
    sandbox.stub(BulkTransferService, 'getParticipantsById').resolves({ payerFsp: PAYER, payeeFsp: PAYEE })
    sandbox.stub(BulkTransferService, 'bulkFulfil').resolves(Enum.Transfers.BulkTransferState.PROCESSING)
    sandbox.stub(BulkTransferService, 'bulkFulfilError').resolves(Enum.Transfers.BulkTransferState.PROCESSING)
    sandbox.stub(BulkTransferService, 'bulkFulfilTransitionToAborting').resolves(Enum.Transfers.BulkTransferState.ABORTING)
    sandbox.stub(BulkTransferService, 'getBulkTransferById').resolves({
      payeeBulkTransfer: { individualTransferResults: [{ transferId: randomUUID() }, { transferId: randomUUID() }] }
    })
    sandbox.stub(BulkTransferService, 'bulkTransferAssociationUpdate').resolves()
    sandbox.stub(BulkTransferModels, 'getIndividualTransferFulfilModel').returns({
      find: () => ({
        cursor: async function * () {
          yield { payload: { transferId: randomUUID(), fulfilment: 'adlcfFFpGkn3dDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI' } }
        }
      })
    })
    test.end()
  })

  bulkFulfilTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  // A DFSP may not change another DFSP's bulk transfer: a callback from the wrong party is rejected to its
  // sender only. Nothing is recorded, the bulk isn't aborted, and no transfer is aborted.
  for (const { name, source, destination, errorMessage } of [
    { name: 'another DFSP as the source', source: OTHER, destination: PAYER, errorMessage: 'FSPIOP-Source header should match Payee FSP' },
    { name: 'the payer as the source', source: PAYER, destination: PAYER, errorMessage: 'FSPIOP-Source header should match Payee FSP' },
    { name: 'a wrong destination', source: PAYEE, destination: OTHER, errorMessage: 'FSPIOP-Destination header should match Payer FSP' }
  ]) {
    for (const action of [Action.BULK_COMMIT, Action.BULK_ABORT]) {
      bulkFulfilTest.test(`reject a ${action} callback with ${name} to its sender only`, async (test) => {
        const message = buildMessage({ source, destination, action })

        await assertRejects(test, BulkFulfilHandler.bulkFulfil(null, [message]), new RegExp(errorMessage))

        test.ok(Kafka.proceed.calledOnce, 'one message: the error to the sender')
        const [, params, options] = Kafka.proceed.firstCall.args
        test.equal(options.fspiopError.errorInformation.errorDescription, `Generic validation error - ${errorMessage}`)
        test.deepEqual(options.eventDetail, { functionality: Type.NOTIFICATION, action })
        test.equal(options.fromSwitch, true, 'sent back to the sender')
        test.deepEqual(params.message.value.content.uriParams, { id: message.value.content.payload.bulkTransferId })
        test.ok(Comparators.duplicateCheckComparator.notCalled, 'nothing recorded, so the payee can still fulfil')
        test.ok(BulkTransferService.bulkFulfilTransitionToAborting.notCalled, 'the bulk is not aborted')
        test.ok(BulkTransferService.bulkFulfil.notCalled && BulkTransferService.bulkFulfilError.notCalled, 'the bulk is not changed')
        test.ok(BulkTransferService.bulkTransferAssociationUpdate.notCalled, 'no transfer is changed')
        test.notOk(Kafka.proceed.getCalls().some(call => call.args[2].eventDetail.functionality === Type.FULFIL), 'no transfer is sent to the fulfil handler')
        test.end()
      })
    }
  }

  bulkFulfilTest.test('abort the whole bulk when the payee\'s own fulfilment fails validation, as before', async (test) => {
    const message = buildMessage({ completedTimestamp: new Date(Date.now() + 10 * 86400000).toISOString() })

    await assertRejects(test, BulkFulfilHandler.bulkFulfil(null, [message]), /completedTimestamp fails because future timestamp was provided/)

    test.ok(Comparators.duplicateCheckComparator.calledOnce)
    test.ok(BulkTransferService.bulkFulfilTransitionToAborting.calledOnce, 'the bulk is aborted')
    test.deepEqual(proceededActions(), [Action.BULK_ABORT, Action.BULK_ABORT, Action.BULK_COMMIT], 'each transfer aborted, then the error to the payee')
    test.end()
  })

  bulkFulfilTest.test('commit each transfer for a valid fulfil from the payee, as before', async (test) => {
    const message = buildMessage()

    await BulkFulfilHandler.bulkFulfil(null, [message])

    test.ok(Comparators.duplicateCheckComparator.calledOnce)
    test.ok(BulkTransferService.bulkFulfil.calledOnce)
    test.ok(BulkTransferService.bulkFulfilTransitionToAborting.notCalled)
    test.deepEqual(proceededActions(), [Action.BULK_COMMIT])
    test.end()
  })

  bulkFulfilTest.end()
})
