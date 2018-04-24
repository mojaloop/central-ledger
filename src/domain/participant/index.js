'use strict'

const P = require('bluebird')
const Model = require('./model')
const ValidationError = require('../../errors').ValidationError
const UrlParser = require('../../lib/urlparser')
const Crypto = require('../../lib/crypto')

const createParticipant = (name, hashedPassword, emailAddress) => {
  return Model.create({ name, hashedPassword, emailAddress })
}

const create = (payload) => {
  return Crypto.hash(payload.password)
    .then(hashedPassword => {
      return createParticipant(payload.name, hashedPassword, payload.emailAddress)
      .then(participant => ({
        participantId: participant.participantId,
        name: participant.name,
        createdDate: participant.createdDate,
        emailAddress: participant.emailAddress
      }))
    })
}

const createLedgerParticipant = (name, password, emailAddress) => {
  return Model.getByName(name)
    .then(participant => {
      if (!participant) {
        return create({ name, password, emailAddress })
      }
      return participant
    })
}

const exists = (participantUri) => {
  return new P((resolve, reject) => {
    UrlParser.nameFromParticipantUri(participantUri, (err, result) => {
      if (err) {
        reject(new ValidationError(`Invalid participant URI: ${participantUri}`))
      }
      resolve(result)
    })
  })
    .then(name => {
      return Model.getByName(name)
        .then(participant => {
          if (participant) {
            return participant
          }
          throw new ValidationError(`Participant ${name} not found`)
        })
    })
}

const getAll = () => {
  return Model.getAll()
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

const update = (name, payload) => {
  return Model.getByName(name).then(participant => {
    return Model.update(participant, payload.is_disabled)
  })
}

const updatePartyCredentials = (participant, payload) => {
  return Crypto.hash(payload.password).then(hashedPassword => {
    return Model.updatePartyCredentials(participant, hashedPassword).then(() => participant)
  })
}
const updateParticipantSettlement = (participant, payload) => {
  return Model.updateParticipantSettlement(participant, payload)
}

const retrievePartyCredentials = (participant) => {
  return Model.retrievePartyCredentials(participant)
}

const verifyPartyCredentials = (participant, userCredentials, password) => {
  return Crypto.verifyHash(userCredentials.password, password)
    .then(match => {
      if (match) {
        return participant
      }
      throw new Error('Partyname and password are invalid')
    })
}

const verify = async function (name, password) {
  const participant = await Model.getByName(name)
  participantExists(participant)
  const userCredentials = await retrievePartyCredentials(participant)
  return verifyPartyCredentials(participant, userCredentials, password)
}

module.exports = {
  create,
  createLedgerParticipant,
  exists,
  getAll,
  getById,
  getByName,
  verify,
  update,
  updatePartyCredentials,
  updateParticipantSettlement
}
