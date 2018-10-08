'use strict'

const Handler = require('./handler')
const tags = ['api', 'token']

module.exports = [
  {
    method: 'GET',
    path: '/auth_token',
    handler: Handler.create,
    options: {
      tags,
      description: 'Get a token that can be used to authenticate future requests',
      id: 'auth_token'
    }
  }
]
