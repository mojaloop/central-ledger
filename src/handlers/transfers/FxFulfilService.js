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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

/* eslint-disable space-before-function-paren */
const { Enum, Util } = require('@mojaloop/central-services-shared')
const cyril = require('../../domain/fx/cyril')
const TransferObjectTransform = require('../../domain/transfer/transform')
const fspiopErrorFactory = require('../../shared/fspiopErrorFactory')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const { Type, Action } = Enum.Events.Event
const { SOURCE, DESTINATION } = Enum.Http.Headers.FSPIOP
const { TransferState, TransferInternalState } = Enum.Transfers
const rethrow = require('../../shared/rethrow')
const consumerCommit = true
const fromSwitch = true

class FxFulfilService {
  // #state = null

  constructor(deps) {
    this.log = deps.log
    this.Config = deps.Config
    this.Comparators = deps.Comparators
    this.Validator = deps.Validator
    this.FxTransferModel = deps.FxTransferModel
    this.Kafka = deps.Kafka
    this.params = deps.params
    this.cyril = deps.cyril || cyril
    this.transform = deps.transform || TransferObjectTransform
  }

  async getFxTransferDetails(commitRequestId, functionality) {
    const fxTransfer = await this.FxTransferModel.fxTransfer.getAllDetailsByCommitRequestIdForProxiedFxTransfer(commitRequestId)

    if (!fxTransfer) {
      const fspiopError = fspiopErrorFactory.fxTransferNotFound()
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = {
        functionality,
        action: Action.FX_RESERVE
      }
      this.log.warn('fxTransfer not found', { commitRequestId, eventDetail, apiFSPIOPError })

      await this.kafkaProceed({
        consumerCommit,
        fspiopError: apiFSPIOPError,
        eventDetail,
        fromSwitch
      })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'getFxTransferDetails' })
    }

    this.log.debug('fxTransfer is found', { fxTransfer })
    return fxTransfer
  }

  async validateHeaders({ transfer, headers, payload }) {
    let fspiopError = null

    if (!transfer.counterPartyFspIsProxy && (headers[SOURCE]?.toLowerCase() !== transfer.counterPartyFspName.toLowerCase())) {
      fspiopError = fspiopErrorFactory.fxHeaderSourceValidationError()
    }
    if (!transfer.initiatingFspIsProxy && (headers[DESTINATION]?.toLowerCase() !== transfer.initiatingFspName.toLowerCase())) {
      fspiopError = fspiopErrorFactory.fxHeaderDestinationValidationError()
    }

    if (fspiopError) {
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = {
        functionality: Type.POSITION,
        action: Action.FX_ABORT_VALIDATION
      }
      this.log.warn('headers validation error', { eventDetail, apiFSPIOPError })

      // Lets handle the abort validation and change the fxTransfer state to reflect this
      await this.FxTransferModel.fxTransfer.saveFxFulfilResponse(transfer.commitRequestId, payload, eventDetail.action, apiFSPIOPError)

      await this._handleAbortValidation(transfer, apiFSPIOPError, eventDetail)
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'validateHeaders' })
    }
  }

  async _handleAbortValidation(fxTransfer, apiFSPIOPError, eventDetail) {
    const cyrilResult = await this.cyril.processFxAbortMessage(fxTransfer.commitRequestId)

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
        fromSwitch,
        toDestination: fxTransfer.externalInitiatingFspName || fxTransfer.initiatingFspName,
        messageKey: participantCurrencyId.toString(),
        topicNameOverride: this.Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.FX_ABORT
      })
    } else {
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError('Invalid cyril result')
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: '_handleAbortValidation' })
    }
  }

  async getDuplicateCheckResult({ commitRequestId, payload, action }) {
    const { duplicateCheck } = this.FxTransferModel
    const isFxTransferError = action === Action.FX_ABORT

    const getDuplicateFn = isFxTransferError
      ? duplicateCheck.getFxTransferErrorDuplicateCheck
      : duplicateCheck.getFxTransferFulfilmentDuplicateCheck
    const saveHashFn = isFxTransferError
      ? duplicateCheck.saveFxTransferErrorDuplicateCheck
      : duplicateCheck.saveFxTransferFulfilmentDuplicateCheck

    return this.Comparators.duplicateCheckComparator(
      commitRequestId,
      payload,
      getDuplicateFn,
      saveHashFn
    )
  }

  async checkDuplication({ dupCheckResult, transfer, functionality, action, type }) {
    const transferStateEnum = transfer?.transferStateEnumeration
    this.log.info('fxTransfer checkDuplication...', { dupCheckResult, action, transferStateEnum })

    if (!dupCheckResult.hasDuplicateId) {
      this.log.debug('No duplication found')
      return false
    }

    if (!dupCheckResult.hasDuplicateHash) {
      // ERROR: We've seen fxTransfer of this ID before, but it's message hash doesn't match the previous message hash.
      const fspiopError = fspiopErrorFactory.noFxDuplicateHash()
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = {
        functionality,
        action: action === Action.FX_ABORT ? Action.FX_ABORT_DUPLICATE : Action.FX_FULFIL_DUPLICATE
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

    // This is a duplicate message for a fxTransfer that is already in a finalized state
    // respond as if we received a GET /fxTransfers/{ID} from the client
    if ([TransferState.COMMITTED, TransferState.ABORTED].includes(transferStateEnum)) {
      this.params.message.value.content.payload = this.transform.toFulfil(transfer)
      const eventDetail = {
        functionality,
        action: action === Action.FX_ABORT ? Action.FX_ABORT_DUPLICATE : Action.FX_FULFIL_DUPLICATE
      }
      this.log.info('eventDetail:', { eventDetail })
      await this.kafkaProceed({ consumerCommit, eventDetail, fromSwitch })
      return true
    }

    if ([TransferState.RECEIVED, TransferState.RESERVED].includes(transferStateEnum)) {
      this.log.info('state: RECEIVED or RESERVED')
      await this.kafkaProceed({ consumerCommit })
      // this code doesn't publish any message to kafka, coz we don't provide eventDetail:
      // https://github.com/mojaloop/central-services-shared/blob/main/src/util/kafka/index.js#L315
      return true
    }

    // Error scenario - fxTransfer.transferStateEnumeration is in some invalid state
    const fspiopError = fspiopErrorFactory.invalidFxTransferState({ transferStateEnum, action, type })
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
    const eventDetail = {
      functionality,
      action: Action.FX_RESERVE
    }
    this.log.warn('callbackErrorInvalidTransferStateEnum', { eventDetail, apiFSPIOPError })
    await this.kafkaProceed({
      consumerCommit,
      fspiopError: apiFSPIOPError,
      eventDetail,
      fromSwitch
    })

    return true
  }

  async validateEventType(type, functionality) {
    if (type !== Type.FULFIL) {
      const fspiopError = fspiopErrorFactory.invalidEventType(type)
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = {
        functionality,
        action: Action.FX_RESERVE
      }
      this.log.warn('callbackErrorInvalidEventType', { type, eventDetail, apiFSPIOPError })

      await this.kafkaProceed({
        consumerCommit,
        fspiopError: apiFSPIOPError,
        eventDetail,
        fromSwitch
      })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'validateEventType' })
    }
    this.log.debug('validateEventType is passed', { type, functionality })
  }

  async validateFulfilment(fxTransfer, payload) {
    const isValid = this.validateFulfilCondition(payload.fulfilment, fxTransfer.ilpCondition)

    if (!isValid) {
      const fspiopError = fspiopErrorFactory.fxInvalidFulfilment()
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = {
        functionality: Type.POSITION,
        action: Action.FX_ABORT_VALIDATION
      }
      this.log.warn('callbackErrorInvalidFulfilment', { eventDetail, apiFSPIOPError, fxTransfer, payload })
      await this.FxTransferModel.fxTransfer.saveFxFulfilResponse(fxTransfer.commitRequestId, payload, eventDetail.action, apiFSPIOPError)

      await this._handleAbortValidation(fxTransfer, apiFSPIOPError, eventDetail)
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'validateFulfilment' })
    }

    this.log.info('fulfilmentCheck passed successfully', { isValid })
    return isValid
  }

  async validateTransferState(transfer, functionality) {
    if (transfer.transferState !== TransferInternalState.RESERVED &&
        transfer.transferState !== TransferInternalState.RESERVED_FORWARDED &&
        transfer.transferState !== TransferInternalState.RECEIVED_FULFIL_DEPENDENT // for the case where we need to abort an fx transfer whose actual transfer is rejected/aborted by payee
    ) {
      const fspiopError = fspiopErrorFactory.fxTransferNonReservedState()
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = {
        functionality,
        action: Action.FX_RESERVE
      }
      this.log.warn('callbackErrorNonReservedState', { eventDetail, apiFSPIOPError, transfer })

      await this.kafkaProceed({
        consumerCommit,
        fspiopError: apiFSPIOPError,
        eventDetail,
        fromSwitch
      })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'validateTransferState' })
    }
    this.log.debug('validateTransferState is passed')
    return true
  }

  async validateExpirationDate(transfer, functionality) {
    if (transfer.expirationDate <= new Date(Util.Time.getUTCString(new Date()))) {
      const fspiopError = fspiopErrorFactory.fxTransferExpired()
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = {
        functionality,
        action: Action.FX_RESERVE
      }
      this.log.warn('callbackErrorTransferExpired', { eventDetail, apiFSPIOPError })

      await this.kafkaProceed({
        consumerCommit,
        fspiopError: apiFSPIOPError,
        eventDetail,
        fromSwitch
      })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'validateExpirationDate' })
    }
  }

  async processFxAbort({ transfer, payload, action }) {
    const fspiopError = fspiopErrorFactory.fromErrorInformation(payload.errorInformation)
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
    const eventDetail = {
      functionality: Type.POSITION,
      action // FX_ABORT
    }
    this.log.warn('FX_ABORT case', { eventDetail, apiFSPIOPError })

    await this.FxTransferModel.fxTransfer.saveFxFulfilResponse(transfer.commitRequestId, payload, action, apiFSPIOPError)
    const cyrilResult = await this.cyril.processFxAbortMessage(transfer.commitRequestId)

    this.params.message.value.content.context = {
      ...this.params.message.value.content.context,
      cyrilResult
    }
    if (cyrilResult.positionChanges.length > 0) {
      const participantCurrencyId = cyrilResult.positionChanges[0].participantCurrencyId
      await this.kafkaProceed({
        consumerCommit,
        eventDetail,
        messageKey: participantCurrencyId.toString(),
        topicNameOverride: this.Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.FX_ABORT
      })
    } else {
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError('Invalid cyril result')
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processFxAbort' })
    }
    return true
  }

  async processFxFulfil({ transfer, payload, action }) {
    await this.FxTransferModel.fxTransfer.saveFxFulfilResponse(transfer.commitRequestId, payload, action)
    await this.cyril.processFxFulfilMessage(transfer.commitRequestId)
    const eventDetail = {
      functionality: Type.POSITION,
      action
    }
    this.log.info('handle fxFulfilResponse', { eventDetail })

    await this.kafkaProceed({
      consumerCommit,
      eventDetail,
      messageKey: transfer.counterPartyFspSourceParticipantCurrencyId.toString(),
      topicNameOverride: this.Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.COMMIT
    })
    return true
  }

  async kafkaProceed(kafkaOpts) {
    return this.Kafka.proceed(this.Config.KAFKA_CONFIG, this.params, {
      ...kafkaOpts,
      hubName: this.Config.HUB_NAME
    })
  }

  validateFulfilCondition(fulfilment, condition) {
    try {
      const isValid = fulfilment && this.Validator.validateFulfilCondition(fulfilment, condition)
      this.log.debug('validateFulfilCondition result:', { isValid, fulfilment, condition })
      return isValid
    } catch (err) {
      this.log.warn(`validateFulfilCondition error: ${err?.message}`, { fulfilment, condition })
      return false
    }
  }

  static decodeKafkaMessage(message) {
    if (!message?.value) {
      throw TypeError('Invalid message format!')
    }
    const payload = Util.StreamingProtocol.decodePayload(message.value.content.payload)
    const { headers } = message.value.content
    const { type, action } = message.value.metadata.event
    const commitRequestId = message.value.content.uriParams.id

    return Object.freeze({
      payload,
      headers,
      type,
      action,
      commitRequestId,
      kafkaTopic: message.topic
    })
  }
}

module.exports = FxFulfilService
