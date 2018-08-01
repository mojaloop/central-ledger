'use strict'

const Handler = require('./handler')
const RouteConfig = require('../../shared/routeConfig')
const Permissions = require('../../domain/security/permissions')
const tags = ['api', 'commands']

module.exports = [
  {
    method: 'POST',
    path: '/TODO/webhooks/reject-expired-transfers',
    handler: Handler.rejectExpired,
    options: RouteConfig.config(tags, Permissions.TRANSFERS_REJECT_EXPIRED)
  },
  {
    method: 'POST',
    path: '/TODO/webhooks/reject-expired-tokens',
    handler: Handler.rejectExpiredTokens,
    options: RouteConfig.config(tags, Permissions.TOKENS_REJECT_EXPIRED)
  },
  {
    method: 'POST',
    path: '/TODO/webhooks/settle-transfers',
    handler: Handler.settle,
    options: RouteConfig.config(tags, Permissions.TRANSFERS_SETTLE)
  }
]
