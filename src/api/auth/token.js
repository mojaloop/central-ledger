'use strict'

const TokenAuth = require('../../domain/token/auth')

module.exports = {
  name: 'bearer-access-token',
  scheme: 'bearer',
  validate: TokenAuth.validate
}
