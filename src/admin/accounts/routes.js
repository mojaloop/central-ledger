'use strict'

const Handler = require('./handler')
const Joi = require('joi')
const Permissions = require('../../domain/security/permissions')
const RouteConfig = require('../route-config')

const tags = ['api', 'accounts']
const nameValidator = Joi.string().alphanum().min(3).max(30).required().description('Name of the account')
const passwordValidator = Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required().description('Password for the account')

module.exports = [
  {
    method: 'GET',
    path: '/accounts',
    handler: Handler.getAll,
    options: RouteConfig.config(tags, Permissions.ACCOUNTS_LIST)
  },
  {
    method: 'GET',
    path: '/accounts/{name}',
    handler: Handler.getByName,
    options: RouteConfig.config(tags, Permissions.ACCOUNTS_VIEW, {
      params: {
        name: Joi.string().required().description('Account name')
      }
    })
  },
  {
    method: 'POST',
    path: '/accounts',
    handler: Handler.create,
    options: RouteConfig.config(tags, Permissions.ACCOUNTS_CREATE, {
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: {
          name: nameValidator,
          password: passwordValidator,
          emailAddress: Joi.string().email().required()
        }
      }
    })
  },
  {
    method: 'PUT',
    path: '/accounts/{name}',
    handler: Handler.update,
    options: RouteConfig.config(tags, Permissions.ACCOUNTS_UPDATE, {
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: {
          is_disabled: Joi.boolean().required().description('Account is_disabled boolean')
        },
        params: {
          name: Joi.string().required().description('Account name')
        }
      }
    })
  }
]
