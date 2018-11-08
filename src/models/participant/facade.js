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
 * @module src/models/participant/facade/
 */

const Db = require('../../db')
const Time = require('../../lib/time')

const getByNameAndCurrency = async (name, currencyId, ledgerAccountTypeId) => {
  try {
    return await Db.participant.query(async (builder) => {
      return builder
        .where({ 'participant.name': name })
        .andWhere({ 'participant.isActive': true })
        .andWhere({ 'pc.currencyId': currencyId })
        .andWhere({ 'pc.isActive': true })
        .andWhere({ 'pc.ledgerAccountTypeId': ledgerAccountTypeId })
        .innerJoin('participantCurrency AS pc', 'pc.participantId', 'participant.participantId')
        .select(
          'participant.*',
          'pc.participantCurrencyId',
          'pc.currencyId'
        )
        .first()
    })
  } catch (e) {
    throw e
  }
}

const getParticipantLimitByParticipantIdAndCurrencyId = async (participantId, currencyId, ledgerAccountTypeId) => {
  try {
    return await Db.participant.query(async (builder) => {
      return builder
        .where({
          'participant.participantId': participantId,
          'pc.currencyId': currencyId,
          'pc.ledgerAccountTypeId': ledgerAccountTypeId
        })
        .innerJoin('participantCurrency AS pc', 'pc.participantId', 'participant.participantId')
        .innerJoin('participantLimit AS pl', 'pl.participantCurrencyId', 'pl.participantCurrencyId')
        .select(
          'participant.*',
          'pc.*',
          'pl.*'
        )
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
 * @param {string} type - the type of the endpoint. Example 'FSPIOP_CALLBACK_URL_TRANSFER_POST'
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
 * @param {object} endpoint - the payload containing object with 'type' and 'value' of the endpoint.
 * Example: {
 *      "endpoint": {
 *      "type": "FSPIOP_CALLBACK_URL_TRANSFER_POST",
 *      "value": "http://localhost:3001/participants/dfsp1/notification12"
 *    }
 * }
 * @returns {object} participantEndpoint - Returns participantEndpoint added/updated if successful, or throws an error if failed
 */

const addEndpoint = async (participantId, endpoint) => {
  try {
    const knex = Db.getKnex()
    return knex.transaction(async trx => {
      try {
        let endpointType = await knex('endpointType').where({ 'name': endpoint.type, 'isActive': 1 }).select('endpointTypeId').first()
        // let endpointType = await trx.first('endpointTypeId').from('endpointType').where({ 'name': endpoint.type, 'isActive': 1 })

        const existingEndpoint = await knex('participantEndpoint').transacting(trx).forUpdate().select('*')
          .where({
            'participantId': participantId,
            'endpointTypeId': endpointType.endpointTypeId,
            'isActive': 1
          })
        if (Array.isArray(existingEndpoint) && existingEndpoint.length > 0) {
          await knex('participantEndpoint').transacting(trx).update({ isActive: 0 }).where('participantEndpointId', existingEndpoint[0].participantEndpointId)
        }
        let newEndpoint = {
          participantId: participantId,
          endpointTypeId: endpointType.endpointTypeId,
          value: endpoint.value,
          isActive: 1,
          createdBy: 'unknown'
        }
        let result = await knex('participantEndpoint').transacting(trx).insert(newEndpoint)
        newEndpoint.participantEndpointId = result[0]
        await trx.commit
        return newEndpoint
      } catch (err) {
        await trx.rollback
        throw err
      }
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

const getParticipantLimitByParticipantCurrencyLimit = async (participantId, currencyId, ledgerAccountTypeId, participantLimitTypeId) => {
  try {
    return await Db.participant.query(async (builder) => {
      return builder
        .where({
          'participant.participantId': participantId,
          'pc.currencyId': currencyId,
          'pc.ledgerAccountTypeId': ledgerAccountTypeId,
          'pl.participantLimitTypeId': participantLimitTypeId,
          'participant.isActive': 1,
          'pc.IsActive': 1,
          'pl.isActive': 1
        })
        .innerJoin('participantCurrency AS pc', 'pc.participantId', 'participant.participantId')
        .innerJoin('participantLimit AS pl', 'pl.participantCurrencyId', 'pc.participantCurrencyId')
        .select(
          'participant.participantID AS participantId',
          'pc.currencyId AS currencyId',
          'pl.participantLimitTypeId as participantLimitTypeId',
          'pl.value AS value'
        ).first()
    })
  } catch (e) {
    throw e
  }
}

const getParticipantPositionByParticipantIdAndCurrencyId = async (participantId, currencyId, ledgerAccountTypeId) => {
  try {
    return await Db.participant.query(async (builder) => {
      return builder
        .where({
          'participant.participantId': participantId,
          'pc.currencyId': currencyId,
          'pc.ledgerAccountTypeId': ledgerAccountTypeId
        })
        .innerJoin('participantCurrency AS pc', 'pc.participantId', 'participant.participantId')
        .innerJoin('participantPosition AS pp', 'pp.participantCurrencyId', 'pc.participantCurrencyId')
        .select(
          'participant.*',
          'pc.*',
          'pp.*'
        )
    })
  } catch (e) {
    throw e
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

const addLimitAndInitialPosition = async (participantCurrencyId, settlementAccountId, limitPostionObj) => {
  try {
    const knex = Db.getKnex()
    return knex.transaction(async trx => {
      try {
        let result
        let limitType = await knex('participantLimitType').where({ 'name': limitPostionObj.limit.type, 'isActive': 1 }).select('participantLimitTypeId').first()
        //  let limitType = await trx.first('participantLimitTypeId').from('participantLimitType').where({ 'name': limitPostionObj.limit.type, 'isActive': 1 })
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
        let settlementPosition = {
          participantCurrencyId: settlementAccountId,
          value: 0,
          reservedValue: 0
        }
        result = await knex('participantPosition').transacting(trx).insert(settlementPosition)
        settlementPosition.participantPositionId = result[0]
        await trx.commit
        return {
          participantLimit,
          participantPosition,
          settlementPosition
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

/**
 * @function AdjustLimits
 *
 * @async
 * @description This adds the Limit details for a participant into the database
 *
 * If there is an existing active limit for the give participant and limitType, That limit will be made inactive,
 * by updating the database entry isActive = 0.
 * Then new limit entry will be inserted into the database, all this will happen inside a database transaction to maintaing the database integrity
 *
 * @param {integer} participantCurrencyId - the participant currency id. Example: 1
 * @param {object} limit - the payload containing object with 'type' and 'value' of the limit.
 * Example: {
 * "currency": "USD",
 *   "limit": {
 *     "type": "NET_DEBIT_CAP",
 *     "value": 10000000
 *   }
 * }
* @returns {object} participantLimit - Returns participantLimit updated/inserted object if successful, or throws an error if failed
 */

const adjustLimits = async (participantCurrencyId, limit, trx) => {
  try {
    const trxFunction = async (trx, doCommit = true) => {
      try {
        const limitType = await knex('participantLimitType').where({ 'name': limit.type, 'isActive': 1 }).select('participantLimitTypeId').first()
        // const limitType = await trx.first('participantLimitTypeId').from('participantLimitType').where({ 'name': limit.type, 'isActive': 1 })
        const existingLimit = await knex('participantLimit').transacting(trx).forUpdate().select('*')
          .where({
            'participantCurrencyId': participantCurrencyId,
            'participantLimitTypeId': limitType.participantLimitTypeId,
            'isActive': 1
          })
        if (Array.isArray(existingLimit) && existingLimit.length > 0) {
          await knex('participantLimit').transacting(trx).update({ isActive: 0 }).where('participantLimitId', existingLimit[0].participantLimitId)
        } else {
          throw new Error('Participant Limit does not exist')
        }
        let newLimit = {
          participantCurrencyId: participantCurrencyId,
          participantLimitTypeId: limitType.participantLimitTypeId,
          value: limit.value,
          thresholdAlarmPercentage: limit.thresholdAlarmPercentage,
          isActive: 1,
          createdBy: 'unknown'
        }
        const result = await knex('participantLimit').transacting(trx).insert(newLimit)
        newLimit.participantLimitId = result[0]
        if (doCommit) {
          await trx.commit
        }
        return {
          participantLimit: newLimit
        }
      } catch (err) {
        if (doCommit) {
          await trx.rollback
        }
        throw err
      }
    }

    const knex = Db.getKnex()
    if (trx) {
      return trxFunction(trx, false)
    } else {
      return knex.transaction(trxFunction)
    }
  } catch (err) {
    throw new Error(err.message)
  }
}

/**
 * @function GetParticipantLimitsByCurrencyId
 *
 * @async
 * @description This retuns the active participant limits for a give participantCurrencyId and limit type
 *
 *
 * @param {integer} participantCurrencyId - the id of the participant currency in the database. Example 1
 * @param {string} type - The type of the limit. Example 'NET_DEBIT_CAP'
 *
 * @returns {array} - Returns an array containing the list of all active limits for the participant/currency and type if successful, or throws an error if failed
 */

const getParticipantLimitsByCurrencyId = async (participantCurrencyId, type) => {
  try {
    return Db.participantLimit.query(builder => {
      return builder.innerJoin('participantLimitType AS lt', 'participantLimit.participantLimitTypeId', 'lt.participantLimitTypeId')
        .where({
          'participantLimit.participantCurrencyId': participantCurrencyId,
          'lt.isActive': 1,
          'participantLimit.isActive': 1
        })
        .where(q => {
          if (type != null) {
            return q.where('lt.name', '=', type)
          }
        })
        .select('participantLimit.*',
          'lt.name'
        ).orderBy('lt.name')
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

/**
 * @function GetParticipantLimitsByParticipantId
 *
 * @async
 * @description This retuns all the active endpoints for a give participantId  and limit type
 *
 *
 * @param {integer} participantId - the id of the participant currency in the database. Example 1
 * @param {string} type - The type of the limit. Example 'NET_DEBIT_CAP'
 *
 * @returns {array} - Returns an array containing the list of all active limits for the participant and type if successful, or throws an error if failed
 */

const getParticipantLimitsByParticipantId = async (participantId, type, ledgerAccountTypeId) => {
  try {
    return Db.participantLimit.query(builder => {
      return builder.innerJoin('participantLimitType AS lt', 'participantLimit.participantLimitTypeId', 'lt.participantLimitTypeId')
        .innerJoin('participantCurrency AS pc', 'participantLimit.participantCurrencyId', 'pc.participantCurrencyId')
        .where({
          'pc.participantId': participantId,
          'pc.ledgerAccountTypeId': ledgerAccountTypeId,
          'pc.isActive': 1,
          'lt.isActive': 1,
          'participantLimit.isActive': 1
        })
        .where(q => {
          if (type != null) {
            return q.where('lt.name', '=', type)
          }
        })
        .select('participantLimit.*',
          'lt.name',
          'pc.currencyId'
        ).orderBy('pc.currencyId', 'lt.name')
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

const addHubAccountAndInitPosition = async (participantId, currencyId, ledgerAccountTypeId) => {
  try {
    const knex = Db.getKnex()
    return knex.transaction(async trx => {
      try {
        let result
        let participantCurrency = {
          participantId,
          currencyId,
          ledgerAccountTypeId,
          createdBy: 'unknown',
          isActive: 1,
          createdDate: Time.getUTCString(new Date())
        }
        result = await knex('participantCurrency').transacting(trx).insert(participantCurrency)
        participantCurrency.participantCurrencyId = result[0]
        let participantPosition = {
          participantCurrencyId: participantCurrency.participantCurrencyId,
          value: 0,
          reservedValue: 0
        }
        result = await knex('participantPosition').transacting(trx).insert(participantPosition)
        participantPosition.participantPositionId = result[0]
        await trx.commit
        return {
          participantCurrency,
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

const getAllAccountsByNameAndCurrency = async (name, currencyId = null) => {
  try {
    return Db.participantCurrency.query(builder => {
      return builder
        .innerJoin('ledgerAccountType AS lap', 'lap.ledgerAccountTypeId', 'participantCurrency.ledgerAccountTypeId')
        .innerJoin('participant AS p', 'p.participantId', 'participantCurrency.participantId')
        .where({
          'p.name': name,
          'p.isActive': 1,
          'participantCurrency.isActive': 1
        })
        .where(q => {
          if (currencyId != null) {
            return q.where('participantCurrency.currencyId', '=', currencyId)
          }
        })
        .select('*', 'lap.name AS ledgerAccountType')
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

module.exports = {
  addHubAccountAndInitPosition,
  getByNameAndCurrency,
  getParticipantLimitByParticipantIdAndCurrencyId,
  getEndpoint,
  getAllEndpoints,
  addEndpoint,
  getParticipantPositionByParticipantIdAndCurrencyId,
  getParticipantLimitByParticipantCurrencyLimit,
  addLimitAndInitialPosition,
  adjustLimits,
  getParticipantLimitsByCurrencyId,
  getParticipantLimitsByParticipantId,
  getAllAccountsByNameAndCurrency
}
