'use strict'

const JWT = require('../../domain/security/jwt')
const Sidecar = require('../../lib/sidecar')

const create = function (request, h) {
  Sidecar.logRequest(request)
  return JWT.create(request.payload.key)
}

module.exports = {
  create
}
