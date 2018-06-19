'use strict'

const Glob = require('glob')

exports.plugin = {
  name: 'admin routes',
  register: function (server, options) {
    Glob.sync('**/routes.js', { cwd: __dirname, ignore: 'routes.js' })
      .forEach(x => server.route(require('./' + x)))
  }
}
