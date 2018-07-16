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
const ParticipantFacade = require('../../models/participant/facade')

const create = async (payload) => {
  try {
    const participant = await ParticipantModel.create({name: payload.name})
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
 * @param {object} payload - the payload containing and endpoint object with 'type' and 'value' of the endpoint.
 * Example: {
 *      "endpoint": {
 *      "type": "FSIOP_CALLBACK_URL",
 *      "value": "http://localhost:3001/participants/dfsp1/notification12"
 *    }
 * }
 * @returns {integer} - Returns number of database rows affected if successful, or throws an error if failed
 */

const addEndpoint = async (name, payload) => {
  try {
    const participant = await ParticipantModel.getByName(name)
    participantExists(participant)
    return ParticipantFacade.addEndpoint(participant.participantId, payload.endpoint)
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
    participantEndpointExists(participantEndpoint)
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
    participantEndpointExists(participantEndpoints)
    return participantEndpoints
  } catch (err) {
    throw err
  }
}

/**
 * @function ParticipantEndpointExists
 *
 * @async
 * @description This functions checks if the participantEndpoint is valid array and its not empty,
 * else, it will throw and error
 *
 * @param {array} participantEndpoint - a list of participantEndpoints
 *
 * @returns {array} - Returns the same participantEndpoint array if successful, or throws an error if failed
 */

const participantEndpointExists = (participantEndpoint) => {
  if (Array.isArray(participantEndpoint) && participantEndpoint.length > 0) {
    return participantEndpoint
  }
  throw new Error('participantEndpoint does not exist')
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
  participantEndpointExists
}
