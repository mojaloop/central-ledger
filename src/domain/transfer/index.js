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

const P = require('bluebird')
const TransferFacade = require('../../models/transfer/facade')
const TransferModel = require('../../models/transfer/transfer')
const TransferStateChangeModel = require('../../models/transfer/transferStateChange')
const TransferFulfilmentModel = require('../../models/transfer/transferFulfilment')
const SettlementFacade = require('../../models/settlement/facade')
const SettlementModel = require('../../models/settlement/settlement')
const TransferObjectTransform = require('./transform')
const Errors = require('../../errors')

const prepare = async (payload, stateReason = null, hasPassedValidation = true) => {
  try {
    return await TransferFacade.saveTransferPrepared(payload, stateReason, hasPassedValidation)
  } catch (e) {
    throw e
  }
}

const getTransferById = (id) => {
  return TransferModel.getById(id)
}

const getById = (id) => {
  return TransferFacade.getById(id)
}

const getAll = () => {
  return TransferFacade.getAll()
}

const getTransferState = (id) => {
  return TransferStateChangeModel.getByTransferId(id)
}

const getTransferInfoToChangePosition = (id, transferParticipantRoleTypeId, ledgerEntryTypeId) => {
  return TransferFacade.getTransferInfoToChangePosition(id, transferParticipantRoleTypeId, ledgerEntryTypeId)
}

const getFulfilment = async (id) => {
  const transfer = await getById(id)
  if (!transfer) {
    throw new Errors.TransferNotFoundError()
  }
  if (!transfer.ilpCondition) {
    throw new Errors.TransferNotConditionalError()
  }
  const transferFulfilment = await TransferFulfilmentModel.getByTransferId(id)
  if (!transferFulfilment) {
    throw new Errors.TransferNotFoundError()
  }
  if (!transferFulfilment.ilpFulfilment) {
    throw new Errors.MissingFulfilmentError()
  }
  return transferFulfilment.ilpFulfilment
}

const expire = (id) => {
  // return reject({id, rejection_reason: Enum.RejectionType.EXPIRED})
}

const fulfil = async (transferId, payload) => {
  try {
    const isCommit = true
    const transfer = await TransferFacade.saveTransferFulfiled(transferId, payload, isCommit)
    return TransferObjectTransform.toTransfer(transfer)
  } catch (err) {
    throw err
  }
}

const reject = async (transferId, payload) => {
  try {
    const isCommit = false
    const stateReason = 'Transaction failed due to user rejection' // TODO: move to generic reason
    const transfer = await TransferFacade.saveTransferFulfiled(transferId, payload, isCommit, stateReason)
    return TransferObjectTransform.toTransfer(transfer)
  } catch (err) {
    throw err
  }
}

const rejectExpired = () => {
  // TODO: create/recover findExpired method
  // const rejections = TransferFacade.findExpired().then(expired => expired.map(x => expire(x.transferId)))
  // return P.all(rejections).then(rejections => {
  //   return rejections.map(r => r.transfer.id)
  // })
}

const settle = async () => {
  const settlementId = SettlementModel.generateId()
  const settledTransfers = SettlementModel.create(settlementId, 'transfer').then(() => {
    return SettlementFacade.getSettleableTransfers().then(transfers => {
      transfers.forEach(transfer => {
        TransferFacade.saveSettledTransfers({id: transfer.transferId, settlement_id: settlementId})
      })
      return transfers
    })
  })

  return P.all(settledTransfers).then(settledTransfers => {
    if (settledTransfers.length > 0) {
      return settledTransfers
    } else {
      return P.resolve([])
    }
  })
}

const saveTransferStateChange = async (stateRecord) => {
  TransferStateChangeModel.saveTransferStateChange(stateRecord)
}

module.exports = {
  getTransferById,
  getById,
  getAll,
  getTransferState,
  getTransferInfoToChangePosition,
  getFulfilment,
  prepare,
  fulfil,
  reject,
  rejectExpired,
  settle,
  saveTransferStateChange,
  expire
}
