'use strict'

process.env.UV_THREADPOOL_SIZE = 12

const Config = require('../lib/config')
const RoutesAdmin = require('./routes')
const RoutesSettlement = require('../settlement/api/routes')
const Setup = require('../shared/setup')
const MetricsPlugin = require('@mojaloop/central-services-metrics').plugin

module.exports = Setup.initialize({
  service: 'api',
  port: Config.PORT,
  modules: [
    RoutesAdmin,
    RoutesSettlement,
    !Config.INSTRUMENTATION_METRICS_DISABLED && MetricsPlugin
  ].filter(Boolean),
  runMigrations: Config.RUN_MIGRATIONS,
  runHandlers: !Config.HANDLERS_DISABLED
})
