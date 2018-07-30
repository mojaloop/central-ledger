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
const Projection = require('../../../../src/domain/transfer/projection')
const TransferObjectTransform = require('../../../../src/domain/transfer/transform')
const TransferModel = require('../../../../src/models/transfer/transfer')
const TransferFacade = require('../../../../src/models/transfer/facade')
const TransferStateChangeModel = require('../../../../src/models/transfer/transferStateChange')
const TransferFulfilmentModel = require('../../../../src/models/transfer/transferFulfilment')
const TransferState = require('../../../../src/lib/enum').TransferState
const Logger = require('@mojaloop/central-services-shared').Logger

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

const ilpRecord = {
  transferId: payload.transferId,
  packet: payload.ilpPacket,
  condition: payload.condition,
  fulfilment: null
}

const transferStateChangeRecord = {
  transferId: payload.transferId,
  transferStateId: TransferState.RECEIVED_PREPARE,
  reason: null,
  createdDate: new Date()
}

const extensionsRecordList = [
  {
    transferId: payload.transferId,
    key: payload.extensionList.extension[0].key,
    value: payload.extensionList.extension[0].value,
    createdDate: new Date(),
    createdBy: 'unknown' // this needs to be changed and cannot be null
  }
]

const transferRecord = {
  transferId: payload.transferId,
  amount: payload.amount.amount,
  currencyId: payload.amount.currency,
  ilpCondition: payload.condition,
  expirationDate: new Date(payload.expiration),
  createdDate: new Date()
}

const transferFulfilmentRecord = {
  transferId: payload.transferId,
  ilpFulfilment: 'oAKAAA',
  completedDate: new Date() - 60000,
  isValid: true,
  settlementWindowId: null,
  createdDate: new Date()
}

const prepareResponse = {
  isSaveTransferPrepared: true,
  transferRecord,
  ilpRecord,
  transferStateChangeRecord,
  extensionsRecordList
}

Test('Transfer Service', transferIndexTest => {
  let sandbox

  transferIndexTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Projection)
    sandbox.stub(TransferObjectTransform)
    sandbox.stub(TransferModel)
    sandbox.stub(TransferFacade)
    sandbox.stub(TransferStateChangeModel)
    sandbox.stub(TransferFulfilmentModel)
    t.end()
  })

  transferIndexTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  transferIndexTest.test('prepare should', preparedTest => {
    preparedTest.test('prepare transfer payload that passed validation', async (test) => {
      try {
        Projection.saveTransferPrepared.returns(Promise.resolve(prepareResponse))
        TransferObjectTransform.toTransfer.returns(payload)
        const response = await TransferService.prepare(payload)
        test.deepEqual(response.transfer, payload)
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    preparedTest.test('prepare transfer throws error', async (test) => {
      Projection.saveTransferPrepared.throws(new Error())
      TransferObjectTransform.toTransfer.returns(payload)
      try {
        await TransferService.prepare(payload)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    preparedTest.test('prepare transfer throws error', async (test) => {
      Projection.saveTransferPrepared.returns(Promise.resolve(prepareResponse))
      TransferObjectTransform.toTransfer.throws(new Error())
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

  transferIndexTest.test('getTransferById should', getTransferByIdTest => {
    getTransferByIdTest.test('get transfer by id', async (test) => {
      try {
        TransferModel.getById.returns(Promise.resolve(transferRecord))
        const response = await TransferService.getTransferById(payload.transferId)
        test.deepEqual(response, transferRecord)
        test.end()
      } catch (err) {
        Logger.error(`getTransferById failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })
    getTransferByIdTest.end()
  })

  transferIndexTest.test('getById should', getByIdTest => {
    getByIdTest.test('get all transfer details by id', async (test) => {
      try {
        TransferFacade.getById.returns(Promise.resolve(transferRecord))
        const response = await TransferService.getById(payload.transferId)
        test.deepEqual(response, transferRecord)
        test.end()
      } catch (err) {
        Logger.error(`getById failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })
    getByIdTest.end()
  })

  transferIndexTest.test('getAll should', getAllTest => {
    getAllTest.test('get all transfer details by id', async (test) => {
      try {
        TransferFacade.getAll.returns(Promise.resolve([transferRecord]))
        const response = await TransferService.getAll()
        test.deepEqual(response, [transferRecord])
        test.end()
      } catch (err) {
        Logger.error(`getTransferById failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })
    getAllTest.end()
  })

  transferIndexTest.test('getTransferState should', getTransferStateTest => {
    getTransferStateTest.test('get transfer state by id', async (test) => {
      try {
        TransferStateChangeModel.getByTransferId.returns(Promise.resolve(transferStateChangeRecord))
        const response = await TransferService.getTransferState(payload.transferId)
        test.deepEqual(response, transferStateChangeRecord)
        test.end()
      } catch (err) {
        Logger.error(`getTransferState failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })
    getTransferStateTest.end()
  })

  transferIndexTest.test('getTransferInfoToChangePosition should', getTransferInfoToChangePositionTest => {
    getTransferInfoToChangePositionTest.test('get transfer info for changing the position by id', async (test) => {
      try {
        TransferFacade.getTransferInfoToChangePosition.returns(Promise.resolve(transferRecord))
        const response = await TransferService.getTransferInfoToChangePosition(payload.transferId)
        test.deepEqual(response, transferRecord)
        test.end()
      } catch (err) {
        Logger.error(`getTransferInfoToChangePosition failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })
    getTransferInfoToChangePositionTest.end()
  })

  transferIndexTest.test('getFulfilment should', getFulfilmentTest => {
    getFulfilmentTest.test('return ilpFulfilment', async (test) => {
      try {
        TransferFacade.getById.returns(Promise.resolve(transferRecord))
        TransferFulfilmentModel.getByTransferId.returns(Promise.resolve(transferFulfilmentRecord))
        const response = await TransferService.getFulfilment(payload.transferId)
        test.equal(response, transferFulfilmentRecord.ilpFulfilment)
        test.end()
      } catch (err) {
        Logger.error(`getFulfilment failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    getFulfilmentTest.test('throw TransferNotFoundError', async (test) => {
      try {
        TransferFacade.getById.returns(Promise.resolve(null))
        TransferFulfilmentModel.getByTransferId.returns(Promise.resolve(transferFulfilmentRecord))
        await TransferService.getFulfilment(payload.transferId)
        test.fail('Error not thrown!')
        test.end()
      } catch (err) {
        Logger.error(`getFulfilment failed with error - ${err}`)
        test.equal(err.name, 'TransferNotFoundError')
        test.end()
      }
    })

    getFulfilmentTest.test('throw TransferNotConditionalError', async (test) => {
      try {
        const transfer = Object.assign({}, transferRecord, {ilpCondition: null})
        TransferFacade.getById.returns(Promise.resolve(transfer))
        TransferFulfilmentModel.getByTransferId.returns(Promise.resolve(transferFulfilmentRecord))
        await TransferService.getFulfilment(payload.transferId)
        test.fail('Error not thrown!')
        test.end()
      } catch (err) {
        Logger.error(`getFulfilment failed with error - ${err}`)
        test.equal(err.name, 'TransferNotConditionalError')
        test.end()
      }
    })

    getFulfilmentTest.test('throw TransferNotFoundError when looking up transfer fulfilment', async (test) => {
      try {
        // const transfer = Object.assign({}, transferRecord, {ilpCondition: null})
        TransferFacade.getById.returns(Promise.resolve(transferRecord))
        TransferFulfilmentModel.getByTransferId.returns(Promise.resolve(null))
        await TransferService.getFulfilment(payload.transferId)
        test.fail('Error not thrown!')
        test.end()
      } catch (err) {
        Logger.error(`getFulfilment failed with error - ${err}`)
        test.equal(err.name, 'TransferNotFoundError')
        test.end()
      }
    })

    getFulfilmentTest.test('throw MissingFulfilmentError when looking up transfer fulfilment', async (test) => {
      try {
        const transferFuflilment = Object.assign({}, transferFulfilmentRecord, {ilpFulfilment: null})
        TransferFacade.getById.returns(Promise.resolve(transferRecord))
        TransferFulfilmentModel.getByTransferId.returns(Promise.resolve(transferFuflilment))
        await TransferService.getFulfilment(payload.transferId)
        test.fail('Error not thrown!')
        test.end()
      } catch (err) {
        Logger.error(`getFulfilment failed with error - ${err}`)
        test.equal(err.name, 'MissingFulfilmentError')
        test.end()
      }
    })

    getFulfilmentTest.end()
  })

  transferIndexTest.test('expire should', expireTest => {
    expireTest.test('be called', async (test) => {
      try {
        await TransferService.expire()
        test.ok(true)
        test.end()
      } catch (err) {
        Logger.error(`expire failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })
    expireTest.end()
  })

  transferIndexTest.test('fulfil should', fulfilTest => {
    fulfilTest.test('commit transfer', async (test) => {
      try {
        TransferFacade.saveTransferFulfiled.returns(Promise.resolve(transferRecord))
        TransferObjectTransform.toTransfer.returns(payload)
        const response = await TransferService.fulfil(payload.transferId, payload)
        test.equal(response, payload)
        test.end()
      } catch (err) {
        Logger.error(`fulfil failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    fulfilTest.test('throw error', async (test) => {
      try {
        TransferFacade.saveTransferFulfiled.throws(new Error())
        TransferObjectTransform.toTransfer.returns(payload)
        await TransferService.fulfil(payload.transferId, payload)
        test.fail('Error not thrown')
        test.end()
      } catch (err) {
        Logger.error(`fulfil failed with error - ${err}`)
        test.pass('Error thrown')
        test.end()
      }
    })

    fulfilTest.end()
  })

  transferIndexTest.test('reject should', rejectTest => {
    rejectTest.test('commit transfer', async (test) => {
      try {
        TransferFacade.saveTransferFulfiled.returns(Promise.resolve(transferRecord))
        TransferObjectTransform.toTransfer.returns(payload)
        const response = await TransferService.reject(payload.transferId, payload)
        test.equal(response, payload)
        test.end()
      } catch (err) {
        Logger.error(`reject failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    rejectTest.test('throw error', async (test) => {
      try {
        TransferFacade.saveTransferFulfiled.throws(new Error())
        TransferObjectTransform.toTransfer.returns(payload)
        await TransferService.reject(payload.transferId, payload)
        test.fail('Error not thrown')
        test.end()
      } catch (err) {
        Logger.error(`reject failed with error - ${err}`)
        test.pass('Error thrown')
        test.end()
      }
    })

    rejectTest.end()
  })

  transferIndexTest.test('rejectExpired should', rejectExpiredTest => {
    rejectExpiredTest.test('be called', async (test) => {
      try {
        await TransferService.rejectExpired()
        test.ok(true)
        test.end()
      } catch (err) {
        Logger.error(`rejectExpired failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })
    rejectExpiredTest.end()
  })

  transferIndexTest.test('saveTransferStateChange should', saveTransferStateChangeTest => {
    saveTransferStateChangeTest.test('save new transfer state', async (test) => {
      try {
        TransferStateChangeModel.saveTransferStateChange.returns(Promise.resolve(true))
        await TransferService.saveTransferStateChange(transferStateChangeRecord)
        test.pass('transfer state saved!')
        test.end()
      } catch (err) {
        Logger.error(`saveTransferStateChange failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })
    saveTransferStateChangeTest.end()
  })

  transferIndexTest.end()
})
