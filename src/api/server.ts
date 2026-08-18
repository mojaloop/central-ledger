'use strict'

import Config from '../lib/config/index'
const RoutesAdmin = require('./routes')
const Setup = require('../shared/setup')
const MetricsPlugin = require('@mojaloop/central-services-metrics').plugin
import Migrator from '../lib/migrator'

const server = {
  run: () => {
    return Setup.initialize({
      service: 'api',
      port: Config.PORT,
      modules: [
        RoutesAdmin,
        !Config.INSTRUMENTATION_METRICS_DISABLED && MetricsPlugin
      ].filter(Boolean),
      runMigrations: Config.RUN_MIGRATIONS,
      runHandlers: !Config.HANDLERS_DISABLED
    });
  },
  migrate: () => {
    return Migrator.migrate()
  }
}

export default server