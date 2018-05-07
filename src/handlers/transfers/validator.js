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

 * Lazola Lucas <lazola.lucas@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/
'use strict'

const P = require('bluebird')
const Decimal = require('decimal.js')
const Moment = require('moment')
const Config = require('../../lib/config')
const Participant = require('../../domain/participant/index')
const CryptoConditions = require('../../crypto-conditions/index')
const Logger = require('@mojaloop/central-services-shared').Logger

const Joi = require('joi')
const Enjoi = require('enjoi')
const fs = require('fs')

// Note that the following two lines will be replaced by functionality to load the schemas from DB
// const transferPrepareSchemaFile = "./transfer-schema.json"
// const transferPrepareSchema  = Enjoi(JSON.parse(fs.readFileSync(transferPrepareSchemaFile, 'utf8')))

const allowedScale = Config.AMOUNT.SCALE
const allowedPrecision = Config.AMOUNT.PRECISION
let reasons = []


const validateParticipantById = async function (participantId) {
  const participant = await Participant.getById(participantId)
  if (!participant) {
    reasons.push(`Participant ${participantId} not found`)
  }
  return !!participant
}

/**
 @typedef validationResult
 @type {Object}
 @property {object} error if validation failed, the error reason, otherwise null.
 @property {object} value the validated value with any type conversions and other modifiers applied (the input is left unchanged). value can be incomplete if validation failed and abortEarly is true. If callback is not provided, then returns an object with error and value properties.
 */
/**
 * Function to validate transfer payload against the transfer schema.
 * @param {object} payload - The prepare transfer payload.
 * @return {validationResult} Returns a Promise of validationResult Object.
 */
// const validateTransferPrepareSchema = async (payload) => {
//   const validationResult = await Joi.validate (payload, transferPrepareSchema)
//   return validationResult
// }

const validateParticipantByName = async function (participantId) {
  const participant = await Participant.getByName(participantId)
  if (!participant) {
    reasons.push(`Participant ${participantId} not found`)
  }
  return !!participant
}

const validateAmount = (amount) => {
  const decimalAmount = new Decimal(amount.amount)
  if (decimalAmount.decimalPlaces() > allowedScale) {
    reasons.push(`Amount ${amount.amount} exceeds allowed scale of ${allowedScale}`)
    return false
  }
  if (decimalAmount.precision(true) > allowedPrecision) {
    reasons.push(`Amount ${amount.amount} exceeds allowed precision of ${allowedPrecision}`)
    return false
  }
  return true
}

const validateConditionAndExpiration = async (payload) => {
  if (!payload.condition) return false
  try {
    await CryptoConditions.validateCondition(payload.condition)
  } catch (e) {
    reasons.push('Condition validation failed')
    return false
  }
  if (payload.expiration) {
    if (payload.expiration.isBefore(Moment.utc())) {
      reasons.push(`expiration date: ${payload.expiration.toISOString()} has already expired.`)
      return false
    }
  } else {
    reasons.push('expiration: required for conditional transfer')
    return false
  }
  return true
}

const validateByName = (payload) => {
  reasons.length = 0
  return P.resolve().then(() => {
    if (!payload) {
      reasons.push('Transfer must be provided')
      return false
    }
    return {
      validationPassed: !!(validateParticipantByName(payload.payerFsp) && validateParticipantByName(payload.payeeFsp) && validateAmount(payload.amount) && validateConditionAndExpiration(payload)),
      reasons
    }
  })
}

const validateById = (payload) => {
  reasons.length = 0
  return P.resolve().then(() => {
    if (!payload) {
      reasons.push('Transfer must be provided')
      return false
    }
    return {
      validationPassed: !!(validateParticipantById(payload.payerFsp) && validateParticipantById(payload.payeeFsp) && validateAmount(payload.amount) && validateConditionAndExpiration(payload)),
      reasons
    }
  })
}

module.exports = {
  validateByName,
  validateById,
//  validateTransferPrepareSchema,
  reasons
}
