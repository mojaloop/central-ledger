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
const Config = require('../../../lib/config')
const UrlParser = require('../../../lib/urlparser')
// const format = require('string-template')
const Mustache = require('mustache')
const createConsumer = require('../kafka/consumeN').createConsumer
const createConsumerFilteredTopics = require('../kafka/consumeN').createConsumerFilteredTopics
const ConsumerOnceOff = require('../kafka/consumeN').ConsumerOnceOff
const getListOfTopics = require('../kafka/zookeeper').getListOfTopics
const Producer = require('../kafka/produceN')

const topicTemplate = {
  prepare: {
    // leaving these in for string-template <-- to compare performance against mustache
    // tx: (DFSP) => { return format(Config.TOPICS_PREPARE_TEMPLATES_TX, {dfspName: DFSP}) },
    // notification: (DFSP) => { return format(Config.TOPICS_PREPARE_TEMPLATES_NOTIFICATION, {dfspName: DFSP}) },
    // position: (DFSP) => { return format(Config.TOPICS_PREPARE_TEMPLATES_POSITION, {dfspName: DFSP}) }
    tx: (DFSP) => { return Mustache.render(Config.TOPICS_PREPARE_TX_TEMPLATE, {dfspName: DFSP}) },
    notification: (DFSP) => { return Mustache.render(Config.TOPICS_PREPARE_NOTIFICATION_TEMPLATE, {dfspName: DFSP}) },
    position: (DFSP) => { return Mustache.render(Config.TOPICS_PREPARE_POSITION_TEMPLATE, {dfspName: DFSP}) }
  }
}

const getDfspName = (accountUri) => {
  return UrlParser.nameFromAccountUri(accountUri)
}

const getPrepareTxTopicName = (transfer) => {
  const dfspName = getDfspName(transfer.debits[0].account)
  return topicTemplate.prepare.tx(dfspName)
}

const getPrepareNotificationTopicName = (transfer) => {
  const dfspName = getDfspName(transfer.debits[0].account)
  return topicTemplate.prepare.notification(dfspName)
}

const tansformAccountToPrepareNotificationTopicName = (account) => {
  return topicTemplate.prepare.notification(account)
}

const tansformAccountToPrepareTxTopicName = (account) => {
  return topicTemplate.prepare.tx(account)
}

const getPreparePositionTopicName = (transfer) => {
  const dfspName = getDfspName(transfer.debits[0].account)
  return topicTemplate.prepare.position(dfspName)
}

const getListOfFilteredTopics = (regex) => {
  return getListOfTopics(Config.TOPICS_KAFKA_ZOOKEEPER_HOSTS).then(result => {
    return new Promise((resolve, reject) => {
      var filteredChildren = result.filter((topic) => {
        const filterRegex = new RegExp(regex, 'i')
        const matches = topic.match(filterRegex)
        if (matches) {
          return matches[1]
        } else {
          return null
        }
      })
      return resolve(filteredChildren)
    })
  })
}

exports.getPrepareTxTopicName = getPrepareTxTopicName
exports.getPrepareNotificationTopicName = getPrepareNotificationTopicName
exports.getPreparePositionTopicName = getPreparePositionTopicName
exports.getListOfTopics = getListOfTopics
exports.getListOfFilteredTopics = getListOfFilteredTopics
exports.tansformAccountToPrepareNotificationTopicName = tansformAccountToPrepareNotificationTopicName
exports.tansformAccountToPrepareTxTopicName = tansformAccountToPrepareTxTopicName
exports.createConsumer = createConsumer
exports.createConsumerFilteredTopics = createConsumerFilteredTopics
exports.ConsumerOnceOff = ConsumerOnceOff
exports.Producer = Producer
// exports.getClientId = getClientId
