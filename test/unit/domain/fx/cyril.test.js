'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Cyril = require('../../../../src/domain/fx/cyril')
const Logger = require('@mojaloop/central-services-logger')
const { Enum } = require('@mojaloop/central-services-shared')
const TransferModel = require('../../../../src/models/transfer/transfer')
const ParticipantFacade = require('../../../../src/models/participant/facade')
const { fxTransfer, watchList } = require('../../../../src/models/fxTransfer')

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
        const result = await Cyril.getParticipantAndCurrencyForTransferMessage(payload)

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
        const result = await Cyril.getParticipantAndCurrencyForTransferMessage(payload)

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
    getParticipantAndCurrencyForTransferMessageTest.end()
  })

  cyrilTest.test('getParticipantAndCurrencyForFxTransferMessage should', getParticipantAndCurrencyForFxTransferMessageTest => {
    getParticipantAndCurrencyForFxTransferMessageTest.test('return details about fxtransfer debtor party initited msg', async (test) => {
      try {
        TransferModel.getById.returns(Promise.resolve(null))
        const result = await Cyril.getParticipantAndCurrencyForFxTransferMessage(fxPayload)

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
        test.fail('Error Thrown')
        test.end()
      }
    })

    getParticipantAndCurrencyForFxTransferMessageTest.test('return details about fxtransfer creditor party initited msg', async (test) => {
      try {
        TransferModel.getById.returns(Promise.resolve({}))
        await Cyril.getParticipantAndCurrencyForFxTransferMessage(fxPayload)

        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.equal(e.message, 'Payee FX conversion not implemented')
        test.pass('Error Thrown')
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

    processFxFulfilMessageTest.test('should return fxTransferRecord when commitRequestId is in watchlist', async (test) => {
      try {
        const fxTransferRecordDetails = {
          initiatingFspParticipantCurrencyId: 1,
          initiatingFspParticipantId: 1,
          initiatingFspName: 'fx_dfsp1',
          counterPartyFspSourceParticipantCurrencyId: 1,
          counterPartyFspTargetParticipantCurrencyId: 2,
          counterPartyFspParticipantId: 2,
          counterPartyFspName: 'fx_dfsp2'
        }
        watchList.getItemInWatchListByCommitRequestId.returns(Promise.resolve({
          commitRequestId: fxPayload.commitRequestId,
          determiningTransferId: fxPayload.determiningTransferId,
          fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION,
          createdDate: new Date()
        }))
        fxTransfer.getAllDetailsByCommitRequestId.returns(Promise.resolve(fxTransferRecordDetails))
        const result = await Cyril.processFxFulfilMessage(fxPayload.commitRequestId)
        test.ok(watchList.getItemInWatchListByCommitRequestId.calledWith(fxPayload.commitRequestId))
        test.ok(fxTransfer.getAllDetailsByCommitRequestId.calledWith(fxPayload.commitRequestId))
        test.deepEqual(result, fxTransferRecordDetails)
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
            initiatingFspParticipantCurrencyId: 1,
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
        const result = await Cyril.processFulfilMessage(payload.transferId, payload, payload)
        test.ok(watchList.getItemsInWatchListByDeterminingTransferId.calledWith(payload.transferId))
        test.ok(fxTransfer.getAllDetailsByCommitRequestId.calledWith(fxPayload.commitRequestId))
        test.ok(ParticipantFacade.getByNameAndCurrency.calledWith(
          'dfsp2',
          fxPayload.targetAmount.currency,
          Enum.Accounts.LedgerAccountType.POSITION
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
            initiatingFspParticipantCurrencyId: 1,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency
          }
        ))
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
            initiatingFspParticipantCurrencyId: 1,
            targetAmount: fxPayload.targetAmount.amount,
            commitRequestId: fxPayload.commitRequestId,
            counterPartyFspSourceParticipantCurrencyId: 1,
            counterPartyFspTargetParticipantCurrencyId: 2,
            sourceAmount: fxPayload.sourceAmount.amount,
            targetCurrency: fxPayload.targetAmount.currency
          }
        ))
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
    processFulfilMessageTest.end()
  })

  cyrilTest.end()
})
