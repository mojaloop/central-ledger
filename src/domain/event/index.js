'use strict'

const Model = require('./model');

const getAll = async () => {
  try {
    return await Model.getAll()
  } catch (err) {
    throw new Error(err.message)
  }
}

const update = async (eventNameId, value, description) => {
  try {
     return await Model.update(eventNameId, value, description)
  } catch (err) {
    throw new Error(err.message)
  }
}

module.exports = {
  getAll,
  update
}
