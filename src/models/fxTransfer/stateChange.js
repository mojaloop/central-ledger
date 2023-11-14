const ErrorHandler = require('@mojaloop/central-services-error-handling')
const TransferError = require('../../models/transfer/transferError')
const Db = require('../../lib/db')
const { TABLE_NAMES } = require('../../shared/constants')

const table = TABLE_NAMES.fxTransferStateChange

const getByCommitRequestId = async (id) => {
  return await Db.from(table).query(async (builder) => {
    return builder
      .where({ 'fxTransferStateChange.commitRequestId': id })
      .select('fxTransferStateChange.*')
      .orderBy('fxTransferStateChangeId', 'desc')
      .first()
  })
}

const logTransferError = async (id, errorCode, errorDescription) => {
  try {
    const stateChange = await getByCommitRequestId(id)
    // todo: check if stateChange is not null
    return TransferError.insert(id, stateChange.fxTransferStateChangeId, errorCode, errorDescription)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  getByCommitRequestId,
  logTransferError
}
