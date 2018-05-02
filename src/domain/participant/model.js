'use strict'

const Db = require('../../db')

exports.getById = (id) => {
  return Db.participant.findOne({ participantId: id })
}

exports.getByName = (name) => {
  return Db.participant.findOne({ name })
}

exports.retrievePartyCredentials = (participant) => {
  return Db.userCredentials.findOne({ participantId: participant.participantId })
}

exports.getAll = () => {
  return Db.participant.find({}, { order: 'name asc' })
}

exports.update = (participant, isDisabled) => {
  return Db.participant.update({ participantId: participant.participantId }, { isDisabled })
}

exports.updatePartyCredentials = (participant, hashedPassword) => {
  return Db.userCredentials.update({ participantId: participant.participantId }, { password: hashedPassword })
}

exports.updateParticipantSettlement = (participant, settlement) => {
  return Db.participantSettlement.findOne({ participantId: participant.participantId })
    .then(participantSettlement => {
      if (participantSettlement) {
        return Db.participantSettlement.update({ participantId: participant.participantId }, { participantNumber: settlement.participant_number, routingNumber: settlement.routing_number }).then(updatedSettlement => {
          return {
            participantName: participant.name,
            participantNumber: updatedSettlement.participantNumber,
            routingNumber: updatedSettlement.routingNumber
          }
        })
      }
      return Db.participantSettlement.insert({ participantId: participant.participantId, participantNumber: settlement.participant_number, routingNumber: settlement.routing_number }).then(insertedSettlement => {
        return {
          participantName: participant.name,
          participantNumber: insertedSettlement.participantNumber,
          routingNumber: insertedSettlement.routingNumber
        }
      })
    })
}

exports.create = (participant) => {
  return Db.participant.insert({ name: participant.name, emailAddress: participant.emailAddress })
  .then(insertedParticipant => {
    const newparticipant = Db.participant.findOne({ participantId: insertedParticipant })
    return Db.userCredentials.insert({ participantId: insertedParticipant, password: participant.hashedPassword })
      .then(() => newparticipant)
  })
}
