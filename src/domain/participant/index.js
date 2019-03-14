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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * @module src/domain/participant/
 */

const ParticipantModel = require('../../models/participant/participant')
const ParticipantCurrencyModel = require('../../models/participant/participantCurrency')
const ParticipantPositionModel = require('../../models/participant/participantPosition')
const ParticipantPositionChangeModel = require('../../models/participant/participantPositionChange')
const ParticipantLimitModel = require('../../models/participant/participantLimit')
const LedgerAccountTypeModel = require('../../models/ledgerAccountType/ledgerAccountType')
const ParticipantFacade = require('../../models/participant/facade')
const PositionFacade = require('../../models/position/facade')
const Config = require('../../lib/config')
const Utility = require('../../handlers/lib/utility')
const Uuid = require('uuid4')
const Enum = require('../../lib/enum')
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction

// Alphabetically ordered list of error texts used below
const AccountInactiveErrorText = 'Account is currently set inactive'
const AccountNotFoundErrorText = 'Account not found'
const AccountNotPositionTypeErrorText = 'Only position account update is permitted'
const AccountNotSettlementTypeErrorText = 'Account is not SETTLEMENT type'
const ActionNotSupportedText = 'The action is not supported'
const ParticipantAccountCurrencyMismatchText = 'The account does not match participant or currency specified'
const ParticipantAccountMismatchText = 'Participant/account mismatch'
const ParticipantInactiveText = 'Participant is currently set inactive'
const ParticipantInitialPositionExistsText = 'Participant Limit or Initial Position already set'
const ParticipantNotFoundText = 'Participant does not exist'

const create = async (payload) => {
  try {
    const participant = await ParticipantModel.create({ name: payload.name })
    return participant
  } catch (err) {
    throw err
  }
}

const getAll = async () => {
  try {
    let all = await ParticipantModel.getAll()
    await Promise.all(all.map(async (participant) => {
      participant.currencyList = await ParticipantCurrencyModel.getByParticipantId(participant.participantId)
    }))
    return all
  } catch (err) {
    throw new Error(err.message)
  }
}

const getById = async (id) => {
  let participant = await ParticipantModel.getById(id)
  if (participant) {
    participant.currencyList = await ParticipantCurrencyModel.getByParticipantId(participant.participantId)
  }
  return participant
}

const getByName = async (name) => {
  let participant = await ParticipantModel.getByName(name)
  if (participant) {
    participant.currencyList = await ParticipantCurrencyModel.getByParticipantId(participant.participantId)
  }
  return participant
}

const participantExists = (participant, checkIsActive = false) => {
  if (participant) {
    if (!checkIsActive || participant.isActive) {
      return participant
    }
    throw new Error(ParticipantInactiveText)
  }
  throw new Error(ParticipantNotFoundText)
}

const update = async (name, payload) => {
  try {
    const participant = await ParticipantModel.getByName(name)
    participantExists(participant)
    await ParticipantModel.update(participant, payload.isActive)
    participant.isActive = +payload.isActive
    participant.currencyList = await ParticipantCurrencyModel.getByParticipantId(participant.participantId)
    return participant
  } catch (err) {
    throw err
  }
}

const createParticipantCurrency = async (participantId, currencyId, ledgerAccountTypeId, isActive = true) => {
  try {
    const participantCurrency = await ParticipantCurrencyModel.create(participantId, currencyId, ledgerAccountTypeId, isActive)
    return participantCurrency
  } catch (err) {
    throw err
  }
}

const createHubAccount = async (participantId, currencyId, ledgerAccountTypeId) => {
  try {
    const participantCurrency = await ParticipantFacade.addHubAccountAndInitPosition(participantId, currencyId, ledgerAccountTypeId)
    return participantCurrency
  } catch (err) {
    throw err
  }
}

const getParticipantCurrencyById = async (participantCurrencyId) => {
  try {
    return await ParticipantCurrencyModel.getById(participantCurrencyId)
  } catch (err) {
    throw err
  }
}

const destroyByName = async (name) => {
  try {
    let participant = await ParticipantModel.getByName(name)
    await ParticipantLimitModel.destroyByParticipantId(participant.participantId)
    await ParticipantPositionModel.destroyByParticipantId(participant.participantId)
    await ParticipantCurrencyModel.destroyByParticipantId(participant.participantId)
    return await ParticipantModel.destroyByName(name)
  } catch (err) {
    throw new Error(err.message)
  }
}

/**
 * @function AddEndpoint
 *
 * @async
 * @description This adds the endpoint details for a participant
 *
 * ParticipantModel.getByName called to get the participant details from the participant name
 * ParticipantFacade.addEndpoint called to add the participant endpoint details
 *
 * @param {string} name - the name of the participant. Example 'dfsp1'
 * @param {object} payload - the payload containing 'type' and 'value' of the endpoint.
 * Example: {
 *      "type": "FSPIOP_CALLBACK_URL_TRANSFER_POST",
 *      "value": "http://localhost:3001/participants/dfsp1/notification12"
 * }
 * @returns {integer} - Returns number of database rows affected if successful, or throws an error if failed
 */

const addEndpoint = async (name, payload) => {
  try {
    const participant = await ParticipantModel.getByName(name)
    participantExists(participant)
    return ParticipantFacade.addEndpoint(participant.participantId, payload)
  } catch (err) {
    throw err
  }
}

/**
 * @function GetEndpoint
 *
 * @async
 * @description This returns the active endpoint value for a give participant and type of endpoint
 *
 * ParticipantModel.getByName called to get the participant details from the participant name
 * ParticipantFacade.getEndpoint called to get the participant endpoint details
 *
 * @param {string} name - the name of the participant. Example 'dfsp1'
 * @param {string} type - the type of the endpoint. Example 'FSPIOP_CALLBACK_URL_TRANSFER_POST'
 *
 * @returns {array} - Returns participantEndpoint array containing the details of active endpoint for the participant if successful, or throws an error if failed
 */

const getEndpoint = async (name, type) => {
  try {
    const participant = await ParticipantModel.getByName(name)
    participantExists(participant)
    const participantEndpoint = await ParticipantFacade.getEndpoint(participant.participantId, type)
    return participantEndpoint
  } catch (err) {
    throw err
  }
}

/**
 * @function GetAllEndpoints
 *
 * @async
 * @description This returns all the active endpoints for a give participant
 *
 * ParticipantModel.getByName called to get the participant details from the participant name
 * ParticipantFacade.getAllEndpoints called to get the participant endpoint details
 *
 * @param {string} name - the name of the participant. Example 'dfsp1'
 *
 * @returns {array} - Returns participantEndpoint array containing the list of all active endpoints for the participant if successful, or throws an error if failed
 */

const getAllEndpoints = async (name) => {
  try {
    const participant = await ParticipantModel.getByName(name)
    participantExists(participant)
    const participantEndpoints = await ParticipantFacade.getAllEndpoints(participant.participantId)
    return participantEndpoints
  } catch (err) {
    throw err
  }
}

/**
 * @function DestroyParticipantEndpointByName
 *
 * @async
 * @description This functions deletes the existing endpoints for a given participant name
 * else, it will throw and error
 *
 * @param {string} name - participant name
 *
 * @returns {integer} - Returns the number of rows deleted if successful, or throws an error if failed
 */

const destroyParticipantEndpointByName = async (name) => {
  try {
    const participant = await ParticipantModel.getByName(name)
    participantExists(participant)
    return ParticipantModel.destroyParticipantEndpointByParticipantId(participant.participantId)
  } catch (err) {
    throw err
  }
}

/**
 * @function addLimitAndInitialPosition
 *
 * @async
 * @description This creates the initial position and limits for a participant
 *
 * ParticipantFacade.getByNameAndCurrency called to get the participant and currency details from the participant name
 * ParticipantFacade.addLimitAndInitialPosition called to add the participant initial position and limits
 *
 * @param {string} name - the name of the participant. Example 'dfsp1'
 * @param {object} limitAndInitialPositionObj - the payload containing the currency, limit and initial position values
 * Example: {
 *  "currency": "USD",
 *  "limit": {
 *    "type": "NET_DEBIT_CAP",
 *    "value": 10000000
 *  },
 *  "initialPosition": 0
 * }
 *
 * @returns {integer} - Returns number of database rows affected if successful, or throws an error if failed
 */

const addLimitAndInitialPosition = async (participantName, limitAndInitialPositionObj) => {
  try {
    const participant = await ParticipantFacade.getByNameAndCurrency(participantName, limitAndInitialPositionObj.currency, Enum.LedgerAccountType.POSITION)
    participantExists(participant)
    const settlementAccount = await ParticipantFacade.getByNameAndCurrency(participantName, limitAndInitialPositionObj.currency, Enum.LedgerAccountType.SETTLEMENT)
    const existingLimit = await ParticipantLimitModel.getByParticipantCurrencyId(participant.participantCurrencyId)
    const existingPosition = await ParticipantPositionModel.getByParticipantCurrencyId(participant.participantCurrencyId)
    const existingSettlementPosition = await ParticipantPositionModel.getByParticipantCurrencyId(settlementAccount.participantCurrencyId)
    if (existingLimit || existingPosition || existingSettlementPosition) {
      throw new Error(ParticipantInitialPositionExistsText)
    }
    let limitAndInitialPosition = limitAndInitialPositionObj
    if (!limitAndInitialPosition.initialPosition) {
      limitAndInitialPosition.initialPosition = Config.PARTICIPANT_INITIAL_POSITION
    }
    let payload = Object.assign({}, limitAndInitialPositionObj, { name: participantName })
    await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, Enum.adminNotificationActions.LIMIT_ADJUSTMENT, createLimitAdjustmentMessageProtocol(payload), Utility.ENUMS.STATE.SUCCESS)
    return ParticipantFacade.addLimitAndInitialPosition(participant.participantCurrencyId, settlementAccount.participantCurrencyId, limitAndInitialPosition, true)
  } catch (err) {
    throw err
  }
}

/**
 * @function getPositionByParticipantCurrencyId
 *
 * @async
 * @description This returns the participant position corresponding to the participantCurrencyId
 *
 *
 * @param {integer} participantCurrencyId - the participant currency id. Example: 1
 *
 * @returns {object} - Returns the row from participantPosition table if successful, or throws an error if failed
 */

const getPositionByParticipantCurrencyId = async (participantCurrencyId) => {
  try {
    return ParticipantPositionModel.getByParticipantCurrencyId(participantCurrencyId)
  } catch (err) {
    throw err
  }
}

/**
 * @function getPositionChangeByParticipantPositionId
 *
 * @async
 * @description This returns the last participant position change for given participantPositionId
 *
 *
 * @param {integer} participantPositionId - the participant position id. Example: 1
 *
 * @returns {object} - Returns the row from participantPositionChange table if successful, or throws an error if failed
 */

const getPositionChangeByParticipantPositionId = async (participantPositionId) => {
  try {
    return ParticipantPositionChangeModel.getByParticipantPositionId(participantPositionId)
  } catch (err) {
    throw err
  }
}

/**
 * @function DestroyParticipantPositionByNameAndCurrency
 *
 * @async
 * @description This functions deletes the existing position for a given participant name
 * else, it will throw and error
 *
 * @param {string} name - participant name
 *
 * @returns {integer} - Returns the number of rows deleted if successful, or throws an error if failed
 */

const destroyParticipantPositionByNameAndCurrency = async (name, currencyId) => {
  try {
    const participant = await ParticipantFacade.getByNameAndCurrency(name, currencyId, Enum.LedgerAccountType.POSITION)
    participantExists(participant)
    return ParticipantPositionModel.destroyByParticipantCurrencyId(participant.participantCurrencyId)
  } catch (err) {
    throw err
  }
}

/**
 * @function DestroyParticipantLimitByNameAndCurrency
 *
 * @async
 * @description This functions deletes the existing limits for a given participant name
 * else, it will throw and error
 *
 * @param {string} name - participant name
 * @param {string} currencyId - participant currency
 *
 * @returns {integer} - Returns the number of rows deleted if successful, or throws an error if failed
 */

const destroyParticipantLimitByNameAndCurrency = async (name, currencyId) => {
  try {
    const participant = await ParticipantFacade.getByNameAndCurrency(name, currencyId, Enum.LedgerAccountType.POSITION)
    participantExists(participant)
    return ParticipantLimitModel.destroyByParticipantCurrencyId(participant.participantCurrencyId)
  } catch (err) {
    throw err
  }
}

/**
 * @function GetLimits
 *
 * @async
 * @description This returns the active endpoint value for a give participant and type of endpoint
 *
 * ParticipantFacade.getByNameAndCurrency called to get the participant and currency details from the participant name
 * ParticipantModel.getByName called to get the participant details from the participant name
 * ParticipantFacade.getParticipantLimitsByCurrencyId called to get the participant limit details from participant currency id
 * ParticipantFacade.getParticipantLimitsByParticipantId called to get the participant limit details from participant id
 *
 * @param {string} name - the name of the participant. Example 'dfsp1'
 * @param {string} type - the type of the endpoint. Example 'FSPIOP_CALLBACK_URL_TRANSFER_POST'
 *
 * @returns {array} - Returns participantEndpoint array containing the details of active endpoint for the participant if successful, or throws an error if failed
 */

const getLimits = async (name, { currency = null, type = null }) => {
  try {
    let participant
    if (currency != null) {
      participant = await ParticipantFacade.getByNameAndCurrency(name, currency, Enum.LedgerAccountType.POSITION)
      participantExists(participant)
      return ParticipantFacade.getParticipantLimitsByCurrencyId(participant.participantCurrencyId, type)
    } else {
      participant = await ParticipantModel.getByName(name)
      participantExists(participant)
      return ParticipantFacade.getParticipantLimitsByParticipantId(participant.participantId, type, Enum.LedgerAccountType.POSITION)
    }
  } catch (err) {
    throw err
  }
}

/**
 * @function GetLimitsForAllParticipants
 *
 * @async
 * @description This returns the active limits value for all the participants for the currency and type combinations
 *
 * ParticipantFacade.getLimitsForAllParticipants called to get the participant limit details from participant id
 *
 * @param {string} currency - the currency id. Example USD
 * @param {string} type - the type of the limit. Example 'NET_DEBIT_CAP'
 *
 * @returns {array} - Returns an array containing the details of active limits for all the participants if successful, or throws an error if failed
 */

const getLimitsForAllParticipants = async ({ currency = null, type = null }) => {
  try {
    return ParticipantFacade.getLimitsForAllParticipants(currency, type, Enum.LedgerAccountType.POSITION)
  } catch (err) {
    throw err
  }
}

/**
 * @function AdjustLimits
 *
 * @async
 * @description This adds/updates limits for a participant
 *
 * ParticipantFacade.getByNameAndCurrency called to get the participant details from the participant name
 * ParticipantFacade.adjustLimits called to add/update the participant limits
 *
 * @param {string} name - the name of the participant. Example 'dfsp1'
 * @param {object} payload - the payload containing the currency and limit values
 * Example: {
 *  "currency": "USD",
 *  "limit": {
 *    "type": "NET_DEBIT_CAP",
 *    "value": 10000000,
 *    "thresholdAlarmPercentage": 10
 *  }
 * }
 *
 * @returns {integer} - Returns number of database rows affected if successful, or throws an error if failed
 */

const adjustLimits = async (name, payload) => {
  try {
    let { limit, currency } = payload
    const participant = await ParticipantFacade.getByNameAndCurrency(name, currency, Enum.LedgerAccountType.POSITION)
    participantExists(participant)
    let result = await ParticipantFacade.adjustLimits(participant.participantCurrencyId, limit)
    payload.name = name
    await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, Enum.adminNotificationActions.LIMIT_ADJUSTMENT, createLimitAdjustmentMessageProtocol(payload), Utility.ENUMS.STATE.SUCCESS)
    return result
  } catch (err) {
    throw err
  }
}

const createLimitAdjustmentMessageProtocol = (payload, action = Enum.adminNotificationActions.LIMIT_ADJUSTMENT, state = '', pp = '') => {
  return {
    id: Uuid(),
    from: payload.name,
    to: Config.HUB_NAME,
    type: 'application/json',
    content: {
      header: {},
      payload
    },
    metadata: {
      event: {
        id: Uuid(),
        responseTo: '',
        type: 'notification',
        action,
        createdAt: new Date(),
        state
      }
    },
    pp
  }
}

/**
 * @function GetPositions
 *
 * @async
 * @description This return the current position value for a participant/currency
 *
 * PositionFacade.getByNameAndCurrency called to get the participant position value from the participant name and currency if passed
 *
 * @param {string} name - the name of the participant. Example 'dfsp1'
 * @param {object} query -Optional query object containing the currency value
 * Example: {
 *  "currency": "USD"
 * }
 *
 * @returns {object/array}  - This returns and object or array depending on the following conditions
 * 1. If the currency is passed as a param, Returns and object containing the current, value and updatedTime of the position, if found, if not found it returns an empty object {}
 * e.g
 * ```
 * {
        "currency": "USD",
        "value": 0,
        "updatedTime": "2018-08-14T04:01:55.000Z"
    }
  ```
 * 2. if the currency object is not passed, then it return an array containing the above mentioned objects for all the currencies defined for that participant.
 *  If no position is found then an empty array is returned.
 * e.g.
 * ```
  [
    {
        "currency": "USD",
        "value": 0,
        "updatedTime": "2018-08-14T04:01:55.000Z"
    },
    {
        "currency": "EUR",
        "value": 200,
        "updatedTime": "2018-08-14T15:15:44.000Z"
    },
  ]
  ```
 */

const getPositions = async (name, query) => {
  try {
    if (query.currency) {
      const participant = await ParticipantFacade.getByNameAndCurrency(name, query.currency, Enum.LedgerAccountType.POSITION)
      participantExists(participant)
      const result = await PositionFacade.getByNameAndCurrency(name, Enum.LedgerAccountType.POSITION, query.currency, Enum.LedgerAccountType.POSITION)
      let position = {}
      if (Array.isArray(result) && result.length > 0) {
        position = {
          currency: result[0].currencyId,
          value: result[0].value,
          changedDate: result[0].changedDate
        }
      }
      return position
    } else {
      const participant = await ParticipantModel.getByName(name)
      participantExists(participant)
      const result = await await PositionFacade.getByNameAndCurrency(name, Enum.LedgerAccountType.POSITION)
      let positions = []
      if (Array.isArray(result) && result.length > 0) {
        result.forEach(item => {
          positions.push({
            currency: item.currencyId,
            value: item.value,
            changedDate: item.changedDate
          })
        })
      }
      return positions
    }
  } catch (err) {
    throw err
  }
}

const getAccounts = async (name, query) => {
  try {
    const participant = await ParticipantModel.getByName(name)
    participantExists(participant)
    const result = await PositionFacade.getAllByNameAndCurrency(name, query.currency)
    let positions = []
    if (Array.isArray(result) && result.length > 0) {
      result.forEach(item => {
        positions.push({
          id: item.participantCurrencyId,
          ledgerAccountType: item.ledgerAccountType,
          currency: item.currencyId,
          isActive: item.isActive,
          value: item.value,
          reservedValue: item.reservedValue,
          changedDate: item.changedDate
        })
      })
    }
    return positions
  } catch (err) {
    throw err
  }
}

const updateAccount = async (payload, params, enums) => {
  try {
    let { name, id } = params
    const participant = await ParticipantModel.getByName(name)
    participantExists(participant)
    const account = await ParticipantCurrencyModel.getById(id)
    if (!account) {
      throw new Error(AccountNotFoundErrorText)
    } else if (account.participantId !== participant.participantId) {
      throw new Error(ParticipantAccountMismatchText)
    } else if (account.ledgerAccountTypeId !== enums.ledgerAccountType.POSITION) {
      throw new Error(AccountNotPositionTypeErrorText)
    }
    return await ParticipantCurrencyModel.update(id, payload.isActive)
  } catch (err) {
    throw err
  }
}

const getLedgerAccountTypeName = async (name) => {
  try {
    return await LedgerAccountTypeModel.getLedgerAccountByName(name)
  } catch (err) {
    throw err
  }
}

const getParticipantAccount = async (accountParams) => {
  try {
    return await ParticipantCurrencyModel.getByName(accountParams)
  } catch (err) {
    throw err
  }
}

const createRecordFundsMessageProtocol = (payload, action = '', state = '', pp = '') => {
  return {
    id: payload.transferId,
    from: payload.payerFsp,
    to: payload.payeeFsp,
    type: 'application/json',
    content: {
      header: {},
      payload
    },
    metadata: {
      event: {
        id: Uuid(),
        responseTo: '',
        type: 'transfer',
        action,
        createdAt: new Date(),
        state
      }
    },
    pp
  }
}

const setPayerPayeeFundsInOut = (fspName, payload, enums) => {
  let { action } = payload
  const actions = {
    'recordFundsIn': {
      payer: fspName,
      payee: enums.hubParticipant.name
    },
    'recordFundsOutPrepareReserve': {
      payer: enums.hubParticipant.name,
      payee: fspName
    },
    'recordFundsOutCommit': {
      payer: enums.hubParticipant.name,
      payee: fspName
    },
    'recordFundsOutAbort': {
      payer: enums.hubParticipant.name,
      payee: fspName
    }
  }
  if (!actions[action]) throw new Error(ActionNotSupportedText)
  return Object.assign(payload, actions[action])
}

const recordFundsInOut = async (payload, params, enums) => {
  try {
    let { name, id, transferId } = params
    const participant = await ParticipantModel.getByName(name)
    const currency = (payload.amount && payload.amount.currency) || null
    const isAccountActive = null
    const checkIsActive = true
    participantExists(participant, checkIsActive)
    const accounts = await ParticipantFacade.getAllAccountsByNameAndCurrency(name, currency, isAccountActive)
    let accountMatched = accounts[accounts.map(account => account.participantCurrencyId).findIndex(i => i === id)]
    if (!accountMatched) {
      throw new Error(ParticipantAccountCurrencyMismatchText)
    } else if (!accountMatched.accountIsActive) {
      throw new Error(AccountInactiveErrorText)
    } else if (accountMatched.ledgerAccountTypeId !== enums.ledgerAccountType.SETTLEMENT) {
      throw new Error(AccountNotSettlementTypeErrorText)
    }
    transferId && (payload.transferId = transferId)
    let messageProtocol = createRecordFundsMessageProtocol(setPayerPayeeFundsInOut(name, payload, enums))
    messageProtocol.metadata.request = {
      params: params,
      enums: enums
    }
    return await Utility.produceGeneralMessage(TransferEventType.ADMIN, TransferEventAction.TRANSFER, messageProtocol, Utility.ENUMS.STATE.SUCCESS)
  } catch (err) {
    throw err
  }
}

module.exports = {
  create,
  getAll,
  getById,
  getByName,
  getLedgerAccountTypeName,
  update,
  createParticipantCurrency,
  createHubAccount,
  getParticipantCurrencyById,
  destroyByName,
  addEndpoint,
  getEndpoint,
  getAllEndpoints,
  destroyParticipantEndpointByName,
  addLimitAndInitialPosition,
  getPositionByParticipantCurrencyId,
  getPositionChangeByParticipantPositionId,
  destroyParticipantPositionByNameAndCurrency,
  destroyParticipantLimitByNameAndCurrency,
  getLimits,
  adjustLimits,
  getPositions,
  getAccounts,
  updateAccount,
  getParticipantAccount,
  recordFundsInOut,
  getAccountByNameAndCurrency: ParticipantFacade.getByNameAndCurrency,
  hubAccountExists: ParticipantCurrencyModel.hubAccountExists,
  getLimitsForAllParticipants
}
