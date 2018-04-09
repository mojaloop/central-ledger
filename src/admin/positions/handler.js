'use strict'

const PositionService = require('../../domain/position')
const Account = require('../../domain/account')

exports.calculateForAllAccounts = async function (request, h) {
  const positions = await PositionService.calculateForAllAccounts()
  return h.response({ positions: positions })
}

exports.calculateForAccount = async function (request, h) {
  const account = await Account.getByName(request.params.name)
  const positions = await PositionService.calculateForAccount(account)
  return h.response(positions)
}
