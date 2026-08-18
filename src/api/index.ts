'use strict'

process.env.UV_THREADPOOL_SIZE = '12'

const RoutesAdmin = require('./routes')
const RoutesSettlement = require('../settlement/api/routes')
import Config from '../lib/config/index'
const Logger = require('../shared/logger').logger
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
}).catch(
  // Ignore this code path in coverage, since we explicitly don't test it in the runner.
  /* istanbul ignore next */
  (err: any) => {
    /* istanbul ignore next */
  Logger.error(`Setup.initialize() failed with error: ${err.message}.\nCalling process.exit(1)`)
  /* istanbul ignore next */
  process.exit(1)
})
