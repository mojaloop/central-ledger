'use strict'

const JWT = require('../../domain/security/jwt')
const Sidecar = require('../../lib/sidecar')

const create = (request, reply) => {
  Sidecar.logRequest(request)
  JWT.create(request.payload.key)
    .then(token => reply({ token }))
    .catch(reply)
}

module.exports = {
  create
}
