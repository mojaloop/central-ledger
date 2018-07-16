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
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Logger = require('@mojaloop/central-services-shared').Logger
const UrlParser = require('../../../../src/lib/urlParser')
const ParticipantService = require('../../../../src/domain/participant')
const ParticipantFacade = require('../../../../src/models/participant/facade')
const TransferState = require('../../../../src/lib/enum').TransferState
const TransfersReadModel = require('../../../../src/models/transfer/facade')
const TransfersModel = require('../../../../src/models/transfer/transfer')
const TransfersProjection = require('../../../../src/domain/transfer/projection')
const TransferParticipant = require('../../../../src/models/transfer/transferParticipant')
const ilpModel = require('../../../../src/models/transfer/ilpPacket')
const extensionModel = require('../../../../src/models/transfer/transferExtension')
const transferStateChangeModel = require('../../../../src/models/transfer/transferStateChange')
const ProjectionModel = require('../../../../src/domain/transfer/projection')

const payload = {
  transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  payerFsp: 'dfsp1',
  payeeFsp: 'dfsp2',
  amount: {
    currency: 'USD',
    amount: '433.88'
  },
  ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
  ilpCondition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
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
// const updateTransferStateRecord = {
//   transferId: payload.transferId,
//   transferStateId: 'RESERVED',
//   reason: '',
//   changedDate: new Date()
// }

const participant1 = {
  participantId: 1,
  currencyId: 'USD',
  name: 'dfsp1',
  createdDate: '2018-05-17 10:10:01',
  isDisabled: false
}

const participant2 = {
  participantId: 2,
  currencyId: 'USD',
  name: 'dfsp2',
  createdDate: '2018-05-17 10:10:01',
  isDisabled: false
}

// const payeeTransferParticipant = {
//   transferId: payload.transferId,
//   transferParticipantRoleTypeId: 1,
//   ledgerEntryTypeId: 1,
//   amount: payload.amount,
//   name: payload.payeeFsp
// }

// const payerTransferParticipant = {
//   transferId: payload.transferId,
//   transferParticipantRoleTypeId: 1,
//   ledgerEntryTypeId: 1,
//   amount: payload.amount,
//   name: payload.payerFsp
// }

const stateReason = 'reasonOne'

const transferStateRecord = {
  transferId: payload.transferId,
  transferStateId: TransferState.RECEIVED_PREPARE,
  reason: null
}

const newTransferStateRecord = {
  transferStateChangeId: null,
  transferId: payload.transferId,
  transferStateId: TransferState.ABORTED,
  reason: stateReason,
  changedDate: new Date()
}

const ilpRecord = {
  transferId: payload.transferId,
  value: payload.ilpPacket // ,
  // condition: payload.condition
  // fulfilment: null
}

const extensionsRecordList = [
  {
    transferId: payload.transferId,
    key: payload.extensionList.extension[0].key,
    value: payload.extensionList.extension[0].value
    // changedDate: new Date(),
    // changedBy: 'user'
  }
]

const transferRecord = {
  transferId: payload.transferId,
  // payerTransferParticipantRecord: payerTransferParticipant,
  // payeeTransferParticipantRecord: payeeTransferParticipant,
  amount: payload.amount.amount,
  currencyId: payload.amount.currency,
  expirationDate: new Date(payload.expiration),
  ilpCondition: payload.condition
}

Test('Transfers-Projection', transfersProjectionTest => {
  let sandbox

  transfersProjectionTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(TransfersReadModel)
    sandbox.stub(extensionModel)
    sandbox.stub(ilpModel)
    sandbox.stub(transferStateChangeModel)
    sandbox.stub(TransfersModel)
    sandbox.stub(UrlParser, 'nameFromParticipantUri')
    sandbox.stub(ParticipantService)
    sandbox.stub(TransferParticipant)
    sandbox.stub(ParticipantFacade)
    t.end()
  })

  transfersProjectionTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  transfersProjectionTest.test('projection saveTransferPrepared should', preparedTest => {
    // Positive tests : saveTransferPrepared
    preparedTest.test('return object of results', async (test) => {
      ParticipantService.getByName.withArgs(payload.payerFsp).returns(P.resolve(participant1))
      ParticipantService.getByName.withArgs(payload.payeeFsp).returns(P.resolve(participant2))
      TransfersModel.saveTransfer.returns(P.resolve())
      extensionModel.saveTransferExtension.returns(P.resolve())
      ilpModel.saveIlpPacket.returns(P.resolve())
      transferStateChangeModel.saveTransferStateChange.returns(P.resolve())
      TransferParticipant.saveTransferParticipant.returns(P.resolve())
      ParticipantFacade.getByNameAndCurrency.withArgs(payload.payerFsp, 'USD').returns(P.resolve(participant1))
      ParticipantFacade.getByNameAndCurrency.withArgs(payload.payeeFsp, 'USD').returns(P.resolve(participant2))
      try {
        const result = await ProjectionModel.saveTransferPrepared(payload)
        test.equal(result.isSaveTransferPrepared, true)
        test.deepEqual(result.transferRecord, transferRecord)
        test.deepEqual(result.ilpPacketRecord, ilpRecord)
        transferStateRecord.createdDate = result.transferStateChangeRecord.createdDate
        test.deepEqual(result.transferStateChangeRecord, transferStateRecord)
        test.deepEqual(result.transferExtensionsRecordList, extensionsRecordList)
        test.end()
      } catch (err) {
        Logger.error(`projection saveTransferPrepared failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    preparedTest.test('return object of results when status is aborted', async (test) => {
      ParticipantService.getByName.withArgs(payload.payerFsp).returns(P.resolve(participant1))
      ParticipantService.getByName.withArgs(payload.payeeFsp).returns(P.resolve(participant2))
      TransfersModel.saveTransfer.returns(P.resolve())
      extensionModel.saveTransferExtension.returns(P.resolve())
      ilpModel.saveIlpPacket.returns(P.resolve())
      transferStateChangeModel.saveTransferStateChange.returns(P.resolve())
      TransferParticipant.saveTransferParticipant.returns(P.resolve())
      ParticipantFacade.getByNameAndCurrency.withArgs(payload.payerFsp, 'USD').returns(P.resolve(participant1))
      ParticipantFacade.getByNameAndCurrency.withArgs(payload.payeeFsp, 'USD').returns(P.resolve(participant2))
      try {
        const result = await TransfersProjection.saveTransferPrepared(payload, 'validation failed', false)
        test.equal(result.isSaveTransferPrepared, true)
        test.deepEqual(result.transferRecord, transferRecord)
        test.deepEqual(result.ilpPacketRecord, ilpRecord)
//        transferStateRecord.changedDate = result.transferStateChangeRecord.changedDate
        transferStateRecord.reason = 'validation failed'
        transferStateRecord.transferStateId = 'REJECTED'
//        extensionsRecordList[0].changedDate = result.extensionsRecordList[0].changedDate
        test.deepEqual(result.transferStateChangeRecord.transferStateId, transferStateRecord.transferStateId)
        test.deepEqual(result.transferExtensionsRecordList, extensionsRecordList)
        test.end()
      } catch (err) {
        Logger.error(`return object of results when status is aborted failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    preparedTest.test('throw an error when unable to save transfer', async (test) => {
      try {
        ParticipantService.getByName.withArgs(payload.payerFsp).returns(P.resolve(participant1))
        ParticipantService.getByName.withArgs(payload.payeeFsp).returns(P.resolve(participant2))
        TransfersModel.saveTransfer.throws(new Error())
        await TransfersProjection.saveTransferPrepared(payload)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    // Negative tests : saveTransferPrepared
    preparedTest.test('save transfer throws error', async (test) => {
      ParticipantService.getByName.withArgs(payload.payerFsp).returns(P.resolve(participant1))
      ParticipantService.getByName.withArgs(payload.payeeFsp).returns(P.resolve(participant2))
      TransfersModel.saveTransfer.throws(new Error())
      extensionModel.saveTransferExtension.returns(P.resolve())
      ilpModel.saveIlpPacket.returns(P.resolve())
      transferStateChangeModel.saveTransferStateChange.returns(P.resolve())
      try {
        await TransfersProjection.saveTransferPrepared(payload)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    preparedTest.test('save extension throws error', async (test) => {
      ParticipantService.getByName.withArgs(payload.payerFsp).returns(P.resolve(participant1))
      ParticipantService.getByName.withArgs(payload.payeeFsp).returns(P.resolve(participant2))
      TransfersModel.saveTransfer.returns(P.resolve())
      extensionModel.saveTransferExtension.throws(new Error())
      ilpModel.saveIlpPacket.returns(P.resolve())
      transferStateChangeModel.saveTransferStateChange.returns(P.resolve())
      try {
        await TransfersProjection.saveTransferPrepared(payload)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    preparedTest.test('save ilp throws error', async (test) => {
      ParticipantService.getByName.withArgs(payload.payerFsp).returns(P.resolve(participant1))
      ParticipantService.getByName.withArgs(payload.payeeFsp).returns(P.resolve(participant2))
      TransfersModel.saveTransfer.returns(P.resolve())
      extensionModel.saveTransferExtension.returns(P.resolve())
      ilpModel.saveIlpPacket.throws(new Error())
      transferStateChangeModel.saveTransferStateChange.returns(P.resolve())
      try {
        await TransfersProjection.saveTransferPrepared(payload)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    preparedTest.test('save TransferStateChange throws error', async (test) => {
      ParticipantService.getByName.withArgs(payload.payerFsp).returns(P.resolve(participant1))
      ParticipantService.getByName.withArgs(payload.payeeFsp).returns(P.resolve(participant2))
      TransfersModel.saveTransfer.returns(P.resolve())
      extensionModel.saveTransferExtension.returns(P.resolve())
      ilpModel.saveIlpPacket.returns(P.resolve())
      transferStateChangeModel.saveTransferStateChange.throws(new Error())
      try {
        await TransfersProjection.saveTransferPrepared(payload)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    preparedTest.end()
  })

  transfersProjectionTest.test('projection saveTransferRejected should', rejectTest => {
    rejectTest.test('return object of results', async (test) => {
      transferStateChangeModel.getByTransferId.withArgs(payload.transferId).returns(P.resolve([]))
      transferStateChangeModel.saveTransferStateChange.returns(P.resolve())
      let {alreadyRejected, transferStateChange} = await TransfersProjection.saveTransferRejected(stateReason, payload.transferId)
      newTransferStateRecord.changedDate = transferStateChange.changedDate
      test.equal(alreadyRejected, false)
      test.deepEqual(transferStateChange, newTransferStateRecord)
      test.end()
    })

    rejectTest.test('return object of results', async (test) => {
      transferStateChangeModel.getByTransferId.withArgs(payload.transferId).returns(P.resolve([newTransferStateRecord]))
      let {alreadyRejected, transferStateChange} = await TransfersProjection.saveTransferRejected(stateReason, payload.transferId)
      newTransferStateRecord.changedDate = transferStateChange.changedDate
      test.equal(alreadyRejected, true)
      test.deepEqual(transferStateChange, newTransferStateRecord)
      test.end()
    })

    // Add negative tests
    rejectTest.test('save saveTransferRejected throws error', async (test) => {
      transferStateChangeModel.getByTransferId.withArgs(payload.transferId).throws(new Error())
      transferStateChangeModel.saveTransferStateChange.returns(P.resolve())
      try {
        await TransfersProjection.saveTransferRejected(stateReason, payload.transferId)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    rejectTest.test('save saveTransferRejected throws error', async (test) => {
      transferStateChangeModel.getByTransferId.withArgs(payload.transferId).returns(P.resolve([]))
      transferStateChangeModel.saveTransferStateChange.throws(new Error())
      try {
        await TransfersProjection.saveTransferRejected(stateReason, payload.transferId)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    rejectTest.end()
  })

  transfersProjectionTest.test('projection updateTransferState should', updateTransferStateTest => {
    updateTransferStateTest.test('successfully add an entry of transferStateRecord to DB', async (test) => {
      transferStateChangeModel.saveTransferStateChange.returns(P.resolve(true))
      let result = await TransfersProjection.updateTransferState(payload, TransferState.RESERVED)
      test.equal(result, true)
      test.end()
    })

    updateTransferStateTest.test('Throws error on updateTransferState', async (test) => {
      try {
        transferStateChangeModel.saveTransferStateChange.returns(P.resolve(true))
        await TransfersProjection.updateTransferState(null)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    updateTransferStateTest.end()
  })

  transfersProjectionTest.end()
})
