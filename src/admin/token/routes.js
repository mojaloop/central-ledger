'use strict'

const Joi = require('joi')
const Handler = require('./handler')
const AdminAuthStrategy = require('../auth/admin')
const tags = ['api', 'token']

module.exports = [
  {
    method: 'POST',
    path: '/auth_token',
    handler: Handler.create,
    options: {
      tags,
      auth: AdminAuthStrategy.scheme,
      description: 'Get a token for admin authentication',
      payload: {
        allow: 'application/json',
        failAction: 'error'
      },
      validate: {
        payload: {
          key: Joi.string().required().description('Login key')
        }
      }
    }
  }
]
