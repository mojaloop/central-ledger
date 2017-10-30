'use strict'

const Joi = require('joi')
const Handler = require('./handler')
const RouteConfig = require('../route-config')
const Permissions = require('../../domain/security/permissions')

const tags = ['api', 'users']

module.exports = [
  {
    method: 'GET',
    path: '/users',
    handler: Handler.getAll,
    config: RouteConfig.config(tags, Permissions.USERS_LIST)
  },
  {
    method: 'GET',
    path: '/users/{id}',
    handler: Handler.getById,
    config: RouteConfig.config(tags, Permissions.USERS_VIEW, {
      params: {
        id: Joi.string().guid().description('User Id')
      }
    })
  },
  {
    method: 'PUT',
    path: '/users/{id}',
    handler: Handler.update,
    config: RouteConfig.config(tags, Permissions.USERS_UPDATE, {
      params: {
        id: Joi.string().guid().description('User Id')
      },
      payload: {
        firstName: Joi.string().description('First name'),
        lastName: Joi.string().description('Last name'),
        key: Joi.string().description('Login key'),
        email: Joi.string().description('Email address'),
        isActive: Joi.bool().description('Active user')
      }
    })
  },
  {
    method: 'POST',
    path: '/users',
    handler: Handler.create,
    config: RouteConfig.config(tags, Permissions.USERS_CREATE, {
      payload: {
        firstName: Joi.string().required().description('First name'),
        lastName: Joi.string().required().description('Last name'),
        key: Joi.string().required().description('Login key'),
        email: Joi.string().required().description('Email address')
      }
    })
  },
  {
    method: 'DELETE',
    path: '/users/{id}',
    handler: Handler.remove,
    config: RouteConfig.config(tags, Permissions.USERS_DELETE, {
      params: {
        id: Joi.string().guid().description('user id')
      }
    })
  },
  {
    method: 'GET',
    path: '/users/{id}/roles',
    handler: Handler.getRoles,
    config: RouteConfig.config(tags, Permissions.USERS_ROLES_LIST, {
      params: {
        id: Joi.string().guid().description('user id')
      }
    })
  },
  {
    method: 'POST',
    path: '/users/{id}/roles',
    handler: Handler.updateRoles,
    config: RouteConfig.config(tags, Permissions.USERS_ROLES_UPDATE, {
      params: {
        id: Joi.string().guid().description('user id')
      },
      payload: Joi.array().items(Joi.string().guid()).required().description('Role ids')
    })
  }
]
