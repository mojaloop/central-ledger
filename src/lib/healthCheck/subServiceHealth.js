
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

 * Lewis Daly <lewis@vesselstech.com>
 --------------
 ******/
'use strict'

const { statusEnum, serviceName } = require('@mojaloop/central-services-shared').HealthCheck.HealthCheckEnums
const Logger = require('@mojaloop/central-services-shared').Logger
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka

const MigrationLockModel = require('../../models/misc/migrationLock')

/**
 * @function getSubServiceHealthBroker
 *
 * @description
 *   Gets the health for the broker, by checking that the consumer is
 *   connected for each topic
 *
 * @returns Promise<SubServiceHealth> The SubService health object for the broker
 */
const getSubServiceHealthBroker = async () => {
  const consumerTopics = Kafka.Consumer.getListOfTopics()
  let status = statusEnum.OK
  try {
    await Promise.all(consumerTopics.map(t => Kafka.Consumer.isConnected(t)))
  } catch (err) {
    Logger.debug(`getSubServiceHealthBroker failed with error ${err.message}.`)
    status = statusEnum.DOWN
  }

  return {
    name: serviceName.broker,
    status
  }
}

/**
 * @function getSubServiceHealthDatastore
 *
 * @description
 *   Gets the health of the Datastore by ensuring the table is currently locked
 *   in a migration state. This implicity checks the connection with the database.
 *
 * @returns Promise<SubServiceHealth> The SubService health object for the broker
 */
const getSubServiceHealthDatastore = async () => {
  let status = statusEnum.OK

  try {
    const isLocked = await MigrationLockModel.getIsMigrationLocked()
    if (isLocked) {
      status = statusEnum.DOWN
    }
  } catch (err) {
    Logger.debug(`getSubServiceHealthDatastore failed with error ${err.message}.`)
    status = statusEnum.DOWN
  }

  return {
    name: serviceName.datastore,
    status
  }
}

module.exports = {
  getSubServiceHealthBroker,
  getSubServiceHealthDatastore
}
