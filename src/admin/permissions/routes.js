'use strict'

const Handler = require('./handler')
const Permissions = require('../../domain/security/permissions')
const RouteConfig = require('../../shared/routeConfig')
const tags = ['api', 'permissions']

module.exports = [
  {
    method: 'GET',
    path: '/permissions',
    handler: Handler.getPermissions,
    options: RouteConfig.config(tags, Permissions.PERMISSIONS_LIST)
  }
]
