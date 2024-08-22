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

const ParticipantModel = require('../../models/participant/participantCached')
const ParticipantCurrencyModel = require('../../models/participant/participantCurrencyCached')
const ParticipantPositionModel = require('../../models/participant/participantPosition')
const ParticipantPositionChangeModel = require('../../models/participant/participantPositionChange')
const ParticipantLimitModel = require('../../models/participant/participantLimit')
const LedgerAccountTypeModel = require('../../models/ledgerAccountType/ledgerAccountType')
const ParticipantFacade = require('../../models/participant/facade')
const PositionFacade = require('../../models/position/facade')
const Config = require('../../lib/config')
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const KafkaProducer = require('@mojaloop/central-services-stream').Util.Producer
const { randomUUID } = require('crypto')
const Enum = require('@mojaloop/central-services-shared').Enum
const Enums = require('../../lib/enumCached')
const { logger } = require('../../shared/logger')

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
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { destroyParticipantEndpointByParticipantId } = require('../../models/participant/participant')

const create = async (payload) => {
  try {
    logger.debug('creating participant with payload', payload)
    return ParticipantModel.create({ name: payload.name, isProxy: !!payload.isProxy })
  } catch (err) {
    logger.error('error creating participant', { err, payload })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getAll = async () => {
  try {
    const all = await ParticipantModel.getAll()
    await Promise.all(all.map(async (participant) => {
      participant.currencyList = await ParticipantCurrencyModel.getByParticipantId(participant.participantId)
    }))
    logger.debug('getAll participants', all)
    return all
  } catch (err) {
    logger.error('error getting all participants', err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getById = async (id) => {
  logger.debug('getting participant by id', { id })
  const participant = await ParticipantModel.getById(id)
  if (participant) {
    participant.currencyList = await ParticipantCurrencyModel.getByParticipantId(participant.participantId)
  }
  return participant
}

const getByName = async (name) => {
  logger.debug('getting participant by name', { name })
  const participant = await ParticipantModel.getByName(name)
  if (participant) {
    participant.currencyList = await ParticipantCurrencyModel.getByParticipantId(participant.participantId)
  }
  return participant
}

const participantExists = (participant, checkIsActive = false) => {
  logger.debug('checking if participant exists', { participant, checkIsActive })
  if (participant) {
    if (!checkIsActive || participant.isActive) {
      return participant
    }
    logger.error('participant is inactive', { participant })
    throw ErrorHandler.Factory.createInternalServerFSPIOPError(ParticipantInactiveText)
  }
  logger.error('participant not found', { participant })
  throw ErrorHandler.Factory.createInternalServerFSPIOPError(ParticipantNotFoundText)
}

const update = async (name, payload) => {
  try {
    logger.debug('updating participant', { name, payload })
    const participant = await ParticipantModel.getByName(name)
    participantExists(participant)
    await ParticipantModel.update(participant, payload.isActive)
    participant.isActive = +payload.isActive
    participant.currencyList = await ParticipantCurrencyModel.getByParticipantId(participant.participantId)
    return participant
  } catch (err) {
    logger.error('error updating participant', { name, payload, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const createParticipantCurrency = async (participantId, currencyId, ledgerAccountTypeId, isActive = true) => {
  try {
    logger.debug('creating participant currency', { participantId, currencyId, ledgerAccountTypeId, isActive })
    const participantCurrency = await ParticipantCurrencyModel.create(participantId, currencyId, ledgerAccountTypeId, isActive)
    return participantCurrency
  } catch (err) {
    logger.error('error creating participant currency', { participantId, currencyId, ledgerAccountTypeId, isActive, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const createHubAccount = async (participantId, currencyId, ledgerAccountTypeId) => {
  try {
    logger.debug('creating hub account', { participantId, currencyId, ledgerAccountTypeId })
    const participantCurrency = await ParticipantFacade.addHubAccountAndInitPosition(participantId, currencyId, ledgerAccountTypeId)
    return participantCurrency
  } catch (err) {
    logger.error('error creating hub account', { participantId, currencyId, ledgerAccountTypeId, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getParticipantCurrencyById = async (participantCurrencyId) => {
  try {
    logger.debug('getting participant currency by id', { participantCurrencyId })
    return await ParticipantCurrencyModel.getById(participantCurrencyId)
  } catch (err) {
    logger.error('error getting participant currency by id', { participantCurrencyId, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const destroyByName = async (name) => {
  try {
    logger.debug('destroying participant by name', { name })
    const participant = await ParticipantModel.getByName(name)
    await ParticipantLimitModel.destroyByParticipantId(participant.participantId)
    await ParticipantPositionModel.destroyByParticipantId(participant.participantId)
    await ParticipantCurrencyModel.destroyByParticipantId(participant.participantId)
    await destroyParticipantEndpointByParticipantId(participant.participantId)
    return await ParticipantModel.destroyByName(name)
  } catch (err) {
    logger.error('error destroying participant by name', { name, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
    logger.debug('adding endpoint', { name, payload })
    const participant = await ParticipantModel.getByName(name)
    participantExists(participant)
    logger.debug('adding endpoint for participant', { participant, payload })
    return ParticipantFacade.addEndpoint(participant.participantId, payload)
  } catch (err) {
    logger.error('error adding endpoint', { name, payload, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
    logger.debug('getting endpoint', { name, type })
    const participant = await ParticipantModel.getByName(name)
    participantExists(participant)
    logger.debug('getting endpoint for participant', { participant, type })
    return ParticipantFacade.getEndpoint(participant.participantId, type)
  } catch (err) {
    logger.error('error getting endpoint', { name, type, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
    logger.debug('getting all endpoints', { name })
    const participant = await ParticipantModel.getByName(name)
    participantExists(participant)
    logger.debug('getting all endpoints for participant', { participant })
    return ParticipantFacade.getAllEndpoints(participant.participantId)
  } catch (err) {
    logger.error('error getting all endpoints', { name, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
    logger.debug('destroying participant endpoint by name', { name })
    const participant = await ParticipantModel.getByName(name)
    participantExists(participant)
    logger.debug('destroying participant endpoint for participant', { participant })
    return ParticipantModel.destroyParticipantEndpointByParticipantId(participant.participantId)
  } catch (err) {
    logger.error('error destroying participant endpoint by name', { name, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
    logger.debug('adding limit and initial position', { participantName, limitAndInitialPositionObj })
    const participant = await ParticipantFacade.getByNameAndCurrency(participantName, limitAndInitialPositionObj.currency, Enum.Accounts.LedgerAccountType.POSITION)
    participantExists(participant)
    logger.debug('adding limit and initial position for participant', { participant, limitAndInitialPositionObj })
    const settlementAccount = await ParticipantFacade.getByNameAndCurrency(participantName, limitAndInitialPositionObj.currency, Enum.Accounts.LedgerAccountType.SETTLEMENT)
    const existingLimit = await ParticipantLimitModel.getByParticipantCurrencyId(participant.participantCurrencyId)
    const existingPosition = await ParticipantPositionModel.getByParticipantCurrencyId(participant.participantCurrencyId)
    const existingSettlementPosition = await ParticipantPositionModel.getByParticipantCurrencyId(settlementAccount.participantCurrencyId)
    if (existingLimit || existingPosition || existingSettlementPosition) {
      logger.error('participant limit or initial position already set', { participant, limitAndInitialPositionObj })
      throw ErrorHandler.Factory.createInternalServerFSPIOPError(ParticipantInitialPositionExistsText)
    }
    const limitAndInitialPosition = Object.assign({}, limitAndInitialPositionObj, { name: participantName })
    if (!limitAndInitialPosition.initialPosition) {
      limitAndInitialPosition.initialPosition = Config.PARTICIPANT_INITIAL_POSITION
    }
    const payload = Object.assign({}, limitAndInitialPositionObj, { name: participantName })
    await Kafka.produceGeneralMessage(Config.KAFKA_CONFIG, KafkaProducer, Enum.Events.Event.Type.NOTIFICATION, Enum.Transfers.AdminNotificationActions.LIMIT_ADJUSTMENT, createLimitAdjustmentMessageProtocol(payload), Enum.Events.EventStatus.SUCCESS)
    return ParticipantFacade.addLimitAndInitialPosition(participant.participantCurrencyId, settlementAccount.participantCurrencyId, limitAndInitialPosition, true)
  } catch (err) {
    logger.error('error adding limit and initial position', { participantName, limitAndInitialPositionObj, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
    logger.debug('getting position by participant currency id', { participantCurrencyId })
    return ParticipantPositionModel.getByParticipantCurrencyId(participantCurrencyId)
  } catch (err) {
    logger.error('error getting position by participant currency id', { participantCurrencyId, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
    logger.debug('getting position change by participant position id', { participantPositionId })
    return ParticipantPositionChangeModel.getByParticipantPositionId(participantPositionId)
  } catch (err) {
    logger.error('error getting position change by participant position id', { participantPositionId, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
    logger.debug('destroying participant position by name and currency', { name, currencyId })
    const participant = await ParticipantFacade.getByNameAndCurrency(name, currencyId, Enum.Accounts.LedgerAccountType.POSITION)
    logger.debug('destroying participant position for participant', { participant })
    participantExists(participant)
    return ParticipantPositionModel.destroyByParticipantCurrencyId(participant.participantCurrencyId)
  } catch (err) {
    logger.error('error destroying participant position by name and currency', { name, currencyId, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
    logger.debug('destroying participant limit by name and currency', { name, currencyId })
    const participant = await ParticipantFacade.getByNameAndCurrency(name, currencyId, Enum.Accounts.LedgerAccountType.POSITION)
    logger.debug('destroying participant limit for participant', { participant })
    participantExists(participant)
    return ParticipantLimitModel.destroyByParticipantCurrencyId(participant.participantCurrencyId)
  } catch (err) {
    logger.error('error destroying participant limit by name and currency', { name, currencyId, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
      logger.debug('getting limits by name and currency', { name, currency, type })
      participant = await ParticipantFacade.getByNameAndCurrency(name, currency, Enum.Accounts.LedgerAccountType.POSITION)
      logger.debug('getting limits for participant', { participant })
      participantExists(participant)
      return ParticipantFacade.getParticipantLimitsByCurrencyId(participant.participantCurrencyId, type)
    } else {
      logger.debug('getting limits by name', { name, type })
      participant = await ParticipantModel.getByName(name)
      logger.debug('getting limits for participant', { participant })
      participantExists(participant)
      return ParticipantFacade.getParticipantLimitsByParticipantId(participant.participantId, type, Enum.Accounts.LedgerAccountType.POSITION)
    }
  } catch (err) {
    logger.error('error getting limits', { name, currency, type, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
    logger.debug('getting limits for all participants', { currency, type })
    return ParticipantFacade.getLimitsForAllParticipants(currency, type, Enum.Accounts.LedgerAccountType.POSITION)
  } catch (err) {
    logger.error('error getting limits for all participants', { currency, type, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
    logger.debug('adjusting limits', { name, payload })
    const { limit, currency } = payload
    const participant = await ParticipantFacade.getByNameAndCurrency(name, currency, Enum.Accounts.LedgerAccountType.POSITION)
    logger.debug('adjusting limits for participant', { participant, limit })
    participantExists(participant)
    const result = await ParticipantFacade.adjustLimits(participant.participantCurrencyId, limit)
    payload.name = name
    await Kafka.produceGeneralMessage(Config.KAFKA_CONFIG, KafkaProducer, Enum.Events.Event.Type.NOTIFICATION, Enum.Transfers.AdminNotificationActions.LIMIT_ADJUSTMENT, createLimitAdjustmentMessageProtocol(payload), Enum.Events.EventStatus.SUCCESS)
    return result
  } catch (err) {
    logger.error('error adjusting limits', { name, payload, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const createLimitAdjustmentMessageProtocol = (payload, action = Enum.Transfers.AdminNotificationActions.LIMIT_ADJUSTMENT, state = '', pp = '') => {
  return {
    id: randomUUID(),
    from: payload.name,
    to: Config.HUB_NAME,
    type: 'application/json',
    content: {
      headers: {},
      payload
    },
    metadata: {
      event: {
        id: randomUUID(),
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
    logger.debug('getting positions', { name, query })
    if (query.currency) {
      const participant = await ParticipantFacade.getByNameAndCurrency(name, query.currency, Enum.Accounts.LedgerAccountType.POSITION)
      logger.debug('getting positions for participant', { participant })
      participantExists(participant)
      const result = await PositionFacade.getByNameAndCurrency(name, Enum.Accounts.LedgerAccountType.POSITION, query.currency) // TODO this function only takes a max of 3 params, this has 4
      let position = {}
      if (Array.isArray(result) && result.length > 0) {
        position = {
          currency: result[0].currencyId,
          value: result[0].value,
          changedDate: result[0].changedDate
        }
      }
      logger.debug('found positions for participant', { participant, position })
      return position
    } else {
      const participant = await ParticipantModel.getByName(name)
      logger.debug('getting positions for participant', { participant })
      participantExists(participant)
      const result = await await PositionFacade.getByNameAndCurrency(name, Enum.Accounts.LedgerAccountType.POSITION)
      const positions = []
      if (Array.isArray(result) && result.length > 0) {
        result.forEach(item => {
          positions.push({
            currency: item.currencyId,
            value: item.value,
            changedDate: item.changedDate
          })
        })
      }
      logger.debug('found positions for participant', { participant, positions })
      return positions
    }
  } catch (err) {
    logger.error('error getting positions', { name, query, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getAccounts = async (name, query) => {
  try {
    logger.debug('getting accounts', { name, query })
    const participant = await ParticipantModel.getByName(name)
    logger.debug('getting accounts for participant', { participant })
    participantExists(participant)
    const result = await PositionFacade.getAllByNameAndCurrency(name, query.currency)
    const positions = []
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
    logger.debug('found accounts for participant', { participant, positions })
    return positions
  } catch (err) {
    logger.error('error getting accounts', { name, query, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const updateAccount = async (payload, params, enums) => {
  try {
    logger.debug('updating account', { payload, params })
    const { name, id } = params
    const participant = await ParticipantModel.getByName(name)
    logger.debug('updating account for participant', { participant })
    participantExists(participant)
    const account = await ParticipantCurrencyModel.getById(id)
    logger.debug('updating account for participant', { participant, account })
    if (!account) {
      throw ErrorHandler.Factory.createInternalServerFSPIOPError(AccountNotFoundErrorText)
    } else if (account.participantId !== participant.participantId) {
      throw ErrorHandler.Factory.createInternalServerFSPIOPError(ParticipantAccountMismatchText)
    } else if (account.ledgerAccountTypeId !== enums.ledgerAccountType.POSITION) {
      throw ErrorHandler.Factory.createInternalServerFSPIOPError(AccountNotPositionTypeErrorText)
    }
    return await ParticipantCurrencyModel.update(id, payload.isActive)
  } catch (err) {
    logger.error('error updating account', { payload, params, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getLedgerAccountTypeName = async (name) => {
  try {
    logger.debug('getting ledger account type by name', { name })
    return await LedgerAccountTypeModel.getLedgerAccountByName(name)
  } catch (err) {
    logger.error('error getting ledger account type by name', { name, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getParticipantAccount = async (accountParams) => {
  try {
    logger.debug('getting participant account by params', { accountParams })
    return await ParticipantCurrencyModel.findOneByParams(accountParams)
  } catch (err) {
    logger.error('error getting participant account by params', { accountParams, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
        id: randomUUID(),
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
  const { action } = payload
  const actions = {
    recordFundsIn: {
      payer: fspName,
      payee: enums.hubParticipant.name
    },
    recordFundsOutPrepareReserve: {
      payer: enums.hubParticipant.name,
      payee: fspName
    },
    recordFundsOutCommit: {
      payer: enums.hubParticipant.name,
      payee: fspName
    },
    recordFundsOutAbort: {
      payer: enums.hubParticipant.name,
      payee: fspName
    }
  }
  if (!actions[action]) throw ErrorHandler.Factory.createInternalServerFSPIOPError(ActionNotSupportedText)
  return Object.assign(payload, actions[action])
}

const recordFundsInOut = async (payload, params, enums) => {
  try {
    logger.debug('recording funds in/out', { payload, params, enums })
    const { name, id, transferId } = params
    const participant = await ParticipantModel.getByName(name)
    const currency = (payload.amount && payload.amount.currency) || null
    const isAccountActive = null
    const checkIsActive = true
    participantExists(participant, checkIsActive)
    const accounts = await ParticipantFacade.getAllAccountsByNameAndCurrency(name, currency, isAccountActive)
    const accountMatched = accounts[accounts.map(account => account.participantCurrencyId).findIndex(i => i === id)]
    logger.debug('recording funds in/out for participant account', { participant, accountMatched })
    if (!accountMatched) {
      throw ErrorHandler.Factory.createInternalServerFSPIOPError(ParticipantAccountCurrencyMismatchText)
    } else if (!accountMatched.accountIsActive) {
      throw ErrorHandler.Factory.createInternalServerFSPIOPError(AccountInactiveErrorText)
    } else if (accountMatched.ledgerAccountTypeId !== enums.ledgerAccountType.SETTLEMENT) {
      throw ErrorHandler.Factory.createInternalServerFSPIOPError(AccountNotSettlementTypeErrorText)
    }
    transferId && (payload.transferId = transferId)
    const messageProtocol = createRecordFundsMessageProtocol(setPayerPayeeFundsInOut(name, payload, enums))
    messageProtocol.metadata.request = {
      params,
      enums
    }
    return await Kafka.produceGeneralMessage(Config.KAFKA_CONFIG, KafkaProducer, Enum.Events.Event.Type.ADMIN, Enum.Events.Event.Action.TRANSFER, messageProtocol, Enum.Events.EventStatus.SUCCESS)
  } catch (err) {
    logger.error('error recording funds in/out', { payload, params, enums, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const validateHubAccounts = async (currency) => {
  const ledgerAccountTypes = await Enums.getEnums('ledgerAccountType')
  const hubReconciliationAccountExists = await ParticipantCurrencyModel.hubAccountExists(currency, ledgerAccountTypes.HUB_RECONCILIATION)
  if (!hubReconciliationAccountExists) {
    logger.error('Hub reconciliation account for the specified currency does not exist')
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR, 'Hub reconciliation account for the specified currency does not exist')
  }
  const hubMlnsAccountExists = await ParticipantCurrencyModel.hubAccountExists(currency, ledgerAccountTypes.HUB_MULTILATERAL_SETTLEMENT)
  if (!hubMlnsAccountExists) {
    logger.error('Hub multilateral net settlement account for the specified currency does not exist')
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR, 'Hub multilateral net settlement account for the specified currency does not exist')
  }
  return true
}

const createAssociatedParticipantAccounts = async (currency, ledgerAccountTypeId, trx) => {
  try {
    logger.debug('creating associated participant accounts', { currency, ledgerAccountTypeId })
    const nonHubParticipantWithCurrencies = await ParticipantFacade.getAllNonHubParticipantsWithCurrencies(trx)

    const participantCurrencies = nonHubParticipantWithCurrencies.map(item => ({
      participantId: item.participantId,
      currencyId: currency,
      ledgerAccountTypeId,
      isActive: true
    }))

    const participantPositionRecords = []
    for (const participantCurrency of participantCurrencies) {
      // create account only if it doesn't exist
      const existingParticipant = await getById(participantCurrency.participantId)
      const currencyExists = existingParticipant.currencyList.find(curr => {
        return curr.currencyId === currency && curr.ledgerAccountTypeId === ledgerAccountTypeId
      })
      if (!currencyExists) {
        const participantCurrencyId = await createParticipantCurrency(participantCurrency.participantId, participantCurrency.currencyId, participantCurrency.ledgerAccountTypeId, participantCurrency.isActive)
        participantPositionRecords.push({
          participantCurrencyId,
          value: 0.0000,
          reservedValue: 0.0000
        })
      }
    }
    await ParticipantPositionModel.createParticipantPositionRecords(participantPositionRecords, trx)
  } catch (err) {
    logger.error('error creating associated participant accounts', { currency, ledgerAccountTypeId, err })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
  getLimitsForAllParticipants,
  validateHubAccounts,
  createAssociatedParticipantAccounts
}
