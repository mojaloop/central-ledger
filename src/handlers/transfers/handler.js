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

const Logger = require('@mojaloop/central-services-shared').Logger
const Commands = require('../../domain/transfer/commands')
const Utility = require('../lib/utility')
const DAO = require('../lib/dao')
const ConsumerUtility = require('../lib/consumer')

const TRANSFER = 'transfer'
const PREPARE = 'prepare'
const FULFILL = 'fulfill'
const REJECT = 'reject'

/**
 * @method CreatePrepareHandler
 *
 * @async
 * Registers the handler for each participant topic created. Gets Kafka config from default.json
 *
 * @function Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const createPrepareHandler = async function (participantName) {
  try {
    const prepareHandler = {
      command: Commands.prepareExecute,
      topicName: Utility.transformAccountToTopicName(participantName, TRANSFER, PREPARE),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TRANSFER.toUpperCase(), PREPARE.toUpperCase())
    }
    await ConsumerUtility.createHandler(prepareHandler.topicName, prepareHandler.config, prepareHandler.command)
  } catch (e) {
    Logger.error(e)
  }
}

/**
 * @method RegisterFulfillHandler
 *
 * @async
 * Registers the one handler for fulfill transfer. Gets Kafka config from default.json
 * @function Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerFulfillHandler = async function () {
  try {
    const fulfillHandler = {
      command: Commands.fulfilling,
      topicName: Utility.transformGeneralTopicName(TRANSFER, FULFILL),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TRANSFER.toUpperCase(), FULFILL.toUpperCase())
    }
    await ConsumerUtility.createHandler(fulfillHandler.topicName, fulfillHandler.config, fulfillHandler.command)
  } catch (e) {
    Logger.error(e)
  }
}

/**
 * @method RegisterRejectHandler
 *
 * @async
 * Registers the one handler for reject transfer. Gets Kafka config from default.json
 * @function Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerRejectHandler = async function () {
  try {
    const rejectHandler = {
      command: Commands.rejecting(),
      topicName: Utility.transformGeneralTopicName(TRANSFER, REJECT),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TRANSFER.toUpperCase(), REJECT.toUpperCase())
    }
    await ConsumerUtility.createHandler(rejectHandler.topicName, rejectHandler.config, rejectHandler.command)
  } catch (e) {
    Logger.error(e)
  }
}

/**
 * @method RegisterPrepareHandlers
 *
 * @async
 * Registers the prepare handlers for all participants. Retrieves the list of all participants from the database and loops through each
 * @function createPrepareHandler called to create the handler for each participant
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerPrepareHandlers = async function () {
  try {
    const participantNames = await DAO.retrieveAllParticipants()
    for (var key in participantNames) {
      await createPrepareHandler(participantNames[key])
    }
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

/**
 * @method RegisterAllHandlers
 *
 * @async
 * Registers all handlers in transfers ie: prepare, fulfill and reject
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async function () {
  try {
    await registerPrepareHandlers()
    await registerFulfillHandler()
    await registerRejectHandler()
    return true
  } catch (e) {
    throw e
  }
}

module.exports = {
  registerPrepareHandlers,
  registerFulfillHandler,
  registerRejectHandler,
  registerAllHandlers
}
