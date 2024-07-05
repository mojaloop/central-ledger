/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

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
