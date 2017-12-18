'use strict'

const TransfersReadModel = require('./models/transfers-read-model')

const getAll = () => {
  return TransfersReadModel.getAll()
}

const getById = (id) => {
  return TransfersReadModel.getById(id)
}

const findExpired = () => {
  return TransfersReadModel.findExpired()
}

module.exports = {
  getAll,
  findExpired,
  getById
}
