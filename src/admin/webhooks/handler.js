'use strict'

const TransferService = require('../../domain/transfer')
const FeeService = require('../../domain/fee')
const TokenService = require('../../domain/token')
const SettlementService = require('../../domain/settlements')
const Sidecar = require('../../lib/sidecar')

exports.rejectExpired = function (request, reply) {
  Sidecar.logRequest(request)
  return TransferService.rejectExpired()
    .then(response => reply(response))
    .catch(e => reply(e))
}

exports.settle = function (request, reply) {
  Sidecar.logRequest(request)
  return TransferService.settle()
    .then(settledTransfers => {
      return FeeService.settleFeesForTransfers(settledTransfers)
        .then(settledFees => {
          return reply(SettlementService.performSettlement(settledTransfers, settledFees))
        })
    })
    .catch(e => reply(e))
}

exports.rejectExpiredTokens = function (request, reply) {
  Sidecar.logRequest(request)
  return TokenService.removeExpired()
    .then(response => reply(response))
    .catch(e => reply(e))
}
