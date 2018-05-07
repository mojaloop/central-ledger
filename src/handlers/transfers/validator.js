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
const ValidationError = require('../../errors/index').ValidationError
const CryptoConditions = require('../../crypto-conditions/index')
const Logger = require('@mojaloop/central-services-shared').Logger

const Joi = require('joi')
const Enjoi = require('enjoi')
const fs = require('fs')

//Note that the following two lines will be replaced by functionality to load the schemas from DB
const transferPrepareSchemaFile = "./transfer-schema.json"
const transferPrepareSchema  = Enjoi(JSON.parse(fs.readFileSync(transferPrepareSchemaFile, 'utf8')))

const allowedScale = Config.AMOUNT.SCALE
const allowedPrecision = Config.AMOUNT.PRECISION

const validateParticipantById = async function (participantId) {
  const participant = Participant.getById(participantId)
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
const validateTransferPrepareSchema = async (payload) => {
  const validationResult = await Joi.validate (payload, transferPrepareSchema)
  return validationResult
}

const validateParticipantByName = async function (participantId) {
  const participant = Participant.getByName(participantId)
  return !!participant
}

const validateAmount = (amount) => {
  const decimalAmount = new Decimal(amount.amount)
  if (decimalAmount.decimalPlaces() > allowedScale) {
    throw new ValidationError(`Amount ${amount.amount} exceeds allowed scale of ${allowedScale}`)
  }
  if (decimalAmount.precision(true) > allowedPrecision) {
    throw new ValidationError(`Amount ${amount.amount} exceeds allowed precision of ${allowedPrecision}`)
  }
}

const validateConditionAndExpiration = (payload) => {
  if (!payload.condition) return
  CryptoConditions.validateCondition(payload.condition)
  if (payload.expiration) {
    if (payload.expiration.isBefore(Moment.utc())) {
      throw new ValidationError(`expiration date: ${payload.expiration.toISOString()} has already expired.`)
    }
  } else {
    throw new ValidationError('expiration: required for conditional transfer')
  }
  return true
}

const validate = (payload) => {
  return P.resolve().then(() => {
    if (!payload) {
      throw new ValidationError('Transfer must be provided')
    }
    return !!(validateParticipantByName(payload.payerFsp) && validateParticipantByName(payload.payeeFsp) && validateAmount(payload.amount) && validateConditionAndExpiration(payload))
  })
}



module.exports = {
  validate,
  validateTransferPrepareSchema
}
