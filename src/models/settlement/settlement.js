'use strict'

const Uuid = require('uuid4')
const Db = require('../../db')

exports.generateId = () => {
  return Uuid()
}

exports.create = (id, settlementType) => {
  return Db.settlement.insert({ settlementId: id, settlementType })
}

exports.findById = (id) => {
  return Db.settlement.findOne({settlementId: id})
}
