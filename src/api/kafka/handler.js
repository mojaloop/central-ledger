'use strict'

const Config = require('../../lib/config')
const Kafka = require('../../domain/transfer/kafka')
const Commands = require('../../domain/transfer/commands')
const UrlParser = require('./../../lib/urlparser')

exports.create = (request, response) => {
  const account = UrlParser.nameFromAccountUri(request.payload.account)
  const accountTopic = Kafka.tansformAccountToPrepareNotificationTopicName(account)
  const kafkaProducerOptions = Config.TOPICS_KAFKA_PRODUCER_OPTIONS
  Kafka.Producer.connect(kafkaProducerOptions)
  Kafka.createConsumer(kafkaProducerOptions, accountTopic, Commands.prepareNotification)
  return response({accountTopic}).code(201)
}
