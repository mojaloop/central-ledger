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

const Db = require('../../lib/db')
const Time = require('@mojaloop/central-services-shared').Util.Time
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Metrics = require('@mojaloop/central-services-metrics')
const Cache = require('../../lib/cache')
const ParticipantModelCached = require('../../models/participant/participantCached')
const ParticipantCurrencyModelCached = require('../../models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('../../models/participant/participantLimitCached')
const Config = require('../../lib/config')
const SettlementModelModel = require('../settlement/settlementModel')
const { Enum } = require('@mojaloop/central-services-shared')

const getByNameAndCurrency = async (name, currencyId, ledgerAccountTypeId, isCurrencyActive) => {
  const histTimerParticipantGetByNameAndCurrencyEnd = Metrics.getHistogram(
    'model_participant',
    'facade_getByNameAndCurrency - Metrics for participant model',
    ['success', 'queryName']
  ).startTimer()

  try {
    let participant
    if (Cache.isCacheEnabled()) {
      /* Cached version - fetch data from Models (which we trust are cached) */
      /* find paricipant id by name */
      participant = await ParticipantModelCached.getByName(name)
      if (participant) {
        /* use the paricipant id and incoming params to prepare the filter */
        const searchFilter = {
          participantId: participant.participantId,
          currencyId,
          ledgerAccountTypeId
        }
        if (isCurrencyActive !== undefined) {
          searchFilter.isActive = isCurrencyActive
        }

        /* find the participantCurrency by prepared filter */
        const participantCurrency = await ParticipantCurrencyModelCached.findOneByParams(searchFilter)

        if (participantCurrency) {
          /* mix requested data from participantCurrency */
          participant.participantCurrencyId = participantCurrency.participantCurrencyId
          participant.currencyId = participantCurrency.currencyId
          participant.currencyIsActive = participantCurrency.isActive
        }
      }
    } else {
      /* Non-cached version - direct call to DB */
      participant = await Db.from('participant').query(async (builder) => {
        let b = builder
          .where({ 'participant.name': name })
          .andWhere({ 'pc.currencyId': currencyId })
          .andWhere({ 'pc.ledgerAccountTypeId': ledgerAccountTypeId })
          .innerJoin('participantCurrency AS pc', 'pc.participantId', 'participant.participantId')
          .select(
            'participant.*',
            'pc.participantCurrencyId',
            'pc.currencyId',
            'pc.isActive AS currencyIsActive'
          )
          .first()

        if (isCurrencyActive !== undefined) {
          b = b.andWhere({ 'pc.isActive': isCurrencyActive })
        }
        return b
      })
    }

    histTimerParticipantGetByNameAndCurrencyEnd({ success: true, queryName: 'facade_getByNameAndCurrency' })

    return participant
  } catch (err) {
    histTimerParticipantGetByNameAndCurrencyEnd({ success: false, queryName: 'facade_getByNameAndCurrency' })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getParticipantLimitByParticipantIdAndCurrencyId = async (participantId, currencyId, ledgerAccountTypeId) => {
  try {
    return await Db.from('participant').query(async (builder) => {
      return builder
        .where({
          'participant.participantId': participantId,
          'pc.currencyId': currencyId,
          'pc.ledgerAccountTypeId': ledgerAccountTypeId
        })
        .innerJoin('participantCurrency AS pc', 'pc.participantId', 'participant.participantId')
        .innerJoin('participantLimit AS pl', 'pl.participantCurrencyId', 'pc.participantCurrencyId')
        .select(
          'participant.*',
          'pc.*',
          'pl.*'
        )
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/**
 * @function GetLimitsForAllParticipants
 *
 * @async
 * @description This returns the active limits value for all the participants for the currency and type combinations
 *
 * @param {string} currencyId - the currency id. Example USD
 * @param {string} type - the type of the limit. Example 'NET_DEBIT_CAP'
 *
 * @returns {array} - Returns an array containing the details of active limits for all the participants if successful, or throws an error if failed
 */

const getLimitsForAllParticipants = async (currencyId, type, ledgerAccountTypeId) => {
  try {
    return Db.from('participant').query(async (builder) => {
      return builder
        .where({
          'pc.ledgerAccountTypeId': ledgerAccountTypeId,
          'participant.isActive': 1,
          'pc.isActive': 1
        })
        .where(q => {
          if (currencyId != null) {
            return q.where('pc.currencyId', '=', currencyId)
          }
        })
        .innerJoin('participantCurrency AS pc', 'pc.participantId', 'participant.participantId')
        .innerJoin('participantLimit AS pl', 'pl.participantCurrencyId', 'pc.participantCurrencyId')
        .where({
          'pl.isActive': 1,
          'lt.isActive': 1
        })
        .where(q => {
          if (type != null) {
            return q.where('lt.name', '=', type)
          }
        })
        .innerJoin('participantLimitType AS lt', 'lt.participantLimitTypeId', 'pl.participantLimitTypeId')
        .select(
          'participant.*',
          'pc.*',
          'pl.*',
          'lt.name as limitType'
        )
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/**
 * @function GetEndpoint
 *
 * @async
 * @description This returns the active endpoint value for a give participantId and type of endpoint
 *
 *
 * @param {integer} participantId - the id of the participant in the database. Example 1
 * @param {string} endpointType - the type of the endpoint. Example 'FSPIOP_CALLBACK_URL_TRANSFER_POST'
 *
 * @returns {array} - Returns participantEndpoint array containing the details of active endpoint for the participant if successful, or throws an error if failed
 */

const getEndpoint = async (participantId, endpointType) => {
  try {
    return Db.from('participantEndpoint').query(builder => {
      return builder.innerJoin('endpointType AS et', 'participantEndpoint.endpointTypeId', 'et.endpointTypeId')
        .where({
          'participantEndpoint.participantId': participantId,
          'participantEndpoint.isActive': 1,
          'et.name': endpointType
        }).select('participantEndpoint.*',
          'et.name')
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/**
 * @function GetAllEndpoints
 *
 * @async
 * @description This returns all the active endpoints for a give participantId
 *
 *
 * @param {integer} participantId - the id of the participant in the database. Example 1
 *
 * @returns {array} - Returns an array containing the list of all active endpoints for the participant if successful, or throws an error if failed
 */

const getAllEndpoints = async (participantId) => {
  try {
    return Db.from('participantEndpoint').query(builder => {
      return builder.innerJoin('endpointType AS et', 'participantEndpoint.endpointTypeId', 'et.endpointTypeId')
        .where({
          'participantEndpoint.participantId': participantId,
          'participantEndpoint.isActive': 1
        }).select('participantEndpoint.*',
          'et.name')
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/**
 * @function AddEndpoint
 *
 * @async
 * @description This adds the endpoint details for a participant into the database
 *
 * If there is an existing active endpoint for the give participant and endpointType, That endpoint will be made inactive,
 * by updating the database entry isActive = 0.
 * Then new endpoint entry will be inserted into the database, all this will happen inside a database transaction to maintain the database integrity
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
        const endpointType = await knex('endpointType').where({ name: endpoint.type, isActive: 1 }).select('endpointTypeId').first()
        // let endpointType = await trx.first('endpointTypeId').from('endpointType').where({ 'name': endpoint.type, 'isActive': 1 })

        const existingEndpoint = await knex('participantEndpoint').transacting(trx).forUpdate().select('*')
          .where({
            participantId: participantId,
            endpointTypeId: endpointType.endpointTypeId,
            isActive: 1
          })
        if (Array.isArray(existingEndpoint) && existingEndpoint.length > 0) {
          await knex('participantEndpoint').transacting(trx).update({ isActive: 0 }).where('participantEndpointId', existingEndpoint[0].participantEndpointId)
        }
        const newEndpoint = {
          participantId: participantId,
          endpointTypeId: endpointType.endpointTypeId,
          value: endpoint.value,
          isActive: 1,
          createdBy: 'unknown'
        }
        const result = await knex('participantEndpoint').transacting(trx).insert(newEndpoint)
        newEndpoint.participantEndpointId = result[0]
        await trx.commit
        return newEndpoint
      } catch (err) {
        await trx.rollback
        throw err
      }
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getParticipantLimitByParticipantCurrencyLimit = async (participantId, currencyId, ledgerAccountTypeId, participantLimitTypeId) => {
  const histGetParticipantLimitEnd = Metrics.getHistogram(
    'model_participant',
    'facade_getParticipantLimitByParticipantCurrencyLimit - Metrics for participant model',
    ['success', 'queryName']
  ).startTimer()

  try {
    let participantLimit
    if (Cache.isCacheEnabled()) {
      /* Cached version - fetch data from Models (which we trust are cached) */
      const participant = await ParticipantModelCached.getById(participantId)

      /* Checkpoint #1: participant found and is active */
      if ((participant) && (participant.isActive)) {
        /* use the paricipant id and incoming params to prepare the filter */
        const searchFilter = {
          participantId: participant.participantId,
          currencyId,
          ledgerAccountTypeId,
          isActive: 1
        }

        /* find the participantCurrency by prepared filter */
        const participantCurrency = await ParticipantCurrencyModelCached.findOneByParams(searchFilter)

        /* Checkpoint #2: participantCurrency found and is active */
        if ((participantCurrency) && (participantCurrency.isActive)) {
          const participantLimitRow = await ParticipantLimitCached.getByParticipantCurrencyId(participantCurrency.participantCurrencyId)

          /* Checkpoint #3: participantLimit found */
          if ((participantLimitRow) && (participantLimitRow.isActive)) {
            /* combine all needed info */
            participantLimit = {
              participantId,
              currencyId: participantCurrency.currencyId,
              participantLimitTypeId: participantLimitRow.participantLimitTypeId,
              value: participantLimitRow.value
            }
          }
        }
      }
    } else {
      /* Non-cached version - direct call to DB */
      participantLimit = await Db.from('participant').query(async (builder) => {
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
    }
    histGetParticipantLimitEnd({ success: true, queryName: 'facade_getParticipantLimitByParticipantCurrencyLimit' })
    return participantLimit
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getParticipantPositionByParticipantIdAndCurrencyId = async (participantId, currencyId, ledgerAccountTypeId) => {
  try {
    return await Db.from('participant').query(async (builder) => {
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
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
/**
 * @function addLimitAndInitialPosition
 *
 * @async
 * @description This adds the limits and initial position details for a participant into the database
 *
 * This is one time process, the initial position and limits can be set only once
 * by updating the database entry isActive = 0.
 * Then new endpoint entry will be inserted into the database, all this will happen inside a database transaction to maintain the database integrity
 *
 * @param {integer} participantId - the participant id. Example: 1
 * @param {object} limitPositionObj - the payload containing and limit and position values .
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

const addLimitAndInitialPosition = async (participantCurrencyId, settlementAccountId, limitPositionObj, setCurrencyActive = false) => {
  try {
    const knex = Db.getKnex()
    return knex.transaction(async trx => {
      try {
        const limitType = await knex('participantLimitType').where({ name: limitPositionObj.limit.type, isActive: 1 }).select('participantLimitTypeId').first()
        const participantLimit = {
          participantCurrencyId,
          participantLimitTypeId: limitType.participantLimitTypeId,
          value: limitPositionObj.limit.value,
          isActive: 1,
          createdBy: 'unknown'
        }
        const result = await knex('participantLimit').transacting(trx).insert(participantLimit)
        participantLimit.participantLimitId = result[0]

        const allSettlementModels = await SettlementModelModel.getAll()
        const settlementModels = allSettlementModels.filter(model => model.currencyId === limitPositionObj.currency)
        if (Array.isArray(settlementModels) && settlementModels.length > 0) {
          for (const settlementModel of settlementModels) {
            const positionAccount = await getByNameAndCurrency(limitPositionObj.name, limitPositionObj.currency, settlementModel.ledgerAccountTypeId)
            const settlementAccount = await getByNameAndCurrency(limitPositionObj.name, limitPositionObj.currency, settlementModel.settlementAccountTypeId)

            const participantPosition = {
              participantCurrencyId: positionAccount.participantCurrencyId,
              value: (settlementModel.ledgerAccountTypeId === Enum.Accounts.LedgerAccountType.POSITION ? limitPositionObj.initialPosition : 0),
              reservedValue: 0
            }
            await knex('participantPosition').transacting(trx).insert(participantPosition)

            const settlementPosition = {
              participantCurrencyId: settlementAccount.participantCurrencyId,
              value: 0,
              reservedValue: 0
            }
            await knex('participantPosition').transacting(trx).insert(settlementPosition)
            if (setCurrencyActive) { // if the flag is true then set the isActive flag for corresponding participantCurrency record to true
              await knex('participantCurrency').transacting(trx).update({ isActive: 1 }).where('participantCurrencyId', positionAccount.participantCurrencyId)
              await knex('participantCurrency').transacting(trx).update({ isActive: 1 }).where('participantCurrencyId', settlementAccount.participantCurrencyId)
              await ParticipantCurrencyModelCached.invalidateParticipantCurrencyCache()
              await ParticipantLimitCached.invalidateParticipantLimitCache()
            }
          }
        } else {
          const participantPosition = {
            participantCurrencyId,
            value: limitPositionObj.initialPosition,
            reservedValue: 0
          }
          const participantPositionResult = await knex('participantPosition').transacting(trx).insert(participantPosition)
          participantPosition.participantPositionId = participantPositionResult[0]
          const settlementPosition = {
            participantCurrencyId: settlementAccountId,
            value: 0,
            reservedValue: 0
          }
          await knex('participantPosition').transacting(trx).insert(settlementPosition)
          if (setCurrencyActive) { // if the flag is true then set the isActive flag for corresponding participantCurrency record to true
            await knex('participantCurrency').transacting(trx).update({ isActive: 1 }).where('participantCurrencyId', participantCurrencyId)
            await knex('participantCurrency').transacting(trx).update({ isActive: 1 }).where('participantCurrencyId', settlementAccountId)
            await ParticipantCurrencyModelCached.invalidateParticipantCurrencyCache()
            await ParticipantLimitCached.invalidateParticipantLimitCache()
          }
        }

        await trx.commit
        return true
      } catch (err) {
        await trx.rollback
        throw err
      }
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
 * Then new limit entry will be inserted into the database, all this will happen inside a database transaction to maintain the database integrity
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
        const limitType = await knex('participantLimitType').where({ name: limit.type, isActive: 1 }).select('participantLimitTypeId').first()
        // const limitType = await trx.first('participantLimitTypeId').from('participantLimitType').where({ 'name': limit.type, 'isActive': 1 })
        const existingLimit = await knex('participantLimit').transacting(trx).forUpdate().select('*')
          .where({
            participantCurrencyId: participantCurrencyId,
            participantLimitTypeId: limitType.participantLimitTypeId,
            isActive: 1
          })
        if (Array.isArray(existingLimit) && existingLimit.length > 0) {
          await knex('participantLimit').transacting(trx).update({ isActive: 0 }).where('participantLimitId', existingLimit[0].participantLimitId)
        } else {
          throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, 'Participant Limit does not exist')
        }
        const newLimit = {
          participantCurrencyId: participantCurrencyId,
          participantLimitTypeId: limitType.participantLimitTypeId,
          value: limit.value,
          thresholdAlarmPercentage: limit.alarmPercentage,
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
        throw ErrorHandler.Factory.reformatFSPIOPError(err)
      }
    }

    const knex = Db.getKnex()
    if (trx) {
      return trxFunction(trx, false)
    } else {
      return knex.transaction(trxFunction)
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/**
 * @function GetParticipantLimitsByCurrencyId
 *
 * @async
 * @description This returns the active participant limits for a give participantCurrencyId and limit type
 *
 *
 * @param {integer} participantCurrencyId - the id of the participant currency in the database. Example 1
 * @param {string} type - The type of the limit. Example 'NET_DEBIT_CAP'
 *
 * @returns {array} - Returns an array containing the list of all active limits for the participant/currency and type if successful, or throws an error if failed
 */

const getParticipantLimitsByCurrencyId = async (participantCurrencyId, type) => {
  try {
    return Db.from('participantLimit').query(builder => {
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
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/**
 * @function GetParticipantLimitsByParticipantId
 *
 * @async
 * @description This returns all the active endpoints for a give participantId  and limit type
 *
 *
 * @param {integer} participantId - the id of the participant currency in the database. Example 1
 * @param {string} type - The type of the limit. Example 'NET_DEBIT_CAP'
 *
 * @returns {array} - Returns an array containing the list of all active limits for the participant and type if successful, or throws an error if failed
 */

const getParticipantLimitsByParticipantId = async (participantId, type, ledgerAccountTypeId) => {
  try {
    return Db.from('participantLimit').query(builder => {
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
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const addHubAccountAndInitPosition = async (participantId, currencyId, ledgerAccountTypeId) => {
  try {
    const knex = Db.getKnex()
    return knex.transaction(async trx => {
      try {
        let result
        const participantCurrency = {
          participantId,
          currencyId,
          ledgerAccountTypeId,
          createdBy: 'unknown',
          isActive: 1,
          createdDate: Time.getUTCString(new Date())
        }
        result = await knex('participantCurrency').transacting(trx).insert(participantCurrency)
        await ParticipantCurrencyModelCached.invalidateParticipantCurrencyCache()
        participantCurrency.participantCurrencyId = result[0]
        const participantPosition = {
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
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getAllAccountsByNameAndCurrency = async (name, currencyId = null, isAccountActive = 1) => {
  try {
    return Db.from('participantCurrency').query(builder => {
      return builder
        .innerJoin('ledgerAccountType AS lap', 'lap.ledgerAccountTypeId', 'participantCurrency.ledgerAccountTypeId')
        .innerJoin('participant AS p', 'p.participantId', 'participantCurrency.participantId')
        .where({
          'p.name': name,
          'p.isActive': 1
        })
        .where(q => {
          if (currencyId != null) {
            return q.where('participantCurrency.currencyId', currencyId)
          }
        })
        .where(q => {
          if (isAccountActive != null) {
            return q.where('participantCurrency.isActive', isAccountActive)
          }
        })
        .select('*', 'lap.name AS ledgerAccountType', 'participantCurrency.isActive AS accountIsActive')
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getAllNonHubParticipantsWithCurrencies = async (trx) => {
  try {
    const HUB_ACCOUNT_NAME = Config.HUB_NAME
    const knex = Db.getKnex()
    const trxFunction = async (trx, doCommit = true) => {
      try {
        const res = await knex.distinct('participant.participantId', 'pc.participantId', 'pc.currencyId')
          .from('participant')
          .innerJoin('participantCurrency as pc', 'participant.participantId', 'pc.participantId')
          .whereNot('participant.name', HUB_ACCOUNT_NAME)
          .transacting(trx)

        if (doCommit) {
          await trx.commit
        }
        return res
      } catch (err) {
        if (doCommit) {
          await trx.rollback
        }
        throw ErrorHandler.Factory.reformatFSPIOPError(err)
      }
    }
    if (trx) {
      return trxFunction(trx, false)
    } else {
      return knex.transaction(trxFunction)
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
  getAllAccountsByNameAndCurrency,
  getLimitsForAllParticipants,
  getAllNonHubParticipantsWithCurrencies
}
