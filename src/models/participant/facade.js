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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * @module src/models/participant/
 */

const Db = require('../../db')

const getByNameAndCurrency = async (name, currencyId) => {
  try {
    return await Db.participant.query(async (builder) => {
      var result = builder
        .where({ 'participant.name': name })
        .andWhere({ 'participant.isActive': true })
        .andWhere({ 'pc.currencyId': currencyId })
        .andWhere({ 'pc.isActive': true })
        .innerJoin('participantCurrency AS pc', 'pc.participantId', 'participant.participantId')
        .select(
          'participant.*',
          'pc.participantCurrencyId'
        )
        .first()
      return result
    })
  } catch (e) {
    throw e
  }
}

/**
 * @function GetEndpoint
 *
 * @async
 * @description This retuns the active endpoint value for a give participantId and type of endpoint
 *
 *
 * @param {integer} participantId - the id of the participant in the database. Example 1
 * @param {string} type - the type of the endpoint. Example 'FSIOP_CALLBACK_URL'
 *
 * @returns {array} - Returns participantEndpoint array containing the details of active endpoint for the participant if successful, or throws an error if failed
 */

const getEndpoint = async (participantId, endpointType) => {
  try {
    return Db.participantEndpoint.query(builder => {
      return builder.innerJoin('endpointType AS et', 'participantEndpoint.endpointTypeId', 'et.endpointTypeId')
        .where({
          'participantEndpoint.participantId': participantId,
          'participantEndpoint.isActive': 1,
          'et.name': endpointType
        }).select('participantEndpoint.*',
          'et.name')
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

/**
 * @function GetAllEndpoints
 *
 * @async
 * @description This retuns all the active endpoints for a give participantId
 *
 *
 * @param {integer} participantId - the id of the participant in the database. Example 1
 *
 * @returns {array} - Returns an array containing the list of all active endpoints for the participant if successful, or throws an error if failed
 */

const getAllEndpoints = async (participantId) => {
  try {
    return Db.participantEndpoint.query(builder => {
      return builder.innerJoin('endpointType AS et', 'participantEndpoint.endpointTypeId', 'et.endpointTypeId')
        .where({
          'participantEndpoint.participantId': participantId,
          'participantEndpoint.isActive': 1
        }).select('participantEndpoint.*',
          'et.name')
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

/**
 * @function AddEndpoint
 *
 * @async
 * @description This adds the endpoint details for a participant into the database
 *
 * If there is an existing active endpoint for the give participant and endpointType, That endpoing will be made inactive,
 * by updating the database entry isActive = 0.
 * Then new endpoint entry will be inserted into the database, all this will happen inside a database transaction to maintaing the database integrity
 *
 * @param {integer} participantId - the participant id. Example: 1
 * @param {object} payload - the payload containing object with 'type' and 'value' of the endpoint.
 * Example: {
 *      "endpoint": {
 *      "type": "FSIOP_CALLBACK_URL",
 *      "value": "http://localhost:3001/participants/dfsp1/notification12"
 *    }
 * }
 * @returns {integer} - Returns number of database rows affected if successful, or throws an error if failed
 */

const addEndpoint = async (participantId, endpoint) => {
  try {
    const knex = Db.getKnex()
    return knex.transaction(async trx => {
      let endpointType = await trx.first('endpointTypeId').from('endpointType').where({ 'name': endpoint.type, 'isActive': 1 })
      return knex('participantEndpoint').transacting(trx).forUpdate().select('*')
        .where({
          'participantId': participantId,
          'endpointTypeId': endpointType.endpointTypeId,
          'isActive': 1
        })
        .then(existingEndpoint => {
          if (Array.isArray(existingEndpoint) && existingEndpoint.length > 0) {
            return knex('participantEndpoint').transacting(trx).update({ isActive: 0 }).where('participantEndpointId', existingEndpoint[0].participantEndpointId)
          }
        }).then(() => {
          let newEndpoint = {
            participantId: participantId,
            endpointTypeId: endpointType.endpointTypeId,
            value: endpoint.value,
            isActive: 1,
            createdBy: 'unknown'
          }
          return knex('participantEndpoint').transacting(trx).insert(newEndpoint)
        }).then(trx.commit)
        .catch(trx.rollback)
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

/**
 * @function addLimitAndInitialPosition
 *
 * @async
 * @description This adds the limits and initial postion details for a participant into the database
 *
 * This is one time process, the initial postion and limits can be set only once
 * by updating the database entry isActive = 0.
 * Then new endpoint entry will be inserted into the database, all this will happen inside a database transaction to maintaing the database integrity
 *
 * @param {integer} participantId - the participant id. Example: 1
 * @param {object} limitPostionObj - the payload containing and limit and postion values .
 * Example: {
 *  "currency": "USD",
 *  "limit": {
 *    "type": "NET_DEBIT_CAP",
 *    "value": 10000000
 *  },
 *  "initialPosition": 0
 * }
 * @returns {integer} - Returns number of database rows affected if successful, or throws an error if failed
 */

const addLimitAndInitialPosition = async (participantCurrencyId, limitPostionObj) => {
  try {
    const knex = Db.getKnex()
    return knex.transaction(async trx => {
      try {
        let result
        let limitType = await trx.first('participantLimitTypeId').from('participantLimitType').where({ 'name': limitPostionObj.limit.type, 'isActive': 1 })
        let participantLimit = {
          participantCurrencyId,
          participantLimitTypeId: limitType.participantLimitTypeId,
          value: limitPostionObj.limit.value,
          isActive: 1,
          createdBy: 'unknown'
        }
        result = await knex('participantLimit').transacting(trx).insert(participantLimit)
        participantLimit.participantLimitId = result[0]
        let participantPosition = {
          participantCurrencyId,
          value: limitPostionObj.initialPosition,
          reservedValue: 0
        }
        result = await knex('participantPosition').transacting(trx).insert(participantPosition)
        participantPosition.participantPositionId = result[0]
        await trx.commit
        return {
          participantLimit,
          participantPosition
        }
      } catch (err) {
        await trx.rollback
        throw err
      }
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

module.exports = {
  getByNameAndCurrency,
  getEndpoint,
  getAllEndpoints,
  addEndpoint,
  addLimitAndInitialPosition
}
