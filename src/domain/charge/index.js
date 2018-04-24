'use strict'

const Model = require('./model')
const Decimal = require('decimal.js')
const Errors = require('../../errors')

const PERCENTAGE = 'percent'
const FLAT = 'flat'

function typeExists (rateType) {
  return rateType === PERCENTAGE || rateType === FLAT
}

function filterCharge (charge, amount) {
  amount = new Decimal(amount)

  return (!charge.minimum || amount.greaterThanOrEqualTo(charge.minimum)) &&
    (!charge.maximum || amount.lessThanOrEqualTo(charge.maximum)) &&
    typeExists(charge.rateType)
}

function quoteAmount (charge, amount) {
  switch (charge.rateType) {
    case PERCENTAGE:
      const rate = new Decimal(charge.rate)
      const transferAmount = new Decimal(amount)
      return rate.times(transferAmount).valueOf()
    case FLAT:
      return new Decimal(charge.rate).valueOf()
  }
}

function chargeQuote (charge, amount) {
  return {
    name: charge.name,
    charge_type: charge.chargeType,
    code: charge.code,
    amount: quoteAmount(charge, amount)
  }
}

const create = (charge) => {
  return Model.create(charge)
}

const update = (name, payload) => {
  return Model.getByName(name).then(charge => {
    if (!charge) {
      throw new Errors.NotFoundError('The charge could not be found')
    }
    return Model.update(charge, payload)
  })
}

const getByName = (name) => {
  return Model.getByName(name)
}

const getAll = () => {
  return Model.getAll()
}

const getAllSenderAsPayer = () => {
  return Model.getAllSenderAsPayer()
}

const getAllForTransfer = (transfer) => {
  return getAll().then(charge => charge.filter(charge => filterCharge(charge, transfer.payerAmount)))
}

const quote = (transaction) => {
  return getAllSenderAsPayer().then(charge => charge.filter(charge => filterCharge(charge, transaction.amount))
    .map(charge => chargeQuote(charge, transaction.amount)))
}

module.exports = {
  create,
  update,
  getByName,
  getAll,
  getAllForTransfer,
  quote
}
