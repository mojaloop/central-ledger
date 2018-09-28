'use strict'

const RouteConfig = require('../../shared/routeConfig')
const tags = ['api', 'root']

module.exports = [
  {
    method: 'GET',
    path: '/',
    handler: function (request, h) {
      return h.response({ status: 'OK' }).code(200)
    },
    options: RouteConfig.config(tags, 'Status of ledger admin api')
  },
  {
    method: 'GET',
    path: '/health',
    handler: function (request, h) {
      return h.response({ status: 'OK' }).code(200)
    },
    options: RouteConfig.config(tags, 'Status of ledger admin api')
  },
  {
    method: 'GET',
    path: '/enums',
    handler: async function (request, h) {
      let enums = await request.server.methods.enums('all')
      return h.response(enums).code(200)
    },
    options: RouteConfig.config(tags, 'List available enumerations')
  }
]
