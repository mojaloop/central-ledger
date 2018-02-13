'use strict'

const Config = require('../../lib/config')
const AdminStrategy = require('./admin')
const TokenStrategy = require('./token')

exports.register = (server) => {
  server.auth.strategy('simple', 'basic', {validate: AdminStrategy.validate})
  server.auth.default('simple')
  server.auth.strategy('jwt-strategy', 'hapi-now-auth', {
    verifyJWT: true,
    keychain: [Config.ADMIN_SECRET],
    validate: TokenStrategy.validate
  })
}

exports.register.attributes = {
  name: 'admin auth'
}

exports.name = 'admin auth'

exports.tokenAuth = (permission) => {
  if (!Config.ENABLE_TOKEN_AUTH) {
    return false
  }

  if (!permission) {
    return TokenStrategy.name
  }

  return {strategy: TokenStrategy.name, scope: permission.key}
}
