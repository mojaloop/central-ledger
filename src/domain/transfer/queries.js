'use strict'

const TransfersReadModel = require('./models/transfers-read-model')

const getById = (id) => {
  return TransfersReadModel.getById(id)
}

const findExpired = () => {
  return TransfersReadModel.findExpired()
}

module.exports = {
  findExpired,
  getById
}
