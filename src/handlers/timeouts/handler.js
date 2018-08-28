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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @module src/handlers/timeout
 */

const CronJob = require('cron').CronJob
const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../lib/config')
// const TimeoutService = require('../../domain/timeout')
// const Utility = require('../lib/utility')

let timeoutJob
let isRegistered

/**
 * @function TransferTimeoutHandler
 *
 * @async
 * @description This is the consumer callback function that gets registered to a cron job.
 *
 * ... called to validate/insert ...
 *
 * @param {error} error - error thrown if something fails within Cron
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const timeout = async () => {
  try {
    console.log('Transfer timeout task running...')
    return true
  } catch (error) {
    Logger.error(error)
    throw error
  }
}

/**
 * @function isRunning
 *
 * @description Function to determine if the timeoutJob is running
 *
 * @returns {boolean} Returns true if the timeoutJob is running
 */
const isRunning = async () => {
  return isRegistered
}

/**
 * @function stop
 *
 * @description Function to stop the timeoutJob if running
 *
 * @returns {boolean} Returns true when the job is stopped
 */
const stop = async () => {
  if (isRegistered) {
    await timeoutJob.destroy()
    isRegistered = undefined
  }
}

/**
 * @function RegisterTimeoutHandlers
 *
 * @async
 * @description Registers the timeout handler by starting the timeoutJob cron
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerTimeoutHandler = async () => {
  try {
    if (isRegistered) {
      await stop()
    }

    timeoutJob = new CronJob({
      cronTime: Config.HANDLERS_TIMEOUT_TIMEXP,
      onTick: timeout,
      start: false,
      timeZone: Config.HANDLERS_CRON_TIMEZONE
    })
    isRegistered = true

    await timeoutJob.start()
    return true
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

/**
 * @function RegisterAllHandlers
 *
 * @async
 * @description Registers all handlers in timeouts
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    if (!Config.HANDLERS_TIMEOUT_DISABLED) {
      await registerTimeoutHandler()
    }
    return true
  } catch (e) {
    throw e
  }
}

module.exports = {
  registerAllHandlers,
  registerTimeoutHandler,
  isRunning
}
