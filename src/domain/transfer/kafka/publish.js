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

// STUFF TO GO IN HERE FOR RE-USABLE PRODUCER CODE
const Config = require('../../../lib/config')
const Events = require('../../../lib/events')
const kafkanode = require('kafka-node')
const Producer = kafkanode.Producer
const KeyedMessage = kafkanode.KeyedMessage
const Client = kafkanode.Client
const Logger = require('@mojaloop/central-services-shared').Logger

const send = (topic, key, msg) => {
  return new Promise((resolve, reject) => {
    const options = Config.TOPICS_KAFKA_PRODUCER_OPTIONS

    const attributes = Config.TOPICS_KAFKA_PRODUCER_ATTRIBUTES

    Logger.info('Publish.send:: start(%s, %s, %s)', topic, key, msg)

    var partition = 0

    const client = new Client(Config.TOPICS_KAFKA_HOSTS)

    var producer = new Producer(client, options)

    producer.on('ready', async function () {
      var message = JSON.stringify(msg)
      var keyedMessage = new KeyedMessage(key, message)

      producer.createTopics([topic], true, (err, data) => {
        if (err) {
          Logger.error(`Publish.send:: Error - ${err}`)
        }
        Logger.info(`'Publish.send:: Created topic - ${data}`)
        producer.send([
          { topic: topic, partitions: partition, messages: [keyedMessage], attributes: attributes }
        ], function (err, result) {
          if (err) {
            Logger.error(`Publish.send:: Publish topics ${topic} failed with error: ${err}`)
            reject(err)
          } else {
            Logger.info(`Publish.send:: Publish to topic ${topic} successful`)
            resolve(true)
          }
        })
      })
      Logger.info("Publish.send:: Sent something keyedMessage='%s'", JSON.stringify(keyedMessage))
    })

    producer.on('Publish.send:: error', function (err) {
      Logger.error('Publish.send:: error: %s', err)
      reject(err)
    })
  })
}

exports.send = send

const publishHandler = (event) => {
  return async (eventMessage) => {
    const { topic, key, msg } = eventMessage
    Logger.info('Kafka.publish.publishHandler:: start(%s, %s, %s)', topic, key, msg)

    await send(topic, key, msg).then(results => {
      Logger.info(`Kafka.publish.publishHandler:: result:'${results}'`)
    })
  }
}

const wireEvents = () => {
  // Logger.info('publish.wireEvents::start')
  Events.onPublishMessage(publishHandler('publish.message'))
}

// for nodejs v8.x upgrade (hapi server v17.xx)
// exports.plugin = {
//     name: 'publishkafka',
//     register: (server, options) => {
//         wireEvents()
//     }
// }

exports.register = (server, options, next) => {
  // Logger.info('publish.exports.register:start')
  wireEvents()
  next()
}

exports.register.attributes = {
  name: 'publish.message'
}
