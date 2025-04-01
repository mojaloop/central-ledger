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

 * Lazola Lucas <lazola.lucas@modusbox.com>
 * Georgi Logodazhki <georgi.logodazhki@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Sam Kummary <sam@modusbox.com>
 * Vijaya Kumar Guthi <vijay.guthi@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @module src/handlers/transfers
 */

const Logger = require('../../shared/logger').logger
const Decimal = require('decimal.js')
const Config = require('../../lib/config')
const Participant = require('../../domain/participant')
const Transfer = require('../../domain/transfer')
const FxTransferModel = require('../../models/fxTransfer')
// const TransferStateChangeModel = require('../../models/transfer/transferStateChange')
const FxTransferStateChangeModel = require('../../models/fxTransfer/stateChange')
const CryptoConditions = require('../../cryptoConditions')
const Crypto = require('crypto')
const base64url = require('base64url')
const Enum = require('@mojaloop/central-services-shared').Enum
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Metrics = require('@mojaloop/central-services-metrics')

const allowedScale = Config.AMOUNT.SCALE
const allowedPrecision = Config.AMOUNT.PRECISION
const reasons = []

const validateParticipantById = async function (participantId) {
  const participant = await Participant.getById(participantId)
  if (!participant) {
    reasons.push(`Participant ${participantId} not found`)
  }
  return !!participant
}

const validateParticipantByName = async function (participantName) {
  const participant = await Participant.getByName(participantName)
  let validationPassed = false
  if (!participant) {
    reasons.push(`Participant ${participantName} not found`)
  } else if (!participant.isActive) {
    reasons.push(`Participant ${participantName} is inactive`)
  } else {
    validationPassed = true
  }
  return validationPassed
}

const validatePositionAccountByNameAndCurrency = async function (participantName, currency) {
  const account = await Participant.getAccountByNameAndCurrency(participantName, currency, Enum.Accounts.LedgerAccountType.POSITION)
  let validationPassed = false
  if (!account) {
    reasons.push(`Participant ${participantName} ${currency} account not found`)
  } else if (!account.currencyIsActive) {
    reasons.push(`Participant ${participantName} ${currency} account is inactive`)
  } else {
    validationPassed = true
  }
  return validationPassed
}

const validateDifferentDfsp = (payerFsp, payeeFsp) => {
  if (!Config.ENABLE_ON_US_TRANSFERS) {
    const isPayerAndPayeeDifferent = (payerFsp.toLowerCase() !== payeeFsp.toLowerCase())
    if (!isPayerAndPayeeDifferent) {
      reasons.push('Payer FSP and Payee FSP should be different, unless on-us tranfers are allowed by the Scheme')
      return false
    }
  }
  return true
}

const validateFspiopSourceMatchesPayer = (payer, headers) => {
  const matched = (headers && headers['fspiop-source'] && headers['fspiop-source'] === payer)
  if (!matched) {
    reasons.push('FSPIOP-Source header should match Payer')
    return false
  }
  return true
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
  const hashSha256 = Crypto.createHash('sha256')
  const preimage = base64url.toBuffer(fulfilment)

  if (preimage.length !== 32) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, 'Interledger preimages must be exactly 32 bytes')
  }

  const calculatedConditionDigest = hashSha256.update(preimage).digest('base64')
  Logger.isDebugEnabled && Logger.debug(`calculatedConditionDigest=${calculatedConditionDigest}`)
  const calculatedConditionUrlEncoded = base64url.fromBase64(calculatedConditionDigest)
  Logger.isDebugEnabled && Logger.debug(`calculatedConditionUrlEncoded=${calculatedConditionUrlEncoded}`)
  return calculatedConditionUrlEncoded
}

// TODO: The following function should be moved into a re-usable common-shared-service at a later point
// NOTE: This logic is based on v1.0 of the Mojaloop Specification as described in section 6.5.1.2
const validateFulfilCondition = (fulfilment, condition) => {
  const histTimerValidateTimer = Metrics.getHistogram(
    'handlers_transfer_validator',
    'validateFulfilCondition - Metrics for transfer handler',
    ['success', 'funcName']
  ).startTimer()
  const calculatedCondition = fulfilmentToCondition(fulfilment)
  histTimerValidateTimer({ success: true, funcName: 'validateFulfilCondition' })
  return calculatedCondition === condition
}

const validateConditionAndExpiration = async (payload) => {
  const histTimerValidateTimer = Metrics.getHistogram(
    'handlers_transfer_validator',
    'validateConditionAndExpiration - Metrics for transfer handler',
    ['success', 'funcName']
  ).startTimer()
  if (!payload.condition) {
    reasons.push('Condition is required for a conditional transfer')
    histTimerValidateTimer({ success: false, funcName: 'validateConditionAndExpiration' })
    return false
  }
  try {
    const condition = 'ni:///sha-256;' + payload.condition + '?fpt=preimage-sha-256&cost=0'
    await CryptoConditions.validateCondition(condition)
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(`${err.message}`)
    reasons.push('Condition validation failed')
    histTimerValidateTimer({ success: false, funcName: 'validateConditionAndExpiration' })
    return false
  }
  if (payload.expiration) {
    if (Date.parse(payload.expiration) < Date.parse(new Date().toISOString())) {
      reasons.push(`Expiration date ${new Date(payload.expiration).toISOString()} is already in the past`)
      histTimerValidateTimer({ success: false, funcName: 'validateConditionAndExpiration' })
      return false
    }
  } else {
    reasons.push('Expiration is required for conditional transfer')
    histTimerValidateTimer({ success: false, funcName: 'validateConditionAndExpiration' })
    return false
  }
  histTimerValidateTimer({ success: true, funcName: 'validateConditionAndExpiration' })
  return true
}

const isAmountValid = (payload, isFx) => isFx
  ? validateAmount(payload.sourceAmount) && validateAmount(payload.targetAmount)
  : validateAmount(payload.amount)

const validatePrepare = async (payload, headers, isFx = false, determiningTransferCheckResult, proxyObligation) => {
  const histTimerValidatePrepareEnd = Metrics.getHistogram(
    'handlers_transfer_validator',
    'validatePrepare - Metrics for transfer handler',
    ['success', 'funcName']
  ).startTimer()

  reasons.length = 0
  let validationPassed
  if (!payload) {
    reasons.push('Transfer must be provided')
    validationPassed = false
    return { validationPassed, reasons }
  }

  const initiatingFsp = isFx ? payload.initiatingFsp : payload.payerFsp
  const counterPartyFsp = isFx ? payload.counterPartyFsp : payload.payeeFsp

  // Check if determining transfers are failed
  if (determiningTransferCheckResult.watchListRecords && determiningTransferCheckResult.watchListRecords.length > 0) {
    // Iterate through determiningTransferCheckResult.watchListRecords
    for (const watchListRecord of determiningTransferCheckResult.watchListRecords) {
      if (isFx) {
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.NOT_IMPLEMENTED)
      } else {
        // Check the transfer state of commitRequestId
        const latestFxTransferStateChange = await FxTransferStateChangeModel.getByCommitRequestId(watchListRecord.commitRequestId)
        if (latestFxTransferStateChange.transferStateId !== Enum.Transfers.TransferInternalState.RECEIVED_FULFIL_DEPENDENT) {
          reasons.push('Related FX Transfer is not fulfilled')
          validationPassed = false
          return { validationPassed, reasons }
        }
      }
    }
  }

  // Skip usual validation if preparing a proxy transfer or fxTransfer
  if (!(proxyObligation?.isInitiatingFspProxy || proxyObligation?.isCounterPartyFspProxy)) {
    validationPassed = (
      validateFspiopSourceMatchesPayer(initiatingFsp, headers) &&
      isAmountValid(payload, isFx) &&
      await validateParticipantByName(initiatingFsp) &&
      await validateParticipantByName(counterPartyFsp) &&
      await validateConditionAndExpiration(payload) &&
      validateDifferentDfsp(initiatingFsp, counterPartyFsp)
    )
  } else {
    validationPassed = true
  }

  // validate participant accounts from determiningTransferCheckResult
  if (validationPassed && determiningTransferCheckResult) {
    for (const participantCurrency of determiningTransferCheckResult.participantCurrencyValidationList) {
      if (!await validatePositionAccountByNameAndCurrency(participantCurrency.participantName, participantCurrency.currencyId)) {
        validationPassed = false
        break // Exit the loop if validation fails
      }
    }
  }
  histTimerValidatePrepareEnd({ success: true, funcName: 'validatePrepare' })

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
  validationPassed = (await validateParticipantById(payload.payerFsp) &&
    await validateParticipantById(payload.payeeFsp) &&
    validateAmount(payload.amount) &&
    await validateConditionAndExpiration(payload))
  return {
    validationPassed,
    reasons
  }
}

const validateParticipantTransferId = async function (participantName, transferId) {
  const transferParticipant = await Transfer.getTransferParticipant(participantName, transferId)
  let validationPassed = false
  if (Array.isArray(transferParticipant) && transferParticipant.length > 0) {
    validationPassed = true
  }
  return validationPassed
}

const validateParticipantForCommitRequestId = async function (participantName, commitRequestId) {
  const fxTransferParticipants = await FxTransferModel.fxTransfer.getFxTransferParticipant(participantName, commitRequestId)
  let validationPassed = false
  if (Array.isArray(fxTransferParticipants) && fxTransferParticipants.length > 0) {
    validationPassed = true
  }
  return validationPassed
}

module.exports = {
  validatePrepare,
  validateById,
  validateFulfilCondition,
  validateParticipantByName,
  reasons,
  validateParticipantTransferId,
  validateParticipantForCommitRequestId
}
