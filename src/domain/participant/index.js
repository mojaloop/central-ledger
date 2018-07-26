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
const ParticipantLimitModel = require('../../models/participant/participantLimit')
const ParticipantFacade = require('../../models/participant/facade')
const Config = require('../../lib/config')

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
      participant.currencyList = await ParticipantCurrencyModel.getByParticipantId(participant.participantId)
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
    participant.currencyList = await ParticipantCurrencyModel.getByParticipantId(participant.participantId)
  }
  return participant
}

const getByName = async (name) => {
  // TODO: refactor the query to use the facade layer and join query for both tables
  let participant = await ParticipantModel.getByName(name)
  if (participant) {
    participant.currencyList = await ParticipantCurrencyModel.getByParticipantId(participant.participantId)
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

const createParticipantCurrency = async (participantId, currencyId) => {
  try {
    const participantCurrency = await ParticipantCurrencyModel.create(participantId, currencyId)
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
 *      "type": "FSIOP_CALLBACK_URL",
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
 * @param {string} type - the type of the endpoint. Example 'FSIOP_CALLBACK_URL'
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
 * @function AddInitialPositionAndLimits
 *
 * @async
 * @description This creates the initial position and limits for a participant
 *
 * ParticipantModel.getByName called to get the participant details from the participant name
 * ParticipantFacade.addInitialPositionAndLimits called to add the participant initial postion and limits
 *
 * @param {string} name - the name of the participant. Example 'dfsp1'
 * @param {object} payload - the payload containing the currency, limit and initial postion values
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

const addInitialPositionAndLimits = async (name, payload) => {
  try {
    const participant = await ParticipantFacade.getByNameAndCurrency(name, payload.currency)
    participantExists(participant)
    const existingLimit = await ParticipantLimitModel.getByParticipantCurrencyId(participant.participantCurrencyId)
    const existingPosition = await ParticipantPositionModel.getByParticipantCurrencyId(participant.participantCurrencyId)
    if (existingLimit || existingPosition) {
      throw new Error('Participant Limit or Initial Position already set')
    }
    const limitPostionObj = payload
    if (limitPostionObj.initialPosition == null) {
      limitPostionObj.initialPosition = Config.PARTICIPANT_INITIAL_POSTITION
    }
    return ParticipantFacade.addInitialPositionAndLimits(participant.participantCurrencyId, limitPostionObj)
  } catch (err) {
    throw err
  }
}

/**
 * @function DestroyPariticpantPositionByNameAndCurrency
 *
 * @async
 * @description This functions deletes the existing position for a given participant name
 * else, it will throw and error
 *
 * @param {string} name - participant name
 *
 * @returns {integer} - Returns the number of rows deleted if successful, or throws an error if failed
 */

const destroyPariticpantPositionByNameAndCurrency = async (name, currencyId) => {
  try {
    const participant = await ParticipantFacade.getByNameAndCurrency(name, currencyId)
    participantExists(participant)
    return ParticipantPositionModel.destroyByParticipantCurrencyId(participant.participantCurrencyId)
  } catch (err) {
    throw err
  }
}

/**
 * @function DestroyPariticpantLimitByName
 *
 * @async
 * @description This functions deletes the existing limits for a given participant name
 * else, it will throw and error
 *
 * @param {string} name - participant name
 *
 * @returns {integer} - Returns the number of rows deleted if successful, or throws an error if failed
 */

const destroyPariticpantLimitByNameAndCurrency = async (name, currencyId) => {
  try {
    const participant = await ParticipantFacade.getByNameAndCurrency(name, currencyId)
    participantExists(participant)
    return ParticipantLimitModel.destroyByParticipantCurrencyId(participant.participantCurrencyId)
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
  addInitialPositionAndLimits,
  destroyPariticpantPositionByNameAndCurrency,
  destroyPariticpantLimitByNameAndCurrency
}
