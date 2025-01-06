const TransferError = require('../../models/transfer/transferError')
const Db = require('../../lib/db')
const { TABLE_NAMES } = require('../../shared/constants')
const { rethrow } = require('@mojaloop/central-services-shared').Util

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
    rethrow.rethrowDatabaseError(err)
  }
}

const getLatest = async () => {
  try {
    return await Db.from('fxTransferStateChange').query(async (builder) => {
      return builder
        .select('fxTransferStateChangeId')
        .orderBy('fxTransferStateChangeId', 'desc')
        .first()
    })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

module.exports = {
  getByCommitRequestId,
  logTransferError,
  getLatest
}
