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
 - Steven Oderayi <steven.oderayi@infitx.com>

 --------------
 ******/
'use strict'

const Logger = require('@mojaloop/central-services-logger')
const BatchPositionModel = require('../../models/position/batch')
const BatchPositionModelCached = require('../../models/position/batchCached')
const PositionPrepareDomain = require('./prepare')
const PositionFxPrepareDomain = require('./fx-prepare')
const PositionFulfilDomain = require('./fulfil')
const PositionFxFulfilDomain = require('./fx-fulfil')
const PositionTimeoutReservedDomain = require('./timeout-reserved')
const PositionFxTimeoutReservedDomain = require('./fx-timeout-reserved')
const SettlementModelCached = require('../../models/settlement/settlementModelCached')
const Enum = require('@mojaloop/central-services-shared').Enum
const ErrorHandler = require('@mojaloop/central-services-error-handling')
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
  // Get transferIdList, reservedActionTransferIdList and commitRequestId for actions PREPARE, FX_PREPARE, FX_RESERVE, COMMIT and RESERVE
  const { transferIdList, reservedActionTransferIdList, commitRequestIdList } = await _getTransferIdList(bins)

  // Pre fetch latest transferStates for all the transferIds in the account-bin
  const latestTransferStates = await _fetchLatestTransferStates(trx, transferIdList)

  // Pre fetch latest fxTransferStates for all the commitRequestIds in the account-bin
  const latestFxTransferStates = await _fetchLatestFxTransferStates(trx, commitRequestIdList)

  const accountIds = Object.keys(bins)

  // Get all participantIdMap for the accountIds
  const participantCurrencyIds = await _getParticipantCurrencyIds(trx, accountIds)

  // Pre fetch all settlement accounts corresponding to the position accounts
  const allSettlementModels = await SettlementModelCached.getAll()

  // Construct objects participantIdMap, accountIdMap and currencyIdMap
  const { settlementCurrencyIds, accountIdMap, currencyIdMap } = await _constructRequiredMaps(participantCurrencyIds, allSettlementModels, trx)

  // Pre fetch all position account balances for the account-bin and acquire lock on position
  const positions = await BatchPositionModel.getPositionsByAccountIdsForUpdate(trx, [
    ...accountIds,
    ...settlementCurrencyIds.map(pc => pc.participantCurrencyId)
  ])

  const latestTransferInfoByTransferId = await BatchPositionModel.getTransferInfoList(
    trx,
    transferIdList,
    Enum.Accounts.TransferParticipantRoleType.PAYEE_DFSP,
    Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE
  )

  const latestInitiatingFxTransferInfoByFxCommitRequestId = await BatchPositionModel.getFxTransferInfoList(
    trx,
    commitRequestIdList,
    Enum.Accounts.TransferParticipantRoleType.INITIATING_FSP,
    Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE
  )


  // Pre fetch transfers for all reserve action fulfils
  const reservedActionTransfers = await BatchPositionModel.getTransferByIdsForReserve(
    trx,
    reservedActionTransferIdList
  )

  let notifyMessages = []
  let followupMessages = []
  let limitAlarms = []

  // For each account-bin in the list
  for (const accountID in bins) {
    const accountBin = bins[accountID]
    const actions = Object.keys(accountBin)
    const isSubset = (array1, array2) =>
      array2.every((element) => array1.includes(element))
    // If non-prepare/non-commit action found, log error
    // We need to remove this once we implement all the actions
    if (!isSubset([
      Enum.Events.Event.Action.PREPARE,
      Enum.Events.Event.Action.FX_PREPARE,
      Enum.Events.Event.Action.COMMIT,
      Enum.Events.Event.Action.RESERVE,
      Enum.Events.Event.Action.FX_RESERVE,
      Enum.Events.Event.Action.TIMEOUT_RESERVED
    ], actions)) {
      Logger.isErrorEnabled && Logger.error('Only prepare/fx-prepare/commit/reserve/timeout reserved actions are allowed in a batch')
    }

    const settlementParticipantPosition = positions[accountIdMap[accountID].settlementCurrencyId].value
    const settlementModel = currencyIdMap[accountIdMap[accountID].currencyId].settlementModel

    // Story #3657: The following SQL query/lookup can be optimized for performance
    const participantLimit = await participantFacade.getParticipantLimitByParticipantCurrencyLimit(
      accountIdMap[accountID].participantId,
      accountIdMap[accountID].currencyId,
      Enum.Accounts.LedgerAccountType.POSITION,
      Enum.Accounts.ParticipantLimitType.NET_DEBIT_CAP
    )
    // Initialize accumulated values
    // These values will be passed across various actions in the bin
    let accumulatedPositionValue = positions[accountID].value
    let accumulatedPositionReservedValue = positions[accountID].reservedValue
    let accumulatedTransferStates = latestTransferStates
    let accumulatedFxTransferStates = latestFxTransferStates
    let accumulatedTransferStateChanges = []
    let accumulatedFxTransferStateChanges = []
    let accumulatedPositionChanges = []

    // If timeout-reserved action found then call processPositionTimeoutReserveBin function
    const fxTimeoutReservedActionResult = await PositionFxTimeoutReservedDomain.processPositionFxTimeoutReservedBin(
      accountBin[Enum.Events.Event.Action.FX_TIMEOUT_RESERVED],
      accumulatedPositionValue,
      accumulatedPositionReservedValue,
      accumulatedTransferStates,
      accumulatedFxTransferStates,
      latestInitiatingFxTransferInfoByFxCommitRequestId,
    )

    // Update accumulated values
    accumulatedPositionValue = fxTimeoutReservedActionResult.accumulatedPositionValue
    accumulatedPositionReservedValue = fxTimeoutReservedActionResult.accumulatedPositionReservedValue
    accumulatedTransferStates = fxTimeoutReservedActionResult.accumulatedTransferStates
    accumulatedFxTransferStates = fxTimeoutReservedActionResult.accumulatedFxTransferStates

    // Append accumulated arrays
    accumulatedTransferStateChanges = accumulatedTransferStateChanges.concat(fxTimeoutReservedActionResult.accumulatedTransferStateChanges)
    accumulatedPositionChanges = accumulatedPositionChanges.concat(fxTimeoutReservedActionResult.accumulatedPositionChanges)
    notifyMessages = notifyMessages.concat(fxTimeoutReservedActionResult.notifyMessages)


    // If fulfil action found then call processPositionPrepareBin function
    // We don't need to change the position for FX transfers. All the position changes happen when actual transfer is done
    const fxFulfilActionResult = await PositionFxFulfilDomain.processPositionFxFulfilBin(
      accountBin[Enum.Events.Event.Action.FX_RESERVE],
      accumulatedFxTransferStates
    )

    // Update accumulated values
    accumulatedFxTransferStates = fxFulfilActionResult.accumulatedFxTransferStates
    // Append accumulated arrays
    accumulatedFxTransferStateChanges = accumulatedFxTransferStateChanges.concat(fxFulfilActionResult.accumulatedFxTransferStateChanges)
    notifyMessages = notifyMessages.concat(fxFulfilActionResult.notifyMessages)

    // If timeout-reserved action found then call processPositionTimeoutReserveBin function
    const timeoutReservedActionResult = await PositionTimeoutReservedDomain.processPositionTimeoutReservedBin(
      accountBin[Enum.Events.Event.Action.TIMEOUT_RESERVED],
      accumulatedPositionValue,
      accumulatedPositionReservedValue,
      accumulatedTransferStates,
      latestTransferInfoByTransferId,
    )

    // Update accumulated values
    accumulatedPositionValue = timeoutReservedActionResult.accumulatedPositionValue
    accumulatedPositionReservedValue = timeoutReservedActionResult.accumulatedPositionReservedValue
    accumulatedTransferStates = timeoutReservedActionResult.accumulatedTransferStates
    // Append accumulated arrays
    accumulatedTransferStateChanges = accumulatedTransferStateChanges.concat(timeoutReservedActionResult.accumulatedTransferStateChanges)
    accumulatedPositionChanges = accumulatedPositionChanges.concat(timeoutReservedActionResult.accumulatedPositionChanges)
    notifyMessages = notifyMessages.concat(timeoutReservedActionResult.notifyMessages)

    // If fulfil action found then call processPositionPrepareBin function
    const fulfilActionResult = await PositionFulfilDomain.processPositionFulfilBin(
      [accountBin.commit, accountBin.reserve],
      accumulatedPositionValue,
      accumulatedPositionReservedValue,
      accumulatedTransferStates,
      accumulatedFxTransferStates,
      latestTransferInfoByTransferId,
      reservedActionTransfers
    )

    // Update accumulated values
    accumulatedPositionValue = fulfilActionResult.accumulatedPositionValue
    accumulatedPositionReservedValue = fulfilActionResult.accumulatedPositionReservedValue
    accumulatedTransferStates = fulfilActionResult.accumulatedTransferStates
    accumulatedFxTransferStates = fulfilActionResult.accumulatedFxTransferStates
    // Append accumulated arrays
    accumulatedTransferStateChanges = accumulatedTransferStateChanges.concat(fulfilActionResult.accumulatedTransferStateChanges)
    accumulatedFxTransferStateChanges = accumulatedFxTransferStateChanges.concat(fulfilActionResult.accumulatedFxTransferStateChanges)
    accumulatedPositionChanges = accumulatedPositionChanges.concat(fulfilActionResult.accumulatedPositionChanges)
    notifyMessages = notifyMessages.concat(fulfilActionResult.notifyMessages)
    followupMessages = followupMessages.concat(fulfilActionResult.followupMessages)

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

    // If fx-prepare action found then call processPositionFxPrepareBin function
    const fxPrepareActionResult = await PositionFxPrepareDomain.processFxPositionPrepareBin(
      accountBin[Enum.Events.Event.Action.FX_PREPARE],
      accumulatedPositionValue,
      accumulatedPositionReservedValue,
      accumulatedFxTransferStates,
      settlementParticipantPosition,
      participantLimit
    )

    // Update accumulated values
    accumulatedPositionValue = fxPrepareActionResult.accumulatedPositionValue
    accumulatedPositionReservedValue = fxPrepareActionResult.accumulatedPositionReservedValue
    accumulatedTransferStates = fxPrepareActionResult.accumulatedTransferStates
    // Append accumulated arrays
    accumulatedFxTransferStateChanges = accumulatedFxTransferStateChanges.concat(fxPrepareActionResult.accumulatedFxTransferStateChanges)
    accumulatedPositionChanges = accumulatedPositionChanges.concat(fxPrepareActionResult.accumulatedPositionChanges)
    notifyMessages = notifyMessages.concat(fxPrepareActionResult.notifyMessages)

    // Update accumulated position values by calling a facade function
    await BatchPositionModel.updateParticipantPosition(trx, positions[accountID].participantPositionId, accumulatedPositionValue, accumulatedPositionReservedValue)

    // Bulk insert accumulated transferStateChanges by calling a facade function
    await BatchPositionModel.bulkInsertTransferStateChanges(trx, accumulatedTransferStateChanges)
    // Bulk insert accumulated fxTransferStateChanges by calling a facade function
    await BatchPositionModel.bulkInsertFxTransferStateChanges(trx, accumulatedFxTransferStateChanges)

    // Bulk get the transferStateChangeIds for transferids using select whereIn
    const fetchedTransferStateChanges = await BatchPositionModel.getLatestTransferStateChangesByTransferIdList(trx, accumulatedTransferStateChanges.map(item => item.transferId))
    // Bulk get the fxTransferStateChangeIds for commitRequestId using select whereIn
    const fetchedFxTransferStateChanges = await BatchPositionModel.getLatestFxTransferStateChangesByCommitRequestIdList(trx, accumulatedFxTransferStateChanges.map(item => item.commitRequestId))
    // Mutate accumulated positionChanges with transferStateChangeIds and fxTransferStateChangeIds
    for (const positionChange of accumulatedPositionChanges) {
      if (positionChange.transferId) {
        positionChange.transferStateChangeId = fetchedTransferStateChanges[positionChange.transferId].transferStateChangeId
        delete positionChange.transferId
      } else if (positionChange.commitRequestId) {
        positionChange.fxTransferStateChangeId = fetchedFxTransferStateChanges[positionChange.commitRequestId].fxTransferStateChangeId
        delete positionChange.commitRequestId
      }
      positionChange.participantPositionId = positions[accountID].participantPositionId
    }
    // Bulk insert accumulated positionChanges by calling a facade function
    await BatchPositionModel.bulkInsertParticipantPositionChanges(trx, accumulatedPositionChanges)

    limitAlarms = limitAlarms.concat(prepareActionResult.limitAlarms)
  }

  // Return results
  return {
    notifyMessages,
    followupMessages,
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
 * @param {async function} errCb - callback function to call incase of any error
 *
 * @returns {void} - Doesn't return anything
 */

const iterateThroughBins = async (bins, cb, errCb) => {
  for (const accountID in bins) {
    const accountBin = bins[accountID]
    for (const action in accountBin) {
      const actionBin = accountBin[action]
      for (const item of actionBin) {
        try {
          await cb(accountID, action, item)
        } catch (err) {
          if (errCb === undefined) {
            Logger.isErrorEnabled && Logger.error(err)
          } else {
            await errCb(accountID, action, item)
          }
        }
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

const _getTransferIdList = async (bins) => {
  const transferIdList = []
  const reservedActionTransferIdList = []
  const commitRequestIdList = []
  await iterateThroughBins(bins, (_accountID, action, item) => {
    if (action === Enum.Events.Event.Action.PREPARE) {
      transferIdList.push(item.decodedPayload.transferId)
    } else if (action === Enum.Events.Event.Action.FULFIL) {
      transferIdList.push(item.message.value.content.uriParams.id)
    } else if (action === Enum.Events.Event.Action.COMMIT) {
      transferIdList.push(item.message.value.content.uriParams.id)
    } else if (action === Enum.Events.Event.Action.RESERVE) {
      transferIdList.push(item.message.value.content.uriParams.id)
      reservedActionTransferIdList.push(item.message.value.content.uriParams.id)
    } else if (action === Enum.Events.Event.Action.TIMEOUT_RESERVED) {
      transferIdList.push(item.message.value.content.uriParams.id)
    } else if (action === Enum.Events.Event.Action.FX_PREPARE) {
      commitRequestIdList.push(item.decodedPayload.commitRequestId)
    } else if (action === Enum.Events.Event.Action.FX_RESERVE) {
      commitRequestIdList.push(item.message.value.content.uriParams.id)
    } else if (action === Enum.Events.Event.Action.FX_TIMEOUT_RESERVED) {
      commitRequestIdList.push(item.message.value.content.uriParams.id)
    }
  })
  return { transferIdList, reservedActionTransferIdList, commitRequestIdList }
}

const _fetchLatestTransferStates = async (trx, transferIdList) => {
  const latestTransferStateChanges = await BatchPositionModel.getLatestTransferStateChangesByTransferIdList(trx, transferIdList)
  const latestTransferStates = {}
  for (const key in latestTransferStateChanges) {
    latestTransferStates[key] = latestTransferStateChanges[key].transferStateId
  }
  return latestTransferStates
}

const _fetchLatestFxTransferStates = async (trx, commitRequestIdList) => {
  const latestFxTransferStateChanges = await BatchPositionModel.getLatestFxTransferStateChangesByCommitRequestIdList(trx, commitRequestIdList)
  const latestFxTransferStates = {}
  for (const key in latestFxTransferStateChanges) {
    latestFxTransferStates[key] = latestFxTransferStateChanges[key].transferStateId
  }
  return latestFxTransferStates
}

const _getParticipantCurrencyIds = async (trx, accountIds) => {
  const participantCurrencyIds = await BatchPositionModelCached.getParticipantCurrencyByIds(trx, accountIds)

  // Validate that participantCurrencyIds exist for each of the accountIds
  // i.e every unique accountId has a corresponding entry in participantCurrencyIds
  const participantIdsHavingCurrencyIdsList = [...new Set(participantCurrencyIds.map(item => item.participantCurrencyId))]
  const allAccountIdsHaveParticipantCurrencyIds = accountIds.every(accountId => {
    return participantIdsHavingCurrencyIdsList.includes(Number(accountId))
  })
  if (!allAccountIdsHaveParticipantCurrencyIds) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, 'Not all accountIds have corresponding participantCurrencyIds')
  }
  return participantCurrencyIds
}

const _constructRequiredMaps = async (participantCurrencyIds, allSettlementModels, trx) => {
  const participantIdMap = {}
  const accountIdMap = {}
  const currencyIdMap = {}
  for (const item of participantCurrencyIds) {
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
  }

  // Get all participantCurrencyIds for the participantIdMap
  const allParticipantCurrencyIds = await BatchPositionModelCached.getParticipantCurrencyByParticipantIds(trx, Object.keys(participantIdMap))
  const settlementCurrencyIds = []
  for (const pc of allParticipantCurrencyIds) {
    const correspondingParticipantCurrencyId = participantIdMap[pc.participantId][pc.currencyId]
    if (correspondingParticipantCurrencyId) {
      const settlementModel = currencyIdMap[pc.currencyId].settlementModel
      if (pc.ledgerAccountTypeId === settlementModel.settlementAccountTypeId) {
        settlementCurrencyIds.push(pc)
        accountIdMap[correspondingParticipantCurrencyId].settlementCurrencyId = pc.participantCurrencyId
      }
    }
  }
  return { settlementCurrencyIds, accountIdMap, currencyIdMap }
}

module.exports = {
  processBins,
  iterateThroughBins
}
