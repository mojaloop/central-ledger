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
 ******/

'use strict'

const { Enum } = require('@mojaloop/central-services-shared')
const TransferObjectTransform = require('../../domain/transfer/transform')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const facade = require('../../models/participant/facade')

const { TransferState } = Enum.Transfers
const { Type, Action } = Enum.Events.Event
const consumerCommit = true
const fromSwitch = true

class FxGetService {
  constructor (deps) {
    this.log = deps.log
    this.Config = deps.Config
    this.Validator = deps.Validator
    this.FxTransferModel = deps.FxTransferModel
    this.Participant = deps.Participant
    this.Kafka = deps.Kafka
    this.params = deps.params
    this.externalParticipantCached = deps.externalParticipantCached
    this.FxTransferErrorModel = deps.FxTransferErrorModel
    this.transform = deps.transform || TransferObjectTransform
    this.proxyCache = deps.ProxyCache
  }

  async getFxTransferDetails (commitRequestId, functionality) {
    const fxTransfer = await this.FxTransferModel.fxTransfer.getByIdLight(commitRequestId)

    if (!fxTransfer) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_ID_NOT_FOUND,
        'Provided commitRequest ID was not found on the server.'
      )
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = {
        functionality,
        action: Action.FX_GET
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

    this.log.debug('fxTransfer is found', { fxTransfer })
    return fxTransfer
  }

  async getProxiedFxTransferDetails (commitRequestId) {
    return await this.FxTransferModel.fxTransfer.getAllDetailsByCommitRequestId(commitRequestId)
  }

  async validateParticipant (participantName, isProxiedGet) {
    if (!isProxiedGet && !await this.Validator.validateParticipantByName(participantName)) {
      const actionLetter = Enum.Events.ActionLetter.get
      this.log.info(`breakParticipantDoesntExist--${actionLetter}1`)
      await this.kafkaProceed({ consumerCommit })
      return false
    }
    return true
  }

  async validateParticipantCommitRequest (participantName, commitRequestId, isProxiedGet) {
    if (!isProxiedGet && !await this.Validator.validateParticipantForCommitRequestId(participantName, commitRequestId)) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR)
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = {
        functionality: Type.NOTIFICATION,
        action: Action.FX_GET
      }
      this.log.warn('callbackErrorGeneric', { eventDetail, apiFSPIOPError })
      await this.kafkaProceed({
        consumerCommit,
        fspiopError: apiFSPIOPError,
        eventDetail,
        fromSwitch
      })
      throw fspiopError
    }
  }

  async validateNotFoundError (commitRequestId, functionality, isProxiedGet, proxy, participantName) {
    // If this is a proxied GET, add the source hub as an external participant so we can direct the callback to that hub
    if (isProxiedGet && proxy) {
      await facade.getExternalParticipantIdByNameOrCreate({ name: participantName, proxyId: proxy })
      await this.proxyCache.addDfspProxyMapping(participantName, proxy)
    }

    const fspiopError = ErrorHandler.Factory.createFSPIOPError(
      ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_ID_NOT_FOUND,
      'Provided commitRequest ID was not found on the server.'
    )
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
    const eventDetail = {
      functionality,
      action: Action.FX_GET
    }
    this.log.warn('callbackErrorFxTransferNotFound', { commitRequestId, eventDetail, apiFSPIOPError })

    await this.kafkaProceed({
      consumerCommit,
      fspiopError: apiFSPIOPError,
      eventDetail,
      fromSwitch
    })
    throw fspiopError
  }

  shouldReplyWithErrorCallback (fxTransfer) {
    return fxTransfer.transferStateEnumeration !== TransferState.COMMITTED &&
      fxTransfer.transferStateEnumeration !== TransferState.RESERVED &&
      fxTransfer.transferStateEnumeration !== TransferState.SETTLED
  }

  async handleErrorCallback (fxTransfer, commitRequestId, functionality) {
    const fxTransferError = await this.FxTransferErrorModel.getByCommitRequestId(commitRequestId)
    let apiFSPIOPError

    if (fxTransferError) {
      apiFSPIOPError = {
        errorInformation: {
          errorCode: fxTransferError.errorCode,
          errorDescription: fxTransferError.errorDescription,
          extensionList: fxTransferError.extensionList ? JSON.parse(fxTransferError.extensionList) : undefined
        }
      }
    } else {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_ID_NOT_FOUND,
        'Provided commitRequest ID was not found on the server.'
      )
      apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
    }

    const eventDetail = {
      functionality,
      action: Action.FX_TIMEOUT_RECEIVED
    }
    this.log.warn('callbackErrorGeneric', { commitRequestId, eventDetail, apiFSPIOPError })

    await this.kafkaProceed({
      consumerCommit,
      fspiopError: apiFSPIOPError,
      eventDetail,
      fromSwitch,
      toDestination: fxTransfer.externalInitiatingFspName || fxTransfer.initiatingFspName
    })
    return true
  }

  createFxTransferPayload (fxTransfer) {
    return this.transform.toFulfil(fxTransfer, true)
  }

  async handleProxiedGetSuccess (fxTransfer, commitRequestId) {
    const eventDetail = {
      functionality: Type.NOTIFICATION,
      action: Action.FX_GET
    }
    this.log.info('callbackMessage (proxied)', { commitRequestId, eventDetail })

    await this.kafkaProceed({
      consumerCommit,
      eventDetail,
      fromSwitch,
      toDestination: fxTransfer.initiatingFspName
    })
  }

  async handleStandardGetSuccess (eventDetail) {
    this.log.info('callbackMessage (standard)', { eventDetail })

    await this.kafkaProceed({
      consumerCommit,
      eventDetail,
      fromSwitch
    })
  }

  async kafkaProceed (kafkaOpts) {
    return this.Kafka.proceed(this.Config.KAFKA_CONFIG, this.params, {
      ...kafkaOpts,
      hubName: this.Config.HUB_NAME
    })
  }

  isProxiedGet (headers) {
    return headers?.[Enum.Http.Headers.FSPIOP.PROXY] ? true : null
  }

  async getExternalParticipant (destination) {
    return destination ? await this.externalParticipantCached.getByName(destination) : null
  }

  getActionLetter (action) {
    switch (action) {
      case Action.FX_COMMIT: return Enum.Events.ActionLetter.fxCommit
      case Action.FX_RESERVE: return Enum.Events.ActionLetter.fxReserve
      case Action.FX_REJECT: return Enum.Events.ActionLetter.fxReject
      case Action.FX_ABORT: return Enum.Events.ActionLetter.fxAbort
      case Action.FX_FORWARDED: return Enum.Events.ActionLetter.fxForwarded
      default: return Enum.Events.ActionLetter.unknown
    }
  }
}

module.exports = FxGetService
