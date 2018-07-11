'use strict'

const JWT = require('jsonwebtoken')
const Promise = require('bluebird')
const Config = require('../../lib/config')
const Errors = require('../../errors')
const SecurityService = {}

const create = (key) => {
  const expiresIn = (Config.TOKEN_EXPIRATION || 3600000) / 1000
  return SecurityService.getPartyByKey(key)
    .then(party => JWT.sign({ userInfo: { partyId: party.partyId } }, Config.ADMIN_SECRET, { algorithm: 'HS512', expiresIn, issuer: Config.HOSTNAME }))
}

const verify = (token) => {
  return new Promise((resolve, reject) => {
    JWT.verify(token, Config.ADMIN_SECRET, { algorithm: ['HS512'], issuer: Config.HOSTNAME }, (err, decoded) => {
      if (err) {
        return reject(new Errors.UnauthorizedError('Invalid token'))
      }
      return resolve(decoded)
    })
  })
    .then(decoded => {
      const partyId = decoded.userInfo.partyId
      return Promise.props({
        party: SecurityService.getPartyById(partyId),
        role: SecurityService.getPartyRole(partyId)
      })
    })
    .catch(Errors.NotFoundError, () => {
      throw new Errors.UnauthorizedError('Invalid token')
    })
}

module.exports = {
  create,
  verify
}
