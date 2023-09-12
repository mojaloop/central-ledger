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
      // Not sure of what should be the correctly structured model here.
      // All I know is that the model should have the following properties: currencyId, the right settlementAccountId
      const allSettlementModels = [{
        settlementModelId: 1,
        name: 'DEFERREDNET',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2, // 1 Immediate, 2 Deferred
        currencyId: 'USD',
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 1, // 1 Position, 2 Settlement
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
        0,
        0,
        {
          'b51ec534-ee48-4575-b6a9-ead2955b8999': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          'c51ec534-ee48-4575-b6a9-ead2955b8999': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          'd51ec534-ee48-4575-b6a9-ead2955b8999': 'INVALID_STATE'
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.resultMessages.length, 3)
      test.equal(processedMessages.resultMessages[0].message.content.uriParams.id, 'b51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[0].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[0].message.content.headers['FSPIOP-Destination'], 'dfsp2')
      test.equal(processedMessages.resultMessages[0].message.content.headers['FSPIOP-Source'], 'dfsp1')
      test.equal(processedMessages.resultMessages[0].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.accumulatedTransferState[transferMessage1.payload.transferId], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.resultMessages[1].message.content.uriParams.id, 'c51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[1].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[1].message.content.headers['FSPIOP-Destination'], 'dfsp3')
      test.equal(processedMessages.resultMessages[1].message.content.headers['FSPIOP-Source'], 'dfsp1')
      test.equal(processedMessages.resultMessages[1].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.accumulatedTransferState[transferMessage2.payload.transferId], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.resultMessages[2].message.content.uriParams.id, 'd51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[2].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[2].message.content.headers['FSPIOP-Destination'], 'dfsp1')
      test.equal(processedMessages.resultMessages[2].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.resultMessages[2].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.resultMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.equal(processedMessages.accumulatedTransferState[transferMessage3.payload.transferId], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferId, transferMessage1.payload.transferId)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferId, transferMessage2.payload.transferId)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferId, transferMessage3.payload.transferId)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedPosition, 9800)
      test.end()
    })

    changeParticipantPositionTest.test('produce abort message for when payer does not have enough liquidity', async (test) => {
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
        value: 10, // Set low
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }
      // Not sure of what should be the correctly structured model here.
      // All I know is that the model should have the following properties: currencyId, the right settlementAccountId
      const allSettlementModels = [{
        settlementModelId: 1,
        name: 'DEFERREDNET',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2, // 1 Immediate, 2 Deferred
        currencyId: 'USD',
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 1, // 1 Position, 2 Settlement
        autoPositionReset: 1,
        adjustPosition: 0,
        settlementAccountTypeId: 2
      }]

      SettlementModelCached.getAll.returns(allSettlementModels)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 2).returns(settlementAccount)
      ParticipantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(Promise.resolve(participantLimit))
      BatchModel.getPositionsByAccountIdsNonTrx.returns({
        1: 10 // Set low
      })

      const processedMessages = await processPositionPrepareBin(
        binItems,
        0,
        0,
        {
          'b51ec534-ee48-4575-b6a9-ead2955b8999': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          'c51ec534-ee48-4575-b6a9-ead2955b8999': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          'd51ec534-ee48-4575-b6a9-ead2955b8999': 'INVALID_STATE'
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.resultMessages.length, 3)

      test.equal(processedMessages.resultMessages[0].message.content.uriParams.id, 'b51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[0].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[0].message.content.headers['FSPIOP-Destination'], 'dfsp1')
      test.equal(processedMessages.resultMessages[0].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.resultMessages[0].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[0].message.content.payload.errorInformation.errorCode, '4001')
      test.equal(processedMessages.resultMessages[0].message.content.payload.errorInformation.errorDescription, 'Payer FSP insufficient liquidity')
      test.equal(processedMessages.participantPositionChanges[0].value, 10)
      test.equal(processedMessages.accumulatedTransferState[transferMessage1.payload.transferId], Enum.Transfers.TransferState.ABORTED)

      test.equal(processedMessages.resultMessages[1].message.content.uriParams.id, 'c51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[1].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[1].message.content.headers['FSPIOP-Destination'], 'dfsp1')
      test.equal(processedMessages.resultMessages[1].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.resultMessages[1].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[1].message.content.payload.errorInformation.errorCode, '4001')
      test.equal(processedMessages.resultMessages[1].message.content.payload.errorInformation.errorDescription, 'Payer FSP insufficient liquidity')
      test.equal(processedMessages.participantPositionChanges[1].value, 10)
      test.equal(processedMessages.accumulatedTransferState[transferMessage2.payload.transferId], Enum.Transfers.TransferState.ABORTED)

      test.equal(processedMessages.resultMessages[2].message.content.uriParams.id, 'd51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[2].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[2].message.content.headers['FSPIOP-Destination'], 'dfsp1')
      test.equal(processedMessages.resultMessages[2].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.resultMessages[2].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.resultMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.equal(processedMessages.participantPositionChanges[2].value, 10)
      test.equal(processedMessages.accumulatedTransferState[transferMessage3.payload.transferId], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferId, transferMessage1.payload.transferId)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferId, transferMessage2.payload.transferId)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferId, transferMessage3.payload.transferId)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.ABORTED)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.ABORTED)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedPosition, 10)
      test.end()
    })

    changeParticipantPositionTest.test('produce reserved messages for valid transfer messages', async (test) => {
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
      // Not sure of what should be the correctly structured model here.
      // All I know is that the model should have the following properties: currencyId, the right settlementAccountId
      const allSettlementModels = [{
        settlementModelId: 1,
        name: 'DEFERREDNET',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2, // 1 Immediate, 2 Deferred
        currencyId: 'USD',
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 1, // 1 Position, 2 Settlement
        autoPositionReset: 1,
        adjustPosition: 0,
        settlementAccountTypeId: 2
      }]

      SettlementModelCached.getAll.returns(allSettlementModels)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 2).returns(settlementAccount)
      ParticipantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(Promise.resolve(participantLimit))
      BatchModel.getPositionsByAccountIdsNonTrx.returns({
        1: 100000,
        2: 100000
      })

      const processedMessages = await processPositionPrepareBin(
        binItems,
        0,
        0,
        {
          'b51ec534-ee48-4575-b6a9-ead2955b8999': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          'c51ec534-ee48-4575-b6a9-ead2955b8999': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          'd51ec534-ee48-4575-b6a9-ead2955b8999': 'INVALID_STATE'
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.resultMessages.length, 3)

      test.equal(processedMessages.resultMessages[0].message.content.uriParams.id, 'b51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[0].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[0].message.content.headers['FSPIOP-Destination'], 'dfsp2')
      test.equal(processedMessages.resultMessages[0].message.content.headers['FSPIOP-Source'], 'dfsp1')
      test.equal(processedMessages.resultMessages[0].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.participantPositionChanges[0].value, 9900)
      test.equal(processedMessages.accumulatedTransferState[transferMessage1.payload.transferId], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.resultMessages[1].message.content.uriParams.id, 'c51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[1].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[1].message.content.headers['FSPIOP-Destination'], 'dfsp3')
      test.equal(processedMessages.resultMessages[1].message.content.headers['FSPIOP-Source'], 'dfsp1')
      test.equal(processedMessages.resultMessages[1].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.participantPositionChanges[1].value, 9800)
      test.equal(processedMessages.accumulatedTransferState[transferMessage2.payload.transferId], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.resultMessages[2].message.content.uriParams.id, 'd51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[2].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[2].message.content.headers['FSPIOP-Destination'], 'dfsp1')
      test.equal(processedMessages.resultMessages[2].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.resultMessages[2].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.resultMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.equal(processedMessages.participantPositionChanges[2].value, 9800)
      test.equal(processedMessages.accumulatedTransferState[transferMessage3.payload.transferId], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferId, transferMessage1.payload.transferId)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferId, transferMessage2.payload.transferId)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferId, transferMessage3.payload.transferId)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedPosition, 9800)
      test.end()
    })

    changeParticipantPositionTest.test('include settlementParticipantPosition in availablePosition calc when settlement model delay is IMMEDIATE', async (test) => {
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
      // Not sure of what should be the correctly structured model here.
      // All I know is that the model should have the following properties: currencyId, the right settlementAccountId
      const allSettlementModels = [{
        settlementModelId: 1,
        name: 'DEFERREDNET',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 1, // 1 Immediate, 2 Deferred
        currencyId: 'USD',
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 1, // 1 Position, 2 Settlement
        autoPositionReset: 1,
        adjustPosition: 0,
        settlementAccountTypeId: 2
      }]

      SettlementModelCached.getAll.returns(allSettlementModels)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 2).returns(settlementAccount)
      ParticipantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(Promise.resolve(participantLimit))
      BatchModel.getPositionsByAccountIdsNonTrx.returns({
        1: 100000,
        2: 100000
      })

      const processedMessages = await processPositionPrepareBin(
        binItems,
        0,
        0,
        {
          'b51ec534-ee48-4575-b6a9-ead2955b8999': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          'c51ec534-ee48-4575-b6a9-ead2955b8999': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          'd51ec534-ee48-4575-b6a9-ead2955b8999': 'INVALID_STATE'
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.resultMessages.length, 3)

      test.equal(processedMessages.resultMessages[0].message.content.uriParams.id, 'b51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[0].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[0].message.content.headers['FSPIOP-Destination'], 'dfsp2')
      test.equal(processedMessages.resultMessages[0].message.content.headers['FSPIOP-Source'], 'dfsp1')
      test.equal(processedMessages.resultMessages[0].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.participantPositionChanges[0].value, 109900)
      test.equal(processedMessages.accumulatedTransferState[transferMessage1.payload.transferId], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.resultMessages[1].message.content.uriParams.id, 'c51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[1].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[1].message.content.headers['FSPIOP-Destination'], 'dfsp3')
      test.equal(processedMessages.resultMessages[1].message.content.headers['FSPIOP-Source'], 'dfsp1')
      test.equal(processedMessages.resultMessages[1].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.participantPositionChanges[1].value, 109800)
      test.equal(processedMessages.accumulatedTransferState[transferMessage2.payload.transferId], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.resultMessages[2].message.content.uriParams.id, 'd51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[2].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[2].message.content.headers['FSPIOP-Destination'], 'dfsp1')
      test.equal(processedMessages.resultMessages[2].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.resultMessages[2].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.resultMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.equal(processedMessages.participantPositionChanges[2].value, 109800)
      test.equal(processedMessages.accumulatedTransferState[transferMessage3.payload.transferId], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferId, transferMessage1.payload.transferId)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferId, transferMessage2.payload.transferId)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferId, transferMessage3.payload.transferId)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedPosition, 109800)
      test.end()
    })

    changeParticipantPositionTest.test('produce error if no settlement models found', async (test) => {
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
      const allSettlementModels = []

      SettlementModelCached.getAll.returns(allSettlementModels)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 2).returns(settlementAccount)
      ParticipantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(Promise.resolve(participantLimit))
      BatchModel.getPositionsByAccountIdsNonTrx.returns({
        1: 100000,
        2: 100000
      })
      try {
        await processPositionPrepareBin(
          binItems,
          0,
          0,
          {
            'b51ec534-ee48-4575-b6a9-ead2955b8999': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
            'c51ec534-ee48-4575-b6a9-ead2955b8999': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
            'd51ec534-ee48-4575-b6a9-ead2955b8999': 'INVALID_STATE'
          }
        )
        test.notOk('Should throw error')
      } catch (error) {
        test.ok(error)
      }

      test.end()
    })

    changeParticipantPositionTest.test('produce reserved messages for valid transfer messages with default settlement model', async (test) => {
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
      // Not sure of what should be the correctly structured model here.
      // All I know is that the model should have the following properties: currencyId, the right settlementAccountId
      const allSettlementModels = [{
        settlementModelId: 1,
        name: 'DEFERREDNET',
        isActive: 1,
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2, // 1 Immediate, 2 Deferred
        currencyId: null, // Default settlement model is null currencyId
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 1, // 1 Position, 2 Settlement
        autoPositionReset: 1,
        adjustPosition: 0,
        settlementAccountTypeId: 2
      }]

      SettlementModelCached.getAll.returns(allSettlementModels)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 1).returns(participant)
      ParticipantFacade.getByNameAndCurrency.withArgs(payerFsp, currency, 2).returns(settlementAccount)
      ParticipantFacade.getParticipantLimitByParticipantCurrencyLimit.returns(Promise.resolve(participantLimit))
      BatchModel.getPositionsByAccountIdsNonTrx.returns({
        1: 100000,
        2: 100000
      })

      const processedMessages = await processPositionPrepareBin(
        binItems,
        0,
        0,
        {
          'b51ec534-ee48-4575-b6a9-ead2955b8999': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          'c51ec534-ee48-4575-b6a9-ead2955b8999': Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
          'd51ec534-ee48-4575-b6a9-ead2955b8999': 'INVALID_STATE'
        }
      )
      Logger.isInfoEnabled && Logger.info(processedMessages)
      test.equal(processedMessages.resultMessages.length, 3)

      test.equal(processedMessages.resultMessages[0].message.content.uriParams.id, 'b51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[0].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[0].message.content.headers['FSPIOP-Destination'], 'dfsp2')
      test.equal(processedMessages.resultMessages[0].message.content.headers['FSPIOP-Source'], 'dfsp1')
      test.equal(processedMessages.resultMessages[0].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.participantPositionChanges[0].value, 9900)
      test.equal(processedMessages.accumulatedTransferState[transferMessage1.payload.transferId], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.resultMessages[1].message.content.uriParams.id, 'c51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[1].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[1].message.content.headers['FSPIOP-Destination'], 'dfsp3')
      test.equal(processedMessages.resultMessages[1].message.content.headers['FSPIOP-Source'], 'dfsp1')
      test.equal(processedMessages.resultMessages[1].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.participantPositionChanges[1].value, 9800)
      test.equal(processedMessages.accumulatedTransferState[transferMessage2.payload.transferId], Enum.Transfers.TransferState.RESERVED)

      test.equal(processedMessages.resultMessages[2].message.content.uriParams.id, 'd51ec534-ee48-4575-b6a9-ead2955b8999')
      test.equal(processedMessages.resultMessages[2].message.content.headers.accept, 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[2].message.content.headers['FSPIOP-Destination'], 'dfsp1')
      test.equal(processedMessages.resultMessages[2].message.content.headers['FSPIOP-Source'], 'switch')
      test.equal(processedMessages.resultMessages[2].message.content.headers['Content-Type'], 'application/vnd.interoperability.transfers+json;version=1.0')
      test.equal(processedMessages.resultMessages[2].message.content.payload.errorInformation.errorCode, '2001')
      test.equal(processedMessages.resultMessages[2].message.content.payload.errorInformation.errorDescription, 'Internal server error')
      test.equal(processedMessages.participantPositionChanges[2].value, 9800)
      test.equal(processedMessages.accumulatedTransferState[transferMessage3.payload.transferId], Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferId, transferMessage1.payload.transferId)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferId, transferMessage2.payload.transferId)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferId, transferMessage3.payload.transferId)

      test.equal(processedMessages.accumulatedTransferStateChanges[0].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[1].transferStateId, Enum.Transfers.TransferState.RESERVED)
      test.equal(processedMessages.accumulatedTransferStateChanges[2].transferStateId, Enum.Transfers.TransferInternalState.ABORTED_REJECTED)

      test.equal(processedMessages.accumulatedPosition, 9800)
      test.end()
    })

    changeParticipantPositionTest.skip('produce proper limit alarms', async (test) => {
    })

    changeParticipantPositionTest.end()
  })

  positionIndexTest.end()
})
