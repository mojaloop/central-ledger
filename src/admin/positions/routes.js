const Handler = require('./handler')
// const Auth = require('../auth')
const Permissions = require('../../domain/security/permissions')
const RouteConfig = require('../route-config')
const tags = ['api', 'positions']

module.exports = [{
  method: 'GET',
  path: '/positions',
  handler: Handler.calculateForAllAccounts,
  config: RouteConfig.config(tags, Permissions.POSITIONS_LIST)
}
]
