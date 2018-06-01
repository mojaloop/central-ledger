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
const Projection = require('../../domain/transfer/projection')
const Utility = require('../lib/utility')
const DAO = require('../lib/dao')
const Kafka = require('../lib/kafka')
const TransferState = require('../../../src/domain/transfer/state')

const POSITION = 'position'
const TRANSFER = 'transfer'

const PREPARE = 'prepare'
const COMMIT = 'commit'

const positions = async (error, messages) => {
  if (error) {
    Logger.error(error)
  }
  let message = {}
  try {
    if (Array.isArray(messages)) {
      message = messages[0]
    } else {
      message = messages
    }
    Logger.info('TransferHandler::position')
    const consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, POSITION, PREPARE))
    const payload = message.value.content.payload
    if (message.value.metadata.event.type === POSITION && message.value.metadata.event.action === PREPARE) {
      await Projection.updateTransferState(payload, TransferState.RESERVED)
    } else if (message.value.metadata.event.type === POSITION && message.value.metadata.event.action === COMMIT) {
      payload.transferId = message.value.id
      await Projection.updateTransferState(payload, TransferState.COMMITTED)
    } else {
      await consumer.commitMessageSync(message)
      throw new Error('event action or type not valid')
    }
    await consumer.commitMessageSync(message)
    // Will follow framework flow in future
    await Utility.produceGeneralMessage(TRANSFER, TRANSFER, message.value, Utility.ENUMS.STATE.SUCCESS)

    return true
  } catch (error) {
    Logger.error(error)
    throw error
  }
}

/**
 * @method CreatePositionHandler
 *
 * @async
 * Registers the handler for each participant topic created. Gets Kafka config from default.json
 *
 * @function Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const createPositionHandler = async (participantName) => {
  try {
    const positionHandler = {
      command: positions,
      topicName: Utility.transformAccountToTopicName(participantName, POSITION, PREPARE),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, POSITION.toUpperCase(), PREPARE.toUpperCase())
    }
    await Kafka.Consumer.createHandler(positionHandler.topicName, positionHandler.config, positionHandler.command)
  } catch (error) {
    Logger.error(error)
    throw error
  }
}

/*
 * @method RegisterPositionsHandlers
 *
 * @async
 * Registers the position handlers for all participants. Retrieves the list of all participants from the database and loops through each
 * @function createPositionHandler called to create the handler for each participant
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerPositionHandlers = async () => {
  try {
    const participantList = await DAO.retrieveAllParticipants()
    for (let name of participantList) {
      await createPositionHandler(name)
    }
  } catch (error) {
    Logger.error(error)
    throw error
  }
}

/**
 * @method RegisterAllHandlers
 *
 * @async
 * Registers all handlers in positions
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    await registerPositionHandlers()
    return true
  } catch (error) {
    throw error
  }
}

module.exports = {
  registerPositionHandlers,
  registerAllHandlers,
  positions
}
