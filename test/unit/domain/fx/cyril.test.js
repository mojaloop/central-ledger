'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Cyril = require('../../../../src/domain/fx/cyril')
const Logger = require('@mojaloop/central-services-logger')
const { Enum } = require('@mojaloop/central-services-shared')
const TransferModel = require('../../../../src/models/transfer/transfer')
const TransferFacade = require('../../../../src/models/transfer/facade')
const ParticipantFacade = require('../../../../src/models/participant/facade')
const ParticipantPositionChangesModel = require('../../../../src/models/position/participantPositionChanges')
const { fxTransfer, watchList } = require('../../../../src/models/fxTransfer')
const ProxyCache = require('../../../../src/lib/proxyCache')

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
      determiningTransferId: 'c05c3f31-33b5-4e33-8bfd-7c3a2685fb6c',
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
        const determiningTransferCheckResult = await Cyril.checkIfDeterminingTransferExistsForTransferMessage(payload)
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
        const determiningTransferCheckResult = await Cyril.checkIfDeterminingTransferExistsForTransferMessage(payload)
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
        const determiningTransferCheckResult = await Cyril.checkIfDeterminingTransferExistsForTransferMessage(payload)
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
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestId.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 2,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency
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
        test.ok(fxTransfer.getAllDetailsByCommitRequestId.calledWith(fxPayload.commitRequestId))
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
          patchNotifications: []
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
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYEE_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestId.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 1,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency
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
        test.ok(fxTransfer.getAllDetailsByCommitRequestId.calledWith(fxPayload.commitRequestId))
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
        fxTransfer.getAllDetailsByCommitRequestId.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 1,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency
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
        test.ok(fxTransfer.getAllDetailsByCommitRequestId.calledWith(fxPayload.commitRequestId))
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

    processFulfilMessageTest.test('process watchlist with only payer conversion found, but payee is a proxy and have no account in the currency', async (test) => {
      try {
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestId.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 2,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency
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
        test.ok(fxTransfer.getAllDetailsByCommitRequestId.calledWith(fxPayload.commitRequestId))
        test.ok(ProxyCache.getProxyParticipantAccountDetails.calledWith(
          'dfsp2',
          fxPayload.targetAmount.currency
        ))

        test.deepEqual(result, {
          isFx: true,
          positionChanges: [],
          patchNotifications: []
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
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestId.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 2,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency
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
        test.ok(fxTransfer.getAllDetailsByCommitRequestId.calledWith(fxPayload.commitRequestId))
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
          patchNotifications: []
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
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestId.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 2,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency
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
        test.ok(fxTransfer.getAllDetailsByCommitRequestId.calledWith(fxPayload.commitRequestId))
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
          patchNotifications: []
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
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYEE_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestId.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 1,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency
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
        test.ok(fxTransfer.getAllDetailsByCommitRequestId.calledWith(fxPayload.commitRequestId))
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
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYEE_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestId.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 1,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency
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
        test.ok(fxTransfer.getAllDetailsByCommitRequestId.calledWith(fxPayload.commitRequestId))
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
        watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(
          [{
            commitRequestId: fxPayload.commitRequestId,
            determiningTransferId: fxPayload.determiningTransferId,
            fxTransferTypeId: Enum.Fx.FxTransferType.PAYEE_CONVERSION,
            createdDate: new Date()
          }]
        ))
        fxTransfer.getAllDetailsByCommitRequestId.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 1,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency
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
        test.ok(fxTransfer.getAllDetailsByCommitRequestId.calledWith(fxPayload.commitRequestId))
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
        fxTransfer.getAllDetailsByCommitRequestId.returns(Promise.resolve(
          {
            initiatingFspParticipantId: 1,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency
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
        test.ok(fxTransfer.getAllDetailsByCommitRequestId.calledWith(fxPayload.commitRequestId))
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
          initiatingFspName: fxPayload.initiatingFsp,
        }))
        ParticipantPositionChangesModel.getReservedPositionChangesByCommitRequestId.returns(Promise.resolve([
          {
            participantCurrencyId: 1,
            value: payload.amount.amount
          }
        ]))
        TransferFacade.getById.returns(Promise.resolve({
          payerFsp: payload.payerFsp,
        }))
        ParticipantPositionChangesModel.getReservedPositionChangesByTransferId.returns(Promise.resolve([
          {
            participantCurrencyId: 1,
            value: payload.amount.amount
          }
        ]))

        const result = await Cyril.processAbortMessage(payload.transferId)

        test.deepEqual(result, { positionChanges: [ { isFxTransferStateChange: true, commitRequestId: '88622a75-5bde-4da4-a6cc-f4cd23b268c4', notifyTo: 'fx_dfsp1', participantCurrencyId: 1, amount: -433.88 }, { isFxTransferStateChange: false, transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999', notifyTo: 'dfsp1', participantCurrencyId: 1, amount: -433.88 } ] })
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
            determiningTransferId: fxPayload.determiningTransferId,
        }))
        fxTransfer.getByDeterminingTransferId.returns(Promise.resolve([
            { commitRequestId: fxPayload.commitRequestId }
        ]))
        // Mocks for _getPositionChnages
        fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer.returns(Promise.resolve({
          initiatingFspName: fxPayload.initiatingFsp,
        }))
        ParticipantPositionChangesModel.getReservedPositionChangesByCommitRequestId.returns(Promise.resolve([
          {
            participantCurrencyId: 1,
            value: payload.amount.amount
          }
        ]))
        TransferFacade.getById.returns(Promise.resolve({
          payerFsp: payload.payerFsp,
        }))
        ParticipantPositionChangesModel.getReservedPositionChangesByTransferId.returns(Promise.resolve([
          {
            participantCurrencyId: 1,
            value: payload.amount.amount
          }
        ]))

        const result = await Cyril.processFxAbortMessage(payload.transferId)

        test.deepEqual(result, { positionChanges: [ { isFxTransferStateChange: true, commitRequestId: '88622a75-5bde-4da4-a6cc-f4cd23b268c4', notifyTo: 'fx_dfsp1', participantCurrencyId: 1, amount: -433.88 }, { isFxTransferStateChange: false, transferId: 'c05c3f31-33b5-4e33-8bfd-7c3a2685fb6c', notifyTo: 'dfsp1', participantCurrencyId: 1, amount: -433.88 } ] })
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
