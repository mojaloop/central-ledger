'use strict'

const TransfersReadModel = require('./models/transfers-read-model')
// const TransferStateChange = require('./models/transferStateChanges')

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
