'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Logger = require('@mojaloop/central-services-shared').Logger
const UrlParser = require('../../../../src/lib/urlparser')
const ParticipantService = require('../../../../src/domain/participant')
const TransferState = require('../../../../src/domain/transfer/state')
const TransfersReadModel = require('../../../../src/domain/transfer/models/transfer-read-model')
const TransfersProjection = require('../../../../src/domain/transfer/projection')
const ilpModel = require('../../../../src/models/ilp')
const extensionModel = require('../../../../src/models/extensions')
const transferStateChangeModel = require('../../../../src/domain/transfer/models/transferStateChanges')

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

const transferRecord = {
  transferId: payload.transferId,
  payerParticipantId: participant1.participantId,
  payeeParticipantId: participant2.participantId,
  amount: payload.amount.amount,
  currencyId: payload.amount.currency,
  expirationDate: new Date(payload.expiration)
}

const stateReason = 'reasonOne'

const transferStateRecord = {
  transferId: payload.transferId,
  transferStateId: TransferState.RECEIVED_PREPARE,
  reason: null,
  changedDate: new Date()
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
  packet: payload.ilpPacket,
  condition: payload.condition,
  fulfilment: null
}

const extensionsRecordList = [
  {
    transferId: payload.transferId,
    key: payload.extensionList.extension[0].key,
    value: payload.extensionList.extension[0].value,
    changedDate: new Date(),
    changedBy: 'user' // this needs to be changed and cannot be null
  }
]

Test('Transfers-Projection', transfersProjectionTest => {
  let sandbox

  transfersProjectionTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(TransfersReadModel)
    sandbox.stub(extensionModel)
    sandbox.stub(ilpModel)
    sandbox.stub(transferStateChangeModel)
    sandbox.stub(UrlParser, 'nameFromParticipantUri')
    sandbox.stub(ParticipantService)
    sandbox.stub(Logger, 'error')
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
      TransfersReadModel.saveTransfer.returns(P.resolve())
      extensionModel.saveExtension.returns(P.resolve())
      ilpModel.saveIlp.returns(P.resolve())
      transferStateChangeModel.saveTransferStateChange.returns(P.resolve())

      const result = await TransfersProjection.saveTransferPrepared(payload)
      test.equal(result.isSaveTransferPrepared, true)
      test.deepEqual(result.transferRecord, transferRecord)
      test.deepEqual(result.ilpRecord, ilpRecord)
      transferStateRecord.changedDate = result.transferStateRecord.changedDate
      extensionsRecordList[0].changedDate = result.extensionsRecordList[0].changedDate
      test.deepEqual(result.transferStateRecord, transferStateRecord)
      test.deepEqual(result.extensionsRecordList, extensionsRecordList)
      test.end()
    })

    preparedTest.test('return object of results when status is aborted', async (test) => {
      ParticipantService.getByName.withArgs(payload.payerFsp).returns(P.resolve(participant1))
      ParticipantService.getByName.withArgs(payload.payeeFsp).returns(P.resolve(participant2))
      TransfersReadModel.saveTransfer.returns(P.resolve())
      extensionModel.saveExtension.returns(P.resolve())
      ilpModel.saveIlp.returns(P.resolve())
      transferStateChangeModel.saveTransferStateChange.returns(P.resolve())

      const result = await TransfersProjection.saveTransferPrepared(payload, 'validation failed', false)
      test.equal(result.isSaveTransferPrepared, true)
      test.deepEqual(result.transferRecord, transferRecord)
      test.deepEqual(result.ilpRecord, ilpRecord)
      transferStateRecord.changedDate = result.transferStateRecord.changedDate
      transferStateRecord.reason = 'validation failed'
      transferStateRecord.transferStateId = 'ABORTED'
      extensionsRecordList[0].changedDate = result.extensionsRecordList[0].changedDate
      test.deepEqual(result.transferStateRecord, transferStateRecord)
      test.deepEqual(result.extensionsRecordList, extensionsRecordList)
      test.end()
    })

    preparedTest.test('throw an error when unable to save transfer', async (test) => {
      try {
        ParticipantService.getByName.withArgs(payload.payerFsp).returns(P.resolve(participant1))
        ParticipantService.getByName.withArgs(payload.payeeFsp).returns(P.resolve(participant2))
        TransfersReadModel.saveTransfer.throws(new Error())
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
      TransfersReadModel.saveTransfer.throws(new Error())
      extensionModel.saveExtension.returns(P.resolve())
      ilpModel.saveIlp.returns(P.resolve())
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
      TransfersReadModel.saveTransfer.returns(P.resolve())
      extensionModel.saveExtension.throws(new Error())
      ilpModel.saveIlp.returns(P.resolve())
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
      TransfersReadModel.saveTransfer.returns(P.resolve())
      extensionModel.saveExtension.returns(P.resolve())
      ilpModel.saveIlp.throws(new Error())
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
      TransfersReadModel.saveTransfer.returns(P.resolve())
      extensionModel.saveExtension.returns(P.resolve())
      ilpModel.saveIlp.returns(P.resolve())
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
