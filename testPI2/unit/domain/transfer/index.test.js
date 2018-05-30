'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const TransferIndex = require('../../../../src/domain/transfer')
const CommandsIndex = require('../../../../src/domain/transfer/commands')
const Translator = require('../../../../src/domain/transfer/translator')
const Events = require('../../../../src/lib/events')
const TransferState = require('../../../../src/domain/transfer/state')

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

const stateReason = 'reasonOne'

const ilpRecord = {
  transferId: payload.transferId,
  packet: payload.ilpPacket,
  condition: payload.condition,
  fulfilment: null
}

const transferStateRecord = {
  transferId: payload.transferId,
  transferStateId: TransferState.RECEIVED,
  reason: null,
  changedDate: new Date()
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

const transferRecord = {
  transferId: payload.transferId,
  payerParticipantId: participant1.participantId,
  payeeParticipantId: participant2.participantId,
  amount: payload.amount.amount,
  currencyId: payload.amount.currency,
  expirationDate: new Date(payload.expiration)
}

const prepareResponse = {
  isSaveTransferPrepared: true,
  transferRecord,
  ilpRecord,
  transferStateRecord,
  extensionsRecordList
}

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

// const newTransferStateRecord = {
//   transferStateChangeId: null,
//   transferId: payload.transferId,
//   transferStateId: TransferState.ABORTED,
//   reason: stateReason,
//   changedDate: new Date()
// }

Test('Transfer-Index', transferIndexTest => {
  let sandbox

  transferIndexTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(CommandsIndex)
    sandbox.stub(Translator)
    sandbox.stub(Events)
    t.end()
  })

  transferIndexTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  transferIndexTest.test('prepare should', preparedTest => {
    preparedTest.test('prepare transfer payload that passed validation', async (test) => {
      try {
        CommandsIndex.prepare.returns(P.resolve(prepareResponse))
        Translator.toTransfer.returns(payload)
        const response = await TransferIndex.prepare(payload)
        test.deepEqual(response.transfer, payload)
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    preparedTest.test('prepare transfer throws error', async (test) => {
      CommandsIndex.prepare.throws(new Error)
      Translator.toTransfer.returns(payload)
      try {
        await TransferIndex.prepare(payload)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    preparedTest.test('prepare transfer throws error', async (test) => {
      CommandsIndex.prepare.returns(P.resolve(prepareResponse))
      Translator.toTransfer.throws(new Error)
      try {
        await TransferIndex.prepare(payload)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })
    preparedTest.end()
  })

  transferIndexTest.test('prepare should', rejectTest => {
    rejectTest.test('reject transfer payload that passed validation', async (test) => {
      CommandsIndex.reject.returns(P.resolve({alreadyRejected: false, transferStateChange: newTransferStateChange}))
      const rejectResponse = await TransferIndex.reject(stateReason, payload.transferId)
      rejectResponse.transferStateChange.changedDate = newTransferStateChange.changedDate
      test.equal(rejectResponse.alreadyRejected, false)
      test.deepEqual(rejectResponse.transferStateChange, newTransferStateChange)
      test.end()
    })
    rejectTest.end()
  })

  transferIndexTest.test('prepare should', rejectTest => {
    rejectTest.test('reject transfer throws an error', async (test) => {
      CommandsIndex.reject.returns(P.resolve({alreadyRejected: false, transferStateChange: newTransferStateChange}))
      try {
        await TransferIndex.reject(stateReason, payload.transferId)
        rejectResponse.transferStateChange.changedDate = newTransferStateChange.changedDate
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })
    rejectTest.end()
  })

  transferIndexTest.end()
})
