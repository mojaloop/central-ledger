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
    options: RouteConfig.config(tags, Permissions.USERS_LIST)
  },
  {
    method: 'GET',
    path: '/users/{id}',
    handler: Handler.getById,
    options: RouteConfig.config(tags, Permissions.USERS_VIEW, {
      validate: {
        params: {
          id: Joi.string().guid().description('User Id')
        }
      }
    })
  },
  {
    method: 'PUT',
    path: '/users/{id}',
    handler: Handler.update,
    options: RouteConfig.config(tags, Permissions.USERS_UPDATE, {
      payload: {
        allow: 'application/json',
        failAction: 'error'
      },
      validate: {
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
      }
    })
  },
  {
    method: 'POST',
    path: '/users',
    handler: Handler.create,
    options: RouteConfig.config(tags, Permissions.USERS_CREATE, {
      payload: {
        allow: 'application/json',
        failAction: 'error'
      },
      validate: {
        payload: {
          firstName: Joi.string().required().description('First name'),
          lastName: Joi.string().required().description('Last name'),
          key: Joi.string().required().description('Login key'),
          email: Joi.string().required().description('Email address')
        }
      }
    })
  },
  {
    method: 'DELETE',
    path: '/users/{id}',
    handler: Handler.remove,
    options: RouteConfig.config(tags, Permissions.USERS_DELETE, {
      validate: {
        params: {
          id: Joi.string().guid().description('User Id')
        }
      }
    })
  },
  {
    method: 'GET',
    path: '/users/{id}/roles',
    handler: Handler.getRoles,
    options: RouteConfig.config(tags, Permissions.USERS_ROLES_LIST, {
      validate: {
        params: {
          id: Joi.string().guid().description('User Id')
        }
      }
    })
  },
  {
    method: 'POST',
    path: '/users/{id}/roles',
    handler: Handler.updateRoles,
    options: RouteConfig.config(tags, Permissions.USERS_ROLES_UPDATE, {
      payload: {
        allow: 'application/json',
        failAction: 'error'
      },
      validate: {
        params: {
          id: Joi.string().guid().description('User Id')
        },
        payload: Joi.array().items(Joi.string().guid()).required().description('Role ids')
      }
    })
  }
]
