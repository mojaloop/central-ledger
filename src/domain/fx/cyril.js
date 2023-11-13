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
const FxTransferModel = require('../../models/fx/fxTransfer')
const FxWatchListModel = require('../../models/fx/fxWatchList')

const getParticipantAndCurrencyForTransferMessage = async (message) => {
  const histTimerGetParticipantAndCurrencyForTransferMessage = Metrics.getHistogram(
    'fx_domain_cyril_getParticipantAndCurrencyForTransferMessage',
    'fx_domain_cyril_getParticipantAndCurrencyForTransferMessage - Metrics for fx cyril',
    ['success', 'determiningTransferExists']
  ).startTimer()
  // Does this determining transfer ID appear on the watch list?
  const watchListRecord = await FxWatchListModel.getItemInWatchListByDeterminingTransferId(message.value.content.payload.determiningTransferId)
  const determiningTransferExistsInWatchList = (watchListRecord !== null)

  let participantName, currencyId

  if (determiningTransferExistsInWatchList) {
    // If there's a currency conversion before the transfer is requested, it must be the debtor who did it.
    // Get the FX request corresponding to this transaction ID
    // TODO: Can't we just use the following query in the first place above to check if the determining transfer exists instead of using the watch list?
    const fxTransferRecord = await FxTransferModel.getByDeterminingTransferId(message.value.content.payload.determiningTransferId)
    // Liquidity check and reserve funds against FXP in FX target currency
    participantName = fxTransferRecord.counterPartyFsp
    currencyId = fxTransferRecord.targetCurrency
    // Add to watch list
    await FxWatchListModel.addToWatchList({
      commitRequestId: fxTransferRecord.commitRequestId,
      determiningTransferId: fxTransferRecord.determiningTransferId,
    })
  } else {
    // Normal transfer request
    // Liquidity check and reserve against payer
    participantName = message.value.content.payload.payerFsp
    currencyId = message.value.content.payload.amount.currency
  }

  histTimerGetParticipantAndCurrencyForTransferMessage({ success: true, determiningTransferExists: determiningTransferExistsInWatchList })
  return {participantName, currencyId}
}

const getParticipantAndCurrencyForFxTransferMessage = async (message) => {
  const histTimerGetParticipantAndCurrencyForFxTransferMessage = Metrics.getHistogram(
    'fx_domain_cyril_getParticipantAndCurrencyForFxTransferMessage',
    'fx_domain_cyril_getParticipantAndCurrencyForFxTransferMessage - Metrics for fx cyril',
    ['success', 'determiningTransferExists']
  ).startTimer()
  // Does this determining transfer ID appear on the transfer list?
  const transferRecord = await TransferModel.getById(message.value.content.payload.determiningTransferId)
  const determiningTransferExistsInTransferList = (transferRecord !== null)

  let participantName, currencyId

  if (determiningTransferExistsInTransferList) {
    // If there's a currency conversion before the transfer is requested, then it must be issued by the debtor party
    // Liquidity check and reserve funds against requester in FX source currency
    participantName = message.value.content.payload.initiatingFsp
    currencyId = message.value.content.payload.sourceAmount.currency
  } else {
    // If there's a currency conversion which is not the first message, then it must be issued by the creditor party
    // Liquidity check and reserve funds against FXP in FX target currency
    participantName = message.value.content.payload.counterPartyFsp
    currencyId = message.value.content.payload.targetAmount.currency
  }

  // Add to watchlist
  await FxWatchListModel.addToWatchList({
    commitRequestId: message.value.content.payload.commitRequestId,
    determiningTransferId: message.value.content.payload.determiningTransferId,
  })

  histTimerGetParticipantAndCurrencyForFxTransferMessage({ success: true, determiningTransferExists: determiningTransferExistsInTransferList })
  return {participantName, currencyId}

}

module.exports = {
  getParticipantAndCurrencyForTransferMessage,
  getParticipantAndCurrencyForFxTransferMessage,
}
