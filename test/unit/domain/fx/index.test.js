/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
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

 * Infitx
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 - Kevin Leyow <kevin.leyow@infitx.com>
 - Kalin Krustev <kalin.krustev@infitx.com>
 - Steven Oderayi <steven.oderayi@infitx.com>
 - Eugen Klymniuk <eugen.klymniuk@infitx.com>

 --------------

 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Fx = require('../../../../src/domain/fx')
const Logger = require('../../../../src/shared/logger').logger
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
