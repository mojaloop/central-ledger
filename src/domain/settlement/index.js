/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
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
 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Lazola Lucas <lazola.lucas@modusbox.com>
 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------
 ******/
'use strict'

const SettlementModel = require('../../models/settlement/settlement')
const SettlementModelModel = require('../../models/settlement/settlementModel')
const SettlementWindowModel = require('../../models/settlementWindow')
const SettlementWindowContentModel = require('../../models/settlementWindowContent')
const SettlementParticipantCurrency = require('../../models/settlement/settlementParticipantCurrency')
const LedgerAccountTypeModel = require('../../models/ledgerAccountType/ledgerAccountType')
const Enum = require('@mojaloop/central-services-shared').Enum.Settlements
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Util = require('@mojaloop/central-services-shared').Util
const MLNumber = require('@mojaloop/ml-number')
const { logger } = require('../../shared/logger')
const { default: stringifySorted } = require('../../shared/helpers')

const arrayDiff = (arr1, arr2) => arr1.filter(x => !arr2.includes(x))


/**
 * @returns {Array<{
 *   id: number,
 *   accounts: Array<{
 *     id: number,
 *     state: string,
 *     reason: string,
 *     netSettlementAmount: {
 *       amount: number,
 *       currency: string,
 *     }
 *   }>
 * }>}
 */
const prepareParticipantsResult = (participantCurrenciesList) => {
  const participantAccounts = {}
  for (const account of participantCurrenciesList) {
    const { id } = account
    const formattedAccount = {
      id: account.participantCurrencyId,
      state: account.state,
      reason: account.reason,
      netSettlementAmount: {
        amount: new MLNumber(account.netAmount).toNumber(),
        currency: account.currency
      }
    }
    if (id in participantAccounts) {
      const accountList = participantAccounts[id].accounts
      accountList.push(formattedAccount)
      participantAccounts[id] = {
        id,
        accounts: accountList
      }
    } else {
      participantAccounts[id] = {
        id,
        accounts: [formattedAccount]
      }
    }
  }
  return Array.from(Object.keys(participantAccounts).map(participantId => participantAccounts[participantId]))
}

const groupSettlementWindowContentBySettlementWindow = (records) => {
  const settlementWindows = {}
  for (const record of records) {
    const id = record.settlementWindowId
    delete record.settlementWindowId
    if (id in settlementWindows) {
      settlementWindows[id].push(record)
    } else {
      settlementWindows[id] = [record]
    }
  }
  return settlementWindows
}

const createSettlementModel = async (settlementModel, trx = null) => {
  try {
    const settlementGranularityId = Enum.SettlementGranularity[settlementModel.settlementGranularity]
    const settlementInterchangeId = Enum.SettlementInterchange[settlementModel.settlementInterchange]
    const settlementDelayId = Enum.SettlementDelay[settlementModel.settlementDelay]

    const [ledgerAccountType, settlementAccountType] = await validateSettlementModel(settlementModel, settlementModel.settlementDelay, settlementModel.settlementGranularity, settlementModel.settlementInterchange, trx)
    await SettlementModelModel.create(settlementModel.name, true, settlementGranularityId,
      settlementInterchangeId, settlementDelayId, settlementModel.currency,
      settlementModel.requireLiquidityCheck,
      ledgerAccountType.ledgerAccountTypeId, settlementAccountType.ledgerAccountTypeId, settlementModel.autoPositionReset, trx)
    return true
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/* istanbul ignore next */
const getByName = async (name, trx = null) => {
  try {
    return await SettlementModelModel.getByName(name, trx)
  } catch (err) {
    /* istanbul ignore next */
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
/**
 * @typedef {Object} SettlementModel
 * @property {number} settlementModelId
 * @property {string} name
 * @property {number} isActive
 * @property {number} settlementGranularityId
 * @property {number} settlementInterchangeId
 * @property {number} settlementDelayId
 * @property {string|null} currencyId
 * @property {number} requireLiquidityCheck
 * @property {number} ledgerAccountTypeId
 * @property {number} settlementAccountTypeId
 * @property {number} autoPositionReset
 */

/**
 * @returns {Promise<SettlementModel[]>}
 */
const getAll = async () => {
  try {
    return await SettlementModelModel.getAll()
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
const getLedgerAccountTypeName = async (name) => {
  try {
    return await LedgerAccountTypeModel.getLedgerAccountByName(name)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const update = async (name, payload) => {
  try {
    const settlementModel = await SettlementModelModel.getByName(name)
    settlementModeExists(settlementModel)
    await SettlementModelModel.update(settlementModel, payload.isActive)
    settlementModel.isActive = +payload.isActive
    return settlementModel
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const settlementModeExists = (settlementModel) => {
  if (settlementModel) {
    return settlementModel
  }
  throw ErrorHandler.Factory.createInternalServerFSPIOPError('Settlement Model does not exist')
}
/* istanbul ignore next */
const validateSettlementModel = async function (settlementModel, settlementDelay, settlementGranularity, settlementInterchange, trx = null) {
  const { isValid, reasons } = Util.Settlement.validateSettlementModel(settlementDelay, settlementGranularity, settlementInterchange)
  if (!isValid) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR, reasons.join('. '))
  }
  const ledgerAccountType = await LedgerAccountTypeModel.getLedgerAccountByName(settlementModel.ledgerAccountType, trx)
  if (!ledgerAccountType) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR, 'Ledger account type was not found')
  }
  const settlementAccountType = await LedgerAccountTypeModel.getLedgerAccountByName(settlementModel.settlementAccountType, trx)
  if (!settlementAccountType) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR, 'Settlement account type was not found')
  }
  const settlementModelExist = await getByName(settlementModel.name, trx)
  if (settlementModelExist) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR, 'Settlement Model already exists')
  }
  return [ledgerAccountType, settlementAccountType]
}

const getById = async ({ settlementId }, enums) => {
  const settlement = await SettlementModel.getById2({ settlementId }, enums)
  if (settlement) {
    const settlementWindowsList = await SettlementWindowModel.getBySettlementId({ settlementId }, enums)
    const participantCurrenciesList = await SettlementParticipantCurrency.getParticipantCurrencyBySettlementId({ settlementId }, enums)
    const participants = prepareParticipantsResult(participantCurrenciesList)

    // Build settlement window content array and insert into settlement window list object
    const windowContentRecords = []
    let windowContentResponseData = {}

    for (const key of Object.keys(settlementWindowsList)) {
      const windowContentRecord = await SettlementWindowContentModel.getBySettlementAndWindowId(settlementId, settlementWindowsList[key].id)
      windowContentResponseData = {
        id: windowContentRecord[0].id,
        state: windowContentRecord[0].state,
        ledgerAccountType: windowContentRecord[0].ledgerAccountType,
        currencyId: windowContentRecord[0].currencyId,
        createdDate: windowContentRecord[0].createdDate,
        changedDate: windowContentRecord[0].changedDate
      }
      windowContentRecords.push(windowContentResponseData)
      settlementWindowsList[key].content = windowContentRecords
    }

    return {
      id: settlement.settlementId,
      state: settlement.state,
      reason: settlement.reason,
      createdDate: settlement.createdDate,
      changedDate: settlement.changedDate,
      settlementWindows: settlementWindowsList,
      participants
    }
  } else {
    const error = ErrorHandler.Factory.createFSPIOPError(
      ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
      `Settlement with ID '${settlementId}' not found`
    )
    logger.error(error)
    throw error
  }
}

const abortById = async (settlementId, payload, enums) => {
  // seq-settlement-6.2.6, step 3
  const settlementData = await SettlementModel.getById2({ settlementId })

  if (!settlementData) {
    const error = ErrorHandler.Factory.createFSPIOPError(
      ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
      `Settlement with ID '${settlementId}' not found`
    )
    logger.error(error)
    throw error
  }
  if (settlementData.state === enums.settlementState.PS_TRANSFERS_COMMITTED ||
    settlementData.state === enums.settlementState.SETTLING ||
    settlementData.state === enums.settlementState.SETTLED) {
    const error = ErrorHandler.Factory.createFSPIOPError(
      ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
      `State change is not allowed for settlement '${settlementId}' in state '${settlementData.state}'`
    )
    logger.error(error)
    throw error
  } else if (settlementData.state === enums.settlementState.ABORTED) {
    return SettlementModel.abortByIdStateAborted(settlementId, payload, enums)
  } else if (settlementData.state === enums.settlementState.PS_TRANSFERS_RESERVED) {
    const transferCommittedAccount = await SettlementModel.getTransferCommitedAccount(settlementId, enums)
    if (transferCommittedAccount !== undefined) {
      const error = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `At least one settlement transfer is committed for settlement '${settlementId}'. Aborting is not allowed.`
      )
      logger.error(error)
      throw error
    }
  }

  const error = ErrorHandler.Factory.createFSPIOPError(
    ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
    `Unhandled state: ${settlementData.state} for settlement '${settlementId}'. Aborting is not allowed.`
  )
  logger.error(error)
  throw error
}

const getSettlementsByParams = async (params, enums) => {
  // 7 filters - at least one should be used
  Object.keys(params.query).forEach(key => params.query[key] === undefined && delete params.query[key])
  if (Object.keys(params.query).length && Object.keys(params.query).length < 10) {
    const settlements = {}
    let settlement
    let participant
    const settlementsData = await SettlementModel.getByParams(params.query, enums)
    if (settlementsData && settlementsData.length > 0) {
      for (const s of settlementsData) {
        if (!settlements[s.settlementId]) {
          const settlementId = s.settlementId
          const settlementWindowsList = await SettlementWindowModel.getBySettlementId(
            { settlementId }
          )
          for (const key of Object.keys(settlementWindowsList)) {
            settlementWindowsList[key].content = await SettlementWindowContentModel
              .getBySettlementAndWindowId(s.settlementId, settlementWindowsList[key].id)
          }
          settlements[s.settlementId] = {
            id: s.settlementId,
            state: s.settlementStateId,
            reason: s.settlementWindowReason,
            createdDate: s.createdDate,
            changedDate: s.changedDate,
            settlementWindows: settlementWindowsList
          }
        }
        settlement = settlements[s.settlementId]
        if (!settlement.settlementWindows) {
          settlement.settlementWindows = {}
        }
        if (!settlement.participants) {
          settlement.participants = {}
        }
        if (!settlement.participants[s.participantId]) {
          settlement.participants[s.participantId] = {
            id: s.participantId
          }
        }
        participant = settlement.participants[s.participantId]
        if (!participant.accounts) {
          participant.accounts = {}
        }
        participant.accounts[s.participantCurrencyId] = {
          id: s.participantCurrencyId,
          state: s.accountState,
          reason: s.accountReason,
          netSettlementAmount: {
            amount: new MLNumber(s.accountAmount).toNumber(),
            currency: s.accountCurrency
          }
        }
      }
      // transform settlements map to result array
      const result = Object.keys(settlements).map((i) => {
        let settlementWindows = settlements[i].settlementWindows
        settlementWindows = Object.keys(settlementWindows).map((j) => {
          return settlementWindows[j]
        })
        settlements[i].settlementWindows = settlementWindows
        let participants = settlements[i].participants
        participants = Object.keys(participants).map((j) => {
          let accounts = participants[j].accounts
          accounts = Object.keys(accounts).map((k) => {
            return accounts[k]
          })
          participants[j].accounts = accounts
          return participants[j]
        })
        settlements[i].participants = participants
        return settlements[i]
      })
      return result
    } else {
      const error = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `No settlements found matching the provided parameters: ${stringifySorted(params.query)}`
      )
      logger.error(error)
      throw error
    }
  } else {
    const error = ErrorHandler.Factory.createFSPIOPError(
      ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
      `Use at least one parameter: state, fromDateTime, toDateTime, currency, settlementWindowId `
      + `fromSettlementWindowDateTime, toSettlementWindowDateTime, participantId, accountId`
    )
    logger.error(error)
    throw error
  }
}

const settlementEventTrigger = async (params, enums) => {
  // validate settlement model
  const { settlementModel, reason, settlementWindows } = params
  const settlementModelData = await SettlementModelModel.getByName(settlementModel)
  if (!settlementModelData) {
    const error = ErrorHandler.Factory.createFSPIOPError(
      ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
      `Settlement model not found: ${settlementModel}`
    )
    logger.error(error)
    throw error
  } else if (settlementModelData.settlementGranularityId === enums.settlementGranularity.GROSS ||
    settlementModelData.settlementDelayId === enums.settlementDelay.IMMEDIATE) {
    const error = ErrorHandler.Factory.createFSPIOPError(
      ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
      'Settlement can not be created for GROSS or IMMEDIATE models'
    )
    logger.error(error)
    throw error
  }

  // validate windows content
  const idList = settlementWindows.map(v => v.id)
  const applicableWindows = await SettlementWindowModel.getByListOfIds(
    idList, settlementModelData, enums.settlementWindowState
  )
  const applicableIdList = applicableWindows.map(v => v.settlementWindowId)
  const nonApplicableIdList = arrayDiff(idList, applicableIdList)
  if (nonApplicableIdList.length) {
    const error = ErrorHandler.Factory.createFSPIOPError(
      ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
      `Inapplicable windows ${nonApplicableIdList.join(', ')}`
    )
    logger.error(error)
    throw error
  }

  // settlement event trigger
  const settlementId = await SettlementModel.triggerSettlementEvent(
    { idList, reason },
    settlementModelData,
    enums
  )

  // retrieve resulting data for response
  const settlement = await getById({ settlementId }, enums)
  const settlementWindowsList = await SettlementWindowModel.getBySettlementId({ settlementId })
  const settlementWindowContentAll = await SettlementWindowContentModel.getBySettlementId(
    settlementId
  )
  const settlementWindowsContent = groupSettlementWindowContentBySettlementWindow(
    settlementWindowContentAll
  )
  const settlementWindowsWithContent = settlementWindowsList.map(record => {
    record.content = settlementWindowsContent[record.id]
    return record
  })
  const participantCurrenciesList = await SettlementParticipantCurrency
    .getParticipantCurrencyBySettlementId({ settlementId })
  const participants = prepareParticipantsResult(participantCurrenciesList)
  return {
    id: settlement.id,
    settlementModel,
    state: settlement.state,
    reason: settlement.reason,
    createdDate: settlement.createdDate,
    changedDate: settlement.changedDate,
    settlementWindows: settlementWindowsWithContent,
    participants
  }
}

/**
 * 
 * @param {{
 *   settlementId: number, 
 *   participantId: number,
 *   accountId?: number
 * }} param0 
 * @param {*} enums 
 * @returns 
 */
const getByIdParticipantAccount = async (
  { settlementId, participantId, accountId },
  enums
) => {
  let participantFoundInSettlement = false
  const accountProvided = accountId > 0
  let participantAndAccountMatched = !accountProvided
  let accountFoundInSettlement = !accountProvided

  const settlement = await SettlementModel.getById2({ settlementId }) // 3
  const settlementFound = !!settlement

  let settlementParticipantCurrencyIdList, account, settlementAccount

  if (settlementFound) {
    settlementParticipantCurrencyIdList = await SettlementParticipantCurrency
      .getAccountsInSettlementByIds({
        settlementId,
        participantId
      }) // 6
    participantFoundInSettlement = settlementParticipantCurrencyIdList.length > 0

    if (participantFoundInSettlement && accountProvided) {
      account = await SettlementModel.checkParticipantAccountExists({
        participantId,
        accountId
      }, enums) // 9
      participantAndAccountMatched = !!account

      if (participantAndAccountMatched) {
        settlementAccount = await SettlementModel.getAccountInSettlement({
          settlementId,
          accountId
        }) // 12
        accountFoundInSettlement = !!settlementAccount
      }
    }
  }

  let settlementWindows
  let accounts
  let participants
  if (settlementFound
    && participantFoundInSettlement
    && participantAndAccountMatched
    && accountFoundInSettlement
  ) {
    if (accountProvided) { // 16
      settlementWindows = await SettlementWindowModel.getWindowsBySettlementIdAndAccountId({
        settlementId,
        accountId
      })
      accounts = await SettlementParticipantCurrency.getSettlementAccountById(settlementAccount.settlementParticipantCurrencyId)
      participants = prepareParticipantsResult(accounts)
    } else {
      settlementWindows = await SettlementWindowModel.getWindowsBySettlementIdAndParticipantId({
        settlementId,
        participantId
      }, enums)
      const ids = settlementParticipantCurrencyIdList.map(record => record.settlementParticipantCurrencyId)
      accounts = await SettlementParticipantCurrency.getSettlementAccountsByListOfIds(ids)
      participants = prepareParticipantsResult(accounts)
    }
  } else {
    if (!settlementFound) {
      const error = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `Settlement with ID '${settlementId}' not found`
      )
      logger.error(error)
      throw error
    } else if (!participantFoundInSettlement) {
      const error = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `Participant with ID '${participantId}' is not part of settlement '${settlementId}'`
      )
      logger.error(error)
      throw error
    } else if (!participantAndAccountMatched) {
      const error = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `Provided account ID '${accountId}' does not match any position account for participant ` +
        `'${participantId}' in settlement '${settlementId}'`
      )
      logger.error(error)
      throw error
    } else {
      const error = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `Account ID '${accountId}' is not part of settlement '${settlementId}'`
      )
      logger.error(error)
      throw error
    }
  }

  return {
    id: settlement.settlementId,
    state: settlement.state,
    settlementWindows,
    participants
  }
}

module.exports = {
  abortById,
  createSettlementModel,
  getAll,
  getById,
  getByIdParticipantAccount,
  getByName,
  getLedgerAccountTypeName,
  getSettlementsByParams,
  settlementEventTrigger,
  update,
  validateSettlementModel,
  putById: SettlementModel.putById,
}
