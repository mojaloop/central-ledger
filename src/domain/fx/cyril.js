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
 * Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 ******/

'use strict'

const Metrics = require('@mojaloop/central-services-metrics')
const { Enum } = require('@mojaloop/central-services-shared')
const TransferModel = require('../../models/transfer/transfer')
const ParticipantFacade = require('../../models/participant/facade')
const { fxTransfer, watchList } = require('../../models/fxTransfer')

const getParticipantAndCurrencyForTransferMessage = async (payload) => {
  const histTimerGetParticipantAndCurrencyForTransferMessage = Metrics.getHistogram(
    'fx_domain_cyril_getParticipantAndCurrencyForTransferMessage',
    'fx_domain_cyril_getParticipantAndCurrencyForTransferMessage - Metrics for fx cyril',
    ['success', 'determiningTransferExists']
  ).startTimer()
  // Does this determining transfer ID appear on the watch list?
  const watchListRecords = await watchList.getItemsInWatchListByDeterminingTransferId(payload.transferId)
  const determiningTransferExistsInWatchList = (watchListRecords !== null && watchListRecords.length > 0)

  let participantName, currencyId, amount

  if (determiningTransferExistsInWatchList) {
    // If there's a currency conversion before the transfer is requested, it must be the debtor who did it.
    // Get the FX request corresponding to this transaction ID
    // TODO: Can't we just use the following query in the first place above to check if the determining transfer exists instead of using the watch list?
    // const fxTransferRecord = await fxTransfer.getByDeterminingTransferId(payload.transferId)
    const fxTransferRecord = await fxTransfer.getAllDetailsByCommitRequestId(watchListRecords[0].commitRequestId)
    // Liquidity check and reserve funds against FXP in FX target currency
    participantName = fxTransferRecord.counterPartyFspName
    currencyId = fxTransferRecord.targetCurrency
    amount = fxTransferRecord.targetAmount
    // TODO: May need to remove the following
    // Add to watch list
    // await watchList.addToWatchList({
    //   commitRequestId: fxTransferRecord.commitRequestId,
    //   determiningTransferId: fxTransferRecord.determiningTransferId
    // })
  } else {
    // Normal transfer request
    // Liquidity check and reserve against payer
    participantName = payload.payerFsp
    currencyId = payload.amount.currency
    amount = payload.amount.amount
  }

  histTimerGetParticipantAndCurrencyForTransferMessage({ success: true, determiningTransferExists: determiningTransferExistsInWatchList })
  return {
    participantName,
    currencyId,
    amount
  }
}

const getParticipantAndCurrencyForFxTransferMessage = async (payload) => {
  const histTimerGetParticipantAndCurrencyForFxTransferMessage = Metrics.getHistogram(
    'fx_domain_cyril_getParticipantAndCurrencyForFxTransferMessage',
    'fx_domain_cyril_getParticipantAndCurrencyForFxTransferMessage - Metrics for fx cyril',
    ['success', 'determiningTransferExists']
  ).startTimer()
  // Does this determining transfer ID appear on the transfer list?
  const transferRecord = await TransferModel.getById(payload.determiningTransferId)
  const determiningTransferExistsInTransferList = (transferRecord !== null)

  let participantName, currencyId, amount

  if (determiningTransferExistsInTransferList) {
    // If there's a currency conversion which is not the first message, then it must be issued by the creditor party
    // Liquidity check and reserve funds against FXP in FX target currency
    participantName = payload.counterPartyFsp
    currencyId = payload.targetAmount.currency
    amount = payload.targetAmount.amount
    await watchList.addToWatchList({
      commitRequestId: payload.commitRequestId,
      determiningTransferId: payload.determiningTransferId,
      fxTransferTypeId: Enum.Fx.FxTransferType.PAYEE_CONVERSION
    })
  } else {
    // If there's a currency conversion before the transfer is requested, then it must be issued by the debtor party
    // Liquidity check and reserve funds against requester in FX source currency
    participantName = payload.initiatingFsp
    currencyId = payload.sourceAmount.currency
    amount = payload.sourceAmount.amount
    await watchList.addToWatchList({
      commitRequestId: payload.commitRequestId,
      determiningTransferId: payload.determiningTransferId,
      fxTransferTypeId: Enum.Fx.FxTransferType.PAYER_CONVERSION
    })
  }

  histTimerGetParticipantAndCurrencyForFxTransferMessage({ success: true, determiningTransferExists: determiningTransferExistsInTransferList })
  return {
    participantName,
    currencyId,
    amount
  }
}

const processFxFulfilMessage = async (commitRequestId, payload) => {
  const histTimerGetParticipantAndCurrencyForFxTransferMessage = Metrics.getHistogram(
    'fx_domain_cyril_processFxFulfilMessage',
    'fx_domain_cyril_processFxFulfilMessage - Metrics for fx cyril',
    ['success']
  ).startTimer()
  // Does this commitRequestId appear on the watch list?
  const watchListRecord = await watchList.getItemInWatchListByCommitRequestId(commitRequestId)
  if (!watchListRecord) {
    throw new Error(`Commit request ID ${commitRequestId} not found in watch list`)
  }
  const fxTransferRecord = await fxTransfer.getAllDetailsByCommitRequestId(commitRequestId)
  const {
    initiatingFspParticipantCurrencyId,
    initiatingFspParticipantId,
    initiatingFspName,
    counterPartyFspSourceParticipantCurrencyId,
    counterPartyFspTargetParticipantCurrencyId,
    counterPartyFspParticipantId,
    counterPartyFspName
  } = fxTransferRecord

  // TODO: May need to update the watchList record to indicate that the fxTransfer has been fulfilled

  histTimerGetParticipantAndCurrencyForFxTransferMessage({ success: true })
  return {
    initiatingFspParticipantCurrencyId,
    initiatingFspParticipantId,
    initiatingFspName,
    counterPartyFspSourceParticipantCurrencyId,
    counterPartyFspTargetParticipantCurrencyId,
    counterPartyFspParticipantId,
    counterPartyFspName
  }
}

const processFulfilMessage = async (transferId, payload, transfer) => {
  const histTimerGetParticipantAndCurrencyForFxTransferMessage = Metrics.getHistogram(
    'fx_domain_cyril_processFulfilMessage',
    'fx_domain_cyril_processFulfilMessage - Metrics for fx cyril',
    ['success']
  ).startTimer()
  // Let's define a format for the function result
  const result = {
    isFx: false,
    positionChanges: [],
    patchNotifications: []
  }

  // Does this transferId appear on the watch list?
  const watchListRecords = await watchList.getItemsInWatchListByDeterminingTransferId(transferId)
  if (watchListRecords && watchListRecords.length > 0) {
    result.isFx = true

    // TODO: Sense check: Are all entries on the watchlist marked as RESERVED?

    // Loop around watch list
    let sendingFxpExists = false
    let receivingFxpExists = false
    let sendingFxpRecord = null
    let receivingFxpRecord = null
    for (const watchListRecord of watchListRecords) {
      const fxTransferRecord = await fxTransfer.getAllDetailsByCommitRequestId(watchListRecord.commitRequestId)
      // Original Plan: If the reservation is against the FXP, then this is a conversion at the creditor. Mark FXP as receiving FXP
      // The above condition is not required as we are setting the fxTransferType in the watchList beforehand
      if (watchListRecord.fxTransferTypeId === Enum.Fx.FxTransferType.PAYEE_CONVERSION) {
        receivingFxpExists = true
        receivingFxpRecord = fxTransferRecord
        // Create obligation between FXP and FX requesting party in currency of reservation
        result.positionChanges.push({
          isFxTransferStateChange: false,
          transferId,
          participantCurrencyId: fxTransferRecord.initiatingFspParticipantCurrencyId,
          amount: -fxTransferRecord.targetAmount
        })
        // TODO: Send PATCH notification to FXP
      }

      // Original Plan: If the reservation is against the DFSP, then this is a conversion at the debtor. Mark FXP as sending FXP
      // The above condition is not required as we are setting the fxTransferType in the watchList beforehand
      if (watchListRecord.fxTransferTypeId === Enum.Fx.FxTransferType.PAYER_CONVERSION) {
        sendingFxpExists = true
        sendingFxpRecord = fxTransferRecord
        // Create obligation between FX requesting party and FXP in currency of reservation
        result.positionChanges.push({
          isFxTransferStateChange: true,
          commitRequestId: fxTransferRecord.commitRequestId,
          participantCurrencyId: fxTransferRecord.counterPartyFspSourceParticipantCurrencyId,
          amount: -fxTransferRecord.sourceAmount
        })
        // TODO: Send PATCH notification to FXP
      }
    }

    if (!sendingFxpExists && !receivingFxpExists) {
      // If there are no sending and receiving fxp, throw an error
      throw new Error(`Required records not found in watch list for transfer ID ${transferId}`)
    }

    if (sendingFxpExists && receivingFxpExists) {
      // If we have both a sending and a receiving FXP, Create obligation between sending and receiving FXP in currency of transfer.
      result.positionChanges.push({
        isFxTransferStateChange: true,
        commitRequestId: receivingFxpRecord.commitRequestId,
        participantCurrencyId: receivingFxpRecord.counterPartyFspSourceParticipantCurrencyId,
        amount: -receivingFxpRecord.sourceAmount
      })
    } else if (sendingFxpExists) {
      // If we have a sending FXP, Create obligation between FXP and creditor party to the transfer in currency of FX transfer
      // Get participantCurrencyId for transfer.payeeParticipantId/transfer.payeeFsp and sendingFxpRecord.targetCurrency
      const participantCurrency = await ParticipantFacade.getByNameAndCurrency(
        transfer.payeeFsp,
        sendingFxpRecord.targetCurrency,
        Enum.Accounts.LedgerAccountType.POSITION
      )
      result.positionChanges.push({
        isFxTransferStateChange: false,
        transferId,
        participantCurrencyId: participantCurrency.participantCurrencyId,
        amount: -sendingFxpRecord.targetAmount
      })
    } else if (receivingFxpExists) {
      // If we have a receiving FXP, Create obligation between debtor party to the transfer and FXP in currency of transfer
      result.positionChanges.push({
        isFxTransferStateChange: true,
        commitRequestId: receivingFxpRecord.commitRequestId,
        participantCurrencyId: receivingFxpRecord.counterPartyFspSourceParticipantCurrencyId,
        amount: -receivingFxpRecord.sourceAmount
      })
    }

    // TODO: Remove entries from watchlist
  } else {
    // Normal transfer request, just return isFx = false
  }

  histTimerGetParticipantAndCurrencyForFxTransferMessage({ success: true })
  return result
}

module.exports = {
  getParticipantAndCurrencyForTransferMessage,
  getParticipantAndCurrencyForFxTransferMessage,
  processFxFulfilMessage,
  processFulfilMessage
}
