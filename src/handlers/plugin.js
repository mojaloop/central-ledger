'use strict'

exports.plugin = {
  name: 'handler routes',
  register: function (server, options) {
    server.route(require('./routes'))
  }
}
