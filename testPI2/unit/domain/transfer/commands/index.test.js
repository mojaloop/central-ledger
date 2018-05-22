'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Logger = require('@mojaloop/central-services-shared').Logger
const Projection = require('../../../../../src/domain/transfer/projection')
const
const stateReason = null
const hasPassedValidation = true

const transfer = {
  transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  payerFsp: 'dfsp1',
  payeeFsp: 'dfsp2',
  amount:
    {
      currency: 'USD',
      amount: '433.88'
    },
  ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
  condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
  expiration: '2016-05-24T08:38:08.699-04:00',
  extensionList:
    {
      extension:
        [
          {
            key: 'key1',
            value: 'value1'
          }
        ]
    }
}

Test('Commands-Index', commandIndextTest => {
  let sandbox

  commandIndextTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Projection)
    t.end()
  })

  commandIndextTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  commandIndextTest.test('commands index saveTransferPrepared should', preparedTest => {

    preparedTest.test('return object of results', async (test) => {

      //Projection.saveTransferPrepared.returns(P.resolve())

      const prepare = await Projection.saveTransferPrepared(transfer, stateReason, hasPassedValidation)

      //let {alreadyRejected, newTransferStateChange} = await Projection.saveTransferRejected(stateReason, transfer.transferId)
      //newTransferStateRecord.changedDate = newTransferStateChange.changedDate

      //test.equal(alreadyRejected, true)
      //test.deepEqual(foundTransferStateChange, newTransferStateRecord)
      test.end()
    })
    preparedTest.end()
  })
  commandIndextTest.end()
})
