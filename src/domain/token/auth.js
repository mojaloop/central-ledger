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

const getAccount = (name, adminOnly = false) => {
  if (Config.ADMIN_KEY && Config.ADMIN_KEY === name) {
    return P.resolve({ is_admin: true, accountId: null })
  } else if (adminOnly) {
    return P.resolve({ is_admin: false })
  } else {
    return AccountService.getByName(name)
  }
}

const validate = (adminOnly) => {
  return (request, token, cb) => {
    const headers = request.headers
    const apiKey = headers['ledger-api-key']
    if (!apiKey) {
      return cb(new UnauthorizedError('"Ledger-Api-Key" header is required'))
    }

    getAccount(apiKey, adminOnly)
      .then(account => {
        if (!account) {
          return cb(new UnauthorizedError('"Ledger-Api-Key" header is not valid'))
        }

        if (adminOnly && !account.is_admin) {
          return cb(null, false)
        }

        return TokenService.byAccount(account).then(results => {
          if (!results || results.length === 0) {
            return cb(null, false)
          }

          return P.all(results.map(x => validateToken(x, token)))
          .then((verifications) => verifications.some(x => x))
          .then(verified => cb(null, verified, account))
        })
      })
  }
}

module.exports = {
  validate
}
