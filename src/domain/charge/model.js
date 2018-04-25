'use strict'

const Db = require('../../db')
const Util = require('../../lib/util')

exports.create = (charge) => {
  return Db.charge.insert({
    name: charge.name,
    chargeType: charge.charge_type,
    rateType: charge.rate_type,
    rate: charge.rate,
    minimum: charge.minimum,
    maximum: charge.maximum,
    code: charge.code,
    isActive: charge.is_active,
    payerParticipantId: charge.payerParticipantId,
    payeeParticipantId: charge.payeeParticipantId
  })
}

exports.update = (charge, payload) => {
  const fields = {
    name: payload.name,
    chargeType: payload.charge_type,
    minimum: payload.minimum,
    maximum: payload.maximum,
    code: payload.code,
    isActive: payload.is_active
  }
  return Db.charge.update({ chargeId: charge.chargeId }, Util.filterUndefined(fields))
}

exports.getByName = (name) => {
  return Db.charge.findOne({ name })
}

exports.getAll = () => {
  return Db.charge.find({ isActive: true }, { order: 'name asc' })
}

exports.getAllSenderAsPayer = () => {
  return Db.charge.find({ payerParticipantId: 'sender', isActive: true }, { order: 'name asc' })
}
