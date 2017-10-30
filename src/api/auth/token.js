'use strict'

const TokenAuth = require('../../domain/token/auth')

module.exports = {
  name: 'token',
  scheme: 'bearer',
  validate: TokenAuth.validate(false)
}

