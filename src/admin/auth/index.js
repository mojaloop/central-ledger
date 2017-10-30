'use strict'

const Config = require('../../lib/config')
const AdminStrategy = require('./admin')
const TokenStrategy = require('./token')

exports.register = (server, options, next) => {
  server.auth.strategy(AdminStrategy.name, AdminStrategy.scheme, { validate: AdminStrategy.validate })
  server.auth.strategy(TokenStrategy.name, TokenStrategy.scheme, { validate: TokenStrategy.validate })
  next()
}

exports.register.attributes = {
  name: 'admin auth'
}

exports.tokenAuth = (permission) => {
  if (!Config.ENABLE_TOKEN_AUTH) {
    return false
  }

  if (!permission) {
    return TokenStrategy.name
  }

  return { strategy: TokenStrategy.name, scope: permission.key }
}
