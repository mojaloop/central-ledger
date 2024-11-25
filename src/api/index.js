'use strict'

process.env.UV_THREADPOOL_SIZE = 12

const Config = require('../lib/config')
const Routes = require('./routes')
const Setup = require('../shared/setup')
const MetricsPlugin = require('@mojaloop/central-services-metrics').plugin

module.exports = Setup.initialize({
  service: 'api',
  port: Config.PORT,
  modules: [Routes, MetricsPlugin],
  runMigrations: Config.RUN_MIGRATIONS,
  runHandlers: !Config.HANDLERS_DISABLED
})
