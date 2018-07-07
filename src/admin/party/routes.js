'use strict'

const Joi = require('joi')
const Handler = require('./handler')
const RouteConfig = require('../route-config')
const Permissions = require('../../domain/security/permissions')

const tags = ['api', 'parties']

module.exports = [
  {
    method: 'GET',
    path: '/parties',
    handler: Handler.getAll,
    options: RouteConfig.config(tags, Permissions.PARTIES_LIST)
  },
  {
    method: 'GET',
    path: '/parties/{id}',
    handler: Handler.getById,
    options: RouteConfig.config(tags, Permissions.PARTIES_VIEW, {
      validate: {
        params: {
          id: Joi.string().guid().description('Party Id')
        }
      }
    })
  },
  {
    method: 'PUT',
    path: '/parties/{id}',
    handler: Handler.update,
    options: RouteConfig.config(tags, Permissions.PARTIES_UPDATE, {
      payload: {
        allow: 'application/json',
        failAction: 'error'
      },
      validate: {
        params: {
          id: Joi.string().guid().description('Party Id')
        },
        payload: {
          firstName: Joi.string().description('First name'),
          lastName: Joi.string().description('Last name'),
          key: Joi.string().description('Login key'),
          email: Joi.string().description('Email address'),
          isActive: Joi.bool().description('Active party')
        }
      }
    })
  },
  {
    method: 'POST',
    path: '/parties',
    handler: Handler.create,
    options: RouteConfig.config(tags, Permissions.PARTIES_CREATE, {
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
    path: '/parties/{id}',
    handler: Handler.remove,
    options: RouteConfig.config(tags, Permissions.PARTIES_DELETE, {
      validate: {
        params: {
          id: Joi.string().guid().description('Party Id')
        }
      }
    })
  },
  {
    method: 'GET',
    path: '/parties/{id}/role',
    handler: Handler.getRole,
    options: RouteConfig.config(tags, Permissions.PARTIES_ROLE_LIST, {
      validate: {
        params: {
          id: Joi.string().guid().description('Party Id')
        }
      }
    })
  },
  {
    method: 'POST',
    path: '/parties/{id}/role',
    handler: Handler.updateRole,
    options: RouteConfig.config(tags, Permissions.PARTIES_ROLE_UPDATE, {
      payload: {
        allow: 'application/json',
        failAction: 'error'
      },
      validate: {
        params: {
          id: Joi.string().guid().description('Party Id')
        },
        payload: Joi.array().items(Joi.string().guid()).required().description('Role ids')
      }
    })
  }
]
