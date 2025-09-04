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
const Cyril = require('../../../../src/domain/fx/cyril')
const Logger = require('../../../../src/shared/logger').logger
const { Enum } = require('@mojaloop/central-services-shared')
const TransferModel = require('../../../../src/models/transfer/transfer')
const TransferFacade = require('../../../../src/models/transfer/facade')
const ParticipantFacade = require('../../../../src/models/participant/facade')
const ParticipantPositionChangesModel = require('../../../../src/models/position/participantPositionChanges')
const { fxTransfer, watchList } = require('../../../../src/models/fxTransfer')
const ProxyCache = require('../../../../src/lib/proxyCache')
const config = require('#src/lib/config')

const defaultGetProxyParticipantAccountDetailsResponse = { inScheme: true, participantCurrencyId: 1 }

Test('Cyril', cyrilTest => {
  let sandbox
  let fxPayload
  let payload

  cyrilTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Logger, 'isDebugEnabled').value(true)
    sandbox.stub(watchList)
    sandbox.stub(fxTransfer)
    sandbox.stub(TransferModel)
    sandbox.stub(ParticipantFacade)
    sandbox.stub(ProxyCache)
    sandbox.stub(ParticipantPositionChangesModel)
    sandbox.stub(TransferFacade)
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
      determiningTransferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
      condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
      expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)), // tomorrow
      initiatingFsp: 'fx_dfsp1',
      counterPartyFsp: 'fx_dfsp2',
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

  cyrilTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  cyrilTest.test('getParticipantAndCurrencyForTransferMessage should', getParticipantAndCurrencyForTransferMessageTest => {
    getParticipantAndCurrencyForTransferMessageTest.test('return details about regular transfer', async (test) => {
      try {
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve([]))
        const determiningTransferCheckResult = await Cyril.checkIfDeterminingTransferExistsForTransferMessage(payload,
          {
            isCounterPartyFspProxy: false,
            isInitiatingFspProxy: false
          }
        )
        const result = await Cyril.getParticipantAndCurrencyForTransferMessage(payload, determiningTransferCheckResult)

        test.deepEqual(result, {
          participantName: 'dfsp1',
          currencyId: 'USD',
          amount: '433.88'
        })
        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    getParticipantAndCurrencyForTransferMessageTest.test('return details about fxtransfer', async (test) => {
      try {
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve([
          {
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
            createdDate: new Date()
          }
        ]))
        fxTransfer.getAllDetailsByCommitRequestId.withArgs(
          fxPayload.commitRequestId
        ).returns(Promise.resolve(
          {
            targetAmount: fxPayload.targetAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            counterPartyFspName: 'fx_dfsp2'
          }
        ))
        const determiningTransferCheckResult = await Cyril.checkIfDeterminingTransferExistsForTransferMessage(payload,
          {
            isCounterPartyFspProxy: false,
            isInitiatingFspProxy: false
          }
        )
        const result = await Cyril.getParticipantAndCurrencyForTransferMessage(
          payload,
          determiningTransferCheckResult,
          { isCounterPartyFspProxy: false }
        )

        test.deepEqual(result, {
          participantName: 'fx_dfsp2',
          currencyId: 'EUR',
          amount: '200.00'
        })
        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.ok(fxTransfer.getAllDetailsByCommitRequestId.calledWith(fxPayload.commitRequestId))
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    getParticipantAndCurrencyForTransferMessageTest.test('return details about proxied fxtransfer', async (test) => {
      try {
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve([
          {
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
            createdDate: new Date()
          }
        ]))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.withArgs(
          fxPayload.commitRequestId
        ).returns(Promise.resolve(
          {
            targetAmount: fxPayload.targetAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            counterPartyFspName: 'fx_dfsp2'
          }
        ))
        const determiningTransferCheckResult = await Cyril.checkIfDeterminingTransferExistsForTransferMessage(payload,
          {
            isCounterPartyFspProxy: true,
            isInitiatingFspProxy: false
          }
        )
        const result = await Cyril.getParticipantAndCurrencyForTransferMessage(
          payload,
          determiningTransferCheckResult,
          { isCounterPartyFspProxy: true }
        )

        test.deepEqual(result, {
          participantName: 'fx_dfsp2',
          currencyId: 'EUR',
          amount: '200.00'
        })
        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.ok(fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.calledWith(fxPayload.commitRequestId))
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    getParticipantAndCurrencyForTransferMessageTest.test('skips adding payee participantCurrency for validation when payee has proxy representation', async (test) => {
      try {
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve([
          {
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
            createdDate: new Date()
          }
        ]))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.withArgs(
          fxPayload.commitRequestId
        ).returns(Promise.resolve(
          {
            targetAmount: fxPayload.targetAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            counterPartyFspName: 'fx_dfsp2'
          }
        ))

        const determiningTransferCheckResult = await Cyril.checkIfDeterminingTransferExistsForTransferMessage(payload,
          {
            isCounterPartyFspProxy: true,
            isInitiatingFspProxy: false
          }
        )
        test.deepEqual(determiningTransferCheckResult.participantCurrencyValidationList, [])
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    getParticipantAndCurrencyForTransferMessageTest.test('skips adding payer participantCurrency for validation when payer has proxy representation', async (test) => {
      try {
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve([]))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.withArgs(
          fxPayload.commitRequestId
        ).returns(Promise.resolve(
          {
            targetAmount: fxPayload.targetAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            counterPartyFspName: 'fx_dfsp2'
          }
        ))

        const determiningTransferCheckResult = await Cyril.checkIfDeterminingTransferExistsForTransferMessage(payload,
          {
            isCounterPartyFspProxy: false,
            isInitiatingFspProxy: true
          }
        )
        test.deepEqual(determiningTransferCheckResult.participantCurrencyValidationList, [])
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    getParticipantAndCurrencyForTransferMessageTest.test('skips adding payee participantCurrency for validation when payee has proxy representation, PAYEE_PARTICIPANT_CURRENCY_VALIDATION_ENABLED=true', async (test) => {
      try {
        config.PAYEE_PARTICIPANT_CURRENCY_VALIDATION_ENABLED = true
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve([]))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.withArgs(
          fxPayload.commitRequestId
        ).returns(Promise.resolve(
          {
            targetAmount: fxPayload.targetAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            counterPartyFspName: 'fx_dfsp2'
          }
        ))

        const determiningTransferCheckResult = await Cyril.checkIfDeterminingTransferExistsForTransferMessage(payload,
          {
            isCounterPartyFspProxy: true,
            isInitiatingFspProxy: true
          }
        )
        test.deepEqual(determiningTransferCheckResult.participantCurrencyValidationList, [])
        test.pass('Error not thrown')
        config.PAYEE_PARTICIPANT_CURRENCY_VALIDATION_ENABLED = false
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    getParticipantAndCurrencyForTransferMessageTest.test('adds payee participantCurrency for validation for payee, PAYEE_PARTICIPANT_CURRENCY_VALIDATION_ENABLED=true', async (test) => {
      try {
        config.PAYEE_PARTICIPANT_CURRENCY_VALIDATION_ENABLED = true
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve([]))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.withArgs(
          fxPayload.commitRequestId
        ).returns(Promise.resolve(
          {
            targetAmount: fxPayload.targetAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            counterPartyFspName: 'fx_dfsp2'
          }
        ))

        const determiningTransferCheckResult = await Cyril.checkIfDeterminingTransferExistsForTransferMessage(payload,
          {
            isCounterPartyFspProxy: false,
            isInitiatingFspProxy: true
          }
        )
        test.deepEqual(determiningTransferCheckResult.participantCurrencyValidationList, [{ participantName: 'dfsp2', currencyId: 'USD' }])
        test.pass('Error not thrown')
        config.PAYEE_PARTICIPANT_CURRENCY_VALIDATION_ENABLED = false
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    getParticipantAndCurrencyForTransferMessageTest.end()
  })

  cyrilTest.test('getParticipantAndCurrencyForFxTransferMessage should', getParticipantAndCurrencyForFxTransferMessageTest => {
    getParticipantAndCurrencyForFxTransferMessageTest.test('return details about fxtransfer debtor party initited msg', async (test) => {
      try {
        TransferModel.getById.returns(Promise.resolve(null))
        const determiningTransferCheckResult = await Cyril.checkIfDeterminingTransferExistsForFxTransferMessage(fxPayload, {
          isCounterPartyFspProxy: false
        })
        const result = await Cyril.getParticipantAndCurrencyForFxTransferMessage(fxPayload, determiningTransferCheckResult)

        test.ok(watchList.addToWatchList.calledWith({
          commitRequestId: fxPayload.commitRequestId,
          determiningTransferId: fxPayload.determiningTransferId,
          fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION
        }))
        test.deepEqual(result, {
          participantName: fxPayload.initiatingFsp,
          currencyId: fxPayload.sourceAmount.currency,
          amount: fxPayload.sourceAmount.amount
        })
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e.stack)
        test.fail('Error Thrown')
        test.end()
      }
    })

    getParticipantAndCurrencyForFxTransferMessageTest.test('return details about fxtransfer creditor party initited msg', async (test) => {
      try {
        TransferModel.getById.returns(Promise.resolve({}))
        const determiningTransferCheckResult = await Cyril.checkIfDeterminingTransferExistsForFxTransferMessage(fxPayload, {
          isCounterPartyFspProxy: false
        })
        const result = await Cyril.getParticipantAndCurrencyForFxTransferMessage(fxPayload, determiningTransferCheckResult)

        test.ok(watchList.addToWatchList.calledWith({
          commitRequestId: fxPayload.commitRequestId,
          determiningTransferId: fxPayload.determiningTransferId,
          fxTransferTypeId: Enum.Fx.FxTransferType.PAYEE_CONVERSION
        }))
        test.deepEqual(result, {
          participantName: fxPayload.counterPartyFsp,
          currencyId: fxPayload.targetAmount.currency,
          amount: fxPayload.targetAmount.amount
        })
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })
    getParticipantAndCurrencyForFxTransferMessageTest.end()
  })

  cyrilTest.test('processFxFulfilMessage should', processFxFulfilMessageTest => {
    processFxFulfilMessageTest.test('throws error when commitRequestId not in watchlist', async (test) => {
      try {
        watchList.getItemInWatchListByCommitRequestId.returns(Promise.resolve(null))
        await Cyril.processFxFulfilMessage(fxPayload.commitRequestId)
        test.ok(watchList.getItemInWatchListByCommitRequestId.calledWith(fxPayload.commitRequestId))
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
        test.end()
      }
    })

    processFxFulfilMessageTest.test('should return true when commitRequestId is in watchlist', async (test) => {
      try {
        watchList.getItemInWatchListByCommitRequestId.returns(Promise.resolve({
          commitRequestId: fxPayload.commitRequestId,
          determiningTransferId: fxPayload.determiningTransferId,
          fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
          createdDate: new Date()
        }))
        const result = await Cyril.processFxFulfilMessage(fxPayload.commitRequestId)
        test.ok(watchList.getItemInWatchListByCommitRequestId.calledWith(fxPayload.commitRequestId))
        test.ok(result)
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    processFxFulfilMessageTest.end()
  })

  cyrilTest.test('processFulfilMessage should', processFulfilMessageTest => {
    processFulfilMessageTest.test('return false if transferId is not in watchlist', async (test) => {
      try {
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(null))
        const result = await Cyril.processFulfilMessage(payload.transferId, payload, payload)

        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.deepEqual(result, {
          isFx: false,
          positionChanges: [],
          patchNotifications: []
        })
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    processFulfilMessageTest.test('process watchlist with only payer conversion found', async (test) => {
      try {
        const completedTimestamp = new Date().toISOString()
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 2,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            counterPartyFspName: fxPayload.counterPartyFsp,
            fulfilment: 'fulfilment',
            completedTimestamp
          }
        ))
        ParticipantFacade.getByNameAndCurrency.returns(Promise.resolve({
          participantId: 1,
          participantCurrencyId: 1,
          participantName: 'fx_dfsp1',
          isActive: 1
        }))
        ProxyCache.getProxyParticipantAccountDetails.returns(Promise.resolve(defaultGetProxyParticipantAccountDetailsResponse))
        const result = await Cyril.processFulfilMessage(payload.transferId, payload, payload)
        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.ok(fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.calledWith(fxPayload.commitRequestId))
        test.ok(ProxyCache.getProxyParticipantAccountDetails.calledWith(
          'dfsp2',
          fxPayload.targetAmount.currency
        ))

        test.deepEqual(result, {
          isFx: true,
          positionChanges: [{
            isFxTransferStateChange: true,
            commitRequestId: '88622a75-5bde-4da4-a6cc-f4cd23b268c4',
            participantCurrencyId: 1,
            amount: -433.88
          },
          {
            isFxTransferStateChange: false,
            transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
            participantCurrencyId: 1,
            amount: -200
          }
          ],
          patchNotifications: [{
            commitRequestId: fxPayload.commitRequestId,
            fxpName: fxPayload.counterPartyFsp,
            fulfilment: 'fulfilment',
            completedTimestamp
          }]
        })
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    processFulfilMessageTest.test('process watchlist with only payee conversion found', async (test) => {
      try {
        const completedTimestamp = new Date().toISOString()
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYEE_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 1,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            fulfilment: 'fulfilment',
            completedTimestamp
          }
        ))
        ParticipantFacade.getByNameAndCurrency.returns(Promise.resolve({
          participantId: 1,
          participantCurrencyId: 1,
          participantName: 'payeeFsp',
          isActive: 1
        }))
        ProxyCache.getProxyParticipantAccountDetails.returns(Promise.resolve(defaultGetProxyParticipantAccountDetailsResponse))
        const result = await Cyril.processFulfilMessage(payload.transferId, payload, payload)
        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.ok(fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.calledWith(fxPayload.commitRequestId))
        test.deepEqual(result, {
          isFx: true,
          positionChanges: [{
            isFxTransferStateChange: false,
            transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
            participantCurrencyId: 1,
            amount: -200
          },
          {
            isFxTransferStateChange: true,
            commitRequestId: '88622a75-5bde-4da4-a6cc-f4cd23b268c4',
            participantCurrencyId: 1,
            amount: -433.88
          }
          ],
          patchNotifications: []
        }
        )
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    processFulfilMessageTest.test('process watchlist with both payer and payee conversion found', async (test) => {
      try {
        const completedTimestamp = new Date().toISOString()
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [
            {
              commitRequestId: fxPayload.commitRequestId,
              determiningTransferId: fxPayload.determiningTransferId,
              fxTransferTypeId: Enum.Fx.FxTransferType.PAYEE_CONVERSION,
              createdDate: new Date()
            },
            {
              commitRequestId: fxPayload.commitRequestId,
              determiningTransferId: fxPayload.determiningTransferId,
              fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
              createdDate: new Date()
            }
          ]
        ))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 1,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            counterPartyFspName: fxPayload.counterPartyFsp,
            fulfilment: 'fulfilment',
            completedTimestamp
          }
        ))
        ParticipantFacade.getByNameAndCurrency.returns(Promise.resolve({
          participantId: 1,
          participantCurrencyId: 1,
          participantName: 'payeeFsp',
          isActive: 1
        }))
        ProxyCache.getProxyParticipantAccountDetails.returns(Promise.resolve(defaultGetProxyParticipantAccountDetailsResponse))
        const result = await Cyril.processFulfilMessage(payload.transferId, payload, payload)
        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.ok(fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.calledWith(fxPayload.commitRequestId))
        test.deepEqual(result, {
          isFx: true,
          positionChanges: [
            {
              isFxTransferStateChange: false,
              transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
              participantCurrencyId: 1,
              amount: -200
            },
            {
              isFxTransferStateChange: true,
              commitRequestId: '88622a75-5bde-4da4-a6cc-f4cd23b268c4',
              participantCurrencyId: 1,
              amount: -433.88
            },
            {
              isFxTransferStateChange: true,
              commitRequestId: '88622a75-5bde-4da4-a6cc-f4cd23b268c4',
              participantCurrencyId: 1,
              amount: -433.88
            }
          ],
          patchNotifications: [{
            commitRequestId: fxPayload.commitRequestId,
            fxpName: fxPayload.counterPartyFsp,
            fulfilment: 'fulfilment',
            completedTimestamp
          }]
        }
        )
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    processFulfilMessageTest.test('process watchlist with only payer conversion found, but payee is a proxy and have no account in the currency', async (test) => {
      try {
        const completedTimestamp = new Date().toISOString()
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 2,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            counterPartyFspName: fxPayload.counterPartyFsp,
            fulfilment: 'fulfilment',
            completedTimestamp
          }
        ))
        ParticipantFacade.getByNameAndCurrency.returns(Promise.resolve({
          participantId: 1,
          participantCurrencyId: 1,
          participantName: 'fx_dfsp1',
          isActive: 1
        }))
        ProxyCache.getProxyParticipantAccountDetails.returns(Promise.resolve({ inScheme: false, participantCurrencyId: null }))
        const result = await Cyril.processFulfilMessage(payload.transferId, payload, payload)
        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.ok(fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.calledWith(fxPayload.commitRequestId))
        test.ok(ProxyCache.getProxyParticipantAccountDetails.calledWith(
          'dfsp2',
          fxPayload.targetAmount.currency
        ))

        test.deepEqual(result, {
          isFx: true,
          positionChanges: [],
          patchNotifications: [{
            commitRequestId: fxPayload.commitRequestId,
            fxpName: fxPayload.counterPartyFsp,
            fulfilment: 'fulfilment',
            completedTimestamp
          }]
        })
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    processFulfilMessageTest.test('process watchlist with only payer conversion found, but payee is a proxy and have account in the currency somehow', async (test) => {
      try {
        const completedTimestamp = new Date().toISOString()
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 2,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            counterPartyFspName: fxPayload.counterPartyFsp,
            fulfilment: 'fulfilment',
            completedTimestamp
          }
        ))
        ParticipantFacade.getByNameAndCurrency.returns(Promise.resolve({
          participantId: 1,
          participantCurrencyId: 1,
          participantName: 'fx_dfsp1',
          isActive: 1
        }))
        ProxyCache.getProxyParticipantAccountDetails.onCall(0).returns(Promise.resolve({ inScheme: false, participantCurrencyId: 234 })) // FXP Source Currency
        ProxyCache.getProxyParticipantAccountDetails.onCall(1).returns(Promise.resolve({ inScheme: false, participantCurrencyId: 456 })) // Payee Target Currency
        ProxyCache.getProxyParticipantAccountDetails.onCall(2).returns(Promise.resolve({ inScheme: false, participantCurrencyId: 345 })) // FXP Target Currency
        const result = await Cyril.processFulfilMessage(payload.transferId, payload, payload)
        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.ok(fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.calledWith(fxPayload.commitRequestId))
        test.ok(ProxyCache.getProxyParticipantAccountDetails.calledWith(
          'dfsp2',
          fxPayload.targetAmount.currency
        ))

        test.deepEqual(result, {
          isFx: true,
          positionChanges: [
            {
              isFxTransferStateChange: true,
              commitRequestId: '88622a75-5bde-4da4-a6cc-f4cd23b268c4',
              participantCurrencyId: 234,
              amount: -433.88
            },
            {
              isFxTransferStateChange: false,
              transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
              participantCurrencyId: 456,
              amount: -200
            }
          ],
          patchNotifications: [{
            commitRequestId: fxPayload.commitRequestId,
            fxpName: fxPayload.counterPartyFsp,
            fulfilment: 'fulfilment',
            completedTimestamp
          }]
        })
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    processFulfilMessageTest.test('process watchlist with only payer conversion found, but payee is a proxy and have account in the currency somehow and it is same as fxp target account', async (test) => {
      try {
        const completedTimestamp = new Date().toISOString()
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 2,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            counterPartyFspName: fxPayload.counterPartyFsp,
            fulfilment: 'fulfilment',
            completedTimestamp
          }
        ))
        ParticipantFacade.getByNameAndCurrency.returns(Promise.resolve({
          participantId: 1,
          participantCurrencyId: 1,
          participantName: 'fx_dfsp1',
          isActive: 1
        }))
        ProxyCache.getProxyParticipantAccountDetails.onCall(0).returns(Promise.resolve({ inScheme: false, participantCurrencyId: 234 })) // FXP Source Currency
        ProxyCache.getProxyParticipantAccountDetails.onCall(1).returns(Promise.resolve({ inScheme: false, participantCurrencyId: 456 })) // Payee Target Currency
        ProxyCache.getProxyParticipantAccountDetails.onCall(2).returns(Promise.resolve({ inScheme: false, participantCurrencyId: 456 })) // FXP Target Currency
        const result = await Cyril.processFulfilMessage(payload.transferId, payload, payload)
        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.ok(fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.calledWith(fxPayload.commitRequestId))
        test.ok(ProxyCache.getProxyParticipantAccountDetails.calledWith(
          'dfsp2',
          fxPayload.targetAmount.currency
        ))

        test.deepEqual(result, {
          isFx: true,
          positionChanges: [
            {
              isFxTransferStateChange: true,
              commitRequestId: '88622a75-5bde-4da4-a6cc-f4cd23b268c4',
              participantCurrencyId: 234,
              amount: -433.88
            }
          ],
          patchNotifications: [{
            commitRequestId: fxPayload.commitRequestId,
            fxpName: fxPayload.counterPartyFsp,
            fulfilment: 'fulfilment',
            completedTimestamp
          }]
        })
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    processFulfilMessageTest.test('process watchlist with only payee conversion found but fxp is proxy and have no account', async (test) => {
      try {
        const completedTimestamp = new Date().toISOString()
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYEE_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 1,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            fulfilment: 'fulfilment',
            completedTimestamp
          }
        ))
        ParticipantFacade.getByNameAndCurrency.returns(Promise.resolve({
          participantId: 1,
          participantCurrencyId: 1,
          participantName: 'payeeFsp',
          isActive: 1
        }))
        ProxyCache.getProxyParticipantAccountDetails.returns(Promise.resolve({ inScheme: false, participantCurrencyId: null }))
        const result = await Cyril.processFulfilMessage(payload.transferId, payload, payload)
        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.ok(fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.calledWith(fxPayload.commitRequestId))
        test.deepEqual(result, {
          isFx: true,
          positionChanges: [],
          patchNotifications: []
        }
        )
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    processFulfilMessageTest.test('process watchlist with only payee conversion found but fxp is proxy and have account in source currency somehow', async (test) => {
      try {
        const completedTimestamp = new Date().toISOString()
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYEE_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 1,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            fulfilment: 'fulfilment',
            completedTimestamp
          }
        ))
        ParticipantFacade.getByNameAndCurrency.returns(Promise.resolve({
          participantId: 1,
          participantCurrencyId: 1,
          participantName: 'payeeFsp',
          isActive: 1
        }))
        ProxyCache.getProxyParticipantAccountDetails.onCall(0).returns(Promise.resolve({ inScheme: false, participantCurrencyId: 456 })) // Payee Target Currency
        ProxyCache.getProxyParticipantAccountDetails.onCall(1).returns(Promise.resolve({ inScheme: false, participantCurrencyId: 234 })) // FXP Source Currency
        ProxyCache.getProxyParticipantAccountDetails.onCall(2).returns(Promise.resolve({ inScheme: false, participantCurrencyId: 123 })) // Payer Source Currency
        const result = await Cyril.processFulfilMessage(payload.transferId, payload, payload)
        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.ok(fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.calledWith(fxPayload.commitRequestId))
        test.deepEqual(result, {
          isFx: true,
          positionChanges: [
            {
              isFxTransferStateChange: false,
              transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
              participantCurrencyId: 456,
              amount: -200
            },
            {
              isFxTransferStateChange: true,
              commitRequestId: '88622a75-5bde-4da4-a6cc-f4cd23b268c4',
              participantCurrencyId: 234,
              amount: -433.88
            }
          ],
          patchNotifications: []
        }
        )
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    processFulfilMessageTest.test('process watchlist with only payee conversion found but fxp is proxy and have account in source currency somehow and it is same as payer account', async (test) => {
      try {
        const completedTimestamp = new Date().toISOString()
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYEE_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 1,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            fulfilment: 'fulfilment',
            completedTimestamp
          }
        ))
        ParticipantFacade.getByNameAndCurrency.returns(Promise.resolve({
          participantId: 1,
          participantCurrencyId: 1,
          participantName: 'payeeFsp',
          isActive: 1
        }))
        ProxyCache.getProxyParticipantAccountDetails.onCall(0).returns(Promise.resolve({ inScheme: false, participantCurrencyId: 456 })) // Payee Target Currency
        ProxyCache.getProxyParticipantAccountDetails.onCall(1).returns(Promise.resolve({ inScheme: false, participantCurrencyId: 234 })) // FXP Source Currency
        ProxyCache.getProxyParticipantAccountDetails.onCall(2).returns(Promise.resolve({ inScheme: false, participantCurrencyId: 234 })) // Payer Source Currency
        const result = await Cyril.processFulfilMessage(payload.transferId, payload, payload)
        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.ok(fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.calledWith(fxPayload.commitRequestId))
        test.deepEqual(result, {
          isFx: true,
          positionChanges: [
            {
              isFxTransferStateChange: false,
              transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
              participantCurrencyId: 456,
              amount: -200
            }
          ],
          patchNotifications: []
        }
        )
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })

    processFulfilMessageTest.test('process watchlist with both payer and payee conversion found, but derived currencyId is null', async (test) => {
      try {
        const completedTimestamp = new Date().toISOString()
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [
            {
              commitRequestId: fxPayload.commitRequestId,
              determiningTransferId: fxPayload.determiningTransferId,
              fxTransferTypeId: Enum.Fx.FxTransferType.PAYEE_CONVERSION,
              createdDate: new Date()
            },
            {
              commitRequestId: fxPayload.commitRequestId,
              determiningTransferId: fxPayload.determiningTransferId,
              fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
              createdDate: new Date()
            }
          ]
        ))
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 1,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency,
            counterPartyFspName: fxPayload.counterPartyFsp,
            fulfilment: 'fulfilment',
            completedTimestamp
          }
        ))
        ParticipantFacade.getByNameAndCurrency.returns(Promise.resolve({
          participantId: 1,
          participantCurrencyId: 1,
          participantName: 'payeeFsp',
          isActive: 1
        }))
        ProxyCache.getProxyParticipantAccountDetails.returns(Promise.resolve({ inScheme: true, participantCurrencyId: null }))
        const result = await Cyril.processFulfilMessage(payload.transferId, payload, payload)
        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.ok(fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.calledWith(fxPayload.commitRequestId))
        test.deepEqual(result, {
          isFx: true,
          positionChanges: [],
          patchNotifications: [{
            commitRequestId: fxPayload.commitRequestId,
            fxpName: fxPayload.counterPartyFsp,
            fulfilment: 'fulfilment',
            completedTimestamp
          }]
        }
        )
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        console.log(e)
        test.fail('Error Thrown')
        test.end()
      }
    })
    processFulfilMessageTest.end()
  })

  cyrilTest.test('processAbortMessage should', processAbortMessageTest => {
    processAbortMessageTest.test('return false if transferId is not in watchlist', async (test) => {
      try {
        fxTransfer.getByDeterminingTransferId.returns(Promise.resolve([
          { commitRequestId: fxPayload.commitRequestId }
        ]))
        // Mocks for _getPositionChnages
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.returns(Promise.resolve({
          initiatingFspName: fxPayload.initiatingFsp
        }))
        ParticipantPositionChangesModel.getReservedPositionChangesByCommitRequestId.returns(Promise.resolve([
          {
            participantCurrencyId: 1,
            change: payload.amount.amount
          }
        ]))
        TransferFacade.getById.returns(Promise.resolve({
          payerFsp: payload.payerFsp
        }))
        ParticipantPositionChangesModel.getReservedPositionChangesByTransferId.returns(Promise.resolve([
          {
            participantCurrencyId: 1,
            change: payload.amount.amount
          }
        ]))

        const result = await Cyril.processAbortMessage(payload.transferId)

        test.deepEqual(result, {
          positionChanges: [
            {
              isFxTransferStateChange: true,
              isOriginalId: false,
              commitRequestId: '88622a75-5bde-4da4-a6cc-f4cd23b268c4',
              notifyTo: 'fx_dfsp1',
              participantCurrencyId: 1,
              amount: -433.88
            },
            {
              isFxTransferStateChange: false,
              isOriginalId: true,
              transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
              notifyTo: 'dfsp1',
              participantCurrencyId: 1,
              amount: -433.88
            }
          ],
          transferStateChanges: []
        })
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    processAbortMessageTest.test('return transferStateChanges if no position changes but has commitRequestId', async (test) => {
      try {
        fxTransfer.getByDeterminingTransferId.returns(Promise.resolve([
          { commitRequestId: fxPayload.commitRequestId }
        ]))
        // Mocks for _getPositionChnages
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.returns(Promise.resolve({
          initiatingFspName: fxPayload.initiatingFsp
        }))
        ParticipantPositionChangesModel.getReservedPositionChangesByCommitRequestId.returns(Promise.resolve([]))
        TransferFacade.getById.returns(Promise.resolve({
          payerFsp: payload.payerFsp,
          payeeIsProxy: true
        }))
        ParticipantPositionChangesModel.getReservedPositionChangesByTransferId.returns(Promise.resolve([]))

        const result = await Cyril.processAbortMessage(payload.transferId)

        test.deepEqual(result, {
          positionChanges: [],
          transferStateChanges: [
            {
              isOriginalId: true,
              notifyTo: 'dfsp1',
              reason: null,
              transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
              transferStateId: Enum.Transfers.TransferInternalState.ABORTED_ERROR
            }
          ]
        })
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    processAbortMessageTest.end()
  })

  cyrilTest.test('processFxAbortMessage should', processFxAbortMessageTest => {
    processFxAbortMessageTest.test('return false if transferId is not in watchlist', async (test) => {
      try {
        fxTransfer.getByCommitRequestId.returns(Promise.resolve({
          determiningTransferId: fxPayload.determiningTransferId
        }))
        fxTransfer.getByDeterminingTransferId.returns(Promise.resolve([
          { commitRequestId: fxPayload.commitRequestId }
        ]))
        // Mocks for _getPositionChnages
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.returns(Promise.resolve({
          initiatingFspName: fxPayload.initiatingFsp
        }))
        ParticipantPositionChangesModel.getReservedPositionChangesByCommitRequestId.returns(Promise.resolve([
          {
            participantCurrencyId: 1,
            change: payload.amount.amount
          }
        ]))
        TransferFacade.getById.returns(Promise.resolve({
          payerFsp: payload.payerFsp
        }))
        ParticipantPositionChangesModel.getReservedPositionChangesByTransferId.returns(Promise.resolve([
          {
            participantCurrencyId: 1,
            change: payload.amount.amount
          }
        ]))

        const result = await Cyril.processFxAbortMessage(fxPayload.commitRequestId)

        test.deepEqual(result, {
          positionChanges: [{
            isFxTransferStateChange: true,
            isOriginalId: true,
            commitRequestId: fxPayload.commitRequestId,
            notifyTo: 'fx_dfsp1',
            participantCurrencyId: 1,
            amount: -433.88
          }, {
            isFxTransferStateChange: false,
            isOriginalId: false,
            transferId: payload.transferId,
            notifyTo: 'dfsp1',
            participantCurrencyId: 1,
            amount: -433.88
          }],
          transferStateChanges: []
        })
        test.pass('Error not thrown')
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    processFxAbortMessageTest.end()
  })

  cyrilTest.end()
})
