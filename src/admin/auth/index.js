'use strict'

const Config = require('../../lib/config')
const AdminStrategy = require('./admin')
const TokenStrategy = require('./token')

exports.plugin = {
  name: 'admin auth',
  register: function (server, options) {
    server.auth.strategy('simple', 'basic', {validate: AdminStrategy.validate})
    // server.auth.default('simple')
    server.auth.strategy('jwt-strategy', 'hapi-now-auth', {
      verifyJWT: true,
      keychain: [Config.ADMIN_SECRET],
      // keychain: ['secret'],
      validate: TokenStrategy.validate
    })
  }
}

exports.tokenAuth = (permission) => {
  if (!Config.ENABLE_TOKEN_AUTH) {
    return false
  }

  if (!permission) {
    return TokenStrategy.name
  }

  return {strategy: TokenStrategy.name, scope: permission.key}
}
