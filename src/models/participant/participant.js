
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

exports.getAll = async () => {
  try {
    const participants = await Db.participant.find({}, { order: 'name asc' })
    return participants
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.create = async (participant) => {
  try {
    let result = await Db.participant.insert({
      name: participant.name,
      createdBy: 'unknown'
    })
    return result
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.update = async (participant, isActive) => {
  try {
    return await Db.participant.update({ participantId: participant.participantId }, { isActive })
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
