
// const Publish = require('./publish')
// const Consume = require('./consume')
const Logger = require('@mojaloop/central-services-shared').Logger
const kafkanode = require('kafka-node')
const Client = kafkanode.Client
const _ = require('lodash')
const jp = require('jsonpath')

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

const getPrepareTxTopicName = (uri) => {
  return 'topic-dfsp1-prepare-tx'
}

const getPrepareNotificationTopicName = (uri) => {
  return 'topic-dfsp1-prepare-notification'
}

// globalListOfResults = {}

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
