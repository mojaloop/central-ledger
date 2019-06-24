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

const Enum = require('../../lib/enum')
const BulkTransferAssociationModel = require('../../models/bulkTransfer/bulkTransferAssociation')
const BulkTransferDuplicateCheckModel = require('../../models/bulkTransfer/bulkTransferDuplicateCheck')
const BulkTransferFulfilmentDuplicateCheckModel = require('../../models/bulkTransfer/bulkTransferFulfilmentDuplicateCheck')
const BulkTransferExtensionModel = require('../../models/bulkTransfer/bulkTransferExtension')
const BulkTransferFacade = require('../../models/bulkTransfer/facade')
const BulkTransferModel = require('../../models/bulkTransfer/bulkTransfer')
const BulkTransferStateChangeModel = require('../../models/bulkTransfer/bulkTransferStateChange')
const IndividualTransferModel = require('../../models/bulkTransfer/individualTransfer')
const IndividualTransferExtensionModel = require('../../models/transfer/transferExtension')

const checkDuplicate = async (bulkTransferId, hash, isFulfilment = null) => {
  try {
    let result
    if (!hash) {
      throw new Error('Invalid hash')
    }

    if (!isFulfilment) {
      result = await BulkTransferDuplicateCheckModel.checkDuplicate(bulkTransferId, hash)
    } else {
      result = await BulkTransferFulfilmentDuplicateCheckModel.checkDuplicate(bulkTransferId, hash)
    }
    return result
  } catch (err) {
    throw err
  }
}

const getBulkTransferById = async (id) => {
  try {
    let bulkTransfer = await BulkTransferModel.getById(id)
    let bulkTransferExtensions = await BulkTransferExtensionModel.getByBulkTransferId(id)
    let individualTransfers = await IndividualTransferModel.getAllById(id)
    let payeeIndividualTransfers = []
    individualTransfers = await Promise.all(individualTransfers.map(async (transfer) => {
      return new Promise(async (resolve, reject) => {
        let extensions = await IndividualTransferExtensionModel.getByTransferId(transfer.transferId)
        let extension
        let result = {
          transferId: transfer.transferId
        }
        if (transfer.fulfilment) {
          result.fulfilment = transfer.fulfilment
        }
        if (transfer.errorCode) {
          result.errorInformation = {
            errorCode: transfer.errorCode,
            errorDescription: transfer.errorDescription
          }
        }
        if (extensions.length > 0) {
          if (!transfer.fulfilment) {
            extension = extensions.map(ext => {
              return { key: ext.key, value: ext.value }
            })
          } else {
            extension = extensions.filter(ext => {
              return !!ext.transferFulfilmentId
            }).map(ext => {
              return { key: ext.key, value: ext.value }
            })
          }
        }
        if (extension && extension.length > 0) {
          result.extensionList = { extension }
        }
        const allowedPayeeTransfers = [
          Enum.TransferStateEnum.RESERVED,
          Enum.TransferStateEnum.COMMITTED
        ]
        if (allowedPayeeTransfers.includes(transfer.transferStateEnum)) {
          payeeIndividualTransfers.push(result)
        }
        return resolve(result)
      })
    }))
    let bulkResponse = {
      bulkTransferId: bulkTransfer.bulkTransferId,
      bulkTransferState: bulkTransfer.bulkTransferStateId
    }
    if (bulkTransfer.completedTimestamp) {
      bulkResponse.completedTimestamp = bulkTransfer.completedTimestamp
    }
    let payerBulkTransfer = { destination: bulkTransfer.payerFsp, ...bulkResponse }
    let payeeBulkTransfer = { destination: bulkTransfer.payeeFsp, ...bulkResponse }
    let bulkExtension
    if (bulkTransferExtensions.length > 0) {
      if (!bulkTransfer.completedTimestamp) {
        bulkExtension = bulkTransferExtensions.map(ext => {
          return { key: ext.key, value: ext.value }
        })
      } else {
        bulkExtension = bulkTransferExtensions.filter(ext => {
          return !!ext.bulkTransferFulfilmentId
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
    }
    return { payerBulkTransfer, payeeBulkTransfer }
  } catch (err) {
    throw err
  }
}

const BulkTransferService = {
  checkDuplicate,
  getBulkTransferById,
  getParticipantsById: BulkTransferModel.getParticipantsById,
  bulkPrepare: BulkTransferFacade.saveBulkTransferReceived,
  bulkFulfil: BulkTransferFacade.saveBulkTransferProcessing,
  bulkTransferAssociationCreate: BulkTransferAssociationModel.create,
  bulkTransferAssociationUpdate: BulkTransferAssociationModel.update,
  bulkTransferAssociationExists: BulkTransferAssociationModel.exists,
  createBulkTransferState: BulkTransferStateChangeModel.create,
  getBulkTransferState: BulkTransferStateChangeModel.getByTransferId
}

module.exports = BulkTransferService
