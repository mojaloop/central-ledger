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

class GetService {
  constructor (deps) {
    this.log = deps.log
    this.Config = deps.Config
    this.Validator = deps.Validator
    this.TransferService = deps.TransferService
    this.Participant = deps.Participant
    this.Kafka = deps.Kafka
    this.params = deps.params
    this.externalParticipantCached = deps.externalParticipantCached
    this.TransferErrorModel = deps.TransferErrorModel
    this.transform = deps.transform || TransferObjectTransform
  }

  async getTransferDetails (transferId, functionality) {
    const transfer = await this.TransferService.getByIdLight(transferId)

    if (!transfer) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_ID_NOT_FOUND,
        'Provided Transfer ID was not found on the server.'
      )
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = {
        functionality,
        action: Action.GET
      }
      this.log.warn('transfer not found', { transferId, eventDetail, apiFSPIOPError })

      await this.kafkaProceed({
        consumerCommit,
        fspiopError: apiFSPIOPError,
        eventDetail,
        fromSwitch
      })
      throw fspiopError
    }

    this.log.debug('transfer is found', { transfer })
    return transfer
  }

  async getProxiedTransferDetails (transferId) {
    return await this.TransferService.getById(transferId)
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

  async validateParticipantTransfer (participantName, transferId, isProxiedGet) {
    if (!isProxiedGet && !await this.Validator.validateParticipantTransferId(participantName, transferId)) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR)
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
      const eventDetail = {
        functionality: Type.NOTIFICATION,
        action: Action.GET
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

  async validateNotFoundError (transferId, functionality, isProxiedGet, proxy, participantName) {
    // If this is a proxied GET, add the source hub as an external participant so we can direct the callback to that hub
    if (isProxiedGet && proxy) {
      await facade.getExternalParticipantIdByNameOrCreate({ name: participantName, proxyId: proxy })
    }

    const fspiopError = ErrorHandler.Factory.createFSPIOPError(
      ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_ID_NOT_FOUND,
      'Provided Transfer ID was not found on the server.'
    )
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
    const eventDetail = {
      functionality,
      action: Action.GET
    }
    this.log.warn('callbackErrorTransferNotFound', { transferId, eventDetail, apiFSPIOPError })

    await this.kafkaProceed({
      consumerCommit,
      fspiopError: apiFSPIOPError,
      eventDetail,
      fromSwitch
    })
    throw fspiopError
  }

  shouldReplyWithErrorCallback (transfer) {
    return transfer.transferStateEnumeration !== TransferState.COMMITTED &&
      transfer.transferStateEnumeration !== TransferState.RESERVED &&
      transfer.transferStateEnumeration !== TransferState.SETTLED
  }

  async handleErrorCallback (transfer, transferId, functionality) {
    const transferError = await this.TransferErrorModel.getByTransferId(transferId)
    let apiFSPIOPError

    if (transferError) {
      apiFSPIOPError = {
        errorInformation: {
          errorCode: transferError.errorCode,
          errorDescription: transferError.errorDescription,
          extensionList: transferError.extensionList ? JSON.parse(transferError.extensionList) : undefined
        }
      }
    } else {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_ID_NOT_FOUND,
        'Provided Transfer ID was not found on the server.'
      )
      apiFSPIOPError = fspiopError.toApiErrorObject(this.Config.ERROR_HANDLING)
    }

    const eventDetail = {
      functionality,
      action: Action.TIMEOUT_RECEIVED
    }
    this.log.warn('callbackErrorGeneric', { transferId, eventDetail, apiFSPIOPError })

    await this.kafkaProceed({
      consumerCommit,
      fspiopError: apiFSPIOPError,
      eventDetail,
      fromSwitch,
      toDestination: transfer.externalPayerName || transfer.payerFsp
    })
    return true
  }

  createTransferPayload (transfer) {
    return this.transform.toFulfil(transfer)
  }

  async handleProxiedGetSuccess (transfer, transferId) {
    const eventDetail = {
      functionality: Type.NOTIFICATION,
      action: Action.GET
    }
    this.log.info('callbackMessage (proxied)', { transferId, eventDetail })

    await this.kafkaProceed({
      consumerCommit,
      eventDetail,
      fromSwitch,
      toDestination: transfer.payerFsp
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
}

module.exports = GetService
