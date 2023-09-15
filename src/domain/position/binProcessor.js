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

 * INFITX
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>

 --------------
 ******/
'use strict'

const Logger = require('@mojaloop/central-services-logger')
const BatchPositionModel = require('../../models/position/batch')
const PositionPrepareDomain = require('./prepare')
const SettlementModelCached = require('../../models/settlement/settlementModelCached')
const Enum = require('@mojaloop/central-services-shared').Enum
const ErrorHandler = require('@mojaloop/central-services-error-handling')
// TODO: We may not need this if we optimize the participantLimit query
const participantFacade = require('../../models/participant/facade')

/**
 * @function processBins
 *
 * @async
 * @description This is the domain function to process a list bins containing position messages grouped by participant account.
 *
 * @param {array} bins - a list of account-bins to process
 * @param {object} trx - Database transaction object
 *
 * @returns {results} - Returns a list of bins with results or throws an error if failed
 */
const processBins = async (bins, trx) => {
  const transferIdList = []
  await iterateThroughBins(bins, async (item) => {
    if (item.message.value.content?.payload?.transferId) {
      transferIdList.push(item.message.value.content.payload.transferId)
    }
  })
  // Pre fetch latest transferStates for all the transferIds in the account-bin
  const latestTransferStateChanges = await BatchPositionModel.getLatestTransferStateChangesByTransferIdList(trx, transferIdList)
  const latestTransferStates = {}
  for (const key in latestTransferStateChanges) {
    latestTransferStates[key] = latestTransferStateChanges[key].transferStateId
  }

  const accountIds = Object.keys(bins)

  // Pre fetch all settlement accounts corresponding to the position accounts
  // Get all participantIdMap for the accountIds
  const participantCurrencyIds = await BatchPositionModel.getParticipantCurrencyIds(trx, accountIds)

  // TODO: Validate if all the participantCurrencyIds exist for all the accountIds

  const allSettlementModels = await SettlementModelCached.getAll()

  // Construct an object participantIdMap, accountIdMap amd currencyIdMap
  const participantIdMap = {}
  const accountIdMap = {}
  const currencyIdMap = {}
  participantCurrencyIds.forEach(item => {
    const { participantId, currencyId, participantCurrencyId } = item
    if (!participantIdMap[participantId]) {
      participantIdMap[participantId] = {}
    }
    if (!currencyIdMap[currencyId]) {
      currencyIdMap[currencyId] = {
        settlementModel: _getSettlementModelForCurrency(currencyId, allSettlementModels)
      }
    }
    participantIdMap[participantId][currencyId] = participantCurrencyId
    accountIdMap[participantCurrencyId] = { participantId, currencyId }
  })

  // TODO: Verify if all the accountIds have a corresponding participantCurrencyId
  // TODO: Verify all maps are correctly constructed

  // Get all participantCurrencyIds for the participantIdMap
  const allParticipantCurrencyIds = await BatchPositionModel.getParticipantCurrencyIdsByParticipantIds(trx, Object.keys(participantIdMap))
  const settlementCurrencyIds = []
  allParticipantCurrencyIds.forEach(pc => {
    const correspondingParticipantCurrencyId = participantIdMap[pc.participantId][pc.currencyId]
    if (correspondingParticipantCurrencyId) {
      const settlementModel = currencyIdMap[pc.currencyId].settlementModel
      if (pc.ledgerAccountTypeId === settlementModel.settlementAccountTypeId) {
        settlementCurrencyIds.push(pc)
        accountIdMap[correspondingParticipantCurrencyId].settlementCurrencyId = pc.participantCurrencyId
      }
    }
  })

  // Pre fetch all position account balances for the account-bin and acquire lock on position
  const positions = await BatchPositionModel.getPositionsByAccountIdsForUpdate(trx, [
    ...accountIds,
    ...settlementCurrencyIds.map(pc => pc.participantCurrencyId)
  ])

  let notifyMessages = []
  let limitAlarms = []

  // For each account-bin in the list
  for (const accountID in bins) {
    const accountBin = bins[accountID]
    const actions = Object.keys(accountBin)

    const settlementParticipantPosition = positions[accountIdMap[accountID].settlementCurrencyId].value
    const settlementModel = currencyIdMap[accountIdMap[accountID].currencyId].settlementModel

    // TODO: Refactor the following SQL query to optimize the performance
    const participantLimit = await participantFacade.getParticipantLimitByParticipantCurrencyLimit(accountIdMap[accountID].participantId, accountIdMap[accountID].currencyId, Enum.Accounts.LedgerAccountType.POSITION, Enum.Accounts.ParticipantLimitType.NET_DEBIT_CAP)
    // Initialize accumulated values
    // These values will be passed across various actions in the bin
    let accumulatedPositionValue = positions[accountID].value
    let accumulatedPositionReservedValue = positions[accountID].reservedValue
    let accumulatedTransferStates = latestTransferStates
    let accumulatedTransferStateChanges = []
    let accumulatedPositionChanges = []

    // If non-prepare action found, log error
    // We need to remove this once we implement all the actions
    if (actions.length > 1 || (actions.length === 1 && actions[0] !== 'prepare')) {
      Logger.isErrorEnabled && Logger.error('Only prepare action is allowed in a batch')
      // throw new Error('Only prepare action is allowed in a batch')
    }
    // If prepare action found then call processPositionPrepareBin function
    const prepareActionResult = await PositionPrepareDomain.processPositionPrepareBin(
      accountBin.prepare,
      accumulatedPositionValue,
      accumulatedPositionReservedValue,
      accumulatedTransferStates,
      settlementParticipantPosition,
      settlementModel,
      participantLimit
    )

    // Update accumulated values
    accumulatedPositionValue = prepareActionResult.accumulatedPositionValue
    accumulatedPositionReservedValue = prepareActionResult.accumulatedPositionReservedValue
    accumulatedTransferStates = prepareActionResult.accumulatedTransferStates
    // Append accumulated arrays
    accumulatedTransferStateChanges = accumulatedTransferStateChanges.concat(prepareActionResult.accumulatedTransferStateChanges)
    accumulatedPositionChanges = accumulatedPositionChanges.concat(prepareActionResult.accumulatedPositionChanges)
    notifyMessages = notifyMessages.concat(prepareActionResult.notifyMessages)

    // Update accumulated position values by calling a facade function
    await BatchPositionModel.updateParticipantPosition(trx, positions[accountID].participantPositionId, accumulatedPositionValue, accumulatedPositionReservedValue)

    // Bulk insert accumulated transferStateChanges by calling a facade function
    await BatchPositionModel.bulkInsertTransferStateChanges(trx, accumulatedTransferStateChanges)

    // Bulk get the transferStateChangeIds for transferids using select whereIn
    const fetchedTransferStateChanges = await BatchPositionModel.getLatestTransferStateChangesByTransferIdList(trx, accumulatedTransferStateChanges.map(item => item.transferId))
    // Mutate accumulated positionChanges with transferStateChangeIds
    accumulatedPositionChanges.forEach(positionChange => {
      positionChange.transferStateChangeId = fetchedTransferStateChanges[positionChange.transferId].transferStateChangeId
      positionChange.participantPositionId = positions[accountID].participantPositionId
      delete positionChange.transferId
    })
    // Bulk insert accumulated positionChanges by calling a facade function
    await BatchPositionModel.bulkInsertParticipantPositionChanges(trx, accumulatedPositionChanges)

    // testing: await trx.rollback()
    limitAlarms = limitAlarms.concat(prepareActionResult.limitAlarms)
  }

  // Return results
  return {
    notifyMessages,
    limitAlarms
  }
}

/**
 * @function iterateThroughBins
 *
 * @async
 * @description Helper function to iterate though all messages in bins.
 *
 * @param {array} bins - a list of account-bins to iterate
 * @param {async function} cb - callback function to call for each item
 *
 * @returns {void} - Doesn't return anything
 */

const iterateThroughBins = async (bins, cb) => {
  for (const accountID in bins) {
    const accountBin = bins[accountID]
    for (const action in accountBin) {
      const actionBin = accountBin[action]
      for (const item of actionBin) {
        try {
          await cb(item)
        } catch (err) {}
      }
    }
  }
}

const _getSettlementModelForCurrency = (currencyId, allSettlementModels) => {
  let settlementModels = allSettlementModels.filter(model => model.currencyId === currencyId)
  if (settlementModels.length === 0) {
    settlementModels = allSettlementModels.filter(model => model.currencyId === null) // Default settlement model
    if (settlementModels.length === 0) {
      throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.GENERIC_SETTLEMENT_ERROR, 'Unable to find a matching or default, Settlement Model')
    }
  }
  return settlementModels.find(sm => sm.ledgerAccountTypeId === Enum.Accounts.LedgerAccountType.POSITION)
}

module.exports = {
  processBins,
  iterateThroughBins
}
