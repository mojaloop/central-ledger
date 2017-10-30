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
    config: {
      tags,
      auth: AdminAuthStrategy.name,
      description: 'Get a token for admin authentication',
      validate: {
        payload: {
          key: Joi.string().required().description('Login key')
        }
      }
    }
  }
]
