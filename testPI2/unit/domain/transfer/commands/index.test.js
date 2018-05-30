'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const CommandsIndex = require('../../../../../src/domain/transfer/commands')
const TransfersProjection = require('../../../../../src/domain/transfer/projection')
const TransferState = require('../../../../../src/domain/transfer/state')

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
  transferStateId: TransferState.RECEIVED,
  reason: null,
  changedDate: new Date()
}

// const newTransferStateRecord = {
//   transferStateChangeId: null,
//   transferId: payload.transferId,
//   transferStateId: TransferState.ABORTED,
//   reason: stateReason,
//   changedDate: new Date()
// }

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

const newTransferStateChange = {
  transferStateChangeId: null,
  transferId: payload.transferId,
  transferStateId: TransferState.ABORTED,
  reason: stateReason,
  changedDate: new Date()
}

const rejectResponse = {
  alreadyRejected: false,
  newTransferStateChange
}

const prepareResponse = {
  isSaveTransferPrepared: true,
  transferRecord,
  ilpRecord,
  transferStateRecord,
  extensionsRecordList
}

Test('Commands-Index', commandIndextTest => {
  let sandbox

  commandIndextTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(TransfersProjection)
    t.end()
  })

  commandIndextTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  commandIndextTest.test('prepare should', preparedTest => {
    preparedTest.test('persist the payload to the database', async (test) => {
      try {
        await TransfersProjection.saveTransferPrepared.returns(P.resolve(prepareResponse))
        const response = await CommandsIndex.prepare(payload)
        test.deepEqual(response, prepareResponse)
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    preparedTest.test('save transfer prepared throws error', async (test) => {
      await TransfersProjection.saveTransferPrepared.throws(new Error)
      try {
        await CommandsIndex.prepare(payload)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
        test.end()
      }
    })
    preparedTest.end()
  })

  commandIndextTest.test('reject should', rejectTest => {
    rejectTest.test('reject saving transfer to the database', async (test) => {
      await TransfersProjection.saveTransferRejected.returns(P.resolve(rejectResponse))
      const response = await CommandsIndex.reject(stateReason, payload.transferId)
      test.deepEqual(response, rejectResponse)
      test.end()
    })

    rejectTest.test('reject save transfer to the database throws an error', async (test) => {
      await TransfersProjection.saveTransferRejected.throws(new Error)
      try {
        await CommandsIndex.reject(stateReason, payload.transferId)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
        test.end()
      }
    })
    rejectTest.end()
  })

  commandIndextTest.end()
})
