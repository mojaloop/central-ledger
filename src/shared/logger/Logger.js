/* eslint-disable space-before-function-paren */
const safeStringify = require('fast-safe-stringify')
const MlLogger = require('@mojaloop/central-services-logger')

// update Logger impl. to avoid stringify string message: https://github.com/mojaloop/central-services-logger/blob/master/src/index.js#L49
const makeLogString = (message, meta) => meta
  ? `${message} - ${typeof meta === 'object' ? safeStringify(meta) : meta}`
  : message

// wrapper to avoid doing Logger.is{SomeLogLevel}Enabled checks everywhere
class Logger {
  #log = MlLogger

  isErrorEnabled = this.#log.isErrorEnabled
  // to be able to follow the same logic: log.isDebugEnabled && log.debug(`some log message: ${data}`)
  isWarnEnabled = this.#log.isWarnEnabled
  isAuditEnabled = this.#log.isAuditEnabled
  isTraceEnabled = this.#log.isTraceEnabled
  isInfoEnabled = this.#log.isInfoEnabled
  isPerfEnabled = this.#log.isPerfEnabled
  isVerboseEnabled = this.#log.isVerboseEnabled
  isDebugEnabled = this.#log.isDebugEnabled
  isSillyEnabled = this.#log.isSillyEnabled

  constructor (context = {}) {
    this.context = context
  }

  get log() { return this.#log }

  error(message, meta) {
    this.isErrorEnabled && this.#log.error(this.#formatLog(message, meta))
  }

  warn(message, meta) {
    this.isWarnEnabled && this.#log.warn(this.#formatLog(message, meta))
  }

  audit(message, meta) {
    this.isAuditEnabled && this.#log.audit(this.#formatLog(message, meta))
  }

  trace(message, meta) {
    this.isTraceEnabled && this.#log.trace(this.#formatLog(message, meta))
  }

  info(message, meta) {
    this.isInfoEnabled && this.#log.info(this.#formatLog(message, meta))
  }

  perf(message, meta) {
    this.isPerfEnabled && this.#log.perf(this.#formatLog(message, meta))
  }

  verbose(message, meta) {
    this.isVerboseEnabled && this.#log.verbose(this.#formatLog(message, meta))
  }

  debug(message, meta) {
    this.isDebugEnabled && this.#log.debug(this.#formatLog(message, meta))
  }

  silly(message, meta) {
    this.isSillyEnabled && this.#log.silly(this.#formatLog(message, meta))
  }

  child(childContext = {}) {
    return new Logger(Object.assign({}, this.context, childContext))
  }

  #formatLog(message, meta = {}) {
    return makeLogString(message, Object.assign({}, meta, this.context))
  }
}

module.exports = Logger
