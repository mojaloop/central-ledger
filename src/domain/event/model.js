'use strict'

const Db = require('@mojaloop/central-services-database').Db

exports.getById = async (eventNameId) => {
  try {
    return await Db.eventName.findOne({ eventNameId })
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.saveEventName = async (eventName) =>{
  try {
    return await Db.eventName.insert(eventName)
  } catch (e) {
    throw e
  }
}

exports.getAll = async () => {
  try {
    return await Db.eventName.find({}, { order: 'eventName asc' })
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.update = async (eventNameId, value, description) => {
  try {
    return await Db.eventName.update({ eventNameId }, { value, description })
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.truncate = async() => {
  try {
    return await Db.eventName.truncate()
  }catch (err) {
    throw  new Error(err.message)
  }
}

