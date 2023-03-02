'use strict'

const Glob = require('glob')

exports.plugin = {
  name: 'api routes',
  register: function (server) {
    Glob.sync('**/routes.js', { cwd: __dirname, ignore: 'routes.js' })
      .forEach(x => server.route(require('./' + x)))
  }
}
