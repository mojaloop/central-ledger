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

/**
 * @module src/handlers/transfers
 */

const Logger = require('@mojaloop/central-services-shared').Logger
const Decimal = require('decimal.js')
const Config = require('../../lib/config')
const Participant = require('../../domain/participant')
const CryptoConditions = require('../../cryptoConditions')
const Crypto = require('crypto')
const base64url = require('base64url')
// const Logger = require('@mojaloop/central-services-shared').Logger

// const Joi = require('joi')
// const Enjoi = require('enjoi')
// const fs = require('fs')

// Note that the following two lines will be replaced by functionality to load the schemas from DB
// const transferPrepareSchemaFile = "./transferSchema.json"
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

const validateParticipantByName = async function (participantName) {
  const participant = await Participant.getByName(participantName)
  if (!participant) {
    reasons.push(`Participant ${participantName} not found`)
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

// TODO: The following function should be moved into a re-usable common-shared-service at a later point
// NOTE: This logic is based on v1.0 of the Mojaloop Specification as described in section 6.5.1.2
const fulfilmentToCondition = (fulfilment) => {
  var hashSha256 = Crypto.createHash('sha256')
  var preimage = base64url.toBuffer(fulfilment)

  if (preimage.length !== 32) {
    throw new Error('Interledger preimages must be exactly 32 bytes')
  }

  var calculatedConditionDigest = hashSha256.update(preimage).digest('base64')
  Logger.debug(`calculatedConditionDigest=${calculatedConditionDigest}`)
  var calculatedConditionUrlEncoded = base64url.fromBase64(calculatedConditionDigest)
  Logger.debug(`calculatedConditionUrlEncoded=${calculatedConditionUrlEncoded}`)
  return calculatedConditionUrlEncoded
}

// TODO: The following function should be moved into a re-usable common-shared-service at a later point
// NOTE: This logic is based on v1.0 of the Mojaloop Specification as described in section 6.5.1.2
const validateFulfilCondition = (fulfilment, condition) => {
  var calculatedCondition = fulfilmentToCondition(fulfilment)
  return calculatedCondition === condition
}

const validateConditionAndExpiration = async (payload) => {
  if (!payload.condition) {
    reasons.push('Condition is required for a conditional transfer')
    return false
  }
  try {
    const condition = 'ni:///sha-256;' + payload.condition + '?fpt=preimage-sha-256&cost=0'
    await CryptoConditions.validateCondition(condition)
  } catch (e) {
    reasons.push('Condition validation failed')
    return false
  }
  if (payload.expiration) {
    if (Date.parse(payload.expiration) < Date.parse(new Date().toDateString())) {
      reasons.push(`Expiration date ${new Date(payload.expiration.toString()).toISOString()} is already in the past`)
      return false
    }
  } else {
    reasons.push('Expiration is required for conditional transfer')
    return false
  }
  return true
}

const validateByName = async (payload) => {
  reasons.length = 0
  let validationPassed
  if (!payload) {
    reasons.push('Transfer must be provided')
    validationPassed = false
    return { validationPassed, reasons }
  }
  validationPassed = (await validateParticipantByName(payload.payerFsp) && await validateParticipantByName(payload.payeeFsp) && validateAmount(payload.amount) && await validateConditionAndExpiration(payload))
  return {
    validationPassed,
    reasons
  }
}

const validateById = async (payload) => {
  reasons.length = 0
  let validationPassed
  if (!payload) {
    reasons.push('Transfer must be provided')
    validationPassed = false
    return { validationPassed, reasons }
  }
  validationPassed = (await validateParticipantById(payload.payerFsp) && await validateParticipantById(payload.payeeFsp) && validateAmount(payload.amount) && await validateConditionAndExpiration(payload))
  return {
    validationPassed,
    reasons
  }
}

module.exports = {
  validateByName,
  validateById,
  validateFulfilCondition,
  //  validateTransferPrepareSchema,
  reasons
}
