'use strict'

// const P = require('bluebird')
const Model = require('./model')
// const ValidationError = require('../../errors').ValidationError
// const UrlParser = require('../../lib/urlparser')
// const Crypto = require('../../lib/crypto')

// const createParticipant = async (name, currency) => {
//   return Model.create({ name, currency }) // hashedPassword, emailAddress })
// }

const create = async (payload) => {
// return Crypto.hash(payload.password)
//   .then(hashedPassword => {
  try {
    const participant = await Model.create({ name: payload.name, currency: payload.currency })
    if (!participant) throw new Error('Something went wrond. Participant cannot be created')
    return participant
  } catch (err) {
    throw err
  }
}

// const createLedgerParticipant = async (name, password, emailAddress) => {
//   try {
//     const participant = await Model.getByName(name)
//     if (!participant) {
//       return await create({ name, password, emailAddress })
//     }
//     return participant
//   } catch (err) {
//     throw err
//   }
// }

// const exists = async (participantUri) => {
//   try {
//     const name = UrlParser.nameFromParticipantUri(participantUri)
//     if (!name) {
//       return new ValidationError(`Invalid participant URI: ${participantUri}`)
//     }
//     const participant = await Model.getByName(name)
//     if (participant) {
//       return participant
//     }
//     throw new ValidationError(`Participant ${name} not found`)
//   } catch (err) {
//     throw err
//   }
// }

const getAll = async () => {
  try {
    const all = await Model.getAll()
    return all
  } catch (err) {
    throw new Error(err.message)
  }
}

const getById = (id) => {
  return Model.getById(id)
}

const getByName = (name) => {
  return Model.getByName(name)
}

const participantExists = (participant) => {
  if (participant) {
    return participant
  }
  throw new Error('Participant does not exist')
}

const update = async (name, payload) => {
  try {
    const participant = await Model.getByName(name)
    participantExists(participant)
    await Model.update(participant, payload.is_disabled)
    return participant
  } catch (err) {
    throw err
  }
}

// const updatePartyCredentials = (participant, payload) => {
//   return Crypto.hash(payload.password).then(hashedPassword => {
//     return Model.updatePartyCredentials(participant, hashedPassword).then(() => participant)
//   })
// }
// const updateParticipantSettlement = (participant, payload) => {
//   return Model.updateParticipantSettlement(participant, payload)
// }

// const retrievePartyCredentials = (participant) => {
//   return Model.retrievePartyCredentials(participant)
// }

// const verifyPartyCredentials = (participant, userCredentials, password) => {
//   return Crypto.verifyHash(userCredentials.password, password)
//     .then(match => {
//       if (match) {
//         return participant
//       }
//       throw new Error('Partyname and password are invalid')
//     })
// }

// const verify = async function (name, password) {
//   const participant = await Model.getByName(name)
//   participantExists(participant)
//   const userCredentials = await retrievePartyCredentials(participant)
//   return verifyPartyCredentials(participant, userCredentials, password)
// }

module.exports = {
  create,
  // createLedgerParticipant,
  // exists,
  getAll,
  getById,
  getByName,
  participantExists,
  update
  // verify,
  // updatePartyCredentials,
  // updateParticipantSettlement
}
