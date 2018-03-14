'use strict'

const Validator = require('./validator')
const RequestLogger = require('./../../lib/request-logger')
const Config = require('../../lib/config')
const Kafka = require('../../domain/transfer/kafka')
const Commands = require('../../domain/transfer/commands')
const UrlParser = require('./../../lib/urlparser')

const registerNotificationConsumer = (data) => {
  const jsonPayload = JSON.parse(data)
  if (jsonPayload.params.accounts.length === 1) {
    const account = UrlParser.nameFromAccountUri(jsonPayload.params.accounts[0])
    const accountTopic = Kafka.tansformAccountToPrepareNotificationTopicName(account)
    const kafkaProducerOptions = Config.TOPICS_KAFKA_PRODUCER_OPTIONS
    Kafka.Producer.connect(kafkaProducerOptions)
    Kafka.createConsumer(kafkaProducerOptions, accountTopic, Commands.prepareNotification)
  }
}

const initialize = (socket, socketManager) => {
  socket.send(JSON.stringify({ id: null, jsonrpc: '2.0', method: 'connect' }))

  socket.on('message', data => {
    RequestLogger.logWebsocket(data)
    Validator.validateSubscriptionRequest(data, (err, result) => {
      if (err) {
        socket.send(JSON.stringify(err.payload))
        socket.close()
      } else {
        socket.send(JSON.stringify({ id: result.id, jsonrpc: result.jsonrpc, result: result.accountUris.length }))
        socketManager.add(socket, ...result.accountUris)
        registerNotificationConsumer(data)
      }
    })
  })
}

module.exports = {
  initialize
}
