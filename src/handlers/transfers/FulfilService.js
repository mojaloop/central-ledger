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

 - Kevin Leyow <kevin.leyow@infitx.com>

 --------------
 **********/

const { Enum, Util } = require('@mojaloop/central-services-shared')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const TransferObjectTransform = require('../../domain/transfer/transform')
const rethrow = require('../../shared/rethrow')

const { Type, Action } = Enum.Events.Event
const { SOURCE, DESTINATION } = Enum.Http.Headers.FSPIOP
const { TransferState, TransferInternalState } = Enum.Transfers
const consumerCommit = true
const fromSwitch = true

class FulfilService {
  constructor (deps) {
    this.log = deps.log
    this.Config = deps.Config
    this.Comparators = deps.Comparators
    this.Validator = deps.Validator
    this.TransferService = deps.TransferService
    this.FxService = deps.FxService
    this.Participant = deps.Participant
    this.Kafka = deps.Kafka
    this.params = deps.params
    this.transform = deps.transform || TransferObjectTransform
  }

  async getTransferDetails (transferId, functionality) {
    const transfer = await this.TransferService.getById(transferId)

    if (!transfer) {
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError('transfer not found')
      const eventDetail = { functionality, action: Action.COMMIT }
      this.log.error('Transfer not found', { transferId, eventDetail })

      await this.kafkaProceed({
        consumerCommit,
        fspiopError: fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING),
        eventDetail,
        fromSwitch
      })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'getTransferDetails' })
    }

    this.log.debug('Transfer found', { transfer })
    return transfer
  }

  async validateTransferState (transfer, action, functionality) {
    const transferState = transfer.transferState
    const transferStateEnum = transfer.transferStateEnumeration

    // Check if transfer is in a valid state for processing
    // Transfer must be in RESERVED or RESERVED_FORWARDED state to proceed with fulfil processing
    if (transferState !== TransferInternalState.RESERVED &&
        transferState !== TransferInternalState.RESERVED_FORWARDED) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `Transfer is in invalid state: ${transferState}. Expected: RESERVED or RESERVED_FORWARDED`
      )
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = { functionality, action: action || Action.COMMIT }

      this.log.warn('Transfer state validation failed - invalid state for fulfil processing', {
        transferId: transfer.transferId,
        currentState: transferState,
        expectedStates: [TransferInternalState.RESERVED, TransferInternalState.RESERVED_FORWARDED],
        action,
        eventDetail
      })

      await this.kafkaProceed({
        consumerCommit,
        fspiopError: apiFSPIOPError,
        eventDetail,
        fromSwitch
      })

      // emit an extra message - RESERVED_ABORTED if action === Action.RESERVE
      if (action === Action.RESERVE) {
        await this._handleReservedAborted(transfer, apiFSPIOPError)
      }

      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'validateTransferState' })
    }

    // Additional state validation for specific actions
    if (action === Action.COMMIT || action === Action.BULK_COMMIT) {
      // For commit actions, ensure we're not trying to commit an already finalized transfer
      if (transferStateEnum === TransferState.COMMITTED ||
          transferStateEnum === TransferState.ABORTED) {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          `Cannot commit transfer that is already in final state: ${transferStateEnum}`
        )
        const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
        const eventDetail = { functionality, action: action || Action.COMMIT }

        this.log.warn('Transfer state validation failed - transfer already finalized', {
          transferId: transfer.transferId,
          currentState: transferStateEnum,
          action,
          eventDetail
        })

        await this.kafkaProceed({
          consumerCommit,
          fspiopError: apiFSPIOPError,
          eventDetail,
          fromSwitch
        })

        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'validateTransferState' })
      }
    }

    this.log.debug('Transfer state validation passed', {
      transferId: transfer.transferId,
      transferState,
      transferStateEnum,
      action
    })

    return true
  }

  async validateHeaders ({ transfer, headers, payload, action, validActionsForRouteValidations }) {
    if (!validActionsForRouteValidations.includes(action)) {
      return true // Skip validation for actions that don't require it
    }

    let fspiopError = null

    // Validate source header matches payee FSP (unless payee is a proxy)
    if (headers[SOURCE] && !transfer.payeeIsProxy &&
        (headers[SOURCE].toLowerCase() !== transfer.payeeFsp.toLowerCase())) {
      fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `${SOURCE} does not match payee fsp on the Fulfil callback response`
      )
    }

    // Validate destination header matches payer FSP (unless payer is a proxy)
    if (headers[DESTINATION] && !transfer.payerIsProxy &&
        (headers[DESTINATION].toLowerCase() !== transfer.payerFsp.toLowerCase())) {
      fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `${DESTINATION} does not match payer fsp on the Fulfil callback response`
      )
    }

    if (fspiopError) {
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = {
        functionality: Type.POSITION,
        action: Action.ABORT_VALIDATION
      }

      this.log.warn('Headers validation error', { eventDetail, apiFSPIOPError })

      // Handle the abort validation and change the transfer state to reflect this
      await this.TransferService.handlePayeeResponse(
        transfer.transferId,
        payload,
        Action.ABORT_VALIDATION,
        apiFSPIOPError
      )

      await this._handleAbortValidation(transfer, apiFSPIOPError, eventDetail)

      // Handle reserved aborted for RESERVE action
      if (action === Action.RESERVE) {
        await this._handleReservedAborted(transfer, apiFSPIOPError)
      }

      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'validateHeaders' })
    }

    return true
  }

  async _handleAbortValidation (transfer, apiFSPIOPError, eventDetail) {
    // Key position abort with payer account id
    const payerAccount = await this.Participant.getAccountByNameAndCurrency(
      transfer.payerFsp,
      transfer.currency,
      Enum.Accounts.LedgerAccountType.POSITION
    )

    await this.kafkaProceed({
      consumerCommit,
      fspiopError: apiFSPIOPError,
      eventDetail,
      fromSwitch,
      toDestination: transfer.payerFsp,
      messageKey: payerAccount.participantCurrencyId.toString()
    })
  }

  async _handleReservedAborted (transfer, apiFSPIOPError) {
    const transferAbortResult = await this.TransferService.getById(transfer.transferId)
    const eventDetail = {
      functionality: Type.NOTIFICATION,
      action: Action.RESERVED_ABORTED
    }

    // Extract error information
    const errorCode = apiFSPIOPError?.errorInformation?.errorCode
    const errorDescription = apiFSPIOPError?.errorInformation?.errorDescription

    const reservedAbortedPayload = {
      transferId: transferAbortResult?.id,
      completedTimestamp: transferAbortResult?.completedTimestamp &&
        (new Date(Date.parse(transferAbortResult.completedTimestamp))).toISOString(),
      transferState: TransferState.ABORTED,
      extensionList: {
        extension: [
          {
            key: 'cause',
            value: `${errorCode}: ${errorDescription}`
          }
        ]
      }
    }

    this.params.message.value.content.payload = reservedAbortedPayload
    await this.kafkaProceed({
      consumerCommit,
      eventDetail,
      fromSwitch: true,
      toDestination: transfer.payeeFsp
    })
  }

  async validateExpirationDate (transfer, functionality, action) {
    // For interscheme we ignore expiration for forwarded transfers
    if (transfer.transferState !== TransferInternalState.RESERVED_FORWARDED &&
        transfer.expirationDate <= new Date(Util.Time.getUTCString(new Date()))) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED
      )
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = { functionality, action: action || Action.COMMIT }

      this.log.warn('Transfer expired validation failed', {
        transferId: transfer.transferId,
        expirationDate: transfer.expirationDate,
        currentTime: new Date(Util.Time.getUTCString(new Date())),
        eventDetail
      })

      await this.kafkaProceed({
        consumerCommit,
        fspiopError: apiFSPIOPError,
        eventDetail,
        fromSwitch
      })
      this.log.warn('Emitting RESERVED_ABORTED event due to transfer expiration', {
        transferId: transfer.transferId,
        eventDetail
      })
      // emit an extra message - RESERVED_ABORTED if action === Action.RESERVE
      if (action === Action.RESERVE) {
        await this._handleReservedAborted(transfer, apiFSPIOPError)
      }

      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'validateExpirationDate' })
    }

    return true
  }

  async validateFulfilment (transfer, payload, action) {
    if (!payload.fulfilment) {
      return true // No fulfilment to validate
    }

    const isValid = this.Validator.validateFulfilCondition(payload.fulfilment, transfer.condition)

    if (!isValid) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        'invalid fulfilment'
      )
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)

      this.log.warn('Fulfilment validation failed', {
        transferId: transfer.transferId,
        fulfilment: payload.fulfilment,
        condition: transfer.condition
      })

      const updatedTransfer = await this.TransferService.handlePayeeResponse(
        transfer.transferId,
        payload,
        Action.ABORT_VALIDATION,
        apiFSPIOPError
      )

      this.params.message.value.payload = {
        ...this.params.message.value.payload,
        completedTimestamp: updatedTransfer.completedTimestamp
      }

      const eventDetail = {
        functionality: Type.POSITION,
        action: Action.ABORT_VALIDATION
      }

      const cyrilResult = await this.FxService.Cyril.processAbortMessage(transfer.transferId)

      this.params.message.value.content.context = {
        ...this.params.message.value.content.context,
        cyrilResult
      }

      if (cyrilResult.positionChanges.length > 0) {
        const participantCurrencyId = cyrilResult.positionChanges[0].participantCurrencyId
        await this.kafkaProceed({
          consumerCommit,
          fspiopError: apiFSPIOPError,
          eventDetail,
          messageKey: participantCurrencyId.toString(),
          topicNameOverride: this.Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.ABORT
        })
      } else {
        const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError('Invalid cyril result')
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'validateFulfilment' })
      }
      this.log.warn(action)
      // emit an extra message - RESERVED_ABORTED if action === Action.RESERVE
      if (action === Action.RESERVE) {
        await this._handleReservedAborted(transfer, apiFSPIOPError)
      }

      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'validateFulfilment' })
    }

    this.log.debug('Fulfilment validation passed', {
      transferId: transfer.transferId,
      isValid
    })

    return true
  }

  async getDuplicateCheckResult ({ transferId, payload, action }) {
    const isTransferError = action === Action.ABORT

    if (!isTransferError) {
      return this.Comparators.duplicateCheckComparator(
        transferId,
        payload,
        this.TransferService.getTransferFulfilmentDuplicateCheck,
        this.TransferService.saveTransferFulfilmentDuplicateCheck
      )
    } else {
      return this.Comparators.duplicateCheckComparator(
        transferId,
        payload,
        this.TransferService.getTransferErrorDuplicateCheck,
        this.TransferService.saveTransferErrorDuplicateCheck
      )
    }
  }

  async checkDuplication ({ dupCheckResult, transfer, functionality, action, type }) {
    const transferStateEnum = transfer?.transferStateEnumeration
    this.log.debug('Transfer checkDuplication...', { dupCheckResult, action, transferStateEnum })

    if (!dupCheckResult.hasDuplicateId) {
      this.log.debug('No duplication found')
      return false
    }

    if (!dupCheckResult.hasDuplicateHash) {
      // ERROR: We have seen a transfer of this ID before, but its message hash doesn't match the previous message hash.
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST
      )
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const isTransferError = action === Action.ABORT
      const eventDetail = {
        functionality,
        action: isTransferError ? Action.ABORT_DUPLICATE : Action.FULFIL_DUPLICATE
      }
      this.log.warn('callbackErrorModified - no hasDuplicateHash', { eventDetail, apiFSPIOPError })

      await this.kafkaProceed({
        consumerCommit,
        fspiopError: apiFSPIOPError,
        eventDetail,
        fromSwitch
      })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'checkDuplication' })
    }

    // This is a duplicate message for a transfer that is already in a finalized state
    // respond as if we received a GET /transfers/{ID} from the client
    if ([TransferState.COMMITTED, TransferState.ABORTED].includes(transferStateEnum)) {
      this.params.message.value.content.payload = this.transform.toFulfil(transfer)
      const isTransferError = action === Action.ABORT
      const eventDetail = { functionality, action }

      if (action !== Action.RESERVE) {
        eventDetail.action = isTransferError ? Action.ABORT_DUPLICATE : Action.FULFIL_DUPLICATE
      }

      this.log.info('Transfer duplication - finalized state', { eventDetail })
      await this.kafkaProceed({ consumerCommit, eventDetail, fromSwitch })
      return true
    }

    if ([TransferState.RECEIVED, TransferState.RESERVED].includes(transferStateEnum)) {
      this.log.info('Transfer duplication - processing state')
      await this.kafkaProceed({ consumerCommit })
      // This code doesn't publish any message to kafka, because we don't provide eventDetail
      return true
    }

    // Error scenario - transfer.transferStateEnumeration is in some invalid state
    const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(
      `Invalid transferStateEnumeration:(${transferStateEnum}) for event action:(${action}) and type:(${type})`
    )
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
    const eventDetail = { functionality, action: Action.COMMIT }

    this.log.warn('callbackErrorInvalidTransferStateEnum', { eventDetail, apiFSPIOPError })
    await this.kafkaProceed({
      consumerCommit,
      fspiopError: apiFSPIOPError,
      eventDetail,
      fromSwitch
    })

    return true
  }

  async validateEventType (type, functionality) {
    if (type !== Type.FULFIL) {
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(`Invalid event type:(${type})`)
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = { functionality, action: Action.COMMIT }

      this.log.warn('callbackErrorInvalidEventType', { type, eventDetail, apiFSPIOPError })

      await this.kafkaProceed({
        consumerCommit,
        fspiopError: apiFSPIOPError,
        eventDetail,
        fromSwitch
      })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'validateEventType' })
    }

    this.log.debug('validateEventType passed', { type, functionality })
  }

  async validateAction (action, functionality) {
    const validActions = [
      Action.COMMIT,
      Action.RESERVE,
      Action.REJECT,
      Action.ABORT,
      Action.BULK_COMMIT,
      Action.BULK_ABORT
    ]

    if (!validActions.includes(action)) {
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(
        `Invalid event action:(${action})`
      )
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = { functionality, action: Action.COMMIT }

      this.log.warn('callbackErrorInvalidEventAction', { action, eventDetail, apiFSPIOPError })

      await this.kafkaProceed({
        consumerCommit,
        fspiopError: apiFSPIOPError,
        eventDetail,
        fromSwitch
      })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'validateAction' })
    }

    this.log.debug('validateAction passed', { action, validActions })
  }

  async kafkaProceed (kafkaOpts) {
    return this.Kafka.proceed(this.Config.KAFKA_CONFIG, this.params, {
      ...kafkaOpts,
      hubName: this.Config.HUB_NAME
    })
  }
}

module.exports = FulfilService
