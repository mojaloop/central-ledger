'use strict'

const P = require('bluebird')
const UnauthorizedError = require('@mojaloop/central-services-auth').UnauthorizedError
const AccountService = require('../account')
const TokenService = require('./index')
const Config = require('../../lib/config')
const Crypto = require('../../lib/crypto')
const Time = require('../../lib/time')

const validateToken = (token, bearer) => {
  const expired = token.expiration && (token.expiration < Time.getCurrentUTCTimeInMilliseconds())
  return !expired && Crypto.verifyHash(token.token, bearer)
}

const getAccount = (name) => {
  if (Config.ADMIN_KEY && Config.ADMIN_KEY === name) {
    return P.resolve({is_admin: true, accountId: null})
  } else {
    return AccountService.getByName(name)
  }
}

const validate = async function (request, token, h) {
  const headers = request.headers
  const apiKey = headers['ledger-api-key']
  if (!apiKey) {
    throw new UnauthorizedError('"Ledger-Api-Key" header is required')
  }
  const account = await getAccount(apiKey)
  if (!account) {
    throw new UnauthorizedError('"Ledger-Api-Key" header is not valid')
  }
  if (!account.is_admin) {
    return h.response({credentials: null, isValid: false})
  }
  const results = await TokenService.byAccount(account)
  if (!results || results.length === 0) {
    return h.response({credentials: null, isValid: false})
  }
  return await P.all(results.map(x => validateToken(x, token)))
    .then((verifications) => verifications.some(x => x))
    .then(verified => h.response({isValid: verified, credentials: account}))
}

module.exports = {
  validate
}
