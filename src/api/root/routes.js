'use strict'

const tags = ['api', 'root']
const Handler = require('./handler')

module.exports = [
  {
    method: 'GET',
    path: '/',
    handler: Handler.metadata,
    options: {
      tags: tags,
      description: 'Metadata'
    }
  },
  {
    method: 'GET',
    path: '/health',
    handler: function (request, h) {
      return h.response({ status: 'OK' }).code(200)
    },
    options: {
      tags
    }
  },
  {
    method: 'GET',
    path: '/enums',
    handler: async function (request, h) {
      let enums = await request.server.methods.enums('all')
      return h.response(enums).code(200)
    },
    options: {
      tags
    }
  }
]
