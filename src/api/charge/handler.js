'use strict'

const Charge = require('../../domain/charge')
const Util = require('../../lib/util')

function entityItem (charge) {
  return {
    name: charge.name,
    charge_type: charge.charge_type,
    code: charge.code,
    amount: Util.formatAmount(charge.amount),
    currency_code: 'USD',
    currency_symbol: '$'
  }
}

exports.chargeQuote = async function (request, h) {
  try {
    const charges = await Charge.quote(request.payload)
    return charges.map(entityItem)
  } catch (err) {
    throw err
  }
}
