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
const TransferModel = require('../../models/transfer/transfer')
const { fxTransfer, watchList } = require('../../models/fxTransfer')

const getParticipantAndCurrencyForTransferMessage = async (payload) => {
  const histTimerGetParticipantAndCurrencyForTransferMessage = Metrics.getHistogram(
    'fx_domain_cyril_getParticipantAndCurrencyForTransferMessage',
    'fx_domain_cyril_getParticipantAndCurrencyForTransferMessage - Metrics for fx cyril',
    ['success', 'determiningTransferExists']
  ).startTimer()
  // Does this determining transfer ID appear on the watch list?
  const watchListRecord = await watchList.getItemInWatchListByDeterminingTransferId(payload.transferId)
  const determiningTransferExistsInWatchList = (watchListRecord !== null)

  let participantName, currencyId, amount

  if (determiningTransferExistsInWatchList) {
    // If there's a currency conversion before the transfer is requested, it must be the debtor who did it.
    // Get the FX request corresponding to this transaction ID
    // TODO: Can't we just use the following query in the first place above to check if the determining transfer exists instead of using the watch list?
    const fxTransferRecord = await fxTransfer.getByDeterminingTransferId(payload.transferId)
    // Liquidity check and reserve funds against FXP in FX target currency
    participantName = fxTransferRecord.counterPartyFsp
    currencyId = fxTransferRecord.targetCurrency
    amount = fxTransferRecord.targetAmount
    // Add to watch list
    await watchList.addToWatchList({
      commitRequestId: fxTransferRecord.commitRequestId,
      determiningTransferId: fxTransferRecord.determiningTransferId
    })
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

// maybe, rename it to getFxParticipant... (move Fx at the beginning for better readability)
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
    // If there's a currency conversion before the transfer is requested, then it must be issued by the debtor party
    // Liquidity check and reserve funds against requester in FX source currency
    participantName = payload.initiatingFsp
    currencyId = payload.sourceAmount.currency
    amount = payload.sourceAmount.amount
  } else {
    // If there's a currency conversion which is not the first message, then it must be issued by the creditor party
    // Liquidity check and reserve funds against FXP in FX target currency
    participantName = payload.counterPartyFsp
    currencyId = payload.targetAmount.currency
    amount = payload.targetAmount.amount
  }

  await watchList.addToWatchList({
    commitRequestId: payload.commitRequestId,
    determiningTransferId: payload.determiningTransferId
  })

  histTimerGetParticipantAndCurrencyForFxTransferMessage({ success: true, determiningTransferExists: determiningTransferExistsInTransferList })
  return {
    participantName,
    currencyId,
    amount
  }
}

module.exports = {
  getParticipantAndCurrencyForTransferMessage,
  getParticipantAndCurrencyForFxTransferMessage
}
