'use strict'

const RouteConfig = require('../routeConfig')
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
  }
]
