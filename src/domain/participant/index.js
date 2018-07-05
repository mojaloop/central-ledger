'use strict'

const ParticipantModel = require('../../models/participant/participant')
const ParticipantCurrencyModel = require('../../models/participant/participantCurrency')
// const ValidationError = require('../../errors').ValidationError
// const UrlParser = require('../../lib/urlParser')
// const Crypto = require('../../lib/crypto')

const create = async (payload) => {
  // return Crypto.hash(payload.password)
  //   .then(hashedPassword => {
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
  getParticipantCurrencyById
  // exists,
  // verify
}
