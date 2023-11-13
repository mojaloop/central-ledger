/* eslint-disable space-before-function-paren */
const safeStringify = require('fast-safe-stringify')
const MlLogger = require('@mojaloop/central-services-logger')

// update Logger impl. to avoid stringify string message: https://github.com/mojaloop/central-services-logger/blob/master/src/index.js#L49
const makeLogString = (message, meta) => meta
  ? `${message} - ${typeof meta === 'object' ? safeStringify(meta) : meta}`
  : message

// wrapper to avoid doing Logger.is{SomeLogLevel}Enabled checks everywhere
class Logger {
  #log

  constructor (log = MlLogger) {
    this.#log = log
  }

  get log () { return this.#log }

  error(...args) {
    this.#log.isDebugEnabled && this.#log.debug(makeLogString(...args))
  }

  warn(...args) {
    this.#log.isWarnEnabled && this.#log.warn(makeLogString(...args))
  }

  audit(...args) {
    this.#log.isAuditEnabled && this.#log.audit(makeLogString(...args))
  }

  trace(...args) {
    this.#log.isTraceEnabled && this.#log.trace(makeLogString(...args))
  }

  info(...args) {
    this.#log.isInfoEnabled && this.#log.info(makeLogString(...args))
  }

  perf(...args) {
    this.#log.isPerfEnabled && this.#log.perf(makeLogString(...args))
  }

  verbose(...args) {
    this.#log.isVerboseEnabled && this.#log.verbose(makeLogString(...args))
  }

  debug(...args) {
    this.#log.isDebugEnabled && this.#log.debug(makeLogString(...args))
  }

  silly(...args) {
    this.#log.isLevelEnabled && this.#log.silly(makeLogString(...args))
  }
}

module.exports = Logger
