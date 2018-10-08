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
const ParticipantFacade = require('../../models/participant/facade')
const PositionFacade = require('../../models/position/facade')
const Config = require('../../lib/config')
const Enum = require('../../lib/enum')

const create = async (payload) => {
  try {
    const participant = await ParticipantModel.create({ name: payload.name })
    if (!participant) throw new Error('Something went wrong. Participant cannot be created')
    return participant
  } catch (err) {
    throw err
  }
}

const getAll = async () => {
  try {
    // TODO: refactor the query to use the facade layer and join query for both tables
    let all = await ParticipantModel.getAll()
    await Promise.all(all.map(async (participant) => {
      participant.currencyList = await ParticipantCurrencyModel.getByParticipantId(participant.participantId, Enum.LedgerAccountType.POSITION)
    }))
    return all
  } catch (err) {
    throw new Error(err.message)
  }
}

const getById = async (id) => {
  // TODO: refactor the query to use the facade layer and join query for both tables
  let participant = await ParticipantModel.getById(id)
  if (participant) {
    participant.currencyList = await ParticipantCurrencyModel.getByParticipantId(participant.participantId, Enum.LedgerAccountType.POSITION)
  }
  return participant
}

const getByName = async (name) => {
  // TODO: refactor the query to use the facade layer and join query for both tables
  let participant = await ParticipantModel.getByName(name)
  if (participant) {
    participant.currencyList = await ParticipantCurrencyModel.getByParticipantId(participant.participantId, Enum.LedgerAccountType.POSITION)
  }
  return participant
}

const participantExists = (participant) => {
  if (participant) {
    return participant
  }
  throw new Error('Participant does not exist')
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

const createParticipantCurrency = async (participantId, currencyId, ledgerAccountTypeId) => {
  try {
    const participantCurrency = await ParticipantCurrencyModel.create(participantId, currencyId, ledgerAccountTypeId)
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
 * @description This retuns the active endpoint value for a give participant and type of endpoint
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
 * @description This retuns all the active endpoints for a give participant
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
 * @function DestroyPariticpantEndpointByName
 *
 * @async
 * @description This functions deletes the existing endpoints for a given participant name
 * else, it will throw and error
 *
 * @param {string} name - participant name
 *
 * @returns {integer} - Returns the number of rows deleted if successful, or throws an error if failed
 */

const destroyPariticpantEndpointByName = async (name) => {
  try {
    const participant = await ParticipantModel.getByName(name)
    participantExists(participant)
    return ParticipantModel.destroyPariticpantEndpointByParticipantId(participant.participantId)
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
 * ParticipantFacade.addLimitAndInitialPosition called to add the participant initial postion and limits
 *
 * @param {string} name - the name of the participant. Example 'dfsp1'
 * @param {object} limitAndInitialPositionObj - the payload containing the currency, limit and initial postion values
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
    const existingLimit = await ParticipantLimitModel.getByParticipantCurrencyId(participant.participantCurrencyId)
    const existingPosition = await ParticipantPositionModel.getByParticipantCurrencyId(participant.participantCurrencyId)
    if (existingLimit || existingPosition) {
      throw new Error('Participant Limit or Initial Position already set')
    }
    let limitAndInitialPosition = limitAndInitialPositionObj
    if (limitAndInitialPosition.initialPosition == null) {
      limitAndInitialPosition.initialPosition = Config.PARTICIPANT_INITIAL_POSTITION
    }
    return ParticipantFacade.addLimitAndInitialPosition(participant.participantCurrencyId, limitAndInitialPosition)
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
 * @description This retuns the active endpoint value for a give participant and type of endpoint
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
 *    "value": 10000000
 *  }
 * }
 *
 * @returns {integer} - Returns number of database rows affected if successful, or throws an error if failed
 */

const adjustLimits = async (name, payload) => {
  try {
    const participant = await ParticipantFacade.getByNameAndCurrency(name, payload.currency, Enum.LedgerAccountType.POSITION)
    participantExists(participant)
    return ParticipantFacade.adjustLimits(participant.participantCurrencyId, payload.limit)
  } catch (err) {
    throw err
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
 * 2. if the currency object is not passed, then it return an array containig the above mentioned objects for all the currencies defined for that participant.
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
      const result = await PositionFacade.getByNameAndCurrency(name, query.currency, Enum.LedgerAccountType.POSITION)
      let position = {}
      if (Array.isArray(result) && result.length > 0) {
        position = {
          currency: result[0].currencyId,
          value: result[0].value,
          updatedTime: result[0].changedDate
        }
      }
      return position
    } else {
      const participant = await ParticipantModel.getByName(name)
      participantExists(participant)
      const result = await await PositionFacade.getByNameAndCurrency(name, null, Enum.LedgerAccountType.POSITION)
      let positions = []
      if (Array.isArray(result) && result.length > 0) {
        result.forEach(item => {
          positions.push({
            currency: item.currencyId,
            value: item.value,
            updatedTime: item.changedDate
          })
        })
      }
      return positions
    }
  } catch (err) {
    throw err
  }
}

module.exports = {
  create,
  getAll,
  getById,
  getByName,
  participantExists,
  update,
  createParticipantCurrency,
  getParticipantCurrencyById,
  destroyByName,
  addEndpoint,
  getEndpoint,
  getAllEndpoints,
  destroyPariticpantEndpointByName,
  addLimitAndInitialPosition,
  getPositionByParticipantCurrencyId,
  getPositionChangeByParticipantPositionId,
  destroyParticipantPositionByNameAndCurrency,
  destroyParticipantLimitByNameAndCurrency,
  getLimits,
  adjustLimits,
  getPositions
}
