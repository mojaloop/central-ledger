'use strict'

const Handler = require('./handler')
const Joi = require('joi')
const Permissions = require('../../domain/security/permissions')
const RouteConfig = require('../route-config')

const tags = ['api', 'accounts']
const nameValidator = Joi.string().token().max(256).required().description('Name of the account')
const passwordValidator = Joi.string().token().max(256).required().description('Password for the account')
const emailAddressValidator = Joi.string().email()

module.exports = [
  {
    method: 'GET',
    path: '/accounts',
    handler: Handler.getAll,
    config: RouteConfig.config(tags, Permissions.ACCOUNTS_LIST)
  },
  {
    method: 'GET',
    path: '/accounts/{name}',
    handler: Handler.getByName,
    config: RouteConfig.config(tags, Permissions.ACCOUNTS_VIEW, {
      params: {
        name: Joi.string().required().description('Account name')
      }
    })
  },
  {
    method: 'POST',
    path: '/accounts',
    handler: Handler.create,
    config: RouteConfig.config(tags, Permissions.ACCOUNTS_CREATE, {
      payload: {
        name: nameValidator,
        password: passwordValidator,
        emailAddress: emailAddressValidator
      }
    })
  },
  {
    method: 'PUT',
    path: '/accounts/{name}',
    handler: Handler.update,
    config: RouteConfig.config(tags, Permissions.ACCOUNTS_UPDATE, {
      params: {
        name: Joi.string().required().description('Account name')
      },
      payload: {
        is_disabled: Joi.boolean().required().description('Account is_disabled boolean')
      }
    })
  }
]
