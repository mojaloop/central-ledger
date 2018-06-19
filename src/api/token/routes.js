'use strict'

const Handler = require('./handler')
const AccountAuthStrategy = require('../auth/account')
const tags = ['api', 'token']

module.exports = [
  {
    method: 'GET',
    path: '/auth_token',
    handler: Handler.create,
    options: {
      tags,
      auth: AccountAuthStrategy.scheme,
      description: 'Get a token that can be used to authenticate future requests',
      id: 'auth_token'
    }
  }
]
