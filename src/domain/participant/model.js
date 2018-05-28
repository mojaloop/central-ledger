
'use strict'

const Db = require('../../db')

exports.getById = async (id) => {
  try {
    return await Db.participant.findOne({ participantId: id })
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.getByName = async (name) => {
  try {
    const named = await Db.participant.findOne({ name })
    return named
  } catch (err) {
    throw new Error(err.message)
  }
}

// exports.retrievePartyCredentials = async (participant) => {
//   try {
//   } catch (err) {
//     throw new Error(err.message)
//   }
// }

exports.getAll = async () => {
  try {
    const participants = await Db.participant.find({}, { order: 'name asc' })
    return participants
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.update = async (participant, isDisabled) => {
  try {
    return await Db.participant.update({ participantId: participant.participantId }, { isDisabled })
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.destroyByName = async (participant) => {
  try {
    return await Db.participant.destroy({name: participant.name})
  } catch (err) {
    throw new Error(err.message)
  }
}

// exports.updatePartyCredentials = async (participant, hashedPassword) => {
//   try {
//     return Db.userCredentials.update({ participantId: participant.participantId }, { password: hashedPassword })
//   } catch (err) {
//     throw new Error(err.message)
//   }
// }

// exports.updateParticipantSettlement = async (participant, settlement) => {
//   try {
//     const participantSettlement = await Db.participantSettlement.findOne({ participantId: participant.participantId })
//     if (participantSettlement) {
//       const updatedSettlement = await Db.participantSettlement.update({
//         participantId: participant.participantId
//       }, {
//         participantNumber: settlement.participant_number,
//         routingNumber: settlement.routing_number
//       })
//       return {
//         participantName: participant.name,
//         participantNumber: updatedSettlement.participantNumber,
//         routingNumber: updatedSettlement.routingNumber
//       }
//     }
//     const insertedSettlement = await Db.participantSettlement.insert({
//       participantId: participant.participantId,
//       participantNumber: settlement.participant_number,
//       routingNumber: settlement.routing_number
//     })
//     return {
//       participantName: participant.name,
//       participantNumber: insertedSettlement.participantNumber,
//       routingNumber: insertedSettlement.routingNumber
//     }
//   } catch (err) {
//     throw new Error(err.message)
//   }
// }

exports.create = async (participant) => {
  try {
    return await Db.participant.insert({
      name: participant.name,
      currencyId: participant.currency
    })
    // const created = await Db.participant.findOne({ participantId: insertedParticipant })
  } catch (err) {
    throw new Error(err.message)
  }
}
