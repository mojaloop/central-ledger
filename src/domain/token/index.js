'use strict'

const Crypto = require('../../lib/crypto')
const Model = require('./model')
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

const create = ({ accountId }) => {
  return generateToken().then(result => {
    return Model.create({ accountId, token: result.tokenHash, expiration: getTokenExpiration() })
      .then(() => ({ token: result.token }))
  })
}

const byAccount = ({ accountId }) => {
  return Model.byAccount({ accountId })
}

const removeExpired = () => {
  return Model.removeExpired()
}

module.exports = {
  create,
  byAccount,
  removeExpired
}
