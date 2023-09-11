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

 * Kevin Leyow <kevin.leyow@infitx.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const { Enum } = require('@mojaloop/central-services-shared')
const Sinon = require('sinon')
const { processPositionPrepareBin } = require('../../../../src/domain/position/prepare')
const Logger = require('@mojaloop/central-services-logger')
const ParticipantFacade = require('../../../../src/models/participant/facade')
const SettlementModelCached = require('../../../../src/models/settlement/settlementModelCached')
const BatchModel = require('../../../../src/models/position/batch')

const payerFsp = 'dfsp1'
const currency = 'USD'
const transferMessage1 = {
  payload: {
    transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
    payerFsp,
    payeeFsp: 'dfsp2',
    amount: {
      currency,
      amount: '100.00'
    },
    ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
    condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
    expiration: '2016-05-24T08:38:08.699-04:00'
  }
}
const transferMessage2 = {
  payload: {
    transferId: 'c51ec534-ee48-4575-b6a9-ead2955b8999',
    payerFsp,
    payeeFsp: 'dfsp3',
    amount: {
      currency,
      amount: '100.00'
    },
    ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
    condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
    expiration: '2016-05-24T08:38:08.699-04:00'
  }
}
const transferMessage3 = {
  payload: {
    transferId: 'd51ec534-ee48-4575-b6a9-ead2955b8999',
    payerFsp,
    payeeFsp: 'dfsp4',
    amount: {
      currency,
      amount: '100.00'
    },
    ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
    condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
    expiration: '2016-05-24T08:38:08.699-04:00'
  }
}
const span = {}
const binItems = [{ message: transferMessage1, span }, { message: transferMessage2, span }, { message: transferMessage3, span }]

Test('Prepare domain', positionIndexTest => {
  let sandbox

  positionIndexTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(ParticipantFacade, 'getByNameAndCurrency')
    sandbox.stub(ParticipantFacade, 'getParticipantLimitByParticipantCurrencyLimit')
    sandbox.stub(SettlementModelCached, 'getAll')
    sandbox.stub(BatchModel, 'getPositionsByAccountIdsNonTrx')
    t.end()
  })

  positionIndexTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  positionIndexTest.test('processPositionPrepareBin should', changeParticipantPositionTest => {
    changeParticipantPositionTest.test('produce abort message for transfers not in the right transfer state', async (test) => {
      const participant = {
        participantId: 0,
        name: 'payerFsp',
        currency: 'USD',
        isActive: 1,
        createdDate: new Date(),
        participantCurrencyId: 1
      }
      const settlementAccount = {
        participantCurrencyId: 2
      }
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 10000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      const allSettlementModels = [{
        settlementModelId: 1,
        name: 'DEFERREDNET',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2,
        currencyId: 'USD',
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 1,
        autoPositionReset: 1,
        adjustPosition: 0,
        settlementAccountTypeId: 2
      }]

      SettlementModelCached.getAll.returns(allSettlementModels)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 2).returns(settlementAccount)
      ParticipantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(Promise.resolve(participantLimit))
      BatchModel.getPositionsByAccountIdsNonTrx.returns({
        1: 10000
      })

      const processedMessages = await processPositionPrepareBin(
        binItems,
        1,
        1,
        {
          'b51ec534-ee48-4575-b6a9-ead2955b8999': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          'c51ec534-ee48-4575-b6a9-ead2955b8999': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          'd51ec534-ee48-4575-b6a9-ead2955b8999': 'INVALID_STATE'
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.resultMessages.length, 3)
      test.equal(processedMessages.resultMessages[2].message.content.uriParams.id, 'd51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[2].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[2].message.content.headers['FSPIOP-Destination'], 'dfsp1')
      test.equal(processedMessages.resultMessages[2].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.resultMessages[2].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.resultMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.end()
    })

    changeParticipantPositionTest.end()
  })

  positionIndexTest.end()
})
