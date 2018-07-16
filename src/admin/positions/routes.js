const Handler = require('./handler')
// const Auth = require('../auth')
const Permissions = require('../../domain/security/permissions')
const RouteConfig = require('../routeConfig')
const tags = ['api', 'positions']
const Joi = require('joi')

module.exports = [
  {
    method: 'GET',
    path: '/TODO/positions',
    handler: Handler.calculateForAllParticipants,
    options: RouteConfig.config(tags, Permissions.POSITIONS_LIST)
  },
  {
    method: 'GET',
    path: '/TODO/positions/{name}',
    handler: Handler.calculateForParticipant,
    options: RouteConfig.config(tags, Permissions.POSITIONS_VIEW, {
      validate: {
        params: {
          name: Joi.string().required().description('Participant Name required')
        }
      }
    })
  }
]
