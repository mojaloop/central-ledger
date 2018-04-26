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

const PRODUCER = 'PRODUCER'
const CONSUMER = 'CONSUMER'

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

const generalTopicTemplate = (functionality, action) => {
  try {
    return Mustache.render(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, {functionality, action})
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

const getParticipantName = (accountUri) => {
  return UrlParser.nameFromAccountUri(accountUri)
}

const getTopicNameFromURI = (transfer, functionality, action) => {
  const participantName = getParticipantName(transfer.debits[0].account)
  return participantTopicTemplate(participantName, functionality, action)
}

const transformGeneralTopicName = (functionality, action) => {
  return generalTopicTemplate(functionality, action)
}

const transformAccountToTopicName = (participantName, functionality, action) => {
  return participantTopicTemplate(participantName, functionality, action)
}

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

exports.getTopicNameFromURI = getTopicNameFromURI
exports.transformAccountToTopicName = transformAccountToTopicName
exports.transformGeneralTopicName = transformGeneralTopicName
exports.getKafkaConfig = getKafkaConfig
exports.ENUMS = {
  PRODUCER,
  CONSUMER
}
