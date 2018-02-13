'use strict'

const Glob = require('glob')

exports.register = function (server, options, next) {
  Glob.sync('**/routes.js', { cwd: __dirname, ignore: 'routes.js' })
    .forEach(x => server.route(require('./' + x)))
}

exports.name = 'admin routes'

exports.register.attributes = {
  name: 'admin routes'
}
