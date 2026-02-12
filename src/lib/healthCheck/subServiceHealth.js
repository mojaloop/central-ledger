/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Lewis Daly <lewis@vesselstech.com>
 --------------
 ******/
'use strict'

const { statusEnum, serviceName } = require('@mojaloop/central-services-shared').HealthCheck.HealthCheckEnums
const Logger = require('../../shared/logger').logger
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const ProxyCache = require('../proxyCache')
const MigrationLockModel = require('../../models/misc/migrationLock')

/**
 * @function getSubServiceHealthBroker
 *
 * @description
 *   Gets the health for the broker, by checking that each consumer is healthy.
 *   Uses the consumer's isHealthy() method from central-services-stream which performs:
 *   - isConnected() - basic connection status
 *   - isAssigned() - consumer has partition assignments
 *   - isPollHealthy() - last poll was within healthCheckPollInterval
 *   - getMetadataSync() - all subscribed topics exist in broker metadata
 *
 * @returns Promise<SubServiceHealth> The SubService health object for the broker
 */
const getSubServiceHealthBroker = async () => {
  let status = statusEnum.OK

  try {
    const consumerTopics = Consumer.getListOfTopics()
    const results = await Promise.all(
      consumerTopics.map(async (topic) => {
        try {
          const consumer = Consumer.getConsumer(topic)
          const isHealthy = await consumer.isHealthy()
          if (!isHealthy) {
            Logger.isWarnEnabled && Logger.warn(`Consumer is not healthy for topic ${topic}`)
          }
          return isHealthy
        } catch (err) {
          Logger.isWarnEnabled && Logger.warn(`isHealthy check failed for topic ${topic}: ${err.message}`)
          return false
        }
      })
    )

    if (results.some(healthy => !healthy)) {
      status = statusEnum.DOWN
    }
  } catch (err) {
    Logger.isWarnEnabled && Logger.warn(`getSubServiceHealthBroker failed with error ${err.message}.`)
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
    Logger.warn(`getSubServiceHealthDatastore failed with error ${err.message}.`, err)
    status = statusEnum.DOWN
  }

  return {
    name: serviceName.datastore,
    status
  }
}

const getSubServiceHealthProxyCache = async () => {
  const proxyCache = ProxyCache.getCache()
  const healthCheck = await proxyCache.healthCheck()
  return {
    name: 'proxyCache',
    status: healthCheck ? statusEnum.OK : statusEnum.DOWN
  }
}

module.exports = {
  getSubServiceHealthBroker,
  getSubServiceHealthDatastore,
  getSubServiceHealthProxyCache
}
