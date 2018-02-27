'use strict'

const JWT = require('../../domain/security/jwt')
const Sidecar = require('../../lib/sidecar')

const create = async function (request, h) {
  Sidecar.logRequest(request)
  return await JWT.create(request.payload.key)
}

module.exports = {
  create
}
