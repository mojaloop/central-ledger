const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Db = require('../../lib/db')
const { TABLE_NAMES } = require('../../shared/constants')

const table = TABLE_NAMES.fxTransfer

const getByIdLight = async (id) => {
  try {
    /** @namespace Db.fxTransfer **/
    return await Db.from(table).query(async (builder) => {
      return builder
        .where({ 'fxTransfer.commitRequestId': id })
        .leftJoin('fxTransferStateChange AS tsc', 'tsc.commitRequestId', 'fxTransfer.commitRequestId')
        .leftJoin('fxTransferState AS ts', 'ts.transferStateId', 'tsc.transferStateId')
        // todo: think, if we need participants and watchList here
        .select(
          'fxTransfer.*',
          'tsc.fxTransferStateChangeId',
          'tsc.fxTransferStateId AS fxTransferState',
          'ts.enumeration AS fxTransferStateEnumeration',
          'ts.description as fxTransferStateDescription',
          'tsc.reason AS reason',
          'tsc.createdDate AS completedTimestamp',
          'fxTransfer.ilpCondition AS condition'
        )
        .orderBy('tsc.fxTransferStateChangeId', 'desc')
        .first()
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  getByIdLight
}
