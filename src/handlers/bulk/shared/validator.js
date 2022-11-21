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
const Config = require('../../../lib/config')
const Enum = require('@mojaloop/central-services-shared').Enum
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const reasons = []

const validateDifferentFsp = (payload) => {
  const isPayerAndPayeeDifferent = (payload.payerFsp.toLowerCase() !== payload.payeeFsp.toLowerCase())
  if (!isPayerAndPayeeDifferent) {
    reasons.push(
      ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        'Payer and Payee FSPs should be different'
      )
    )
    return false
  }
  return true
}

const validateExpiration = (payload) => {
  if (Date.parse(payload.expiration) < Date.parse(new Date().toDateString())) {
    reasons.push(
      ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `Expiration date ${new Date(payload.expiration.toString()).toISOString()} is already in the past`
      )
    )
    return false
  }
  return true
}

const validateFspiopSourceMatchesPayer = (payload, headers) => {
  const matched = (headers && headers[Enum.Http.Headers.FSPIOP.SOURCE] === payload.payerFsp)
  if (!matched) {
    reasons.push(
      ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        'FSPIOP-Source header should match Payer FSP'
      )
    )
    return false
  }
  return true
}

const validateFspiopSourceAndDestination = async (payload, headers) => {
  const participant = await BulkTransferService.getParticipantsById(payload.bulkTransferId)
  const matchedPayee = (headers && headers[Enum.Http.Headers.FSPIOP.SOURCE] === participant.payeeFsp)
  const matchedPayer = (
    headers &&
    (
      (headers[Enum.Http.Headers.FSPIOP.DESTINATION] === participant.payerFsp) ||
      // The following was added for fix(mojaloop/##3024): [core bulk] POST /bulkTransfers from Switch --> PayeeFSP to use Switch as fspiop-source - https://github.com/mojaloop/project/issues/3024
      // Notes:
      //  Due to the Bulk [Design Considerations](https://docs.mojaloop.io/technical/central-bulk-transfers/#_2-design-considerations),
      //  it is possible that the Switch may send a POST Request to the Payer with the Source Header containing "Switch",
      //  and the Payee FSP thus responding with a PUT Callback and destination header containing the same value (Switch).
      (headers[Enum.Http.Headers.FSPIOP.DESTINATION] === Enum.Http.Headers.FSPIOP.SWITCH.value)
    )
  )

  if (!matchedPayee) {
    reasons.push(
      ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        'FSPIOP-Source header should match Payee FSP'
      )
    )
    return false
  }
  if (!matchedPayer) {
    reasons.push(
      ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        'FSPIOP-Destination header should match Payer FSP'
      )
    )
    return false
  }
  return true
}

const validateParticipantByName = async (participantName, isPayer = null) => {
  let fspiopErrorCode
  if (isPayer == null) {
    fspiopErrorCode = ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR
  } else if (isPayer) {
    fspiopErrorCode = ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_ID_NOT_FOUND
  } else {
    fspiopErrorCode = ErrorHandler.Enums.FSPIOPErrorCodes.PAYEE_FSP_ID_NOT_FOUND
  }

  const participant = await Participant.getByName(participantName)
  let isValid = false
  let participantId
  if (!participant) {
    reasons.push(
      ErrorHandler.Factory.createFSPIOPError(
        fspiopErrorCode,
        `Participant ${participantName} not found`
      )
    )
  } else if (!participant.isActive) {
    participantId = participant.participantId
    reasons.push(
      ErrorHandler.Factory.createFSPIOPError(
        fspiopErrorCode,
        `Participant ${participantName} is inactive`
      )
    )
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
    reasons.push(
      ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        'A valid Bulk transfer message must be provided'
      )
    )
    isValid = false
    return { isValid, reasons, payerParticipantId, payeeParticipantId }
  }
  isValid = isValid && validateFspiopSourceMatchesPayer(payload, headers)
  isValid = isValid && validateExpiration(payload)
  isValid = isValid && validateDifferentFsp(payload)
  if (isValid) {
    const result = await validateParticipantByName(payload.payerFsp, true)
    isValid = result.isValid
    payerParticipantId = result.participantId
  }
  if (isValid) {
    // The double header/payload payee check is to cover the error scenario of
    // a invalid dfsp sent in the FSPIOP-Destination header.
    // The initial solution was to validate that FSPIOP-Destination is equal to
    // payee.
    // Due to the FX functionality in some projects the payee fspId in the headers
    // and body may be different. So we can not enforce that check.

    // We validate that both these fspId's exist and and continue on.
    // We check the body then the header only if the body is valid to avoid
    // adding two errors to `reasons`
    const payloadResult = await validateParticipantByName(payload.payeeFsp, false)
    isValid = payloadResult.isValid

    if (isValid) {
      const headerResult = await validateParticipantByName(headers[Enum.Http.Headers.FSPIOP.DESTINATION], false)
      isValid = headerResult.isValid
    }

    payeeParticipantId = payloadResult.participantId
  }
  return { isValid, reasons, payerParticipantId, payeeParticipantId }
}

const validateBulkTransferFulfilment = async (payload, headers) => {
  reasons.length = 0
  let isValid = true
  if (!payload) {
    reasons.push(
      ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        'A valid Bulk transfer fulfilment message must be provided'
      )
    )
    isValid = false
    return { isValid, reasons }
  }
  isValid = isValid && await validateFspiopSourceAndDestination(payload, headers)
  isValid = isValid && validateCompletedTimestamp(payload)
  return { isValid, reasons }
}

const validateCompletedTimestamp = (payload) => {
  const maxLag = Config.MAX_FULFIL_TIMEOUT_DURATION_SECONDS * 1000
  const completedTimestamp = new Date(payload.completedTimestamp)
  const now = new Date()
  if (completedTimestamp > now) {
    reasons.push(
      ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        'Bulk fulfil failed validation - completedTimestamp fails because future timestamp was provided'
      )
    )
    return false
  } else if (completedTimestamp < now - maxLag) {
    reasons.push(
      ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        'Bulk fulfil failed validation - completedTimestamp fails because provided timestamp exceeded the maximum timeout duration'
      )
    )
    return false
  }
  return true
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
