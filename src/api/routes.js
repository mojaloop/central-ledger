'use strict'

const {
  globSync
} = require('glob')

exports.plugin = {
  name: 'api routes',
  register: function (server) {
    globSync('**/routes.js', { cwd: __dirname, ignore: 'routes.js' })
      .forEach(x => server.route(require('./' + x)))
  }
}
