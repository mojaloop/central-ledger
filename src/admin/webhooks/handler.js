'use strict'

const TransferService = require('../../domain/transfer')
const FeeService = require('../../domain/fee')
const TokenService = require('../../domain/token')
const SettlementService = require('../../domain/settlements')
const Sidecar = require('../../lib/sidecar')

exports.rejectExpired = async function (request, h) {
  Sidecar.logRequest(request)
  return await TransferService.rejectExpired()
}

exports.settle = async function (request, h) {
  Sidecar.logRequest(request)
  const settledTransfers = await TransferService.settle()
  const settledFees = await FeeService.settleFeesForTransfers(settledTransfers)
  return SettlementService.performSettlement(settledTransfers, settledFees)
}

exports.rejectExpiredTokens = async function (request, h) {
  Sidecar.logRequest(request)
  return TokenService.removeExpired()
}
