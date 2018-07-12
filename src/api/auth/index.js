'use strict'

const Config = require('../../lib/config')
const ParticipantStrategy = require('./participant')
const TokenStrategy = require('./token')

exports.plugin = {
  name: 'auth',
  register: function (server, options) {
    server.auth.strategy('simple', 'basic', {validate: ParticipantStrategy.validate})
    // server.auth.strategy(ParticipantStrategy.name, ParticipantStrategy.scheme, { validate: ParticipantStrategy.validate })
    server.auth.strategy('bearer', 'bearer-access-token', { validate: TokenStrategy.validate })
  }
}

exports.strategy = (optional = false) => {
  if (!Config.ENABLE_TOKEN_AUTH && !Config.ENABLE_BASIC_AUTH) {
    return false
  }
  const strategy = (Config.ENABLE_TOKEN_AUTH ? TokenStrategy.name : ParticipantStrategy.scheme)
  const mode = (optional ? 'try' : 'required')
  return {
    mode,
    strategy
  }
}
