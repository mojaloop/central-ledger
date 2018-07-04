'use strict'

const TransferService = require('../../domain/transfer')
const TokenService = require('../../domain/token')
const SettlementService = require('../../domain/settlement')
const Sidecar = require('../../lib/sidecar')

exports.rejectExpired = async function (request, h) {
  Sidecar.logRequest(request)
  return await TransferService.rejectExpired()
}

exports.settle = async function (request, h) {
  Sidecar.logRequest(request)
  const settledTransfers = await TransferService.settle()
  const settledFee = 0
  return SettlementService.performSettlement(settledTransfers, settledFee)
}

exports.rejectExpiredTokens = async function (request, h) {
  Sidecar.logRequest(request)
  return TokenService.removeExpired()
}
