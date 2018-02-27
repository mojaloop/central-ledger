'use strict'

const Config = require('../../lib/config')
const AccountStrategy = require('./account')
const TokenStrategy = require('./token')

exports.plugin = {
  name: 'auth',
  register: function (server, options) {
    server.auth.strategy('simple', 'basic', {validate: AccountStrategy.validate})
    // server.auth.strategy(AccountStrategy.name, AccountStrategy.scheme, { validate: AccountStrategy.validate })
    server.auth.strategy('bearer', 'bearer-access-token', { validate: TokenStrategy.validate })
  }
}

exports.strategy = (optional = false) => {
  if (!Config.ENABLE_TOKEN_AUTH && !Config.ENABLE_BASIC_AUTH) {
    return false
  }
  const strategy = (Config.ENABLE_TOKEN_AUTH ? TokenStrategy.name : AccountStrategy.scheme)
  const mode = (optional ? 'try' : 'required')
  return {
    mode,
    strategy
  }
}

