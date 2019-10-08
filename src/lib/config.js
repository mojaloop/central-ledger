const RC = require('rc')('CLEDG', require('../../config/default.json'))

module.exports = {
  HOSTNAME: RC.HOSTNAME.replace(/\/$/, ''),
  PORT: RC.PORT,
  // ADMIN_PORT: RC.ADMIN_PORT,
  // DATABASE_URI: RC.DATABASE_URI,
  // DB_CONNECTION_POOL_MIN: RC.DB_CONNECTION.POOL_MIN,
  // DB_CONNECTION_POOL_MAX: RC.DB_CONNECTION.POOL_MAX,
  MONGODB_URI: RC.MONGODB.URI,
  MONGODB_DISABLED: RC.MONGODB.DISABLED,
  AMOUNT: RC.AMOUNT,
  EXPIRES_TIMEOUT: RC.EXPIRES_TIMEOUT,
  SIDECAR: RC.SIDECAR,
  SIDECAR_DISABLED: RC.SIDECAR.DISABLED,
  ERROR_HANDLING: RC.ERROR_HANDLING,
  HANDLERS: RC.HANDLERS,
  HANDLERS_DISABLED: RC.HANDLERS.DISABLED,
  HANDLERS_API: RC.HANDLERS.API,
  HANDLERS_API_DISABLED: RC.HANDLERS.API.DISABLED,
  HANDLERS_CRON: RC.HANDLERS.CRON,
  HANDLERS_CRON_DISABLED: RC.HANDLERS.CRON.DISABLED,
  HANDLERS_CRON_TIMEXP: RC.HANDLERS.CRON.TIMEXP,
  HANDLERS_CRON_TIMEZONE: RC.HANDLERS.CRON.TIMEZONE,
  HANDLERS_TIMEOUT: RC.HANDLERS.TIMEOUT,
  HANDLERS_TIMEOUT_DISABLED: RC.HANDLERS.TIMEOUT.DISABLED,
  HANDLERS_TIMEOUT_TIMEXP: RC.HANDLERS.TIMEOUT.TIMEXP,
  HANDLERS_TIMEOUT_TIMEZONE: RC.HANDLERS.TIMEOUT.TIMEZONE,
  KAFKA_CONFIG: RC.KAFKA,
  PARTICIPANT_INITIAL_POSITION: RC.PARTICIPANT_INITIAL_POSITION,
  RUN_MIGRATIONS: !RC.MIGRATIONS.DISABLED,
  RUN_DATA_MIGRATIONS: RC.MIGRATIONS.RUN_DATA_MIGRATIONS,
  INTERNAL_TRANSFER_VALIDITY_SECONDS: RC.INTERNAL_TRANSFER_VALIDITY_SECONDS,
  HUB_ID: RC.HUB_PARTICIPANT.ID,
  HUB_NAME: RC.HUB_PARTICIPANT.NAME,
  HUB_ACCOUNTS: RC.HUB_PARTICIPANT.ACCOUNTS,
  INSTRUMENTATION_METRICS_DISABLED: RC.INSTRUMENTATION.METRICS.DISABLED,
  INSTRUMENTATION_METRICS_LABELS: RC.INSTRUMENTATION.METRICS.labels,
  INSTRUMENTATION_METRICS_CONFIG: RC.INSTRUMENTATION.METRICS.config,
  DATABASE: {
    client: RC.DATABASE.DIALECT,
    connection: {
      host: RC.DATABASE.HOST.replace(/\/$/, ''),
      port: RC.DATABASE.PORT,
      user: RC.DATABASE.USER,
      password: RC.DATABASE.PASSWORD,
      database: RC.DATABASE.SCHEMA
    },
    pool: {
      // minimum size
      min: RC.DATABASE.POOL_MIN_SIZE ? RC.DATABASE.POOL_MIN_SIZE : 2,

      // maximum size
      max: RC.DATABASE.POOL_MAX_SIZE ? RC.DATABASE.POOL_MAX_SIZE : 10,
      // acquire promises are rejected after this many milliseconds
      // if a resource cannot be acquired
      acquireTimeoutMillis: RC.DATABASE.ACQUIRE_TIMEOUT_MILLIS ? RC.DATABASE.ACQUIRE_TIMEOUT_MILLIS : 30000,

      // create operations are cancelled after this many milliseconds
      // if a resource cannot be acquired
      createTimeoutMillis: RC.DATABASE.CREATE_TIMEOUT_MILLIS ? RC.DATABASE.CREATE_TIMEOUT_MILLIS : 3000,

      // destroy operations are awaited for at most this many milliseconds
      // new resources will be created after this timeout
      destroyTimeoutMillis: RC.DATABASE.DESTROY_TIMEOUT_MILLIS ? RC.DATABASE.DESTROY_TIMEOUT_MILLIS : 5000,

      // free resouces are destroyed after this many milliseconds
      idleTimeoutMillis: RC.DATABASE.IDLE_TIMEOUT_MILLIS ? RC.DATABASE.IDLE_TIMEOUT_MILLIS : 30000,

      // how often to check for idle resources to destroy
      reapIntervalMillis: RC.DATABASE.REAP_INTERVAL_MILLIS ? RC.DATABASE.REAP_INTERVAL_MILLIS : 1000,

      // long long to idle after failed create before trying again
      createRetryIntervalMillis: RC.DATABASE.CREATE_RETRY_INTERVAL_MILLIS ? RC.DATABASE.CREATE_RETRY_INTERVAL_MILLIS : 200
      // ping: function (conn, cb) { conn.query('SELECT 1', cb) }
    },
    debug: RC.DATABASE.DEBUG ? RC.DATABASE.DEBUG : false
  }
}
