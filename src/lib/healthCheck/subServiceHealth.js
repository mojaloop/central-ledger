/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
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
 *   Gets the health for the broker, by checking that the consumer is
 *   connected for each topic
 *
 * @returns Promise<SubServiceHealth> The SubService health object for the broker
 */
const getSubServiceHealthBroker = async () => {
  let status = statusEnum.OK

  try {
    const consumerTopics = Consumer.getListOfTopics()
    const results = await Promise.all(
      consumerTopics.map(async (t) => {
        try {
          return await Consumer.allConnected(t)
        } catch (err) {
          Logger.isWarnEnabled && Logger.warn(`allConnected threw for topic ${t}: ${err.message}`)
          return false
        }
      })
    )

    if (results.some(connected => !connected)) {
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
    Logger.isDebugEnabled && Logger.debug(`getSubServiceHealthDatastore failed with error ${err.message}.`)
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
