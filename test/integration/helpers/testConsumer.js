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

const { uniqueId } = require('lodash')
const Logger = require('@mojaloop/central-services-logger')
const Consumer = require('@mojaloop/central-services-stream').Kafka.Consumer

/**
 * @class TestConsumer
 * @description A Kafka consumer that listens for events from our test harness, and
 *   makes it easy to ensure that
 */
class TestConsumer {
  constructor (handlers) {
    this.handlers = handlers
    this.eventLog = []
    this.consumers = []
  }

  /**
   * @function startListening
   * @description Start listening for Consumers
   */
  async startListening () {
    await Promise.all(this.handlers.map(async handlerConfig => {
      const handler = {
        command: this.onEvent.bind(this),
        topicName: handlerConfig.topicName,
        config: handlerConfig.config
      }
      // Override the client and group ids:
      const id = uniqueId()
      handler.config.rdkafkaConf['client.id'] = 'testConsumer' + id
      // Fix issue of consumers with different partition.assignment.strategy being assigned to the same group
      handler.config.rdkafkaConf['group.id'] = 'testConsumerGroup' + id
      delete handler.config.rdkafkaConf['partition.assignment.strategy']

      Logger.warn(`TestConsumer.startListening(): registering consumer with uniqueId ${id} - topicName: ${handler.topicName}`)
      const topics = [handler.topicName]
      const consumer = new Consumer(topics, handler.config)
      await consumer.connect()
      await consumer.consume(handler.command)
      this.consumers.push(consumer)
    }))
  }

  /**
   * @function destroy
   * @description Stop listening for the registered Consumers
   *   and release and open files
   */
  async destroy () {
    Logger.warn(`TestConsumer.destroy(): destroying ${this.consumers.length} consumers`)
    await Promise.all(this.consumers.map(consumer => new Promise((resolve, reject) => {
      consumer.disconnect((err) => err ? reject(err) : resolve())
    })))
  }

  /**
   * @function peek
   * @description Read the last event that we saw
   */
  peek () {
    Logger.warn(`peeking at event log. EventLogLength:${this.eventLog.length}`)
    return this.eventLog[0]
  }

  /**
   * @function peekOrDie
   * @description Read the last event that we saw. Throw an error if not found
   */
  peekOrDie () {
    const peekResult = this.peek()
    if (!peekResult) {
      throw new Error('TestConsumer.peekOrDie(): `peek()` found no events.')
    }
    return peekResult
  }

  /**
   * @function getAllEvents
   * @description Get a list of all events
   * @param {string} eventId
   * @returns {Array<event>} A list of the events found for the eventId
   */
  getAllEvents () {
    return this.eventLog
  }

  /**
   * @function getEventsForFilter
   * @description Get a list of all events that match a basic filter
   * @param {*} filters
   * @param {string} filters.action - String matching filter for `event.value.metadata.event.action`
   * @param {string} filters.topicFilter - String matching filter for `event.topic`
   * @param {string} filters.valueFromFilter - String matching filter for `event.value.from`
   * @param {string} filters.valueToFilter - String matching filter for `event.value.to`
   * @param {string} filters.keyFilter - String matching filter for `event.key`
   * @param {string} filters.errorCodeFilter - String matching filter for `event.value.content.payload.errorInformation.errorCode`
   * @returns {Array<event>} A list of the events found for the eventId
   * @throws {Error} If no events could be found for the given set of filters
   */
  getEventsForFilter (filters) {
    const { action, topicFilter, valueFromFilter, valueToFilter, keyFilter, errorCodeFilter } = filters

    let events = this.eventLog
    if (topicFilter !== undefined) {
      events = events.filter(e => e.topic === topicFilter)
    }

    if (action !== undefined) {
      events = events.filter(e => e.value.metadata.event.action === action)
    }

    if (valueFromFilter !== undefined) {
      events = events.filter(e => e.value.from === valueFromFilter)
    }

    if (valueToFilter !== undefined) {
      events = events.filter(e => e.value.to === valueToFilter)
    }

    if (keyFilter !== undefined) {
      events = events.filter(e => e.key.toString() === keyFilter)
    }

    if (errorCodeFilter !== undefined) {
      events = events.filter(e => e.value.content.payload.errorInformation.errorCode === errorCodeFilter)
    }

    if (events.length === 0) {
      throw new Error(`No events found for given filters" ${JSON.stringify(filters)}`)
    }

    return events
  }

  /**
   * @function clearEvents
   * @description Clears the event queue
   */
  clearEvents () {
    this.eventLog = []
  }

  onEvent (arg1, events) {
    Logger.warn('TestConsumer.onEvent')
    Logger.debug(`TestConsumer.onEvent - received event: ${JSON.stringify(events)}`)
    this.eventLog = this.eventLog.concat(events)
  }
}

module.exports = TestConsumer
