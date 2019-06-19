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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

'use strict'

/**
 * @module src/handlers/lib
 */

const Config = require('../../lib/config')
const Mustache = require('mustache')
const KafkaConfig = Config.KAFKA_CONFIG
const Logger = require('@mojaloop/central-services-shared').Logger
const Uuid = require('uuid4')
const Kafka = require('./kafka')
const Enum = require('../../lib/enum')
const decodePayload = require('@mojaloop/central-services-stream').Kafka.Protocol.decodePayload

/**
 * The Producer config required
 *
 * @description This ENUM is for the PRODUCER of the topic being created
 *
 * @enum {object} ENUMS~PRODUCER
 * @property {string} PRODUCER - PRODUCER config to be fetched
 */
const PRODUCER = 'PRODUCER'
/**
 * The Consumer config required
 *
 * @description This ENUM is for the CONSUMER of the topic being created
 *
 * @enum {object} ENUMS~CONSUMER
 * @property {string} CONSUMER - CONSUMER config to be fetched
 */
const CONSUMER = 'CONSUMER'

/**
 * The Notification config required
 *
 * @description This ENUM is for the notification message being created
 *
 * @enum {object} ENUMS~NOTIFICATION
 * @property {string} NOTIFICATION - notification to be used to update metadata
 */
const NOTIFICATION = 'notification'

/**
 * The Position config required
 *
 * @description This ENUM is for the Position message being created
 *
 * @enum {object} ENUMS~POSITION
 * @property {string} POSITION - position to be used to update metadata
 */
const POSITION = 'position'

/**
 * The EVENT config required
 *
 * @description This ENUM is for the topic being created
 *
 * @enum {object} ENUMS~EVENT
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
 * @enum {object} ENUMS~STATE
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
 * @description Global ENUMS object
 *
 * @enum {string} ENUMS
 * @property {string} PRODUCER - This ENUM is for the PRODUCER
 * @property {string} CONSUMER - This ENUM is for the CONSUMER
 */
const ENUMS = {
  PRODUCER,
  CONSUMER,
  NOTIFICATION,
  POSITION,
  STATE,
  EVENT
}

/**
 * @function ParticipantTopicTemplate
 *
 * @description Generates a participant topic name from the 3 inputs which are used in the placeholder topic template for participants found in the default.json
 *
 * @param {string} participantName - participant name, retrieved from database. Example: 'dfsp1'
 * @param {string} functionality - the functionality flow. Example: 'transfer'
 * @param {string} action - the action that applies to the flow. Example: 'prepare'
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
 * @function GeneralTopicTemplate
 *
 * @description Generates a general topic name from the 2 inputs, which are used in the placeholder general topic template found in the default.json
 *
 * @param {string} functionality - the functionality flow. Example: 'transfer'
 * @param {string} action - the action that applies to the flow. Example: 'prepare'
 *
 * @returns {string} - Returns topic name to be created, throws error if failure occurs
 */
const generalTopicTemplate = (functionality, action) => {
  try {
    return Mustache.render(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, { functionality, action })
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

/**
 * @function TransformGeneralTopicName
 *
 * @description generalTopicTemplate called which generates a general topic name from the 2 inputs, which are used in the placeholder general topic template found in the default.json
 *
 * @param {string} functionality - the functionality flow. Example: 'transfer'
 * @param {string} action - the action that applies to the flow. Example: 'prepare'
 *
 * @returns {string} - Returns topic name to be created, throws error if failure occurs
 */
const transformGeneralTopicName = (functionality, action) => {
  try {
    if (Enum.topicMap[functionality] && Enum.topicMap[functionality][action]) {
      return generalTopicTemplate(Enum.topicMap[functionality][action].functionality, Enum.topicMap[functionality][action].action)
    }
    return generalTopicTemplate(functionality, action)
  } catch (e) {
    throw e
  }
}

/**
 * @function TransformGeneralTopicName
 *
 * @description participantTopicTemplate called which generates a participant topic name from the 3 inputs, which are used in the placeholder participant topic template found in the default.json
 *
 * @param {string} participantName - participant name, retrieved from database. Example: 'dfsp1'
 * @param {string} functionality - the functionality flow. Example: 'transfer'
 * @param {string} action - the action that applies to the flow. Example: 'prepare'
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
 * @function GetKafkaConfig
 *
 * @description participantTopicTemplate called which generates a participant topic name from the 3 inputs, which are used in the placeholder participant topic template found in the default.json
 *
 * @param {string} flow - This is required for the config for the Stream Processing API. Example: 'CONSUMER' ie: note the case of text
 * @param {string} functionality - the functionality flow. Example: 'TRANSFER' ie: note the case of text
 * @param {string} action - the action that applies to the flow. Example: 'PREPARE' ie: note the case of text
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
    throw new Error(`No config found for flow='${flow}', functionality='${functionality}', action='${action}'`)
  }
}

/**
 * @function updateMessageProtocolMetadata
 *
 * @param {object} messageProtocol - The current messageProtocol from kafka
 * @param {string} metadataType - the type of flow. Example: 'notification'
 * @param {string} metadataAction - the action flow. Example: 'prepare'
 * @param {object} state - the state of the message being passed.
 * Example:
 * SUCCESS: {
 *   status: 'success',
 *   code: 0,
 *   description: 'action successful'
 * }
 *
 * @returns {object} - Returns updated messageProtocol
 */
const updateMessageProtocolMetadata = (messageProtocol, metadataType, metadataAction, state) => {
  if (!messageProtocol.metadata) {
    messageProtocol.metadata = {
      event: {
        id: Uuid(),
        type: metadataType,
        action: metadataAction,
        state: state
      }
    }
  } else {
    messageProtocol.metadata.event.responseTo = messageProtocol.metadata.event.id
    messageProtocol.metadata.event.id = Uuid()
    messageProtocol.metadata.event.type = metadataType
    messageProtocol.metadata.event.action = metadataAction
    messageProtocol.metadata.event.state = state
  }
  return messageProtocol
}

/**
 * @function createPrepareErrorStatus
 *
 * @param {number} errorCode - error code for error occurred
 * @param {string} errorDescription - error description for error occurred
 * @param {object} extensionList - list of extensions
 * Example:
 * errorInformation: {
 *   errorCode: '3001',
 *   errorDescription: 'A failure has occurred',
 *   extensionList: [{
 *      extension: {
 *        key: 'key',
 *        value: 'value'
 *      }
 *   }]
 * }
 *
 * @returns {object} - Returns errorInformation object
 */
const createPrepareErrorStatus = (errorCode, errorDescription, extensionList) => {
  errorCode = errorCode.toString()
  return {
    errorInformation: {
      errorCode,
      errorDescription,
      extensionList
    }
  }
}

/**
 * @function createState
 *
 * @param {string} status - status of message
 * @param {number} code - error code
 * @param {string} description - description of error
 * @example:
 * errorInformation: {
 *   status: 'error',
 *   code: 3100,
 *   description: 'error message'
 * }
 *
 * @returns {object} - Returns errorInformation object
 */
const createState = (status, code, description) => {
  return {
    status,
    code,
    description
  }
}

/**
 * @function createTransferMessageProtocol
 *
 * @param {object} payload - The payload of the api request
 * @param {string} type - the type flow. Example: 'prepare'
 * @param {string} action - the action flow. Example: 'commit'
 * @param {object} state - the state of the message being passed.
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
const createTransferMessageProtocol = (payload, type, action, state, pp = '') => {
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
        type,
        action,
        createdAt: new Date(),
        state
      }
    },
    pp
  }
}

/**
 * @function createParticipantTopicConfig
 *
 * @param {string} participantName - The participant name
 * @param {string} functionality - the functionality flow. Example: 'transfer' ie: note the case of text
 * @param {string} action - the action that applies to the flow. Example: 'prepare' ie: note the case of text
 * @param {number} partition - optional partition to produce to
 * @param {*} opaqueKey - optional opaque token, which gets passed along to your delivery reports
 *
 * @returns {object} - Returns newly created participant topicConfig
 */
const createParticipantTopicConf = (participantName, functionality, action, key = null, partition = null, opaqueKey = null) => {
  return {
    topicName: transformAccountToTopicName(participantName, functionality, action),
    key,
    partition,
    opaqueKey
  }
}

/**
 * @function createGeneralTopicConfig
 *
 * @param {string} functionality - the functionality flow. Example: 'transfer' ie: note the case of text
 * @param {string} action - the action that applies to the flow. Example: 'prepare' ie: note the case of text
 * @param {number} partition - optional partition to produce to
 * @param {*} opaqueKey - optional opaque token, which gets passed along to your delivery reports
 *
 * @returns {object} - Returns newly created general topicConfig
 */
const createGeneralTopicConf = (functionality, action, key = null, partition = null, opaqueKey = null) => {
  return {
    topicName: transformGeneralTopicName(functionality, action),
    key,
    partition,
    opaqueKey
  }
}

/**
 * @function produceGeneralMessage
 *
 * @async
 * @description This is an async method that produces a message against a generated Kafka topic. it is called multiple times
 *
 * Kafka.Producer.produceMessage called to persist the message to the configured topic on Kafka
 * Utility.updateMessageProtocolMetadata called updates the messages metadata
 * Utility.createGeneralTopicConf called dynamically generates the general topic configuration
 * Utility.getKafkaConfig called dynamically gets Kafka configuration
 *
 * @param {string} functionality - the functionality flow. Example: 'transfer' ie: note the case of text
 * @param {string} action - the action that applies to the flow. Example: 'prepare' ie: note the case of text
 * @param {object} message - a list of messages to consume for the relevant topic
 * @param {object} state - state of the message being produced
 *
 * @returns {object} - Returns a boolean: true if successful, or throws and error if failed
 */
const produceGeneralMessage = async (functionality, action, message, state/* , messageId */) => {
  let functionalityMapped = functionality
  let actionMapped = action
  if (Enum.topicMap[functionality] && Enum.topicMap[functionality][action]) {
    functionalityMapped = Enum.topicMap[functionality][action].functionality
    actionMapped = Enum.topicMap[functionality][action].action
  }
  const messageProtocol = updateMessageProtocolMetadata(message, functionality, action, state)
  const topicConfig = createGeneralTopicConf(functionalityMapped, actionMapped/* , messageId */)
  const kafkaConfig = getKafkaConfig(ENUMS.PRODUCER, functionalityMapped.toUpperCase(), actionMapped.toUpperCase())
  await Kafka.Producer.produceMessage(messageProtocol, topicConfig, kafkaConfig)
  return true
}

/**
 * @function produceParticipantMessage
 *
 * @async
 *
 * @description This is an async method that produces a message against a Kafka generated topic for a specific participant. it is called multiple times
 *
 * Kafka.Producer.produceMessage called to persist the message to the configured topic on Kafka
 * Utility.updateMessageProtocolMetadata called updates the messages metadata
 * Utility.createParticipantTopicConf called dynamically generates the topic configuration with a participant name
 * Utility.getKafkaConfig called dynamically gets Kafka configuration
 *
 * @param {string} participantName - the name of the participant for topic creation
 * @param {string} functionality - the functionality flow. Example: 'transfer' ie: note the case of text
 * @param {string} action - the action that applies to the flow. Example: 'prepare' ie: note the case of text
 * @param {object} message - a list of messages to consume for the relevant topic
 * @param {object} state - state of the message being produced
 *
 * @returns {object} - Returns a boolean: true if successful, or throws and error if failed
 */
const produceParticipantMessage = async (participantName, functionality, action, message, state) => {
  let functionalityMapped = functionality
  let actionMapped = action
  if (Enum.topicMap[functionality] && Enum.topicMap[functionality][action]) {
    functionalityMapped = Enum.topicMap[functionality][action].functionality
    actionMapped = Enum.topicMap[functionality][action].action
  }
  const messageProtocol = updateMessageProtocolMetadata(message, functionality, action, state)
  const topicConfig = createParticipantTopicConf(participantName, functionalityMapped, actionMapped)
  const kafkaConfig = getKafkaConfig(ENUMS.PRODUCER, functionalityMapped.toUpperCase(), actionMapped.toUpperCase())
  await Kafka.Producer.produceMessage(messageProtocol, topicConfig, kafkaConfig)
  return true
}

const commitMessageSync = async (kafkaTopic, consumer, message) => {
  if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
    await consumer.commitMessageSync(message)
  }
}

const breadcrumb = (location, message) => {
  if (typeof message === 'object') {
    if (message.method) {
      location.method = message.method
      location.path = `${location.module}::${location.method}`
    }
    if (message.path) {
      location.path = `${location.module}::${location.method}::${message.path}`
    }
  } else if (typeof message === 'string') {
    location.path += `::${message}`
  }
  return location.path
}

const proceed = async (params, opts) => {
  const { message, kafkaTopic, consumer } = params
  const { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch } = opts
  let metadataState

  if (consumerCommit) {
    await commitMessageSync(kafkaTopic, consumer, message)
  }
  if (errorInformation) {
    const code = errorInformation.errorCode
    const desc = errorInformation.errorDescription
    message.value.content.uriParams = { id: decodePayload(params.message.value.content.payload).transferId }
    message.value.content.payload = createPrepareErrorStatus(code, desc, message.value.content.payload.extensionList)
    metadataState = createState(ENUMS.STATE.FAILURE.status, code, desc)
  } else {
    metadataState = ENUMS.STATE.SUCCESS
  }
  if (fromSwitch) {
    message.value.to = message.value.from
    message.value.from = Enum.headers.FSPIOP.SWITCH
  }
  if (producer) {
    const p = producer
    // const messageId = toDestination ? message.value.content.headers[Enum.headers.FSPIOP.DESTINATION] : message.id
    await produceGeneralMessage(p.functionality, p.action, message.value, metadataState/*, messageId */)
  }
  if (histTimerEnd && typeof histTimerEnd === 'function') {
    histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
  }
  return true
}

module.exports = {
  ENUMS,
  transformAccountToTopicName,
  transformGeneralTopicName,
  getKafkaConfig,
  updateMessageProtocolMetadata,
  createPrepareErrorStatus,
  createState,
  createTransferMessageProtocol,
  createParticipantTopicConf,
  createGeneralTopicConf,
  produceParticipantMessage,
  produceGeneralMessage,
  commitMessageSync,
  breadcrumb,
  proceed
}
