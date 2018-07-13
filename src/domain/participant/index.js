'use strict'

/**
 * @module src/domain/participant/
 */

const ParticipantModel = require('../../models/participant/participant')
const ParticipantCurrencyModel = require('../../models/participant/participantCurrency')
const ParticipantFacade = require('../../models/participant/facade')

const create = async (payload) => {
  try {
    const participant = await ParticipantModel.create({ name: payload.name, currency: payload.currency })
    if (!participant) throw new Error('Something went wrond. Participant cannot be created')
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
 *	    "endpoint": {
 *		  "type": "FSIOP_CALLBACK_URL",
 *		  "value": "http://localhost:3001/participants/dfsp1/notification12"
 *	  }
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

// const exists = async (participantUri) => {
//   try {
//     const name = UrlParser.nameFromParticipantUri(participantUri)
//     if (!name) {
//       return new ValidationError(`Invalid participant URI: ${participantUri}`)
//     }
//     const participant = await ParticipantModel.getByName(name)
//     if (participant) {
//       return participant
//     }
//     throw new ValidationError(`Participant ${name} not found`)
//   } catch (err) {
//     throw err
//   }
// }

// const verify = async function (name, password) {
//   const participant = await ParticipantModel.getByName(name)
//   participantExists(participant)
//   const userCredentials = await retrievePartyCredentials(participant)
//   return verifyPartyCredentials(participant, userCredentials, password)
// }

module.exports = {
  create,
  getAll,
  getById,
  getByName,
  participantExists,
  update,
  createParticipantCurrency,
  getParticipantCurrencyById,
  addEndpoint,
  getEndpoint,
  getAllEndpoints,
  participantEndpointExists
  // exists,
  // verify
}
