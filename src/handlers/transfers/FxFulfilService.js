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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com
 --------------
 **********/

/* eslint-disable space-before-function-paren */
const { Enum, Util } = require('@mojaloop/central-services-shared')
const cyril = require('../../domain/fx/cyril')
const TransferObjectTransform = require('../../domain/transfer/transform')
const fspiopErrorFactory = require('../../shared/fspiopErrorFactory')

const { Type, Action } = Enum.Events.Event
const { SOURCE, DESTINATION } = Enum.Http.Headers.FSPIOP
const { TransferState } = Enum.Transfers

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
    this.params = deps.params // todo: rename to kafkaParams
    this.cyril = deps.cyril || cyril
    this.transform = deps.transform || TransferObjectTransform
  }

  async getFxTransferDetails(commitRequestId, functionality) {
    const transfer = await this.FxTransferModel.fxTransfer.getAllDetailsByCommitRequestId(commitRequestId)

    if (!transfer) {
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
      throw fspiopError
    }

    this.log.debug('fxTransfer is found', { transfer })
    return transfer
  }

  async validateHeaders({ transfer, headers, payload }) {
    let fspiopError = null

    if (headers[SOURCE]?.toLowerCase() !== transfer.counterPartyFspName.toLowerCase()) {
      fspiopError = fspiopErrorFactory.fxHeaderSourceValidationError()
    }
    if (headers[DESTINATION]?.toLowerCase() !== transfer.initiatingFspName.toLowerCase()) {
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

      // Publish message to FX Position Handler
      await this.kafkaProceed({
        consumerCommit,
        fspiopError: apiFSPIOPError,
        eventDetail,
        fromSwitch,
        toDestination: transfer.initiatingFspName,
        messageKey: transfer.initiatingFspParticipantCurrencyId.toString()
      })
      throw fspiopError
    }
  }

  async getDuplicateCheckResult({ commitRequestId, payload, action }) {
    const { duplicateCheck } = this.FxTransferModel

    const getDuplicateFn = action === Action.FX_ABORT
      ? duplicateCheck.getFxTransferErrorDuplicateCheck
      : duplicateCheck.getFxTransferDuplicateCheck
    const saveHashFn = action === Action.FX_ABORT
      ? duplicateCheck.saveFxTransferErrorDuplicateCheck
      : duplicateCheck.saveFxTransferDuplicateCheck

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
      throw fspiopError
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
      throw fspiopError
    }
  }

  async validateFulfilment(transfer, payload) {
    const isValid = this.validateFulfilCondition(payload.fulfilment, transfer.condition) // todo: should be ilpCondition
    
    if (!isValid) {
      const fspiopError = fspiopErrorFactory.fxInvalidFulfilment()
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = {
        functionality: Type.POSITION,
        action: Action.FX_ABORT_VALIDATION
      }
      this.log.warn('callbackErrorInvalidFulfilment', { eventDetail, apiFSPIOPError })
      await this.FxTransferModel.fxTransfer.saveFxFulfilResponse(transfer.commitRequestId, payload, eventDetail.action, apiFSPIOPError)

      await this.kafkaProceed({
        consumerCommit,
        fspiopError: apiFSPIOPError,
        eventDetail,
        messageKey: transfer.counterPartyFspTargetParticipantCurrencyId.toString()
      })
      throw fspiopError
    }
    
    this.log.info('fulfilmentCheck passed successfully')
    return true
  }

  async validateTransferState(transfer, functionality) {
    if (transfer.transferState !== TransferState.RESERVED) {
      const fspiopError = fspiopErrorFactory.fxTransferNonReservedState()
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = {
        functionality,
        action: Action.FX_RESERVE
      }
      this.log.warn('callbackErrorNonReservedState', { eventDetail, apiFSPIOPError })

      await this.kafkaProceed({
        consumerCommit,
        fspiopError: apiFSPIOPError,
        eventDetail,
        fromSwitch
      })
      throw fspiopError
    }
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
      throw fspiopError
    }
  }

  async processFxAbortAction({ transfer, payload, action }) {
    const fspiopError = fspiopErrorFactory.fromErrorInformation(payload.errorInformation)
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
    const eventDetail = {
      functionality: Type.POSITION,
      action
    }
    this.log.warn('FX_ABORT case', { eventDetail, apiFSPIOPError })

    await this.FxTransferModel.fxTransfer.saveFxFulfilResponse(transfer.commitRequestId, payload, action, apiFSPIOPError)
    await this.kafkaProceed({
      consumerCommit,
      fspiopError: apiFSPIOPError,
      eventDetail,
      messageKey: transfer.counterPartyFspTargetParticipantCurrencyId.toString()
      // todo: think if we need to use cyrilOutput to get counterPartyFspTargetParticipantCurrencyId?
    })

    throw fspiopError
  }

  async processFxFulfil({ transfer, payload, action }) {
    await this.FxTransferModel.fxTransfer.saveFxFulfilResponse(transfer.commitRequestId, payload, action)
    const cyrilOutput = await this.cyril.processFxFulfilMessage(transfer.commitRequestId, payload)
    const eventDetail = {
      functionality: Type.POSITION,
      action
    }
    this.log.info('handle fxFulfilResponse', { eventDetail, cyrilOutput })

    await this.kafkaProceed({
      consumerCommit,
      eventDetail,
      messageKey: cyrilOutput.counterPartyFspSourceParticipantCurrencyId.toString()
    })
    return true
  }

  async kafkaProceed(kafkaOpts) {
    return this.Kafka.proceed(this.Config.KAFKA_CONFIG, this.params, kafkaOpts)
  }

  validateFulfilCondition(fulfilment, condition) {
    try {
      const isValid = this.Validator.validateFulfilCondition(fulfilment, condition)
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
