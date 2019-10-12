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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/
'use strict'

/**
 * @module src/domain/transfer/
 */

const Enum = require('@mojaloop/central-services-shared').Enum
const BulkTransferAssociationModel = require('../../models/bulkTransfer/bulkTransferAssociation')
const BulkTransferDuplicateCheckModel = require('../../models/bulkTransfer/bulkTransferDuplicateCheck')
const BulkTransferFulfilmentDuplicateCheckModel = require('../../models/bulkTransfer/bulkTransferFulfilmentDuplicateCheck')
const BulkTransferExtensionModel = require('../../models/bulkTransfer/bulkTransferExtension')
const BulkTransferFacade = require('../../models/bulkTransfer/facade')
const BulkTransferModel = require('../../models/bulkTransfer/bulkTransfer')
const BulkTransferStateChangeModel = require('../../models/bulkTransfer/bulkTransferStateChange')
const IndividualTransferModel = require('../../models/bulkTransfer/individualTransfer')
const IndividualTransferExtensionModel = require('../../models/transfer/transferExtension')
const Logger = require('@mojaloop/central-services-logger')

const getBulkTransferById = async (id) => {
  try {
    const bulkTransfer = await BulkTransferModel.getById(id)
    const bulkTransferExtensions = await BulkTransferExtensionModel.getByBulkTransferId(id)
    let individualTransfers = await IndividualTransferModel.getAllById(id)
    const payeeIndividualTransfers = []
    // TODO: refactor this to move away from Promises and use async-await
    individualTransfers = await Promise.all(individualTransfers.map(async (transfer) => {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async (resolve, reject) => {
        const result = {
          transferId: transfer.transferId
        }
        if (transfer.errorCode) {
          result.errorInformation = {
            errorCode: transfer.errorCode,
            errorDescription: transfer.errorDescription
          }
        } else {
          if (transfer.fulfilment) {
            result.fulfilment = transfer.fulfilment
          }
          let extension
          const extensions = await IndividualTransferExtensionModel.getByTransferId(transfer.transferId)
          if (extensions.length > 0) {
            if (!transfer.fulfilment) {
              extension = extensions.map(ext => {
                return { key: ext.key, value: ext.value }
              })
            } else {
              extension = extensions.filter(ext => {
                return ext.isFulfilment
              }).map(ext => {
                return { key: ext.key, value: ext.value }
              })
            }
          }
          if (extension && extension.length > 0) {
            result.extensionList = { extension }
          }
        }
        if ((bulkTransfer.bulkTransferStateId === Enum.Transfers.BulkTransferState.ACCEPTED &&
          transfer.bulkProcessingStateId === Enum.Transfers.BulkProcessingState.ACCEPTED) ||
          (bulkTransfer.bulkTransferStateId === Enum.Transfers.BulkTransferState.COMPLETED &&
          transfer.bulkProcessingStateId > Enum.Transfers.BulkProcessingState.PROCESSING)) {
          payeeIndividualTransfers.push(result)
        }
        return resolve(result)
      })
    }))
    const bulkResponse = {
      bulkTransferId: bulkTransfer.bulkTransferId,
      bulkTransferState: bulkTransfer.bulkTransferStateId
    }
    if (bulkTransfer.completedTimestamp) {
      bulkResponse.completedTimestamp = bulkTransfer.completedTimestamp
    }
    const payerBulkTransfer = { destination: bulkTransfer.payerFsp, ...bulkResponse }
    const payeeBulkTransfer = { destination: bulkTransfer.payeeFsp, ...bulkResponse }
    let bulkExtension
    if (bulkTransferExtensions.length > 0) {
      if (!bulkTransfer.completedTimestamp) {
        bulkExtension = bulkTransferExtensions.map(ext => {
          return { key: ext.key, value: ext.value }
        })
      } else {
        bulkExtension = bulkTransferExtensions.filter(ext => {
          return ext.isFulfilment
        }).map(ext => {
          return { key: ext.key, value: ext.value }
        })
      }
      payerBulkTransfer.extensionList = { extension: bulkExtension }
      payeeBulkTransfer.extensionList = { extension: bulkExtension }
    }
    if (individualTransfers.length > 0) {
      payerBulkTransfer.individualTransferResults = individualTransfers
    }
    if (payeeIndividualTransfers.length > 0) {
      payeeBulkTransfer.individualTransferResults = payeeIndividualTransfers
    } else {
      payeeBulkTransfer.individualTransferResults = individualTransfers
    }
    return { payerBulkTransfer, payeeBulkTransfer }
  } catch (err) {
    Logger.error(err)
    throw err
  }
}

const BulkTransferService = {
  getBulkTransferById,
  getParticipantsById: BulkTransferModel.getParticipantsById,
  bulkPrepare: BulkTransferFacade.saveBulkTransferReceived,
  bulkFulfil: BulkTransferFacade.saveBulkTransferProcessing,
  bulkTransferAssociationCreate: BulkTransferAssociationModel.create,
  bulkTransferAssociationUpdate: BulkTransferAssociationModel.update,
  bulkTransferAssociationExists: BulkTransferAssociationModel.exists,
  createBulkTransferState: BulkTransferStateChangeModel.create,
  getBulkTransferState: BulkTransferStateChangeModel.getByTransferId,
  getBulkTransferDuplicateCheck: BulkTransferDuplicateCheckModel.getBulkTransferDuplicateCheck,
  saveBulkTransferDuplicateCheck: BulkTransferDuplicateCheckModel.saveBulkTransferDuplicateCheck,
  getBulkTransferFulfilmentDuplicateCheck: BulkTransferFulfilmentDuplicateCheckModel.getBulkTransferFulfilmentDuplicateCheck,
  saveBulkTransferFulfilmentDuplicateCheck: BulkTransferFulfilmentDuplicateCheckModel.saveBulkTransferFulfilmentDuplicateCheck
}

module.exports = BulkTransferService
