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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const TransferService = require('../../../../src/domain/transfer')
const TransferObjectTransform = require('../../../../src/domain/transfer/transform')
const TransferModel = require('../../../../src/models/transfer/transfer')
const TransferFacade = require('../../../../src/models/transfer/facade')
const TransferError = require('../../../../src/models/transfer/transferError')
const TransferStateChangeModel = require('../../../../src/models/transfer/transferStateChange')
const TransferFulfilmentModel = require('../../../../src/models/transfer/transferFulfilment')
const TransferDuplicateCheckModel = require('../../../../src/models/transfer/transferDuplicateCheck')
const TransferFulfilmentDuplicateCheckModel = require('../../../../src/models/transfer/transferFulfilmentDuplicateCheck')
const TransferErrorDuplicateCheckModel = require('../../../../src/models/transfer/transferErrorDuplicateCheck')
const TransferInternalState = require('@mojaloop/central-services-shared').Enum.Transfers.TransferInternalState
const Logger = require('../../../../src/shared/logger').logger

const payload = {
  transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  payerFsp: 'dfsp1',
  payeeFsp: 'dfsp2',
  amount: {
    currency: 'USD',
    amount: '433.88'
  },
  ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
  condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
  expiration: '2016-05-24T08:38:08.699-04:00',
  extensionList: {
    extension: [
      {
        key: 'key1',
        value: 'value1'
      }
    ]
  }
}

const transferStateChangeRecord = {
  transferId: payload.transferId,
  transferStateId: TransferInternalState.RECEIVED_PREPARE,
  reason: null,
  createdDate: new Date()
}

const transferRecord = {
  transferId: payload.transferId,
  amount: payload.amount.amount,
  currencyId: payload.amount.currency,
  ilpCondition: payload.condition,
  expirationDate: new Date(payload.expiration),
  createdDate: new Date()
}

// const saveTransferAbortedResult = {
//   saveTransferAbortedExecuted: true,
//   transferStateChangeRecord: {
//     transferId: '054ef1c9-901d-4570-9c4e-ad99c6bce7af',
//     transferStateId: 'RECEIVED_ERROR',
//     createdDate: '2019-03-07 18:40:25.026'
//   },
//   transferErrorRecord: {
//     errorCode: '5100',
//     errorDescription: 'Payer aborted transfer without fulfilment',
//     isError: true,
//     createdDate: '2019-03-07 18:40:25.026'
//   }
// }

Test('Transfer Service', transferIndexTest => {
  let sandbox

  transferIndexTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(TransferObjectTransform)
    sandbox.stub(TransferModel)
    sandbox.stub(TransferFacade)
    sandbox.stub(TransferStateChangeModel)
    sandbox.stub(TransferFulfilmentModel)
    sandbox.stub(TransferError)
    sandbox.stub(TransferDuplicateCheckModel)
    sandbox.stub(TransferFulfilmentDuplicateCheckModel)
    sandbox.stub(TransferErrorDuplicateCheckModel)
    sandbox.stub(Logger, 'isDebugEnabled').value(true)
    t.end()
  })

  transferIndexTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  transferIndexTest.test('prepare should', preparedTest => {
    preparedTest.test('prepare transfer payload that passed validation', async (test) => {
      try {
        TransferFacade.saveTransferPrepared.returns(Promise.resolve())
        await TransferService.prepare(payload)
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    preparedTest.test('prepare transfer throws error', async (test) => {
      TransferFacade.saveTransferPrepared.throws(new Error())
      try {
        await TransferService.prepare(payload)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })
    preparedTest.end()
  })

  transferIndexTest.test('handlePayeeResponse should', handlePayeeResponseTest => {
    handlePayeeResponseTest.test('commit transfer', async (test) => {
      try {
        TransferFacade.savePayeeTransferResponse.returns(Promise.resolve(transferRecord))
        TransferObjectTransform.toTransfer.returns(payload)
        const response = await TransferService.handlePayeeResponse(payload.transferId, payload)
        test.equal(response, payload)
        test.end()
      } catch (err) {
        Logger.error(`handlePayeeResponse failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    handlePayeeResponseTest.test('throw error', async (test) => {
      try {
        TransferFacade.savePayeeTransferResponse.throws(new Error())
        TransferObjectTransform.toTransfer.returns(payload)
        await TransferService.handlePayeeResponse(payload.transferId, payload)
        test.fail('Error not thrown')
        test.end()
      } catch (err) {
        Logger.error(`handlePayeeResponse failed with error - ${err}`)
        test.pass('Error thrown')
        test.end()
      }
    })

    handlePayeeResponseTest.end()
  })

  transferIndexTest.test('logTransferError should', logTransferErrorTest => {
    logTransferErrorTest.test('log the transfer error', async (test) => {
      try {
        TransferError.insert.returns(Promise.resolve(true))
        TransferStateChangeModel.getByTransferId.returns(Promise.resolve(transferStateChangeRecord))

        await TransferService.logTransferError(transferStateChangeRecord.transferStateChangeId, '3100', 'Error')
        test.pass('log the transfer error success!')
        test.end()
      } catch (err) {
        Logger.error(`logTransferError failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    logTransferErrorTest.test('throw error', async (test) => {
      try {
        TransferError.insert.returns(Promise.resolve(true))
        TransferStateChangeModel.getByTransferId.throws(new Error('message'))

        await TransferService.logTransferError(transferStateChangeRecord.transferStateChangeId, '3100', 'Error')
        test.fail('should throw')
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    logTransferErrorTest.end()
  })

  transferIndexTest.test('forwardedPrepare should', handlePayeeResponseTest => {
    handlePayeeResponseTest.test('commit transfer', async (test) => {
      try {
        TransferFacade.updatePrepareReservedForwarded.returns(Promise.resolve())
        await TransferService.forwardedPrepare(payload.transferId)
        test.pass()
        test.end()
      } catch (err) {
        Logger.error(`handlePayeeResponse failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    handlePayeeResponseTest.test('throw error', async (test) => {
      try {
        TransferFacade.updatePrepareReservedForwarded.throws(new Error())
        await TransferService.forwardedPrepare(payload.transferId)
        test.fail('Error not thrown')
        test.end()
      } catch (err) {
        Logger.error(`handlePayeeResponse failed with error - ${err}`)
        test.pass('Error thrown')
        test.end()
      }
    })

    handlePayeeResponseTest.end()
  })

  transferIndexTest.end()
})
