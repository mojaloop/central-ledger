'use strict'

const Config = require('../lib/config')
const Routes = require('./routes')
const Setup = require('../shared/setup')

module.exports = Setup.initialize({
  service: 'api',
  port: Config.PORT,
  modules: [Routes],
  runMigrations: Config.RUN_MIGRATIONS,
  runHandlers: !Config.HANDLERS_DISABLED
})
