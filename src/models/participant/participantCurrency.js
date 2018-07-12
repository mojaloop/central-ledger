
'use strict'

const Db = require('../../db')

exports.create = async (participantId, currencyId) => {
  try {
    let result = await Db.participantCurrency.insert({
      participantId,
      currencyId,
      createdBy: 'unknown'
    })
    return result
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.getById = async (id) => {
  try {
    return await Db.participantCurrency.findOne({ participantCurrencyId: id })
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.getByParticipantId = async (id) => {
  try {
    return await Db.participantCurrency.find({ participantId: id }, { order: 'currencyId asc' })
  } catch (err) {
    throw new Error(err.message)
  }
}
