'use strict'

const P = require('bluebird')
const UnauthorizedError = require('@mojaloop/central-services-auth').UnauthorizedError
const ParticipantService = require('../participant')
const TokenService = require('./index')
const Config = require('../../lib/config')
const Crypto = require('../../lib/crypto')
const Time = require('../../lib/time')

const validateToken = (token, bearer) => {
  const expired = token.expiration && (token.expiration < Time.getCurrentUTCTimeInMilliseconds())
  return !expired && Crypto.verifyHash(token.token, bearer)
}

const getParticipant = (name) => {
  if (Config.ADMIN_KEY && Config.ADMIN_KEY === name) {
    return P.resolve({is_admin: true, participantId: null})
  } else {
    return ParticipantService.getByName(name)
  }
}

const validate = async function (request, token, h) {
  const headers = request.headers
  const apiKey = headers['ledger-api-key']
  if (!apiKey) {
    throw new UnauthorizedError('"Ledger-Api-Key" header is required')
  }
  const participant = await getParticipant(apiKey)
  if (!participant) {
    throw new UnauthorizedError('"Ledger-Api-Key" header is not valid')
  }
  if (!participant.is_admin) {
    return h.response({credentials: null, isValid: false})
  }
  const results = await TokenService.byParticipant(participant)
  if (!results || results.length === 0) {
    return h.response({credentials: null, isValid: false})
  }
  return await P.all(results.map(x => validateToken(x, token)))
    .then((verifications) => verifications.some(x => x))
    .then(verified => h.response({isValid: verified, credentials: participant}))
}

module.exports = {
  validate
}
