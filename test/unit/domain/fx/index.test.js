'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Fx = require('../../../../src/domain/fx')
const Logger = require('@mojaloop/central-services-logger')
const { fxTransfer } = require('../../../../src/models/fxTransfer')
const { Enum } = require('@mojaloop/central-services-shared')

const TransferEventAction = Enum.Events.Event.Action

Test('Fx', fxIndexTest => {
  let sandbox
  let payload
  let fxPayload
  fxIndexTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Logger, 'isDebugEnabled').value(true)
    sandbox.stub(fxTransfer)
    payload = {
      transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
      payerFsp: 'dfsp1',
      payeeFsp: 'dfsp2',
      amount: {
        currency: 'USD',
        amount: '433.88'
      },
      ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
      condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
      expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)), // tomorrow
      extensionList: {
        extension: [
          {
            key: 'key1',
            value: 'value1'
          },
          {
            key: 'key2',
            value: 'value2'
          }
        ]
      }
    }
    fxPayload = {
      commitRequestId: '88622a75-5bde-4da4-a6cc-f4cd23b268c4',
      determiningTransferId: 'c05c3f31-33b5-4e33-8bfd-7c3a2685fb6c',
      condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
      expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)), // tomorrow
      initiatingFsp: 'dfsp1',
      counterPartyFsp: 'fx_dfsp',
      sourceAmount: {
        currency: 'USD',
        amount: '433.88'
      },
      targetAmount: {
        currency: 'EUR',
        amount: '200.00'
      }
    }
    t.end()
  })

  fxIndexTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  fxIndexTest.test('handleFulfilResponse should', handleFulfilResponseTest => {
    handleFulfilResponseTest.test('return details about regular transfer', async (test) => {
      try {
        fxTransfer.saveFxFulfilResponse.returns(Promise.resolve())
        const result = await Fx.handleFulfilResponse(payload.transferId, payload, TransferEventAction.FX_RESERVE, null)
        test.deepEqual(result, {})
        test.ok(fxTransfer.saveFxFulfilResponse.calledWith(payload.transferId, payload, TransferEventAction.FX_RESERVE, null))
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    handleFulfilResponseTest.test('throw errors', async (test) => {
      try {
        fxTransfer.saveFxFulfilResponse.throws(new Error('Error'))
        const result = await Fx.handleFulfilResponse(payload.transferId, payload, TransferEventAction.FX_RESERVE, null)
        test.deepEqual(result, {})
        test.ok(fxTransfer.saveFxFulfilResponse.calledWith(payload.transferId, payload, TransferEventAction.FX_RESERVE, null))
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
        test.end()
      }
    })

    handleFulfilResponseTest.end()
  })

  fxIndexTest.test('forwardedPrepare should', forwardedPrepareTest => {
    forwardedPrepareTest.test('commit transfer', async (test) => {
      try {
        fxTransfer.updateFxPrepareReservedForwarded.returns(Promise.resolve())
        await Fx.forwardedFxPrepare(fxPayload.commitRequestId)
        test.ok(fxTransfer.updateFxPrepareReservedForwarded.calledWith(fxPayload.commitRequestId))
        test.pass()
        test.end()
      } catch (err) {
        Logger.error(`handlePayeeResponse failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    forwardedPrepareTest.test('throw error', async (test) => {
      try {
        fxTransfer.updateFxPrepareReservedForwarded.throws(new Error())
        await Fx.forwardedFxPrepare(fxPayload.commitRequestId)
        test.fail('Error not thrown')
        test.end()
      } catch (err) {
        Logger.error(`handlePayeeResponse failed with error - ${err}`)
        test.pass('Error thrown')
        test.end()
      }
    })

    forwardedPrepareTest.end()
  })

  fxIndexTest.end()
})
