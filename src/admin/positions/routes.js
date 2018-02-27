const Handler = require('./handler')
// const Auth = require('../auth')
const Permissions = require('../../domain/security/permissions')
const RouteConfig = require('../route-config')
const tags = ['api', 'positions']
const Joi = require('joi')

module.exports = [
  {
    method: 'GET',
    path: '/positions',
    handler: Handler.calculateForAllAccounts,
    options: RouteConfig.config(tags, Permissions.POSITIONS_LIST)
  },
  {
    method: 'GET',
    path: '/positions/{name}',
    handler: Handler.calculateForAccount,
    options: RouteConfig.config(tags, Permissions.POSITIONS_VIEW, {
      validate: {
        params: {
          name: Joi.string().required().description('Account Name required')
        }
      }
    })
  }
]
