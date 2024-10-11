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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

const { Enum, Util } = require('@mojaloop/central-services-shared')
const Config = require('#src/lib/config')
const TestConsumer = require('./testConsumer')

/**
 * Creates a TestConsumer with handlers based on the specified types/actions configurations.
 *
 * @param {Array<Object>} typeActionList - An array of objects with 'type' and 'action' properties
 *   - `type` {string} - Represents the type parameter for the topic and configuration.
 *   - `action` {string} - Represents the action parameter for the topic and configuration.
 *
 * @returns {TestConsumer} An instance of TestConsumer configured with handlers derived from
 */
const createTestConsumer = (typeActionList) => {
  const handlers = typeActionList.map(({ type, action }) => ({
    topicName: Util.Kafka.transformGeneralTopicName(
      Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
      type,
      action
    ),
    config: Util.Kafka.getKafkaConfig(
      Config.KAFKA_CONFIG,
      Enum.Kafka.Config.CONSUMER,
      type.toUpperCase(),
      action.toUpperCase()
    )
  }))

  return new TestConsumer(handlers)
}

module.exports = createTestConsumer
