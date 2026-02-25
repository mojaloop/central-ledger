'use strict'

const { globSync } = require('node:fs')

exports.plugin = {
  name: 'api routes',
  register: function (server) {
    globSync('**/routes.js', { cwd: __dirname })
      .filter(x => x !== 'routes.js')
      .forEach(x => server.route(require('./' + x)))
  }
}
