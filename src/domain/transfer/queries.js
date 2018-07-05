// TODO: remove and point directly to facade from index.js
'use strict'

const TransfersReadModel = require('../../models/transfer/facade')
// const TransferStateChange = require('./models/transferStateChange')

const getAll = () => {
  return TransfersReadModel.getAll()
}

const getById = (id) => {
  return TransfersReadModel.getById(id)
}

// const findExpired = () => {
//   return TransfersReadModel.findExpired()
// }

// const getTransferStateChangeById = async (id) => {
//   return await TransferStateChange.getByTransferId(id)
// }

// const saveTransferStateChange = async (transferStateChange) => {
//   return await TransferStateChange.saveTransferStateChange(transferStateChange)
// }

module.exports = {
  getAll,
  //  findExpired,
  getById // ,
  // getTransferStateChangeById,
  // saveTransferStateChange
}
