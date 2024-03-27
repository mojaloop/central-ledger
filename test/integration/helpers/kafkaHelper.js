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

 * Miguel de Barros <miguel.debarros@initx.com>
 --------------
 **********/

const Producer = require('@mojaloop/central-services-stream').Util.Producer
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer

const topics = [
  'topic-transfer-prepare',
  'topic-transfer-position',
  'topic-transfer-fulfil',
  'topic-notification-event'
]

exports.topics = topics

exports.producers = {
  connect: async (assert) => {
    // lets make sure all our Producers are already connected if they have already been defined.
    for (const topic of topics) {
      try {
        // lets make sure check if any of our Producers are already connected if they have already been defined.
        console.log(`Producer[${topic}] checking connectivity!`)
        const isConnected = await Producer.isConnected(topic)
        if (!isConnected) {
          try {
            console.log(`Producer[${topic}] is connecting`)
            await Producer.getProducer(topic).connect()
            console.log(`Producer[${topic}] is connected`)
            if (assert) assert.pass(`Producer[${topic}] is connected`)
          } catch (err) {
            console.log(`Producer[${topic}] connection failed!`)
            if (assert) assert.fail(err)
            console.error(err)
          }
        } else {
          console.log(`Producer[${topic}] is ALREADY connected`)
        }
      } catch (err) {
        console.log(`Producer[${topic}] has not been initialized`)
        if (assert) assert.fail(err)
        console.error(err)
      }
    }
  },

  disconnect: async (assert) => {
    for (const topic of topics) {
      try {
        console.log(`Producer[${topic}] disconnecting`)
        await Producer.getProducer(topic).disconnect()
        if (assert) assert.pass(`Producer[${topic}] is disconnected`)
        console.log(`Producer[${topic}] disconnected`)
      } catch (err) {
        if (assert) assert.fail(err.message)
        console.log(`Producer[${topic}] disconnection failed`)
        console.error(err)
      }
    }
  }
}

exports.consumers = {
  connect: async (assert) => {
    // lets make sure all our Consumers are already connected if they have already been defined.
    for (const topic of topics) {
      try {
        // lets make sure check if any of our Consumers are already connected if they have already been defined.
        console.log(`Consumer[${topic}] checking connectivity!`)
        const isConnected = await Consumer.isConnected(topic)
        if (!isConnected) {
          try {
            console.log(`Consumer[${topic}] is connecting`)
            await Consumer.getConsumer(topic).connect()
            console.log(`Consumer[${topic}] is connected`)
            if (assert) assert.pass(`Consumer[${topic}] is connected`)
          } catch (err) {
            console.log(`Consumer[${topic}] connection failed!`)
            if (assert) assert.fail(`Consumer[${topic}] connection failed!`)
            console.error(err)
          }
        } else {
          console.log(`Consumer[${topic}] is ALREADY connected`)
        }
      } catch (err) {
        console.log(`Consumer[${topic}] has not been initialized`)
        if (assert) assert.fail(`Consumer[${topic}] has not been initialized`)
        console.error(err)
      }
    }
  },

  disconnect: async (assert) => {
    for (const topic of topics) {
      try {
        console.log(`Consumer[${topic}] disconnecting`)
        await Consumer.getConsumer(topic).disconnect()
        if (assert) assert.pass(`Consumer[${topic}] is disconnected`)
        console.log(`Consumer[${topic}] disconnected`)
      } catch (err) {
        if (assert) assert.fail(err.message)
        console.log(`Consumer[${topic}] disconnection failed`)
        console.error(err)
      }
    }
  }
}
