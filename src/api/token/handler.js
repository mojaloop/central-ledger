'use strict'

const TokenService = require('../../domain/token')
const Sidecar = require('../../lib/sidecar')

const create = (req, rep) => {
  Sidecar.logRequest(req)
  TokenService.create(req.auth.credentials)
    .then(token => rep(token))
    .catch(e => rep(e))
}

module.exports = {
  create
}
