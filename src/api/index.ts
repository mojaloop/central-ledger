'use strict'

process.env.UV_THREADPOOL_SIZE = '12'

import Config from '../lib/config'
const Routes = require('./routes')
const Setup = require('../shared/setup')
const MetricsPlugin = require('@mojaloop/central-services-metrics').plugin

module.exports = Setup.initialize({
  service: 'api',
  port: Config.PORT,
  modules: [Routes, !Config.INSTRUMENTATION_METRICS_DISABLED && MetricsPlugin].filter(Boolean),
  runMigrations: Config.RUN_MIGRATIONS,
  runHandlers: !Config.HANDLERS_DISABLED
})
