'use strict'

const tags = ['api', 'root']

module.exports = [
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
