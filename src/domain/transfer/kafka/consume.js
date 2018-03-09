
// STUFF TO GO IN HERE FOR RE-USABLE CONSUMING
const Logger = require('@mojaloop/central-services-shared').Logger

const kafkaLogging = require('kafka-node/logging')
const getLoggerProvider = {
  debug: console.log.bind(Logger),
  info: console.log.bind(Logger),
  warn: console.log.bind(Logger),
  error: console.log.bind(Logger)
}
kafkaLogging.setLoggerProvider(getLoggerProvider)
const kafkanode = require('kafka-node')
const Consumer = kafkanode.Consumer
const Client = kafkanode.Client

const kafka = require('./index')
const Commands = require('../commands')
const Translator = require('../translator')

// let client

const options = {
  groupId: 'kafka-node-group', // consumer group id, default `kafka-node-group`
    // Auto commit config
  // autoCommit: true,
  autoCommit: false,
  autoCommitIntervalMs: 100,
    // The max wait time is the maximum amount of time in milliseconds to block waiting if insufficient data is available at the time the request is issued, default 100ms
  fetchMaxWaitMs: 100,
    // This is the minimum number of bytes of messages that must be available to give a response, default 1 byte
  fetchMinBytes: 1,
    // The maximum bytes to include in the message set for this partition. This helps bound the size of the response.
  fetchMaxBytes: 1024 * 1024,
    // If set true, consumer will fetch message from the given offset in the payloads
  fromOffset: false,
    // If set to 'buffer', values will be returned as raw buffer objects.
  encoding: 'utf8',
  keyEncoding: 'utf8'
}

const consumePrepare = () => {
  // client = new kafka.Client("a02bcb8d21d2d11e8ada0027eebfb29a-160662342.eu-west-2.elb.amazonaws.com:2181");
  Logger.info('consumePrepare::start')

  // const client = new Client('localhost:2181')
  // if (!client) {
  //   client = new kafka.Client('localhost:2181')
  // }
  // var payload = { topic: 'topic-dfsp1-prepare-tx', partition: 0, offset: 0 }
  // kafka.getListOfTopics(kafka.topicRegexEnum.topicPrepareRegex)
  // var temp =  kafka.globalListOfResults[kafka.topicRegexEnum.topicPrepareRegex.name]
  // Logger.info('list of topics: %s', temp)
  // kafka.getListOfTopics(kafka.topicRegexEnum.topicPrepareRegex).then(result => {
  //   Logger.info('list of topics: %s', result)
  // })
  // Logger.info('list of topics: %s', res)
  var topicList = [ { topic: 'topic-dfsp1-prepare-tx', partition: 0 } ]

  const client = new Client('localhost:2181')

  var temp = {}
  client.zk.client.getChildren('/brokers/topics', (error, children, stats) => {
    if (error) {
      console.log(error.stack)
      return
    }
    temp = children
    console.log('Children are: %j.', children)
    // return children
  })
  console.log('temp are: %j.', temp)

  var consumer = new Consumer(
      client,
      topicList,
      options
  )
  consumer.on('message', (message) => {
    Logger.info('prepare-tx consumed: %s', JSON.stringify(message))

    var payload = JSON.parse(message.value)
    const transfer = Translator.fromPayload(payload)
    // figure out what message appear here
    // const transfer = Translator.fromPayload(payload)
    // var transfer = JSON.parse(message.value)
    Commands.prepareExecute(transfer).then(result => {
      if (result) {
        // Logger.info('result: %s', result)
        consumer.commit(
          function (err, result) {
            Logger.info('Committing index result: %s', (JSON.stringify(err) || JSON.stringify(result)))
          })
      }
    })
    // consumer.commit(
    //   function (err, result) {
    //     Logger.info('Committing index result: %s', (JSON.stringify(err) || JSON.stringify(result)))
    //   })
    // var offset = new kafka.Offset(client)
    // var offsetValue = 0
    // offset.fetch([
    //   {
    //     topic: 'topic-dfsp1-prepare-tx',
    //     partition: 0,
    //     time: Date.now(),
    //     maxNum: 1
    //   }
    // ], function (err, data) {
    //   if (err) {
    //     Logger.error('ERROR=%s', JSON.stringify(err))
    //   } else {
    //     Logger.info('data=%s', JSON.stringify(data))
    //   }
    //   // data
    //   // { 't': { '0': [999] } }
    //   offsetValue = data['topic-dfsp1-prepare-tx']['0'][0]
    //   Logger.info('offsetValue=%d', offsetValue)
    // })

    // consumer.commit(
    //   options.groupId,
    //   {
    //     topic: 'topic-dfsp1-prepare-tx',
    //     partition: 0,
    //     offset: offsetValue
    //   },
    //   function (err, result) {
    //     Logger.info('Committing index result: %s', (JSON.stringify(err) || JSON.stringify(result)))
    //   })
    // consumer.commit(
    //   function (err, result) {
    //     Logger.info('Committing index result: %s', (JSON.stringify(err) || JSON.stringify(result)))
    //   })
  })

  consumer.on('error', function (err) {
    Logger.error('ERROR: %s', err.toString())
  })
}

const consumeNotification = () => {
  Logger.info('consumeNotification::start')
  // const client = new Client('localhost:2181')
  // if (!client) {
  //   client = new kafka.Client('localhost:2181')
  // }
    // client = new kafka.Client("a02bcb8d21d2d11e8ada0027eebfb29a-160662342.eu-west-2.elb.amazonaws.com:2181");
  const client = new Client('localhost:2181')
  var payload = [{ topic: 'topic-dfsp1-prepare-notification', partition: 0 }]
  var consumer = new Consumer(
    client,
    payload,
    options
  )

  // var res = kafka.getListOfTopics('')
  // Logger.info('list of topics: %s', res)

  consumer.on('message', function (message) {
    Logger.info('prepare-notification consumed: %s', JSON.stringify(message))
    // need to call something in the commands/index.js
    // consumer.commit(
    //   function (err, result) {
    //     Logger.info('Committing index result: %s', (JSON.stringify(err) || JSON.stringify(result)))
    //   })
  })

  consumer.on('error', function (err) {
    Logger.error('ERROR: %s', err.toString())
        // error handling code needs to go here
  })
}

exports.register = (server, options, next) => {
  // client = new kafka.Client('localhost:2181')
  // kafka.getListOfTopics(kafka.topicRegexEnum.topicPrepareRegex)
  consumePrepare()
  consumeNotification()
  next()
}

exports.register.attributes = {
  name: 'consume.message'
}
