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

 - Lewis Daly <lewisd@crosslaketech.com>
 --------------
 ******/
'use strict'


const Logger = require('@mojaloop/central-services-logger')
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum


const Config = require('../../../src/lib/config')


/**
 * @class TestConsumer
 * @description A Kafka consumer that listens for events from our test harness, and 
 *   makes it easy to ensure that 
 */
class TestConsumer {
  handlers = {}
  eventLog = []
  topics = []

  constructor(handlers) {
    this.handlers = handlers
  }

  /**
   * @function startListening
   * @description Start listening for Consumers
   */
  async startListening() {
    await Promise.all(this.handlers.map(async handlerConfig => {
      const handler = {
        command: this.onEvent.bind(this),
        topicName: handlerConfig.topicName,
        config: handlerConfig.config
      }
      // Override the client and group ids:
      handler.config.rdkafkaConf['client.id'] = 'testConsumer'
      handler.config.rdkafkaConf['group.id'] = 'testConsumerGroup'

      Logger.warn(`TestConsumer.startListening(): registering consumer with topicName: ${handler.topicName}`)
      return Consumer.createHandler(handler.topicName, handler.config, handler.command)
    }))
  }

  /**
   * @function destroy
   * @description Stop listening for the registered Consumers 
   *   and release and open files 
   */
  // TODO: this won't work - if we have multiple consumers for the same topic names, there's no easy way
  // to get them at a later date and destroy....
  async destroy() {
    Logger.warn(`TestConsumer.destroy(): destroying consumers for the following topics: ${JSON.stringify(this.topics)}`)
    // await Promise.all(this.topics.map(topic => Consumer.getConsumer(topic).disconnect()))
  }

  /**
   * @function peek
   * @description Read the last event that we saw 
   */
  peek() {
    Logger.warn(`peeking at event log. EventLogLength:${this.eventLog.length}`)
    return this.eventLog[0]
  }

  /**
   * @function peekOrDie
   * @description Read the last event that we saw. Throw an error if not found 
   */
  peekOrDie() {
    const peekResult = this.peek()
    if (!peekResult) {
      throw new Error('TestConsumer.peekOrDie(): `peek()` found no events.')
    }
    return peekResult
  }

  /**
   * @function getEvents
   * @description Get a list of events for a given eventId
   * @param {string} eventId 
   * @returns {Array<event>} A list of the events found for the eventId
   */
  getEvents(eventId) {
    return this.eventLog
  }

  /**
   * @function clearEvents
   * @description Clears the event queue
   */
  clearEvents() {
    this.eventLog = []
  }

  onEvent(arg1, events) {
    Logger.warn(`TestConsumer.onEvent`)
    Logger.debug(`TestConsumer.onEvent - received event: ${JSON.stringify(events)}`)
    this.eventLog = this.eventLog.concat(events)
  }
}

module.exports = TestConsumer