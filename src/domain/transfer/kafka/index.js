'use strict'

// const Publish = require('./publish')
// const Consume = require('./consume')
// const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../lib/config')
const kafkanode = require('kafka-node')
const Client = kafkanode.Client
// const _ = require('lodash')
// const jp = require('jsonpath')
const UrlParser = require('../../../lib/urlparser')
// const format = require('string-template')
const Mustache = require('mustache')

const topicTemplate = {
  prepare: {
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

const getListOfTopics = (regex) => {
  return new Promise((resolve, reject) => {
    const client = new Client(Config.TOPICS_KAFKA_HOSTS)
    client.zk.client.getChildren('/brokers/topics', (error, children, stats) => {
      if (error) {
        console.log(error.stack)
        return reject(error)
      }
      if (!regex) {
        return children
      }
      // console.log('Children are: %j.', children)
      var filteredChildren = children.filter((topic) => {
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

// const getListOfTopics = (regex) => {
//   const client = new Client('localhost:2181')
//   // let listOfResults
//   client.once('connect', function () {
//     client.loadMetadataForTopics([], function (error, results) {
//       if (error) {
//         return Logger.error('%s', error)
//       }
//       var listOfResults = jp.query(results, '$.1.metadata..topic')
//       switch (regex) {
//         case topicRegexEnum.topicPrepareRegex:
//           listOfResults = listOfResults.filter(filterTopicsForPrepareTx)
//           Logger.info(`{$topicRegexEnum.topicPrepareRegex.name}`)
//           globalListOfResults[topicRegexEnum.topicPrepareRegex.name] = listOfResults
//           break
//         case topicRegexEnum.topicNotificationRegex:
//           listOfResults = listOfResults.filter(filterTopicsForPrepareNotification)
//           break
//         default:
//           client.close()
//           return []
//       }
//       Logger.info('LIST OF WTF TOPICs: %j', listOfResults)
//       client.close()
//       return listOfResults
//     })
//     client.close()
//     return []
//   })
//   // return new Promise(function (fulfill, reject) {
//   //   fulfill(listOfResults)
//   // })
// }

module.exports = {
  getPrepareTxTopicName,
  getPrepareNotificationTopicName,
  getListOfTopics
  // topicRegexEnum,
  // globalListOfResults
}
