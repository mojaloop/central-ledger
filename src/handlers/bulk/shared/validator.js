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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 - Steven Oderayi <steven.oderayi@modusbox.com>
 --------------
 ******/
'use strict'

/**
 * @module src/handlers/bulk
 */

const Participant = require('../../../domain/participant')
const BulkTransferService = require('../../../domain/bulkTransfer')
const Enum = require('@mojaloop/central-services-shared').Enum

const reasons = []

const validateDifferentFsp = (payload) => {
  const isPayerAndPayeeDifferent = (payload.payerFsp.toLowerCase() !== payload.payeeFsp.toLowerCase())
  if (!isPayerAndPayeeDifferent) {
    reasons.push('Payer and Payee should differ')
    return false
  }
  return true
}
const validateExpiration = (payload) => {
  if (Date.parse(payload.expiration) < Date.parse(new Date().toDateString())) {
    reasons.push(`Expiration date ${new Date(payload.expiration.toString()).toISOString()} is already in the past`)
    return false
  }
  return true
}
const validateFspiopSourceMatchesPayer = (payload, headers) => {
  const matched = (headers && headers[Enum.Http.Headers.FSPIOP.SOURCE] === payload.payerFsp)
  if (!matched) {
    reasons.push('FSPIOP-Source header should match Payer')
    return false
  }
  return true
}
const validateFspiopSourceAndDestination = async (payload, headers) => {
  const participant = await BulkTransferService.getParticipantsById(payload.bulkTransferId)
  const matchedPayee = (headers && headers[Enum.Http.Headers.FSPIOP.SOURCE] === participant.payeeFsp)
  const matchedPayer = (headers && headers[Enum.Http.Headers.FSPIOP.DESTINATION] === participant.payerFsp)
  if (!matchedPayee) {
    reasons.push('FSPIOP-Source header should match Payee')
    return false
  }
  if (!matchedPayer) {
    reasons.push('FSPIOP-Destination header should match Payer')
    return false
  }
  return true
}
const validateParticipantByName = async (participantName) => {
  const participant = await Participant.getByName(participantName)
  let isValid = false
  let participantId
  if (!participant) {
    reasons.push(`Participant ${participantName} not found`)
  } else if (!participant.isActive) {
    participantId = participant.participantId
    reasons.push(`Participant ${participantName} is inactive`)
  } else {
    participantId = participant.participantId
    isValid = true
  }
  return { isValid, participantId }
}

const validateBulkTransfer = async (payload, headers) => {
  reasons.length = 0
  let isValid = true
  let payerParticipantId = null
  let payeeParticipantId = null
  if (!payload) {
    reasons.push('Bulk transfer must be provided')
    isValid = false
    return { isValid, reasons, payerParticipantId, payeeParticipantId }
  }
  isValid = isValid && validateFspiopSourceMatchesPayer(payload, headers)
  isValid = isValid && validateExpiration(payload)
  isValid = isValid && validateDifferentFsp(payload)
  if (isValid) {
    const result = await validateParticipantByName(payload.payerFsp)
    isValid = result.isValid
    payerParticipantId = result.participantId
  }
  if (isValid) {
    const result = await validateParticipantByName(payload.payeeFsp)
    isValid = result.isValid
    payeeParticipantId = result.participantId
  }
  return { isValid, reasons, payerParticipantId, payeeParticipantId }
}

const validateBulkTransferFulfilment = async (payload, headers) => {
  reasons.length = 0
  let isValid = true
  if (!payload) {
    reasons.push('Bulk transfer fulfilment payload must be provided')
    isValid = false
    return { isValid, reasons }
  }
  isValid = isValid && await validateFspiopSourceAndDestination(payload, headers)
  return { isValid, reasons }
}

const validateParticipantBulkTransferId = async function (participantName, bulkTransferId) {
  const bulkTransferParticipant = await BulkTransferService.getBulkTransferParticipant(participantName, bulkTransferId)
  let validationPassed = false
  if (Array.isArray(bulkTransferParticipant) && bulkTransferParticipant.length > 0) {
    validationPassed = true
  }
  return validationPassed
}

module.exports = {
  validateBulkTransfer,
  validateBulkTransferFulfilment,
  validateParticipantByName,
  validateParticipantBulkTransferId
}
