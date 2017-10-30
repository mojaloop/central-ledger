'use strict'

const RouteConfig = require('../route-config')
const tags = ['api', 'root']

module.exports = [
  {
    method: 'GET',
    path: '/',
    handler: (request, reply) => reply({ status: 'OK' }).code(200),
    config: RouteConfig.config(tags, 'Status of ledger admin api')
  },
  {
    method: 'GET',
    path: '/health',
    handler: (request, reply) => reply({ status: 'OK' }).code(200),
    config: RouteConfig.config(tags, 'Status of ledger admin api')
  }
]
