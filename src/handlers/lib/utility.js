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

const Config = require('../../lib/config')
const UrlParser = require('../../lib/urlparser')
const Mustache = require('mustache')
const KafkaConfig = Config.KAFKA_CONFIG
const Logger = require('@mojaloop/central-services-shared').Logger
const Uuid = require('uuid4')
const Kafka = require('./kafka')

/**
 * The Producer config required
 *
 * This ENUM is for the PRODUCER of the topic being created
 *
 * @typedef {object} ENUMS~PRODUCER
 * @property {string} PRODUCER - PRODUCER config to be fetched
 */
const PRODUCER = 'PRODUCER'
/**
 * The Consumer config required
 *
 * This ENUM is for the CONSUMER of the topic being created
 *
 * @typedef {object} ENUMS~CONSUMER
 * @property {string} CONSUMER - CONSUMER config to be fetched
 */
const CONSUMER = 'CONSUMER'

/**
 * The Notification config required
 *
 * This ENUM is for the notification message being created
 *
 * @typedef {object} ENUMS~NOTIFICATION
 * @property {string} NOTIFICATION - notification to be used to update metadata
 */
const NOTIFICATION = 'notification'

/**
 * The EVENT config required
 *
 * This ENUM is for the topic being created
 *
 * @typedef {object} ENUMS~EVENT
 * @property {string} EVENT - event to be used get the config for Kafka
 */
const EVENT = 'event'

/**
 * The STATE constant
 *
 * I believe that this is a temporary solution
 *
 * This ENUM is for the state of the message being created
 *
 * @typedef {object} ENUMS~STATE
 * @property {string} STATE - used for the state of the message
 */
const STATE = {
  SUCCESS: {
    status: 'success',
    code: 0,
    description: 'action successful'
  },
  FAILURE: {
    status: 'error',
    code: 999,
    description: 'action failed'
  }
}

/**
 * ENUMS
 *
 * Global ENUMS object
 *
 * @typedef {object} ENUMS
 * @property {string} PRODUCER - This ENUM is for the PRODUCER
 * @property {string} CONSUMER - This ENUM is for the CONSUMER
 */
const ENUMS = {
  PRODUCER,
  CONSUMER,
  NOTIFICATION,
  STATE,
  EVENT
}

/**
 * @method ParticipantTopicTemplate
 *
 * @param {string} participantName - participant name, retrieved from database. Example: 'dfsp1'
 * @param {string} functionality - the functionality flow. Example: 'transfer'
 * @param {string} action - the action that applies to the flow. Example: 'prepare'
 *
 * Generates a participant topic name from the 3 inputs which are used in the placeholder topic template for participants found in the default.json
 *
 * @returns {string} - Returns topic name to be created, throws error if failure occurs
 */
const participantTopicTemplate = (participantName, functionality, action) => {
  try {
    return Mustache.render(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.PARTICIPANT_TOPIC_TEMPLATE.TEMPLATE, {
      participantName,
      functionality,
      action
    })
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

/**
 * @method GeneralTopicTemplate
 *
 * @param {string} functionality - the functionality flow. Example: 'transfer'
 * @param {string} action - the action that applies to the flow. Example: 'prepare'
 *
 * Generates a general topic name from the 2 inputs, which are used in the placeholder general topic template found in the default.json
 *
 * @returns {string} - Returns topic name to be created, throws error if failure occurs
 */
const generalTopicTemplate = (functionality, action) => {
  try {
    return Mustache.render(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, {functionality, action})
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

/**
 * @method GetParticipantName
 *
 * @param {string} accountUri - the accountUri
 *
 * Parses the accountUri into a participant name from the uri string
 *
 * @returns {string} - Returns participant name, throws error if failure occurs
 */
const getParticipantName = (accountUri) => {
  try {
    return UrlParser.nameFromAccountUri(accountUri)
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

/**
 * @method GetTopicNameFromURI
 *
 * @param {object} transfer - the transfer object used to get the accountUri from
 * @param {string} functionality - the functionality flow. Example: 'transfer'
 * @param {string} action - the action that applies to the flow. Example: 'prepare'
 *
 * Parses the accountUri into a participant name from the uri string
 *
 * @returns {string} - Returns participant name, throws error if failure occurs
 */
const getTopicNameFromURI = (transfer, functionality, action) => {
  try {
    const participantName = getParticipantName(transfer.debits[0].account)
    return participantTopicTemplate(participantName, functionality, action)
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

/**
 * @method TransformGeneralTopicName
 *
 * @param {string} functionality - the functionality flow. Example: 'transfer'
 * @param {string} action - the action that applies to the flow. Example: 'prepare'
 *
 * @function generalTopicTemplate called which generates a general topic name from the 2 inputs,
 * which are used in the placeholder general topic template found in the default.json
 *
 * @returns {string} - Returns topic name to be created, throws error if failure occurs
 */
const transformGeneralTopicName = (functionality, action) => {
  try {
    return generalTopicTemplate(functionality, action)
  } catch (e) {
    throw e
  }
}

/**
 * @method TransformGeneralTopicName
 *
 * @param {string} participantName - participant name, retrieved from database. Example: 'dfsp1'
 * @param {string} functionality - the functionality flow. Example: 'transfer'
 * @param {string} action - the action that applies to the flow. Example: 'prepare'
 *
 * @function participantTopicTemplate called which generates a participant topic name from the 3 inputs,
 * which are used in the placeholder participant topic template found in the default.json
 *
 * @returns {string} - Returns topic name to be created, throws error if failure occurs
 */
const transformAccountToTopicName = (participantName, functionality, action) => {
  try {
    return participantTopicTemplate(participantName, functionality, action)
  } catch (e) {
    throw e
  }
}

/**
 * @method GetKafkaConfig
 *
 * @param {string} flow - This is required for the config for the Stream Processing API. Example: 'CONSUMER' ie: note the case of text
 * @param {string} functionality - the functionality flow. Example: 'TRANSFER' ie: note the case of text
 * @param {string} action - the action that applies to the flow. Example: 'PREPARE' ie: note the case of text
 *
 * @function participantTopicTemplate called which generates a participant topic name from the 3 inputs,
 * which are used in the placeholder participant topic template found in the default.json
 *
 * @returns {string} - Returns topic name to be created, throws error if failure occurs
 */
const getKafkaConfig = (flow, functionality, action) => {
  try {
    const flowObject = KafkaConfig[flow]
    const functionalityObject = flowObject[functionality]
    const actionObject = functionalityObject[action]
    actionObject.config.logger = Logger
    return actionObject.config
  } catch (e) {
    throw new Error('No config found for those parameters')
  }
}

/**
 * @method updateMessageProtocolMetadata
 *
 * @param {object} messageProtocol - The current messageProtocol from kafka
 * @param {string} metadataType - the action flow. Example: 'prepare'
 * @param {object} state - the tate of the message being passed.
 * Example:
 * SUCCESS: {
 *   status: 'success',
 *   code: 0,
 *   description: 'action successful'
 * }
 *
 * @returns {object} - Returns updated messageProtocol
 */
const updateMessageProtocolMetadata = (messageProtocol, metadataType, state) => {
  messageProtocol.metadata.event.responseTo = messageProtocol.metadata.event.id
  messageProtocol.metadata.event.id = Uuid()
  messageProtocol.metadata.event.type = metadataType
  messageProtocol.metadata.event.state = state
  return messageProtocol
}

/**
 * @method createTransferMessageProtocol
 *
 * @param {object} payload - The payload of the api request
 * @param {string} metadataType - the action flow. Example: 'prepare'
 * @param {object} state - the tate of the message being passed.
 * Example:
 * SUCCESS: {
 *   status: 'success',
 *   code: 0,
 *   description: 'action successful'
 * }
 * @param {string} pp - this is an optional field for future functionality to send the message to a third party
 *
 * @returns {object} - Returns newly created messageProtocol
 */
const createTransferMessageProtocol = (payload, metadataType, state, pp = '') => {
  return {
    id: payload.transferId,
    from: payload.payerFsp,
    to: payload.payeeFsp,
    type: 'application/json',
    content: {
      header: {},
      payload
    },
    metadata: {
      event: {
        id: Uuid(),
        responseTo: '',
        type: metadataType,
        action: metadataType,
        createdAt: new Date(),
        state
      }
    },
    pp
  }
}

/**
 * @method createParticipantTopicConf
 *
 * @param {string} participantName - The participant name
 * @param {string} functionality - the functionality flow. Example: 'transfer' ie: note the case of text
 * @param {string} action - the action that applies to the flow. Example: 'prepare' ie: note the case of text
 * @param {number} partition - optional partition to produce to
 * @param {*} opaqueKey - optional opaque token, which gets passed along to your delivery reports
 *
 * @returns {object} - Returns newly created participant topicConfig
 */
const createParticipantTopicConf = (participantName, functionality, action, partition = 0, opaqueKey = 0) => {
  return {
    topicName: transformAccountToTopicName(participantName, functionality, action),
    key: Uuid(),
    partition,
    opaqueKey
  }
}

/**
 * @method createGeneralTopicConf
 *
 * @param {string} functionality - the functionality flow. Example: 'transfer' ie: note the case of text
 * @param {string} action - the action that applies to the flow. Example: 'prepare' ie: note the case of text
 * @param {number} partition - optional partition to produce to
 * @param {*} opaqueKey - optional opaque token, which gets passed along to your delivery reports
 *
 * @returns {object} - Returns newly created general topicConfig
 */
const createGeneralTopicConf = (functionality, action, partition = 0, opaqueKey = 0) => {
  return {
    topicName: transformGeneralTopicName(functionality, action),
    key: Uuid(),
    partition,
    opaqueKey
  }
}

/**
 * @method produceGeneralMessage
 *
 * @async
 * This is an async method that produces a message against a generated Kafka topic. it is called multiple times
 *
 * @param {string} functionality - the functionality flow. Example: 'transfer' ie: note the case of text
 * @param {string} action - the action that applies to the flow. Example: 'prepare' ie: note the case of text
 * @param {object} message - a list of messages to consume for the relevant topic
 * @param {object} state - state of the message being produced
 *
 * @function Kafka.Producer.produceMessage to persist the message to the configured topic on Kafka
 * @function Utility.updateMessageProtocolMetadata updates the messages metadata
 * @function Utility.createGeneralTopicConf dynamically generates the general topic configuration
 * @function Utility.getKafkaConfig dynamically gets Kafka configuration
 *
 * @returns {object} - Returns a boolean: true if successful, or throws and error if failed
 */
const produceGeneralMessage = async (functionality, action, message, state) => {
  return await Kafka.Producer.produceMessage(updateMessageProtocolMetadata(message, functionality, state),
    createGeneralTopicConf(functionality, action),
    getKafkaConfig(ENUMS.PRODUCER, functionality.toUpperCase(), action.toUpperCase()))
}

/**
 * @method produceParticipantMessage
 *
 * @async
 * This is an async method that produces a message against a Kafka generated topic for a specific participant. it is called multiple times
 *
 * @param {string} participantName - the name of the participant for topic creation
 * @param {string} functionality - the functionality flow. Example: 'transfer' ie: note the case of text
 * @param {string} action - the action that applies to the flow. Example: 'prepare' ie: note the case of text
 * @param {object} message - a list of messages to consume for the relevant topic
 * @param {object} state - state of the message being produced
 *
 * @function Kafka.Producer.produceMessage to persist the message to the configured topic on Kafka
 * @function Utility.updateMessageProtocolMetadata updates the messages metadata
 * @function Utility.createParticipantTopicConf dynamically generates the topic configuration with a participant name
 * @function Utility.getKafkaConfig dynamically gets Kafka configuration
 *
 * @returns {object} - Returns a boolean: true if successful, or throws and error if failed
 */
const produceParticipantMessage = async (participantName, functionality, action, message, state) => {
  return await Kafka.Producer.produceMessage(updateMessageProtocolMetadata(message, functionality, state),
    createParticipantTopicConf(participantName, functionality, action),
    getKafkaConfig(ENUMS.PRODUCER, functionality.toUpperCase(), action.toUpperCase()))
}

exports.getTopicNameFromURI = getTopicNameFromURI
exports.transformAccountToTopicName = transformAccountToTopicName
exports.transformGeneralTopicName = transformGeneralTopicName
exports.getKafkaConfig = getKafkaConfig
exports.updateMessageProtocolMetadata = updateMessageProtocolMetadata
exports.createTransferMessageProtocol = createTransferMessageProtocol
exports.createParticipantTopicConf = createParticipantTopicConf
exports.createGeneralTopicConf = createGeneralTopicConf
exports.produceParticipantMessage = produceParticipantMessage
exports.produceGeneralMessage = produceGeneralMessage
exports.ENUMS = ENUMS
