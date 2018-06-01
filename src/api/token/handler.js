'use strict'

const TokenService = require('../../domain/token')
const Sidecar = require('../../lib/sidecar')

const create = async function (req, rep) {
  Sidecar.logRequest(req)
  const token = await TokenService.create(req.auth.credentials)
  return token
}

module.exports = {
  create
}
