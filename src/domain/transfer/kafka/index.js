// const Publish = require('./publish')
// const Consume = require('./consume')
// const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../lib/config')
// const kafkanode = require('kafka-node')
// const Client = kafkanode.Client
const _ = require('lodash')
// const jp = require('jsonpath')
const UrlParser = require('../../../lib/urlparser')
// const format = require('string-template')
const Mustache = require('mustache')

// const topicRegexEnum = {
//   topicPrepareRegex: {
//     name: 'topicPrepare',
//     regex: new RegExp(/topic-(.*)-prepare-tx/, 'i')
//   },
//   topicNotificationRegex: {
//     name: 'topicNotification',
//     regex: new RegExp(/topic-(.*)-prepare-notification/, 'i')
//   }
// }
//
// const filterTopicsForPrepareTx = (topic) => {
//   const matches = topic.match(topicRegexEnum.topicPrepareRegex.regex)
//   if (matches) {
//     return true
//   } else {
//     return false
//   }
// }
//
// const filterTopicsForPrepareNotification = (topic) => {
//   const matches = topic.match(topicRegexEnum.topicNotificationRegex.regex)
//   if (matches) {
//     return true
//   } else {
//     return false
//   }
// }

// const template = {
//   prepare: {
//     tx: 'topic-{0}-prepare-tx',
//     notification: 'topic-{0}-prepare-notification',
//     position: 'topic-{0}-prepare-position'
//   }
// }

// function template(strings, ...keys) {
//   return (function(...values) {
//     var dict = values[values.length - 1] || {};
//     var result = [strings[0]];
//     keys.forEach(function(key, i) {
//       var value = Number.isInteger(key) ? values[key] : dict[key];
//       result.push(value, strings[i + 1]);
//     });
//     return result.join('');
//   });
// }

// var t1Closure = template`${0}${1}${0}!`;
// t1Closure('Y', 'A');  // "YAY!"
// var test = (name) => {return `Hello ${you}! You're looking ${adjective} today!`}

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

// const publish = (?) => {
//     //TBD by laz
//     return ??
// }

// const consume = (?) => {
//     //TBD
//     return ??
// }

module.exports = {
  getPrepareTxTopicName,
  getPrepareNotificationTopicName
  // getPrepareNotificationTopicName,
  // getListOfTopics,
  // topicRegexEnum,
  // globalListOfResults
}
