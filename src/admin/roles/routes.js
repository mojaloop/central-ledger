'use strict'

const Joi = require('joi')
const Handler = require('./handler')
const Permissions = require('../../domain/security/permissions')
const RouteConfig = require('../route-config')
const tags = ['api', 'roles']

const nameValidator = Joi.string().max(256).description('Name of role')
const descriptionValidator = Joi.string().max(1000).optional().description('Description of role')
const permissionsValidator = Joi.array().items(Joi.string().valid(Object.keys(Permissions))).description('Role permissions')

module.exports = [
  {
    method: 'GET',
    path: '/roles',
    handler: Handler.getRoles,
    options: RouteConfig.config(tags, Permissions.ROLES_LIST)
  },
  {
    method: 'POST',
    path: '/roles',
    handler: Handler.createRole,
    options: RouteConfig.config(tags, Permissions.ROLES_CREATE, {
      validate: {
        payload: {
          name: nameValidator.required(),
          description: descriptionValidator,
          permissions: permissionsValidator.required()
        }
      }
    })
  },
  {
    method: 'PUT',
    path: '/roles/{id}',
    handler: Handler.updateRole,
    config: RouteConfig.config(tags, Permissions.ROLES_UPDATE, {
      options: {
        validate: {
          params: {
            id: Joi.string().guid().required().description('Id of role to update')
          },
          payload: {
            name: nameValidator,
            description: descriptionValidator,
            permissions: permissionsValidator
          }
        }
      }
    })
  },
  {
    method: 'DELETE',
    path: '/roles/{id}',
    handler: Handler.deleteRole,
    config: RouteConfig.config(tags, Permissions.ROLES_DELETE, {
      options: {
        validate: {
          params: {
            id: Joi.string().guid().required().description('Id of role to delete')
          }
        }
      }
    })
  }
]
