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

 * Lazola Lucas <lazola.lucas@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @method RegisterAllHandlers
 *
 * @async
 * Registers all handlers by using the require-glob to retrieve all handler exports in sub directories and access the registerAllHandlers()
 * in each of them. Every handler in the **\/handlers must have a registerAllHandlers() function
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */

const Logger = require('@mojaloop/central-services-shared').Logger
const requireGlob = require('require-glob')

exports.registerAllHandlers = async (request, h) => {
  try {
    const modules = await requireGlob(['./**/handler.js'])
    Logger.info(JSON.stringify(modules))
    for (let key in modules) {
      Logger.info(`Registering handler module[${key}]: ${JSON.stringify(modules[key])}`)
      const handlerObject = modules[key]
      Logger.info(JSON.stringify(handlerObject.handler))
      await handlerObject.handler.registerAllHandlers()
    }
    if (h) {
      return h.response(true)
    } else {
      return true
    }
  } catch (e) {
    Logger.error(e)
  }
}
