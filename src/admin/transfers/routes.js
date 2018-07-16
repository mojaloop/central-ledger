'use strict'

const Handler = require('./handler')
const Permissions = require('../../domain/security/permissions')
const RouteConfig = require('../routeConfig')

const tags = ['api', 'transfers']

module.exports = [
  {
    method: 'GET',
    path: '/transfers',
    handler: Handler.getAll,
    options: RouteConfig.config(tags, Permissions.TRANSFERS_LIST)
  }
]
