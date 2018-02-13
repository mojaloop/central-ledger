const Handler = require('./handler')
const tags = ['api', 'metadata']

module.exports = [
  {
    method: 'GET',
    path: '/health',
    handler: function (request, h) {
      return h.response({ status: 'OK' }).code(200)
    },
    config: {
      tags: tags,
      description: 'Status of ledger',
      id: 'health'
    }
  },
  {
    method: 'GET',
    path: '/',
    handler: Handler.metadata,
    config: {
      tags: tags,
      description: 'Metadata'
    }
  }
]
