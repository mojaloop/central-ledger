'use strict'

const Crypto = require('../../lib/crypto')
const TokenModel = require('../../models/token/token')
const Config = require('../../lib/config')
const Time = require('../../lib/time')

const hashToken = (token) => {
  return Crypto.hash(token).then(tokenHash => ({ token, tokenHash }))
}

const generateToken = () => {
  return Crypto.generateToken().then(hashToken)
}

const getTokenExpiration = () => {
  return Config.TOKEN_EXPIRATION ? (Time.getCurrentUTCTimeInMilliseconds() + Config.TOKEN_EXPIRATION) : null
}

const create = ({ participantId }) => {
  return generateToken().then(result => {
    return TokenModel.create({ participantId, token: result.tokenHash, expiration: getTokenExpiration() })
      .then(() => ({ token: result.token }))
  })
}

const byParticipant = ({ participantId }) => {
  return TokenModel.byParticipant({ participantId })
}

const removeExpired = () => {
  return TokenModel.removeExpired()
}

module.exports = {
  create,
  byParticipant,
  removeExpired
}
