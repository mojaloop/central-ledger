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
const TransferFacade = require('../../models/transfer/facade')
const ParticipantPositionChangesModel = require('../../models/position/participantPositionChanges')
const { fxTransfer, watchList } = require('../../models/fxTransfer')
const Config = require('../../lib/config')
const ProxyCache = require('../../lib/proxyCache')

const checkIfDeterminingTransferExistsForTransferMessage = async (payload, proxyObligation) => {
  // Does this determining transfer ID appear on the watch list?
  const watchListRecords = await watchList.getItemsInWatchListByDeterminingTransferId(payload.transferId)
  const determiningTransferExistsInWatchList = (watchListRecords !== null && watchListRecords.length > 0)
  // Create a list of participants and currencies to validate against
  const participantCurrencyValidationList = []
  if (determiningTransferExistsInWatchList) {
    // If there's a currency conversion before the transfer is requested, it must be the debtor who did it.
    if (!proxyObligation.isCounterPartyFspProxy) {
      participantCurrencyValidationList.push({
        participantName: payload.payeeFsp,
        currencyId: payload.amount.currency
      })
    }
  } else {
    // Normal transfer request or payee side currency conversion
    if (!proxyObligation.isInitiatingFspProxy) {
      participantCurrencyValidationList.push({
        participantName: payload.payerFsp,
        currencyId: payload.amount.currency
      })
    }
    // If it is a normal transfer, we need to validate payeeFsp against the currency of the transfer.
    // But its tricky to differentiate between normal transfer and payee side currency conversion.
    if (Config.PAYEE_PARTICIPANT_CURRENCY_VALIDATION_ENABLED) {
      if (!proxyObligation.isCounterPartyFspProxy) {
        participantCurrencyValidationList.push({
          participantName: payload.payeeFsp,
          currencyId: payload.amount.currency
        })
      }
    }
  }
  return {
    determiningTransferExistsInWatchList,
    watchListRecords,
    participantCurrencyValidationList
  }
}

const checkIfDeterminingTransferExistsForFxTransferMessage = async (payload, proxyObligation) => {
  // Does this determining transfer ID appear on the transfer list?
  const transferRecord = await TransferModel.getById(payload.determiningTransferId)
  const determiningTransferExistsInTransferList = (transferRecord !== null)
  // We need to validate counterPartyFsp (FXP) against both source and target currencies anyway
  const participantCurrencyValidationList = [
    {
      participantName: payload.counterPartyFsp,
      currencyId: payload.sourceAmount.currency
    }
  ]
  // If a proxy is representing a FXP in a jurisdictional scenario,
  // they would not hold a position account for the `targetAmount` currency
  // for a /fxTransfer. So we skip adding this to accounts to be validated.
  if (!proxyObligation.isCounterPartyFspProxy) {
    participantCurrencyValidationList.push({
      participantName: payload.counterPartyFsp,
      currencyId: payload.targetAmount.currency
    })
  }
  if (determiningTransferExistsInTransferList) {
    // If there's a currency conversion which is not the first message, then it must be issued by the creditor party
    participantCurrencyValidationList.push({
      participantName: payload.initiatingFsp,
      currencyId: payload.targetAmount.currency
    })
  } else {
    // If there's a currency conversion before the transfer is requested, then it must be issued by the debtor party
    participantCurrencyValidationList.push({
      participantName: payload.initiatingFsp,
      currencyId: payload.sourceAmount.currency
    })
  }
  return {
    determiningTransferExistsInTransferList,
    transferRecord,
    participantCurrencyValidationList
  }
}

const getParticipantAndCurrencyForTransferMessage = async (payload, determiningTransferCheckResult, proxyObligation) => {
  const histTimer = Metrics.getHistogram(
    'fx_domain_cyril_getParticipantAndCurrencyForTransferMessage',
    'fx_domain_cyril_getParticipantAndCurrencyForTransferMessage - Metrics for fx cyril',
    ['success', 'determiningTransferExists']
  ).startTimer()

  let participantName, currencyId, amount

  if (determiningTransferCheckResult.determiningTransferExistsInWatchList) {
    // If there's a currency conversion before the transfer is requested, it must be the debtor who did it.
    // Get the FX request corresponding to this transaction ID
    let fxTransferRecord
    if (proxyObligation.isCounterPartyFspProxy) {
      // If a proxy is representing a FXP in a jurisdictional scenario,
      // they would not hold a position account for the `targetAmount` currency
      // for a /fxTransfer. So we skip adding this to accounts to be validated.
      fxTransferRecord = await fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer(determiningTransferCheckResult.watchListRecords[0].commitRequestId)
    } else {
      fxTransferRecord = await fxTransfer.getAllDetailsByCommitRequestId(determiningTransferCheckResult.watchListRecords[0].commitRequestId)
    }

    // Liquidity check and reserve funds against FXP in FX target currency
    participantName = fxTransferRecord.counterPartyFspName
    currencyId = fxTransferRecord.targetCurrency
    amount = fxTransferRecord.targetAmount
  } else {
    // Normal transfer request or payee side currency conversion
    // Liquidity check and reserve against payer
    participantName = payload.payerFsp
    currencyId = payload.amount.currency
    amount = payload.amount.amount
  }

  histTimer({ success: true, determiningTransferExists: determiningTransferCheckResult.determiningTransferExistsInWatchList })
  return {
    participantName,
    currencyId,
    amount
  }
}

const getParticipantAndCurrencyForFxTransferMessage = async (payload, determiningTransferCheckResult) => {
  const histTimer = Metrics.getHistogram(
    'fx_domain_cyril_getParticipantAndCurrencyForFxTransferMessage',
    'fx_domain_cyril_getParticipantAndCurrencyForFxTransferMessage - Metrics for fx cyril',
    ['success', 'determiningTransferExists']
  ).startTimer()

  let participantName, currencyId, amount

  if (determiningTransferCheckResult.determiningTransferExistsInTransferList) {
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

  histTimer({ success: true, determiningTransferExists: determiningTransferCheckResult.determiningTransferExistsInTransferList })
  return {
    participantName,
    currencyId,
    amount
  }
}

const processFxFulfilMessage = async (commitRequestId) => {
  const histTimer = Metrics.getHistogram(
    'fx_domain_cyril_processFxFulfilMessage',
    'fx_domain_cyril_processFxFulfilMessage - Metrics for fx cyril',
    ['success']
  ).startTimer()
  // Does this commitRequestId appear on the watch list?
  const watchListRecord = await watchList.getItemInWatchListByCommitRequestId(commitRequestId)
  if (!watchListRecord) {
    throw new Error(`Commit request ID ${commitRequestId} not found in watch list`)
  }

  // TODO: May need to update the watchList record to indicate that the fxTransfer has been fulfilled

  histTimer({ success: true })
  return true
}

const _getPositionChanges = async (commitRequestIdList, transferIdList) => {
  const positionChanges = []
  for (const commitRequestId of commitRequestIdList) {
    const fxRecord = await fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer(commitRequestId)
    const fxPositionChanges = await ParticipantPositionChangesModel.getReservedPositionChangesByCommitRequestId(commitRequestId)
    fxPositionChanges.forEach((fxPositionChange) => {
      positionChanges.push({
        isFxTransferStateChange: true,
        commitRequestId,
        notifyTo: fxRecord.initiatingFspName,
        participantCurrencyId: fxPositionChange.participantCurrencyId,
        amount: -fxPositionChange.change
      })
    })
  }

  for (const transferId of transferIdList) {
    const transferRecord = await TransferFacade.getById(transferId)
    const transferPositionChanges = await ParticipantPositionChangesModel.getReservedPositionChangesByTransferId(transferId)
    transferPositionChanges.forEach((transferPositionChange) => {
      positionChanges.push({
        isFxTransferStateChange: false,
        transferId,
        notifyTo: transferRecord.payerFsp,
        participantCurrencyId: transferPositionChange.participantCurrencyId,
        amount: -transferPositionChange.change
      })
    })
  }
  return positionChanges
}

const processFxAbortMessage = async (commitRequestId) => {
  const histTimer = Metrics.getHistogram(
    'fx_domain_cyril_processFxAbortMessage',
    'fx_domain_cyril_processFxAbortMessage - Metrics for fx cyril',
    ['success']
  ).startTimer()

  // Get the fxTransfer record
  const fxTransferRecord = await fxTransfer.getByCommitRequestId(commitRequestId)
  // const fxTransferRecord = await fxTransfer.getAllDetailsByCommitRequestId(commitRequestId)
  // Incase of reference currency, there might be multiple fxTransfers associated with a transfer.
  const relatedFxTransferRecords = await fxTransfer.getByDeterminingTransferId(fxTransferRecord.determiningTransferId)

  // Get position changes
  const positionChanges = await _getPositionChanges(relatedFxTransferRecords.map(item => item.commitRequestId), [fxTransferRecord.determiningTransferId])

  histTimer({ success: true })
  return {
    positionChanges
  }
}

const processAbortMessage = async (transferId) => {
  const histTimer = Metrics.getHistogram(
    'fx_domain_cyril_processAbortMessage',
    'fx_domain_cyril_processAbortMessage - Metrics for fx cyril',
    ['success']
  ).startTimer()

  // Get all related fxTransfers
  const relatedFxTransferRecords = await fxTransfer.getByDeterminingTransferId(transferId)

  // Get position changes
  const positionChanges = await _getPositionChanges(relatedFxTransferRecords.map(item => item.commitRequestId), [transferId])

  histTimer({ success: true })
  return {
    positionChanges
  }
}

const processFulfilMessage = async (transferId, payload, transfer) => {
  const histTimer = Metrics.getHistogram(
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
      const fxTransferRecord = await fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer(watchListRecord.commitRequestId)
      // Original Plan: If the reservation is against the FXP, then this is a conversion at the creditor. Mark FXP as receiving FXP
      // The above condition is not required as we are setting the fxTransferType in the watchList beforehand
      if (watchListRecord.fxTransferTypeId === Enum.Fx.FxTransferType.PAYEE_CONVERSION) {
        receivingFxpExists = true
        receivingFxpRecord = fxTransferRecord
        // Create obligation between FXP and FX requesting party in currency of reservation
        // Find out the participantCurrencyId of the initiatingFsp
        // The following is hardcoded for Payer side conversion with SEND amountType.
        const proxyParticipantAccountDetails = await ProxyCache.getProxyParticipantAccountDetails(fxTransferRecord.initiatingFspName, fxTransferRecord.targetCurrency)
        if (proxyParticipantAccountDetails.participantCurrencyId) {
          result.positionChanges.push({
            isFxTransferStateChange: false,
            transferId,
            participantCurrencyId: proxyParticipantAccountDetails.participantCurrencyId,
            amount: -fxTransferRecord.targetAmount
          })
        }
        // TODO: Send PATCH notification to FXP
      }

      // Original Plan: If the reservation is against the DFSP, then this is a conversion at the debtor. Mark FXP as sending FXP
      // The above condition is not required as we are setting the fxTransferType in the watchList beforehand
      if (watchListRecord.fxTransferTypeId === Enum.Fx.FxTransferType.PAYER_CONVERSION) {
        sendingFxpExists = true
        sendingFxpRecord = fxTransferRecord
        // Create obligation between FX requesting party and FXP in currency of reservation
        const proxyParticipantAccountDetails = await ProxyCache.getProxyParticipantAccountDetails(fxTransferRecord.counterPartyFspName, fxTransferRecord.sourceCurrency)
        if (proxyParticipantAccountDetails.participantCurrencyId) {
          result.positionChanges.push({
            isFxTransferStateChange: true,
            commitRequestId: fxTransferRecord.commitRequestId,
            participantCurrencyId: proxyParticipantAccountDetails.participantCurrencyId,
            amount: -fxTransferRecord.sourceAmount
          })
        }
        result.patchNotifications.push({
          commitRequestId: watchListRecord.commitRequestId,
          fxpName: fxTransferRecord.counterPartyFspName,
          fulfilment: fxTransferRecord.fulfilment,
          completedTimestamp: fxTransferRecord.completedTimestamp
        })
      }
    }

    if (!sendingFxpExists && !receivingFxpExists) {
      // If there are no sending and receiving fxp, throw an error
      throw new Error(`Required records not found in watch list for transfer ID ${transferId}`)
    }

    if (sendingFxpExists && receivingFxpExists) {
      // If we have both a sending and a receiving FXP, Create obligation between sending and receiving FXP in currency of transfer.
      const proxyParticipantAccountDetails = await ProxyCache.getProxyParticipantAccountDetails(receivingFxpRecord.counterPartyFspName, receivingFxpRecord.sourceCurrency)
      if (proxyParticipantAccountDetails.participantCurrencyId) {
        result.positionChanges.push({
          isFxTransferStateChange: true,
          commitRequestId: receivingFxpRecord.commitRequestId,
          participantCurrencyId: proxyParticipantAccountDetails.participantCurrencyId,
          amount: -receivingFxpRecord.sourceAmount
        })
      }
    } else if (sendingFxpExists) {
      // If we have a sending FXP, Create obligation between FXP and creditor party to the transfer in currency of FX transfer
      // Get participantCurrencyId for transfer.payeeParticipantId/transfer.payeeFsp and sendingFxpRecord.targetCurrency
      const proxyParticipantAccountDetails = await ProxyCache.getProxyParticipantAccountDetails(transfer.payeeFsp, sendingFxpRecord.targetCurrency)
      if (proxyParticipantAccountDetails.participantCurrencyId) {
        let isPositionChange = false
        if (proxyParticipantAccountDetails.inScheme) {
          isPositionChange = true
        } else {
          // We are not expecting this. Payee participant is a proxy and have an account in the targetCurrency.
          // In this case we need to check if FXP is also a proxy and have the same account as payee.
          const proxyParticipantAccountDetails2 = await ProxyCache.getProxyParticipantAccountDetails(sendingFxpRecord.counterPartyFspName, sendingFxpRecord.targetCurrency)
          if (!proxyParticipantAccountDetails2.inScheme && (proxyParticipantAccountDetails.participantCurrencyId !== proxyParticipantAccountDetails2.participantCurrencyId)) {
            isPositionChange = true
          }
        }
        if (isPositionChange) {
          result.positionChanges.push({
            isFxTransferStateChange: false,
            transferId,
            participantCurrencyId: proxyParticipantAccountDetails.participantCurrencyId,
            amount: -sendingFxpRecord.targetAmount
          })
        }
      }
    } else if (receivingFxpExists) {
      // If we have a receiving FXP, Create obligation between debtor party to the transfer and FXP in currency of transfer
      const proxyParticipantAccountDetails = await ProxyCache.getProxyParticipantAccountDetails(receivingFxpRecord.counterPartyFspName, receivingFxpRecord.sourceCurrency)
      if (proxyParticipantAccountDetails.participantCurrencyId) {
        let isPositionChange = false
        if (proxyParticipantAccountDetails.inScheme) {
          isPositionChange = true
        } else {
          // We are not expecting this. FXP participant is a proxy and have an account in the sourceCurrency.
          // In this case we need to check if Payer is also a proxy and have the same account as FXP.
          const proxyParticipantAccountDetails2 = await ProxyCache.getProxyParticipantAccountDetails(transfer.payerFsp, receivingFxpRecord.sourceCurrency)
          if (!proxyParticipantAccountDetails2.inScheme && (proxyParticipantAccountDetails.participantCurrencyId !== proxyParticipantAccountDetails2.participantCurrencyId)) {
            isPositionChange = true
          }
        }
        if (isPositionChange) {
          result.positionChanges.push({
            isFxTransferStateChange: true,
            commitRequestId: receivingFxpRecord.commitRequestId,
            participantCurrencyId: proxyParticipantAccountDetails.participantCurrencyId,
            amount: -receivingFxpRecord.sourceAmount
          })
        }
      }
    }

    // TODO: Remove entries from watchlist
  } else {
    // Normal transfer request, just return isFx = false
  }

  histTimer({ success: true })
  return result
}

module.exports = {
  getParticipantAndCurrencyForTransferMessage,
  getParticipantAndCurrencyForFxTransferMessage,
  processFxFulfilMessage,
  processFxAbortMessage,
  processFulfilMessage,
  processAbortMessage,
  checkIfDeterminingTransferExistsForTransferMessage,
  checkIfDeterminingTransferExistsForFxTransferMessage
}
