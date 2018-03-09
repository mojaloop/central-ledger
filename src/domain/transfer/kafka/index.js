// const Publish = require('./publish')
// const Consume = require('./consume')
const Logger = require('@mojaloop/central-services-shared').Logger
const kafkanode = require('kafka-node')
const Client = kafkanode.Client
var _ = require('lodash')

const getDfspName = (accountUri) => {
  const index = accountUri.indexOf('accounts/')
  return accountUri.substr(index + 9)
}

const getPrepareTxTopicName = (transfer) => {
  const dfspName = getDfspName(transfer.debits[0].account)
  return 'topic-' + dfspName + '-prepare-tx'
}

const getPrepareNotificationTopicName = (transfer) => {
  const dfspName = getDfspName(transfer.debits[0].account)
  return 'topic-' + dfspName + '-prepare-notification'
}

const getListOfTopics = (regex) => {
  // return new Promise(function (fulfill, reject) {
  const client = new Client('localhost:2181')
  client.once('connect', function () {
    client.loadMetadataForTopics([], function (error, results) {
      if (error) {
        return Logger.error('%s', error)
      }
      Logger.info('LIST OF WTF TOPICs: %j', _.get(results, '1.metadata'))
      // fulfill(_.get(results, '1.metadata'))
      return _.get(results, '1.metadata')
    })
  })
  // })
}

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
  getPrepareNotificationTopicName,
  getListOfTopics
}
