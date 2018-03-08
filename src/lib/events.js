'use strict'

const Events = require('events')
const ledgerEmitter = new Events()

const transferRejected = 'transferRejected'
const transferPrepared = 'transferPrepared'
const transferExecuted = 'transferExecuted'
const publishMessage = "publish.message"
const messageSend = 'message.send'
const emailSettlementCsvSend = 'emailSettlementCsv'

const publish = (path, message) => {
  ledgerEmitter.emit(path, message)
}

const listen = (path, callback) => {
  ledgerEmitter.on(path, (message) => {
    callback(message)
  })
}

module.exports = {
  onTransferPrepared: (callback) => {
    listen(transferPrepared, callback)
  },
  onTransferExecuted: (callback) => {
    listen(transferExecuted, callback)
  },
  onTransferRejected: (callback) => {
    listen(transferRejected, callback)
  },
  onMessageSent: (callback) => {
    listen(messageSend, callback)
  },
  onEmailSettlementCsv: (callback) => {
    listen(emailSettlementCsvSend, callback)
  },
  onPublishMessage: (callback) => {
    listen(publishMessage, callback)
  },
  emitTransferPrepared: (transfer) => {
    publish(transferPrepared, {
      resource: transfer
    })
  },
  emitPublishMessage: (topic, key, msg) => {
    publish(publishMessage, {
      topic: topic,
      key: key,
      msg: msg
    })
  },
  emitTransferExecuted: (resource, relatedResources) => {
    publish(transferExecuted, {
      resource: resource,
      related_resources: relatedResources
    })
  },
  emitTransferRejected: (resource, relatedResources) => {
    publish(transferRejected, {
      resource: resource,
      related_resources: relatedResources
    })
  },
  sendMessage: (message) => {
    publish(messageSend, message)
  },
  emailSettlementCsv: (csv) => {
    publish(emailSettlementCsvSend, csv)
  }
}
